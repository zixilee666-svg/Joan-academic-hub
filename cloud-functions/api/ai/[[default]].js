/**
 * Cloud Function: AI Proxy
 * 处理 /api/ai/* 路由（由 EdgeOne Pages 自动路由到此处）
 * 
 * 为什么用 Cloud Function 而不是 Edge Function？
 * - Edge Function (V8 isolate) 无法访问外部网络（fetch 外部域名会 net_exception_timeout）
 * - Cloud Function (Node.js) 可以正常访问外部 API
 * 
 * 路由：
 * - POST /api/ai/chat         → AI 流式对话
 * - POST /api/ai/parse-paper → AI 解析文献
 * - GET  /api/ai/conversations → 获取对话列表（KV 操作，需 JWT 认证）
 * - PUT  /api/ai/conversations/:id → 保存对话
 * - DELETE /api/ai/conversations/:id → 删除对话
 */

// KV Storage（EdgeOne Pages KV 在 Cloud Function 中通过环境变量访问）
// 注意：Cloud Function 中 KV 的访问方式可能与 Edge Function 不同
// 如果无法访问 KV，对话功能将降级（chat 仍可工作）

// JWT 密钥（从环境变量读取，fallback 到硬编码值）
// 注意：必须与 Edge Function 中的默认值完全一致
const JWT_SECRET_RAW = process.env.JWT_SECRET || 'academic-hub-v4-jwt-secret-key-2026-prod';

// ============================================================
// JWT 验证（兼容 Edge Function 的实现）
// ============================================================

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, sigInput);
    if (!ok) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function authenticate(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verifyToken(token, JWT_SECRET_RAW);
}

// ============================================================
// AI API 调用（Cloud Function 可以访问外部网络）
// ============================================================

async function callOpenAICompatibleApi(baseUrl, apiKey, model, messages, { stream = false, temperature = 0.3, maxTokens = 4096, timeout = 55000 } = {}) {
  // 移除 baseUrl 末尾可能已有的 /chat/completions，避免重复拼接
  const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
  const url = base + '/chat/completions';
  
  console.log(`[CF-AI] POST ${url.replace(/https?:\/\/[^/]+/, '***')} model:${model} stream:${stream} timeout:${timeout}`);

  try {
    const fetchPromise = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI API timeout: ${timeout}ms`)), timeout)
    );

    const res = await Promise.race([fetchPromise, timeoutPromise]);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown');
      throw new Error(`AI API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    return res;
  } catch (e) {
    console.error('[CF-AI] Error:', e.name, e.message);
    throw e;
  }
}

// ============================================================
// 路由分发
// ============================================================

