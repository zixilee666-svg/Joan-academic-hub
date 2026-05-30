/**
 * Cloud Function: AI Proxy (路径: /api-ai/*)
 * 处理 AI 请求（需要外部网络访问，Edge Function V8 无法支持）
 * 
 * 路径设计: /api-ai/* 不会被 Edge Function (/api/*) 拦截
 * 为什么不用 /api/ai/*？因为 edge-functions/api/[[default]].js 会拦截所有 /api/* 请求
 * 
 * 路由：
 * - POST /api-ai/chat         → AI 流式对话 (SSE)
 * - POST /api-ai/parse-paper  → AI 解析文献
 */

// JWT 密钥（从环境变量读取）
const JWT_SECRET_RAW = (typeof process !== 'undefined' && process.env && process.env.JWT_SECRET) || 'academic-hub-v4-jwt-secret-key-2026-prod';

// ============================================================
// JWT 验证
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
// AI API 调用
// ============================================================

async function callOpenAICompatibleApi(baseUrl, apiKey, model, messages, { stream = false, temperature = 0.3, maxTokens = 4096, timeout = 20000 } = {}) {
  const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
  const url = base + '/chat/completions';
  
  console.log(`[CF-AI] POST ${url.replace(/https?:\/\/[^/]+/, '***')} model:${model} stream:${stream} timeout:${timeout}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
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
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown');
      throw new Error(`AI API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 路由分发
// ============================================================

export async function onRequest(context) {
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
    // POST /api-ai/parse-paper
    if (path === '/api-ai/parse-paper' && method === 'POST') {
      return await handleParsePaper(request);
    }

    // POST /api-ai/chat
    if (path === '/api-ai/chat' && method === 'POST') {
      return await handleAiChat(request);
    }

    return jsonResponse({ success: false, error: 'Not Found on AI endpoint' }, 404);
  } catch (e) {
    console.error('[CF-AI] Unhandled error:', e);
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

    const systemPrompt = `You are a scholarly paper metadata extractor. Given the text of a paper (title, authors, abstract section), extract metadata and output ONLY a valid JSON object.

Required JSON fields:
- "title": string, paper title
- "authors": string array, author full names
- "year": number, publication year
- "month": number or null, publication month 1-12
- "venue": string, journal or conference name
- "volume": string, volume number
- "issue": string, issue number
- "pages": string, page range e.g. "123-145"
- "doi": string, DOI identifier
- "url": string, paper URL if present
- "abstract": string, the abstract text
- "keywords": string array, keywords if present
- "references": array of { "title": string, "authors": string[], "year": number, "venue": string }

Output rules:
1. Output ONLY the JSON object, no markdown, no explanation, no code fences.
2. If a field cannot be found, use empty string "" or empty array [] or null.
3. The JSON must be valid and parseable.`;

    const truncatedText = text.slice(0, 3000);
    const userPrompt = `Extract metadata from this paper text:\n${truncatedText}`;

    const res = await callOpenAICompatibleApi(
      baseUrl, apiKey, model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { stream: false, temperature: 0.05, maxTokens: 1024, timeout: 55000 }
    );

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('[CF-ParsePaper] AI raw content length:', content.length);

    // 尝试 1：直接解析 JSON
    let parsed = tryParseJson(content);

    // 尝试 2：正则提取
    if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
      console.log('[CF-ParsePaper] JSON parse yielded empty, trying regex fallback...');
      parsed = extractWithRegex(content);
    }

    // 尝试 3：从原始文本提取
    if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
      console.log('[CF-ParsePaper] Regex fallback empty, trying from original text...');
      parsed = extractWithRegex(text.slice(0, 4000));
    }

    const result = {
      title: parsed.title || '',
      authors: Array.isArray(parsed.authors) ? parsed.authors : [],
      year: Number(parsed.year) || new Date().getFullYear(),
      month: parsed.month ?? null,
      venue: parsed.venue || parsed.journal || '',
      volume: parsed.volume || '',
      issue: parsed.issue || parsed.number || '',
      pages: parsed.pages || '',
      doi: parsed.doi || '',
      url: parsed.url || '',
      abstract: parsed.abstract || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
    };

    const hasMeaningfulData = result.title || result.authors.length > 0 || result.abstract;
    if (!hasMeaningfulData) {
      return jsonResponse({
        success: false,
        error: 'AI 未能从文本中提取到有效的文献信息，请检查文本内容或稍后重试',
      }, 422);
    }

    // 生成引用格式
    const bibtex = generateBibTeX(result);
    const ieee = generateIEEE(result);
    const gb7714 = generateGB7714(result);

    return jsonResponse({
      success: true,
      data: { ...result, citations: { bibtex, ieee, gb7714 } },
    });
  } catch (e) {
    console.error('[CF-ParsePaper] Error:', e.name, e.message);
    return jsonResponse({ success: false, error: e.message }, 502);
  }
}