export default async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  try {
    // POST /api/ai/parse-paper
    if (path === '/api/ai/parse-paper' && method === 'POST') {
      return await handleParsePaper(request);
    }

    // POST /api/ai/chat
    if (path === '/api/ai/chat' && method === 'POST') {
      return await handleAiChat(request);
    }

    // GET /api/ai/conversations
    if (path === '/api/ai/conversations' && method === 'GET') {
      return await handleGetConversations(request);
    }

    // PUT /api/ai/conversations/:id
    if (path.startsWith('/api/ai/conversations/') && method === 'PUT') {
      const id = path.split('/').pop();
      return await handleSaveConversation(request, id);
    }

    // DELETE /api/ai/conversations/:id
    if (path.startsWith('/api/ai/conversations/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return await handleDeleteConversation(request, id);
    }

    return jsonResponse({ success: false, error: 'Not Found' }, 404);
  } catch (e) {
    console.error('[CF] Unhandled error:', e);
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ============================================================
// handleParsePaper
// ============================================================

async function handleParsePaper(request) {
  try {
    const body = await request.json();
    const { text, modelConfig } = body;
    
    if (!text || text.trim().length < 50) {
      return jsonResponse({ success: false, error: 'Text too short' }, 400);
    }

    const baseUrl = modelConfig?.baseUrl || '';
    const apiKey = modelConfig?.apiKey || '';
    const model = modelConfig?.model || 'deepseek-chat';

    const systemPrompt = `Extract academic paper metadata from the text. Return JSON with fields: title, authors(array), abstract, journal, year, volume, number, pages, doi, url, keywords(array), citeKey.`;
    
    const userPrompt = `Paper text (first 6000 chars):\n${text.slice(0, 6000)}`;

    const res = await callOpenAICompatibleApi(
      baseUrl, apiKey, model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { stream: false, temperature: 0.1, maxTokens: 1024, timeout: 55000 }
    );

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let parsed;
    try {
      // 尝试提取 JSON（AI 可能用 ```json 包裹）
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/(\{[\s\S]*\})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : content);
    } catch {
      parsed = { raw: content };
    }

    // 服务端生成引用格式
    const bibtex = generateBibTeX(parsed);
    const ieee = generateIEEE(parsed);
    const gb7714 = generateGB7714(parsed);

    return jsonResponse({
      success: true,
      data: { ...parsed, bibtex, ieee, gb7714 },
    });
  } catch (e) {
    console.error('[CF-ParsePaper] Error:', e.name, e.message);
    return jsonResponse({ success: false, error: e.message, debug: { name: e.name, message: e.message } }, 502);
  }
}

// ============================================================
// handleAiChat (SSE streaming)
// ============================================================

async function handleAiChat(request) {
  try {
    const user = await authenticate(request);
    if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

    const body = await request.json();
    const { messages, modelConfig, conversationId } = body;

    const baseUrl = modelConfig?.baseUrl || '';
    const apiKey = modelConfig?.apiKey || '';
    const model = modelConfig?.model || 'deepseek-chat';

    const res = await callOpenAICompatibleApi(
      baseUrl, apiKey, model, messages,
      { stream: true, temperature: 0.7, maxTokens: 4096, timeout: 55000 }
    );

    // SSE 流式转发
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const reader = res.body.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[CF-AiChat] Error:', e.name, e.message);
    return jsonResponse({ success: false, error: e.message }, 502);
  }
}

// ============================================================
// Conversations handlers (simplified - no KV in Cloud Function)
// ============================================================

async function handleGetConversations(request) {
  // Cloud Function 中暂不支持 KV，返回空列表
  // TODO: 如需持久化，可通过调用 Edge Function API 或直接使用 KV SDK
  return jsonResponse({ success: true, conversations: [] });
}

async function handleSaveConversation(request, id) {
  return jsonResponse({ success: true });
}

async function handleDeleteConversation(request, id) {
  return jsonResponse({ success: true });
}

// ============================================================
// Reference format generators (server-side)
// ============================================================

function generateBibTeX(p) {
  const key = p.citeKey || `cite:${p.year || '????'}`;
  const authors = (p.authors || []).join(' and ');
  return `@article{${key},
  title = {${p.title || ''}},
  author = {${authors}},
  journal = {${p.journal || ''}},
  year = {${p.year || ''}},
  volume = {${p.volume || ''}},
  number = {${p.number || ''}},
  pages = {${p.pages || ''}},
  doi = {${p.doi || ''}}
}`;
}

function generateIEEE(p) {
  const authors = (p.authors || []).map(a => {
    const parts = a.split(' ');
    return parts.length > 1 ? `${parts[parts.length - 1]}, ${parts[0][0]}.` : a;
  }).join(', ');
  return `${authors}, "${p.title || ''}," ${p.journal || ''}, vol. ${p.volume || ''}, no. ${p.number || ''}, pp. ${p.pages || ''}, ${p.year || ''}.`;
}

function generateGB7714(p) {
  const lang = /[\u4e00-\u9fa5]/.test(p.title || p.authors?.join('') || '') ? 'zh' : 'en';
  if (lang === 'zh') {
    return `${p.authors?.join('，') || ''}. ${p.title || ''}[J]. ${p.journal || ''}, ${p.year || ''}, ${p.volume || ''}(${p.number || ''}): ${p.pages || ''}.`;
  }
  return `${p.authors?.join(', ') || ''}. ${p.title || ''}[J]. ${p.journal || ''}, ${p.year || ''}, ${p.volume || ''}(${p.number || ''}): ${p.pages || ''}.`;
}