function tryParseJson(str) {
  try {
    let jsonStr = str.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function extractWithRegex(text) {
  const result = {};
  const titleMatch = text.match(/(?:Title|题目)[:\s]*([^\n]{10,200})/i)
    || text.match(/^([A-Z][^\n.!?]{10,200})\n/gm);
  if (titleMatch) result.title = titleMatch[1].trim();
  const authorMatch = text.match(/(?:Authors|作者)[:\s]*([^\n]{5,200})/i);
  if (authorMatch) result.authors = authorMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const yearMatch = text.match(/(?:Year|年份|©)\s*[:\s]*(\d{4})/i)
    || text.match(/(\d{4})\s*(?:IEEE|ACM|Springer|Elsevier)/i);
  if (yearMatch) result.year = parseInt(yearMatch[1]);
  const abstractMatch = text.match(/(?:Abstract|摘要)[\s\S]{0,50}?([\s\S]{50,2000}?)(?:\n\s*\n|\n(?:Index|Keywords|I\.?\s+INTRODUCTION|\d+\.?\s+[A-Z]))/i);
  if (abstractMatch) result.abstract = abstractMatch[1].trim().replace(/\s+/g, ' ').slice(0, 1500);
  const venueMatch = text.match(/(?:Journal|Conference|Venue|期刊|会议)[:\s]*([^\n]{3,100})/i);
  if (venueMatch) result.venue = venueMatch[1].trim();
  const doiMatch = text.match(/DOI[:\s]*([^\s]{10,100})/i)
    || text.match(/(10\.\d{4,9}\/[\S]+)/i);
  if (doiMatch) result.doi = doiMatch[1].trim();
  return result;
}

// ============================================================
// handleAiChat (SSE streaming)
// ============================================================

async function handleAiChat(request) {
  try {
    const user = await authenticate(request);
    if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

    const body = await request.json();
    const { message, context, modelConfig, conversationId } = body;

    const baseUrl = modelConfig?.baseUrl || '';
    const apiKey = modelConfig?.apiKey || '';
    const model = modelConfig?.model || 'deepseek-chat';

    console.log('[CF-AiChat] model:', model, 'conversationId:', conversationId);

    const systemPrompt = `You are a helpful academic research assistant. When answering:
1. Be concise and direct. Avoid long introductory phrases.
2. Use bullet points (•) for structured answers. Keep each point under 2 sentences.
3. Do NOT use markdown formatting (no **bold**, no ## headers). Use plain text only.
4. If the question requires a long answer, summarize key points first, then elaborate briefly.
Always reply in the same language as the user's question.`;
    
    const messages = [{ role: 'system', content: systemPrompt }];
    if (context) {
      messages.push({ role: 'system', content: 'Additional context: ' + context });
    }
    if (message) {
      messages.push({ role: 'user', content: message });
    }

    if (messages.length === 0) {
      return jsonResponse({ success: false, error: 'Message is required' }, 400);
    }

    const res = await callOpenAICompatibleApi(
      baseUrl, apiKey, model, messages,
      { stream: true, temperature: 0.7, maxTokens: 4096, timeout: 28000 }
    );

    return new Response(res.body, {
      status: res.status,
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
// Reference format generators
// ============================================================

function generateBibTeX(p) {
  const authors = (p.authors || []).join(' and ');
  return `@article{cite:${p.year || '????'},
  title = {${p.title || ''}},
  author = {${authors}},
  journal = {${p.venue || ''}},
  year = {${p.year || ''}},
  volume = {${p.volume || ''}},
  number = {${p.issue || ''}},
  pages = {${p.pages || ''}},
  doi = {${p.doi || ''}}
}`;
}

function generateIEEE(p) {
  const authors = (p.authors || []).map(a => {
    const parts = a.split(' ');
    return parts.length > 1 ? `${parts[parts.length - 1]}, ${parts[0][0]}.` : a;
  }).join(', ');
  return `${authors}, "${p.title || ''}," ${p.venue || ''}, vol. ${p.volume || ''}, no. ${p.issue || ''}, pp. ${p.pages || ''}, ${p.year || ''}.`;
}

function generateGB7714(p) {
  const lang = /[\u4e00-\u9fa5]/.test(p.title || p.authors?.join('') || '') ? 'zh' : 'en';
  if (lang === 'zh') {
    return `${p.authors?.join('，') || ''}. ${p.title || ''}[J]. ${p.venue || ''}, ${p.year || ''}, ${p.volume || ''}(${p.issue || ''}): ${p.pages || ''}.`;
  }
  return `${p.authors?.join(', ') || ''}. ${p.title || ''}[J]. ${p.venue || ''}, ${p.year || ''}, ${p.volume || ''}(${p.issue || ''}): ${p.pages || ''}.`;
}
