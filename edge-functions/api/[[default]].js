/**
 * Joan's Academic Hub — Edge Functions API (v6.0 EdgeOne 正确适配版)
 * 处理所有 /api/* 路由
 *
 * 存储: EdgeOne KV Storage (全局变量 ACADEMIC_HUB_KV)
 *
 * 部署说明:
 * 1. 在 EdgeOne 控制台创建 KV 命名空间 "academic_hub_kv"
 * 2. 在项目中绑定 KV 命名空间到 Edge Functions，设置变量名为 "ACADEMIC_HUB_KV"
 * 3. 设置环境变量 JWT_SECRET
 *
 * ⚠️ 重要: KV 是全局变量，不是 context.env
 */

// ============================================================
// KV Storage 操作 (EdgeOne Pages KV 为全局变量)
// ============================================================

// EdgeOne Pages KV namespace 绑定后会作为全局变量注入
// 变量名与控制台绑定时设置的名称一致
let ACADEMIC_HUB_KV = typeof globalThis.ACADEMIC_HUB_KV !== 'undefined' ? globalThis.ACADEMIC_HUB_KV : null;

async function kvGet(key) {
  try {
    if (!ACADEMIC_HUB_KV) {
      console.error('[KV] KV not initialized');
      return null;
    }
    const value = await ACADEMIC_HUB_KV.get(key);
    return value || null;
  } catch (e) {
    console.error('[KV] Get error:', key, e);
    return null;
  }
}

async function kvSet(key, value) {
  try {
    if (!ACADEMIC_HUB_KV) {
      console.error('[KV] KV not initialized');
      return false;
    }
    await ACADEMIC_HUB_KV.put(key, value);
    return true;
  } catch (e) {
    console.error('[KV] Set error:', key, e);
    return false;
  }
}

async function kvDel(key) {
  try {
    if (!ACADEMIC_HUB_KV) return false;
    await ACADEMIC_HUB_KV.delete(key);
    return true;
  } catch (e) {
    console.error('[KV] Del error:', key, e);
    return false;
  }
}

async function kvHas(key) {
  try {
    if (!ACADEMIC_HUB_KV) return false;
    return await ACADEMIC_HUB_KV.get(key) !== null;
  } catch (e) {
    return false;
  }
}

// JSON 存储便捷方法
async function kvGetJson(key) {
  const v = await kvGet(key);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return v; }
}

async function kvSetJson(key, value) {
  return kvSet(key, JSON.stringify(value));
}

// 列表操作
async function kvListGet(listKey) {
  const list = await kvGetJson(listKey);
  return list || [];
}

async function kvListAdd(listKey, item) {
  const list = await kvListGet(listKey);
  if (!list.includes(item)) {
    list.push(item);
    await kvSetJson(listKey, list);
  }
}

async function kvListRemove(listKey, item) {
  const list = await kvListGet(listKey);
  const idx = list.indexOf(item);
  if (idx > -1) {
    list.splice(idx, 1);
    await kvSetJson(listKey, list);
  }
}

// ============================================================
// AI 对话持久化 (KV)
// ============================================================
const AI_CONV_INDEX_PREFIX = 'ai_conv_index:';
const AI_CONV_PREFIX = 'ai_conv:';

async function getConvIndex(userId) {
  return kvGetJson(AI_CONV_INDEX_PREFIX + userId) || [];
}

async function updateConvIndex(userId, convId, title, updatedAt) {
  const index = await getConvIndex(userId);
  const existing = index.find(c => c.id === convId);
  if (existing) {
    existing.title = title;
    existing.updatedAt = updatedAt;
  } else {
    index.unshift({ id: convId, title, updatedAt });
  }
  await kvSetJson(AI_CONV_INDEX_PREFIX + userId, index);
}

async function removeFromConvIndex(userId, convId) {
  const index = await getConvIndex(userId);
  await kvSetJson(AI_CONV_INDEX_PREFIX + userId, index.filter(c => c.id !== convId));
}

async function getConversation(userId, convId) {
  return kvGetJson(AI_CONV_PREFIX + userId + ':' + convId);
}

async function saveConversation(userId, convId, convData) {
  await kvSetJson(AI_CONV_PREFIX + userId + ':' + convId, convData);
  await updateConvIndex(userId, convId, convData.title || '未命名对话', convData.updatedAt || new Date().toISOString());
}

// ============================================================
// Generic OpenAI-compatible AI API
// Supports: Kimi, DeepSeek, Doubao, Claude(OpenAI-compat), OpenAI, Custom
// ============================================================
async function callOpenAICompatibleApi(baseUrl, apiKey, model, messages, { stream = false, temperature = 0.3, maxTokens = 4096 } = {}) {
  // 移除 baseUrl 末尾可能已有的 /chat/completions，避免重复拼接
  const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
  const url = base + '/chat/completions';
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
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`AI API error ${res.status}: ${errText}`);
  }

  return res;
}

// Parse paper metadata using any OpenAI-compatible API
async function handleParsePaper(request) {
  try {
    const body = await request.json();
    const { text, modelConfig } = body;
    const { baseUrl, apiKey, model } = modelConfig || {};

    if (!text || !apiKey || !baseUrl) {
      return apiError('text, apiKey and baseUrl are required', 400, 'VALIDATION_ERROR', request);
    }

    const systemPrompt = `你是学术文献元数据提取专家。请从用户提供的文献文本中精确提取以下结构化信息，并以纯 JSON 格式返回（不要包含 markdown 代码块标记，只返回 JSON 本身）。

【提取字段说明】
- title: 文献标题（字符串，保留原标题的大小写和特殊符号）
- authors: 作者列表（字符串数组，每个元素格式统一为"FirstName LastName"，如"John Smith"；中文作者保留原名）
- year: 发表年份（4位数字，如2024）
- month: 发表月份（1-12的数字，如无法提取则返回null）
- venue: 发表期刊或会议全称（字符串，如"IEEE Transactions on Pattern Analysis and Machine Intelligence"或"Proceedings of NeurIPS"）
- volume: 卷号（字符串或数字，如无法提取则返回空字符串）
- issue: 期号（字符串或数字，如无法提取则返回空字符串）
- pages: 页码范围（字符串，如"123-145"或"pp. 123-145"，如无法提取则返回空字符串）
- doi: DOI（字符串，格式为"10.xxxx/xxxx"，如无法提取则返回空字符串）
- url: 文献URL链接（字符串，如无法提取则返回空字符串）
- abstract: 摘要（字符串，完整提取，如无法提取则返回空字符串）
- keywords: 关键词列表（字符串数组，3-10个，从文本中提取或根据内容推断）
- bibtex: BibTeX 引用格式（字符串，格式如下所示，必须包含所有可用字段）
- ieee: IEEE 引用格式（字符串）
- gb7714: GB/T 7714-2015 引用格式（字符串，中文文献使用中文格式，英文使用英文格式）
- references: 参考文献列表（对象数组，每个对象包含 title, authors, year, venue；如文本中无参考文献则返回空数组）

【各字段提取指南】
1. DOI识别：在文本中搜索以"10."开头的字符串，通常格式为"10.xxxx/xxxx"，可能前面带有"DOI:","doi:","https://doi.org/"等前缀
2. 年份识别：搜索4位数字，优先选择发表年份（通常在标题附近或页脚），排除下载日期、审稿日期等
3. 月份识别：查找月份名称（January-December）或数字1-12，通常紧跟在年份附近
4. 页码识别：查找"pp.","pages","Page"等关键词后的数字范围，如"pp. 123-145"或"123-145"
5. 卷号/期号识别：查找"Vol.","Volume","No.","Issue"等关键词后的数字，或"XX(Y)"格式
6. 作者识别：查找"Author(s)","By","作者"等关键词后的姓名列表，注意区分通讯作者和共同作者
7. URL识别：查找"http://"或"https://"开头的链接
8. 期刊/会议名：查找出版社信息附近的全称，优先使用官方全称而非缩写

【引用格式生成规则】
BibTeX格式示例：
@article{key,
  title={...},
  author={... and ...},
  journal={...},
  year={...},
  volume={...},
  number={...},
  pages={...},
  doi={...}
}

IEEE格式示例：
F. Author et al., "Title," Journal, vol. X, no. Y, pp. Z, Month Year.

GB/T 7714格式示例：
[1] 作者. 标题[J]. 期刊名, 年, 卷(期): 页码. DOI:...

【重要约束】
1. 如果某项信息无法从文本中提取，使用空字符串、空数组或null（按字段说明）
2. 引用格式必须基于真实提取的信息生成，禁止编造不存在的字段
3. 只返回 JSON，不要有任何解释性文字、markdown代码块标记或额外注释
4. 确保 JSON 格式合法，所有字符串值正确转义`;

    const res = await callOpenAICompatibleApi(baseUrl, apiKey, model || 'moonshot-v1-32k', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请精确解析以下文献文本，提取所有可用的元数据信息：\n\n${text.slice(0, 30000)}` },
    ], { stream: false, temperature: 0.1, maxTokens: 8192 });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding JSON between first { and last }
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }
    }

    // Normalize authors field
    let authors = [];
    if (Array.isArray(parsed.authors)) {
      authors = parsed.authors.map(a => typeof a === 'string' ? a : (a.name || '')).filter(Boolean);
    }

    // Normalize references
    let references = [];
    if (Array.isArray(parsed.references)) {
      references = parsed.references.map(r => ({
        title: r.title || '',
        authors: Array.isArray(r.authors) ? r.authors.map(a => typeof a === 'string' ? a : (a.name || '')).filter(Boolean) : [],
        year: typeof r.year === 'number' ? r.year : (parseInt(r.year) || 0),
        venue: r.venue || '',
      }));
    }

    return success({
      title: parsed.title || '',
      authors: authors,
      year: typeof parsed.year === 'number' ? parsed.year : (parseInt(parsed.year) || new Date().getFullYear()),
      month: parsed.month !== undefined && parsed.month !== null ? (typeof parsed.month === 'number' ? parsed.month : parseInt(parsed.month) || null) : null,
      venue: parsed.venue || '',
      volume: parsed.volume !== undefined ? String(parsed.volume) : '',
      issue: parsed.issue !== undefined ? String(parsed.issue) : '',
      pages: parsed.pages || '',
      doi: parsed.doi || '',
      url: parsed.url || '',
      abstract: parsed.abstract || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      citations: {
        bibtex: parsed.bibtex || '',
        ieee: parsed.ieee || '',
        gb7714: parsed.gb7714 || '',
      },
      references: references,
    }, 'Paper parsed successfully', request);
  } catch (e) {
    console.error('[ParsePaper] Error:', e);
    return apiError('Failed to parse paper: ' + e.message, 502, 'AI_PARSE_ERROR', request);
  }
}

// AI Chat with any OpenAI-compatible API, supports SSE streaming
async function handleAiChat(request) {
  try {
    const body = await request.json();
    const { message, modelConfig, conversationId } = body;
    const { baseUrl, apiKey, model } = modelConfig || {};

    if (!message || !apiKey || !baseUrl) {
      return apiError('message, apiKey and baseUrl are required', 400, 'VALIDATION_ERROR', request);
    }

    const systemPrompt = '你是 Joan\'s Academic Hub 的学术助手，名为「贞德」。你擅长学术文献分析、研究方法指导和学术写作建议。回答应当严谨、专业、简洁。';

    // 构建消息列表（含历史上下文）
    const messages = [{ role: 'system', content: systemPrompt }];
    if (conversationId) {
      const authPayload = await authenticate(request, JWT_SECRET);
      if (authPayload) {
        const userId = authPayload.userId || authPayload.sub || 'anonymous';
        const conv = await getConversation(userId, conversationId);
        if (conv && conv.messages && conv.messages.length > 0) {
          // 包含最近 20 条消息作为上下文
          const recentMessages = conv.messages.slice(-20);
          messages.push(...recentMessages.map(m => ({ role: m.role, content: m.content })));
        }
      }
    }
    messages.push({ role: 'user', content: message });

    const res = await callOpenAICompatibleApi(baseUrl, apiKey, model || 'moonshot-v1-8k', messages, { stream: true, temperature: 0.7 });

    // Transform OpenAI SSE to our frontend format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode('data: {"done":true}\n\n'));
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: {"content":${JSON.stringify(content)}}\n\n`));
            }
          } catch { /* skip invalid SSE lines */ }
        }
      },
    });

    const transformed = res.body.pipeThrough(transformStream);

    return new Response(transformed, {
      status: 200,
      headers: {
        ...makeCorsHeaders(request),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    console.error('[AIChat] Error:', e);
    return apiError('AI service error: ' + e.message, 502, 'AI_SERVICE_ERROR', request);
  }
}

// ============================================================
// 工具函数
// ============================================================

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return origin || '*';
}

function makeCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, request) {
  const headers = { ...makeCorsHeaders(request), 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(data), { status, headers });
}

function success(data, message = 'Success', request) {
  return json({ success: true, data, message }, 200, request);
}

function apiError(message, status = 400, code = 'ERROR', request) {
  return json({ success: false, error: message, code }, status, request);
}

function unauthorized(request) {
  return apiError('Unauthorized', 401, 'UNAUTHORIZED', request);
}

function forbidden(request) {
  return apiError('Forbidden', 403, 'FORBIDDEN', request);
}

function notFound(message = 'Not found', request) {
  return apiError(message, 404, 'NOT_FOUND', request);
}

// ============================================================
// JWT 工具
// ============================================================

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

async function createSignature(data, JWT_SECRET) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function createToken(payload, JWT_SECRET) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const hEnc = base64UrlEncode(JSON.stringify(header));

  const now = Date.now();
  const expMs = 7 * 86400000; // 7 天
  const pEnc = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expMs) / 1000)
  }));

  const sig = await createSignature(hEnc + '.' + pEnc, JWT_SECRET);
  return hEnc + '.' + pEnc + '.' + sig;
}

async function verifyToken(token, JWT_SECRET) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const sigInput = parts[0] + '.' + parts[1];
    const expectedSig = await createSignature(sigInput, JWT_SECRET);
    if (expectedSig !== parts[2]) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function extractToken(request) {
  const auth = request.headers.get('Authorization');
  return auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function authenticate(request, JWT_SECRET) {
  const token = extractToken(request);
  if (!token) return null;
  return await verifyToken(token, JWT_SECRET);
}

async function requireAuth(request, JWT_SECRET) {
  const payload = await authenticate(request, JWT_SECRET);
  if (!payload) return unauthorized(request);
  return payload;
}

async function requireAdmin(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;
  if (payload.role !== 'admin') return forbidden(request);
  return payload;
}

// ============================================================
// 初始化管理员账户
// ============================================================

async function initAdmin() {
  const adminExists = await kvHas('users:admin');
  if (!adminExists) {
    await kvSetJson('users:admin', {
      id: 'admin',
      username: 'admin',
      displayName: 'Administrator',
      email: 'admin@academic-hub.local',
      passwordHash: await hashPassword('123456'),
      role: 'admin',
      institution: 'Joan Academic Hub',
      createdAt: new Date().toISOString()
    });
    await kvSet('users:by-username:admin', 'admin');
    await kvListAdd('users:index', 'admin');
    await kvListAdd('spaces:index', 'admin');
    await kvSetJson('spaces:admin', {
      username: 'admin',
      displayName: 'Administrator',
      bio: '',
      institution: 'Joan Academic Hub',
      theme: 'light',
      modules: ['papers', 'projects', 'library', 'chat'],
      social: { twitter: '', github: '', linkedin: '' },
      stats: { papers: 0, projects: 0, libraries: 0 },
      createdAt: new Date().toISOString()
    });
    console.log('[Init] Admin account created');
  }
}

// 简单密码哈希 (使用 Web Crypto API)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = 'academic-hub-salt-2026';
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 生成唯一 ID
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================
// 路由处理器 - 认证
// ============================================================

async function handleLogin(request, JWT_SECRET) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed', message: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(request) },
    });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return apiError('Username and password required', 400, 'VALIDATION_ERROR', request);
    }

    // 管理员特殊处理
    if (username === 'admin') {
      const admin = await kvGetJson('users:admin');
      if (admin && await verifyPassword(password, admin.passwordHash)) {
        const token = await createToken({ userId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET);
        const { passwordHash, ...safeUser } = admin;
        return success({ token, user: safeUser }, 'Login successful', request);
      }
      return unauthorized(request);
    }

    // 仅支持管理员账号登录
    return unauthorized(request);
  } catch (e) {
    console.error('[Login] Error:', e);
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

// 增强的注册处理器 - v2
async function handleRegister(request, JWT_SECRET) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  try {
    const body = await request.json();
    const { username, password, email, displayName, institution, researchField } = body;

    // 基本验证
    if (!username || !password) {
      return apiError('用户名和密码不能为空', 400, 'VALIDATION_ERROR', request);
    }

    // 用户名格式验证
    if (username.length < 3 || username.length > 20) {
      return apiError('用户名长度需在 3-20 个字符之间', 400, 'VALIDATION_ERROR', request);
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
      return apiError('用户名必须以字母开头，只能包含字母、数字和下划线', 400, 'VALIDATION_ERROR', request);
    }

    // 保留用户名检查
    const reservedUsernames = ['admin', 'root', 'system', 'user', 'joan', 'test', 'master', 'api', 'www'];
    if (reservedUsernames.includes(username.toLowerCase())) {
      return apiError('该用户名已被保留，请选择其他用户名', 409, 'CONFLICT', request);
    }

    // 密码强度验证
    if (password.length < 6) {
      return apiError('密码长度至少 6 位', 400, 'VALIDATION_ERROR', request);
    }
    
    // 密码强度检查
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (password.length < 8 && !hasUpperCase && !hasSpecial) {
      return apiError('密码强度太弱，建议使用至少 8 位并包含大小写字母和数字', 400, 'VALIDATION_ERROR', request);
    }

    // 检查用户名是否存在
    if (await kvHas('users:by-username:' + username)) {
      return apiError('该用户名已被使用', 409, 'CONFLICT', request);
    }

    // 邮箱格式验证（如果提供）
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError('请输入有效的邮箱地址', 400, 'VALIDATION_ERROR', request);
    }

    // 过滤 XSS 和特殊字符
    const sanitize = (str) => {
      if (!str) return '';
      return String(str).replace(/[<>'"]/g, '').trim().substring(0, 500);
    };

    const userId = generateId('user');
    const user = {
      id: userId,
      username,
      displayName: sanitize(displayName) || username,
      email: sanitize(email) || '',
      institution: sanitize(institution) || '',
      bio: '',
      avatar: '',
      role: 'user',
      isActive: true,
      researchField: sanitize(researchField) || '',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      stats: {
        papers: 0,
        projects: 0,
        libraries: 0,
      }
    };

    await kvSetJson('users:' + userId, user);
    await kvSet('users:by-username:' + username, userId);
    await kvListAdd('users:index', userId);
    await kvListAdd('spaces:index', username);

    // 初始化用户空间配置
    await kvSetJson('spaces:' + username, {
      username,
      displayName: user.displayName,
      bio: '',
      institution: user.institution,
      theme: 'light',
      modules: ['papers', 'projects', 'library', 'chat'],
      social: { twitter: '', github: '', linkedin: '' },
      stats: { papers: 0, projects: 0, libraries: 0 },
      createdAt: new Date().toISOString()
    });

    // 初始化用户数据索引
    await kvSetJson('users:' + userId + ':papers', []);
    await kvSetJson('users:' + userId + ':projects', []);
    await kvSetJson('users:' + userId + ':libraries', []);

    // 创建 Token
    const token = await createToken({ userId, username, role: user.role }, JWT_SECRET);
    
    // 返回安全用户信息（不包含密码哈希）
    const { passwordHash, ...safeUser } = user;
    
    console.log('[Register] New user registered:', username);
    return success({ token, user: safeUser }, '注册成功', request);
  } catch (e) {
    console.error('[Register] Error:', e);
    return apiError('注册请求处理失败', 400, 'BAD_REQUEST', request);
  }
}

async function handleMe(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const user = await kvGetJson('users:' + payload.userId);
  if (!user) return notFound('User not found', request);

  const { passwordHash, ...safeUser } = user;
  return success(safeUser, 'Success', request);
}

async function handleLogout(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed', message: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(request) },
    });
  }
  return success(null, 'Logout successful', request);
}

async function handleChangePassword(request, JWT_SECRET) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed', message: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(request) },
    });
  }

  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return apiError('Current password and new password are required', 400, 'VALIDATION_ERROR', request);
    }

    if (newPassword.length < 6) {
      return apiError('New password must be at least 6 characters', 400, 'VALIDATION_ERROR', request);
    }

    const user = await kvGetJson('users:' + payload.userId);
    if (!user) return notFound('User not found', request);

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return apiError('Current password is incorrect', 401, 'INVALID_PASSWORD', request);
    }

    // Hash and save new password
    user.passwordHash = await hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    await kvSetJson('users:' + payload.userId, user);

    console.log('[Password] Password changed for user:', payload.userId);
    return success(null, 'Password changed successfully', request);
  } catch (e) {
    console.error('[ChangePassword] Error:', e);
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

// ============================================================
// 路由处理器 - 用户管理 (管理员)
// ============================================================

async function handleGetUsers(request, JWT_SECRET) {
  const payload = await requireAdmin(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const userIds = await kvListGet('users:index');
  const users = [];

  for (const userId of userIds) {
    const user = await kvGetJson('users:' + userId);
    if (user) {
      const { passwordHash, ...safeUser } = user;
      users.push(safeUser);
    }
  }

  return success(users, 'Success', request);
}

async function handleGetUser(request, JWT_SECRET, userId) {
  await authenticate(request, JWT_SECRET);

  const user = await kvGetJson('users:' + userId);
  if (!user) return notFound('User not found', request);

  const { passwordHash, ...safeUser } = user;
  return success(safeUser, 'Success', request);
}

async function handleUpdateUser(request, JWT_SECRET, userId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  if (payload.userId !== userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  const user = await kvGetJson('users:' + userId);
  if (!user) return notFound('User not found', request);

  try {
    const body = await request.json();
    const { displayName, email, institution, bio, avatar, role, isActive } = body;

    if (displayName !== undefined) user.displayName = displayName;
    if (email !== undefined && (payload.role === 'admin' || payload.userId === userId)) user.email = email;
    if (institution !== undefined) user.institution = institution;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    // Admin-only fields
    if (payload.role === 'admin') {
      if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
    }

    user.updatedAt = new Date().toISOString();

    await kvSetJson('users:' + userId, user);

    if (body.username && body.username !== user.username) {
      if (await kvHas('users:by-username:' + body.username)) {
        return apiError('Username already exists', 409, 'CONFLICT', request);
      }
      await kvDel('users:by-username:' + user.username);
      await kvSet('users:by-username:' + body.username, userId);
      user.username = body.username;
    }

    const { passwordHash, ...safeUser } = user;
    return success(safeUser, 'User updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleDeleteUser(request, JWT_SECRET, userId) {
  const payload = await requireAdmin(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  if (userId === 'admin' || userId === 'user-joan') {
    return apiError('Cannot delete system account', 400, 'VALIDATION_ERROR', request);
  }

  const user = await kvGetJson('users:' + userId);
  if (!user) return notFound('User not found', request);

  await kvDel('users:' + userId);
  await kvDel('users:by-username:' + user.username);
  await kvListRemove('spaces:index', user.username);
  await kvDel('spaces:' + user.username);
  await kvDel('users:' + userId + ':papers');
  await kvDel('users:' + userId + ':projects');
  await kvDel('users:' + userId + ':libraries');

  const paperIds = await kvGetJson('users:' + userId + ':papers');
  for (const paperId of paperIds) {
    await kvDel('papers:' + paperId);
  }

  const projectIds = await kvGetJson('users:' + userId + ':projects');
  for (const projectId of projectIds) {
    await kvDel('projects:' + projectId);
  }

  const libIds = await kvGetJson('users:' + userId + ':libraries');
  for (const libId of libIds) {
    await kvDel('libraries:' + libId);
  }

  return success(null, 'User deleted', request);
}

// ============================================================
// 路由处理器 - 空间管理
// ============================================================

async function handleGetSpaces(request) {
  const spaceUsernames = await kvListGet('spaces:index');
  const spaces = [];

  for (const username of spaceUsernames) {
    const space = await kvGetJson('spaces:' + username);
    if (space) {
      spaces.push({
        username: space.username,
        displayName: space.displayName,
        bio: space.bio,
        institution: space.institution,
        researchField: space.researchField || '',
        avatar: space.avatar || '',
        paperCount: space.stats?.papers || 0,
        projectCount: space.stats?.projects || 0,
        viewCount: space.viewCount || 0,
        popularity: space.popularity || 0,
        lastActiveAt: space.lastActiveAt || space.createdAt,
        createdAt: space.createdAt
      });
    }
  }

  return success(spaces, 'Success', request);
}

async function handleGetSpace(request, username) {
  const space = await kvGetJson('spaces:' + username);
  if (!space) return notFound('Space not found', request);

  return success({
    username: space.username,
    displayName: space.displayName,
    bio: space.bio,
    institution: space.institution,
    researchField: space.researchField || '',
    avatar: space.avatar || '',
    paperCount: space.stats?.papers || 0,
    projectCount: space.stats?.projects || 0,
    viewCount: space.viewCount || 0,
    popularity: space.popularity || 0,
    lastActiveAt: space.lastActiveAt || space.createdAt,
    theme: space.theme,
    modules: space.modules,
    social: space.social,
    stats: space.stats,
    createdAt: space.createdAt
  }, 'Success', request);
}

async function handleUpdateSpace(request, JWT_SECRET, username) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  if (payload.username !== username && payload.role !== 'admin') {
    return forbidden(request);
  }

  const space = await kvGetJson('spaces:' + username);
  if (!space) return notFound('Space not found', request);

  try {
    const body = await request.json();
    const { displayName, bio, institution, theme, modules, social, avatar } = body;

    if (displayName !== undefined) space.displayName = displayName;
    if (bio !== undefined) space.bio = bio;
    if (institution !== undefined) space.institution = institution;
    if (theme !== undefined) space.theme = theme;
    if (modules !== undefined) space.modules = modules;
    if (social !== undefined) space.social = { ...space.social, ...social };
    if (avatar !== undefined) space.avatar = avatar;

    space.updatedAt = new Date().toISOString();

    await kvSetJson('spaces:' + username, space);

    const user = await kvGetJson('users:' + payload.userId);
    if (user) {
      if (displayName) user.displayName = displayName;
      user.updatedAt = new Date().toISOString();
      await kvSetJson('users:' + payload.userId, user);
    }

    return success(space, 'Space updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

// ============================================================
// 路由处理器 - 论文管理
// ============================================================

async function handleGetPapers(request, username) {
  const userId = await kvGet('users:by-username:' + username);
  if (!userId) return notFound('User not found', request);

  const paperIds = await kvGetJson('users:' + userId + ':papers') || [];
  const papers = [];

  for (const paperId of paperIds) {
    const paper = await kvGetJson('papers:' + paperId);
    if (paper) {
      papers.push({
        ...paper,
        citations: paper.citations || 0,
        pdfUrl: paper.pdfUrl || '',
        doi: paper.doi || '',
        isFavorited: paper.isFavorited ?? false,
        isRead: paper.isRead ?? false,
        readingStatus: paper.readingStatus || 'unread',
        notes: paper.notes || [],
        highlights: paper.highlights || [],
        keywords: paper.keywords || paper.tags || [],
        venueType: paper.venueType || 'conference',
        addedAt: paper.addedAt || paper.createdAt,
        url: paper.url || '',
      });
    }
  }

  return success(papers, 'Success', request);
}

async function handleCreatePaper(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { title, abstract, authors, year, venue, tags, pdfUrl } = body;

    if (!title) {
      return apiError('Title is required', 400, 'VALIDATION_ERROR', request);
    }

    const paperId = generateId('paper');
    const paper = {
      id: paperId,
      userId: payload.userId,
      username: payload.username,
      title,
      abstract: abstract || '',
      authors: authors || [],
      year: year || new Date().getFullYear(),
      venue: venue || '',
      tags: tags || [],
      citations: 0,
      pdfUrl: pdfUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvSetJson('papers:' + paperId, paper);
    await kvListAdd('users:' + payload.userId + ':papers', paperId);

    const space = await kvGetJson('spaces:' + payload.username);
    if (space) {
      space.stats.papers = (space.stats.papers || 0) + 1;
      await kvSetJson('spaces:' + payload.username, space);
    }

    return success(paper, 'Paper created', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleImportFromSearch(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { title, authors, year, venue, abstract, doi, url, tags, pdfUrl } = body;

    if (!title) {
      return apiError('Title is required', 400, 'VALIDATION_ERROR', request);
    }

    const paperId = generateId('paper');
    const paper = {
      id: paperId,
      userId: payload.userId,
      username: payload.username,
      title,
      abstract: abstract || '',
      authors: Array.isArray(authors) ? authors : (authors ? [authors] : []),
      year: year || new Date().getFullYear(),
      venue: venue || '',
      tags: tags || [],
      citations: 0,
      doi: doi || '',
      url: url || '',
      pdfUrl: pdfUrl || url || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvSetJson('papers:' + paperId, paper);
    await kvListAdd('users:' + payload.userId + ':papers', paperId);

    const space = await kvGetJson('spaces:' + payload.username);
    if (space) {
      space.stats.papers = (space.stats.papers || 0) + 1;
      await kvSetJson('spaces:' + payload.username, space);
    }

    return success(paper, 'Paper imported', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleGetPaper(request, paperId) {
  const paper = await kvGetJson('papers:' + paperId);
  if (!paper) return notFound('Paper not found', request);

  return success({
    id: paper.id,
    userId: paper.userId,
    username: paper.username,
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    tags: paper.tags,
    citations: paper.citations || 0,
    pdfUrl: paper.pdfUrl || '',
    doi: paper.doi || '',
    createdAt: paper.createdAt,
    updatedAt: paper.updatedAt
  }, 'Success', request);
}

async function handleUpdatePaper(request, JWT_SECRET, paperId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const paper = await kvGetJson('papers:' + paperId);
  if (!paper) return notFound('Paper not found', request);

  if (paper.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  try {
    const body = await request.json();
    const { title, abstract, authors, year, venue, tags, pdfUrl, doi } = body;

    if (title !== undefined) paper.title = title;
    if (abstract !== undefined) paper.abstract = abstract;
    if (authors !== undefined) paper.authors = authors;
    if (year !== undefined) paper.year = year;
    if (venue !== undefined) paper.venue = venue;
    if (tags !== undefined) paper.tags = tags;
    if (pdfUrl !== undefined) paper.pdfUrl = pdfUrl;
    if (doi !== undefined) paper.doi = doi;
    paper.updatedAt = new Date().toISOString();

    await kvSetJson('papers:' + paperId, paper);
    return success(paper, 'Paper updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleDeletePaper(request, JWT_SECRET, paperId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const paper = await kvGetJson('papers:' + paperId);
  if (!paper) return notFound('Paper not found', request);

  if (paper.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  await kvDel('papers:' + paperId);
  await kvListRemove('users:' + paper.userId + ':papers', paperId);

  const space = await kvGetJson('spaces:' + paper.username);
  if (space && space.stats.papers > 0) {
    space.stats.papers -= 1;
    await kvSetJson('spaces:' + paper.username, space);
  }

  return success(null, 'Paper deleted', request);
}

// ============================================================
// 路由处理器 - 项目管理
// ============================================================

async function handleGetProjects(request, username) {
  const userId = await kvGet('users:by-username:' + username);
  if (!userId) return notFound('User not found', request);

  const projectIds = await kvGetJson('users:' + userId + ':projects') || [];
  const projects = [];

  for (const projectId of projectIds) {
    const project = await kvGetJson('projects:' + projectId);
    if (project) {
      projects.push({
        ...project,
        progress: project.progress ?? 0,
        goalCount: project.goalCount ?? (project.objectives?.length || 0),
        completedGoals: project.completedGoals ?? (project.objectives?.filter(o => o.completed)?.length || 0),
        targetDate: project.targetDate || project.endDate || '',
        paperIds: project.paperIds || [],
      });
    }
  }

  return success(projects, 'Success', request);
}

async function handleCreateProject(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { name, description, status, progress, tags, startDate, endDate, objectives } = body;

    if (!name) {
      return apiError('Project name is required', 400, 'VALIDATION_ERROR', request);
    }

    const projectId = generateId('project');
    const project = {
      id: projectId,
      userId: payload.userId,
      username: payload.username,
      name,
      description: description || '',
      status: status || 'active',
      progress: progress || 0,
      tags: tags || [],
      startDate: startDate || '',
      endDate: endDate || '',
      objectives: objectives || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvSetJson('projects:' + projectId, project);
    await kvListAdd('users:' + payload.userId + ':projects', projectId);

    const space = await kvGetJson('spaces:' + payload.username);
    if (space) {
      space.stats.projects = (space.stats.projects || 0) + 1;
      await kvSetJson('spaces:' + payload.username, space);
    }

    return success(project, 'Project created', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleGetProject(request, projectId) {
  const project = await kvGetJson('projects:' + projectId);
  if (!project) return notFound('Project not found', request);

  return success(project, 'Success', request);
}

async function handleUpdateProject(request, JWT_SECRET, projectId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const project = await kvGetJson('projects:' + projectId);
  if (!project) return notFound('Project not found', request);

  if (project.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  try {
    const body = await request.json();
    const { name, description, status, progress, tags, startDate, endDate, objectives, paperIds, relatedPaperIds } = body;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (progress !== undefined) project.progress = progress;
    if (tags !== undefined) project.tags = tags;
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;
    if (objectives !== undefined) project.objectives = objectives;
    if (paperIds !== undefined) project.paperIds = paperIds;
    if (relatedPaperIds !== undefined) project.relatedPaperIds = relatedPaperIds;
    project.updatedAt = new Date().toISOString();

    await kvSetJson('projects:' + projectId, project);
    return success(project, 'Project updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleDeleteProject(request, JWT_SECRET, projectId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const project = await kvGetJson('projects:' + projectId);
  if (!project) return notFound('Project not found', request);

  if (project.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  await kvDel('projects:' + projectId);
  await kvListRemove('users:' + project.userId + ':projects', projectId);

  const space = await kvGetJson('spaces:' + project.username);
  if (space && space.stats.projects > 0) {
    space.stats.projects -= 1;
    await kvSetJson('spaces:' + project.username, space);
  }

  return success(null, 'Project deleted', request);
}

// ============================================================
// 路由处理器 - 文献库管理
// ============================================================

async function handleGetLibraries(request, username) {
  const userId = await kvGet('users:by-username:' + username);
  if (!userId) return notFound('User not found', request);

  const libIds = await kvGetJson('users:' + userId + ':libraries') || [];
  const libraries = [];

  for (const libId of libIds) {
    const lib = await kvGetJson('libraries:' + libId);
    if (lib) {
      libraries.push({
        ...lib,
        color: lib.color || '#3d5a80',
        icon: lib.icon || 'Library',
        paperIds: lib.paperIds || lib.papers || [],
        isDefault: lib.isDefault || false,
      });
    }
  }

  return success(libraries, 'Success', request);
}

async function handleCreateLibrary(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { name, description, tags } = body;

    if (!name) {
      return apiError('Library name is required', 400, 'VALIDATION_ERROR', request);
    }

    const libId = generateId('lib');
    const lib = {
      id: libId,
      userId: payload.userId,
      username: payload.username,
      name,
      description: description || '',
      tags: tags || [],
      papers: [],
      paperCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvSetJson('libraries:' + libId, lib);
    await kvListAdd('users:' + payload.userId + ':libraries', libId);

    const space = await kvGetJson('spaces:' + payload.username);
    if (space) {
      space.stats.libraries = (space.stats.libraries || 0) + 1;
      await kvSetJson('spaces:' + payload.username, space);
    }

    const response = {
      ...lib,
      color: lib.color || '#3d5a80',
      icon: lib.icon || 'Library',
      paperIds: lib.papers || [],
      isDefault: false,
    };
    return success(response, 'Library created', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleGetLibrary(request, libId) {
  const lib = await kvGetJson('libraries:' + libId);
  if (!lib) return notFound('Library not found', request);

  return success(lib, 'Success', request);
}

async function handleUpdateLibrary(request, JWT_SECRET, libId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const lib = await kvGetJson('libraries:' + libId);
  if (!lib) return notFound('Library not found', request);

  if (lib.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  try {
    const body = await request.json();
    const { name, description, tags, papers } = body;

    if (name !== undefined) lib.name = name;
    if (description !== undefined) lib.description = description;
    if (tags !== undefined) lib.tags = tags;
    if (papers !== undefined) {
      lib.papers = papers;
      lib.paperCount = papers.length;
    }
    lib.updatedAt = new Date().toISOString();

    await kvSetJson('libraries:' + libId, lib);
    const response = {
      ...lib,
      color: lib.color || '#3d5a80',
      icon: lib.icon || 'Library',
      paperIds: lib.papers || [],
      isDefault: lib.isDefault || false,
    };
    return success(response, 'Library updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleAddPaperToLibrary(request, JWT_SECRET, libId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const lib = await kvGetJson('libraries:' + libId);
  if (!lib) return notFound('Library not found', request);

  if (lib.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  try {
    const body = await request.json();
    const { paperId } = body;
    if (!paperId) {
      return apiError('paperId is required', 400, 'VALIDATION_ERROR', request);
    }

    const papers = lib.papers || [];
    if (!papers.includes(paperId)) {
      papers.push(paperId);
      lib.papers = papers;
      lib.paperCount = papers.length;
      lib.updatedAt = new Date().toISOString();
      await kvSetJson('libraries:' + libId, lib);
    }

    const response = {
      ...lib,
      color: lib.color || '#3d5a80',
      icon: lib.icon || 'Library',
      paperIds: lib.papers || [],
      isDefault: lib.isDefault || false,
    };
    return success(response, 'Paper added to library', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleDeleteLibrary(request, JWT_SECRET, libId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const lib = await kvGetJson('libraries:' + libId);
  if (!lib) return notFound('Library not found', request);

  if (lib.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  await kvDel('libraries:' + libId);
  await kvListRemove('users:' + lib.userId + ':libraries', libId);

  const space = await kvGetJson('spaces:' + lib.username);
  if (space && space.stats.libraries > 0) {
    space.stats.libraries -= 1;
    await kvSetJson('spaces:' + lib.username, space);
  }

  return success(null, 'Library deleted', request);
}

// ============================================================
// 路由处理器 - 统计信息 (管理员)
// ============================================================

async function handleGetStats(request, JWT_SECRET) {
  const payload = await requireAdmin(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const userIds = await kvListGet('users:index');

  let totalPapers = 0, totalProjects = 0, totalLibraries = 0;

  for (const userId of userIds) {
    const papers = await kvGetJson('users:' + userId + ':papers') || [];
    const projects = await kvGetJson('users:' + userId + ':projects') || [];
    const libraries = await kvGetJson('users:' + userId + ':libraries') || [];
    totalPapers += papers.length;
    totalProjects += projects.length;
    totalLibraries += libraries.length;
  }

  return success({
    users: userIds.length,
    papers: totalPapers,
    projects: totalProjects,
    libraries: totalLibraries,
    spaces: userIds.length
  }, 'Success', request);
}

// ============================================================
// 路由处理器 - 资料 (Materials)
// ============================================================

async function handleGetMaterials(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const materialIds = await kvGetJson('users:' + payload.userId + ':materials') || [];
  const materials = [];

  for (const id of materialIds) {
    const mat = await kvGetJson('materials:' + id);
    if (mat) {
      const { userId, ...safe } = mat;
      materials.push(safe);
    }
  }

  return success(materials, 'Success', request);
}

async function handleCreateMaterial(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const { title, type, category, description, content, fileName, fileSize, fileUrl, tags } = body;

    if (!title) {
      return apiError('Title is required', 400, 'VALIDATION_ERROR', request);
    }

    const materialId = generateId('mat');
    const material = {
      id: materialId,
      userId: payload.userId,
      username: payload.username,
      title,
      type: type || 'file',
      category: category || 'other',
      description: description || '',
      content: content || '',
      fileName: fileName || '',
      fileSize: fileSize || 0,
      fileUrl: fileUrl || '',
      tags: tags || [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvSetJson('materials:' + materialId, material);
    await kvListAdd('users:' + payload.userId + ':materials', materialId);

    const { userId: _, ...safe } = material;
    return success(safe, 'Material created', request);
  } catch (e) {
    console.error('[CreateMaterial] Error:', e);
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleGetMaterial(request, materialId) {
  const material = await kvGetJson('materials:' + materialId);
  if (!material) return notFound('Material not found', request);

  const { userId, ...safe } = material;
  return success(safe, 'Success', request);
}

async function handleGetPublicMaterials(request, username) {
  const userId = await kvGet('users:by-username:' + username);
  if (!userId) return notFound('User not found', request);

  const materialIds = await kvGetJson('users:' + userId + ':materials') || [];
  const materials = [];

  for (const id of materialIds) {
    const mat = await kvGetJson('materials:' + id);
    if (mat) {
      const { userId: _, ...safe } = mat;
      materials.push(safe);
    }
  }

  return success(materials, 'Success', request);
}

async function handleUpdateMaterial(request, JWT_SECRET, materialId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const material = await kvGetJson('materials:' + materialId);
  if (!material) return notFound('Material not found', request);

  if (material.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  try {
    const body = await request.json();
    const { title, type, category, description, content, fileName, fileSize, fileUrl, tags, isFavorite } = body;

    if (title !== undefined) material.title = title;
    if (type !== undefined) material.type = type;
    if (category !== undefined) material.category = category;
    if (description !== undefined) material.description = description;
    if (content !== undefined) material.content = content;
    if (fileName !== undefined) material.fileName = fileName;
    if (fileSize !== undefined) material.fileSize = fileSize;
    if (fileUrl !== undefined) material.fileUrl = fileUrl;
    if (tags !== undefined) material.tags = tags;
    if (isFavorite !== undefined) material.isFavorite = isFavorite;
    material.updatedAt = new Date().toISOString();

    await kvSetJson('materials:' + materialId, material);

    const { userId, ...safe } = material;
    return success(safe, 'Material updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

async function handleDeleteMaterial(request, JWT_SECRET, materialId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const material = await kvGetJson('materials:' + materialId);
  if (!material) return notFound('Material not found', request);

  if (material.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  await kvDel('materials:' + materialId);
  await kvListRemove('users:' + material.userId + ':materials', materialId);

  return success(null, 'Material deleted', request);
}

async function handleToggleMaterialFavorite(request, JWT_SECRET, materialId) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const material = await kvGetJson('materials:' + materialId);
  if (!material) return notFound('Material not found', request);

  if (material.userId !== payload.userId && payload.role !== 'admin') {
    return forbidden(request);
  }

  material.isFavorite = !material.isFavorite;
  await kvSetJson('materials:' + materialId, material);

  return success({ isFavorite: material.isFavorite }, 'Success', request);
}

// ============================================================
// 路由处理器 - 用户设置
// ============================================================

const DEFAULT_SETTINGS = {
  theme: 'system',
  citationFormat: 'ieee',
  language: 'zh-CN',
  autoSave: true,
  notifications: {
    newPapers: true,
    readingReminders: true,
    projectUpdates: true,
    pointsChange: false,
  },
};

async function handleGetSettings(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  const settings = await kvGetJson('users:settings:' + payload.userId);
  return success(settings || DEFAULT_SETTINGS, 'Success', request);
}

async function handleUpdateSettings(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const body = await request.json();
    const current = await kvGetJson('users:settings:' + payload.userId) || { ...DEFAULT_SETTINGS };
    const updated = { ...current, ...body, updatedAt: new Date().toISOString() };
    await kvSetJson('users:settings:' + payload.userId, updated);
    return success(updated, 'Settings updated', request);
  } catch (e) {
    return apiError('Invalid request', 400, 'BAD_REQUEST', request);
  }
}

// ============================================================
// 路由处理器 - 批量导入
// ============================================================

async function handleBatchImport(request, JWT_SECRET) {
  const payload = await requireAuth(request, JWT_SECRET);
  if (payload instanceof Response) return payload;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return apiError('No file uploaded', 400, 'VALIDATION_ERROR', request);
    }

    const text = await file.text();
    const fileName = file.name || 'imported-file';
    const ext = fileName.split('.').pop()?.toLowerCase();

    let imported = 0;

    if (ext === 'json') {
      try {
        const data = JSON.parse(text);
        const papers = Array.isArray(data) ? data : (data.papers || [data]);
        for (const p of papers) {
          const paperId = generateId('paper');
          const paper = {
            id: paperId,
            userId: payload.userId,
            username: payload.username,
            title: p.title || 'Untitled',
            authors: Array.isArray(p.authors) ? p.authors : (p.authors ? p.authors.split(/,\s*|\s+and\s+/i) : []),
            year: p.year || new Date().getFullYear(),
            venue: p.venue || '',
            abstract: p.abstract || '',
            tags: p.tags || [],
            citations: p.citations || 0,
            doi: p.doi || '',
            createdAt: new Date().toISOString(),
          };
          await kvSetJson('papers:' + paperId, paper);
          await kvListAdd('users:' + payload.userId + ':papers', paperId);
          imported++;
        }
      } catch (e) {
        return apiError('Invalid JSON format', 400, 'VALIDATION_ERROR', request);
      }
    } else if (ext === 'bib' || ext === 'bibtex') {
      const entries = text.match(/@\w+\s*\{[\s\S]*?\n\s*\}/g) || [];
      for (const entry of entries) {
        const titleMatch = entry.match(/title\s*=\s*\{([^}]*)\}/);
        const authorMatch = entry.match(/author\s*=\s*\{([^}]*)\}/);
        const yearMatch = entry.match(/year\s*=\s*(\d{4})/);
        const venueMatch = entry.match(/(?:journal|booktitle)\s*=\s*\{([^}]*)\}/);
        const abstractMatch = entry.match(/abstract\s*=\s*\{([^}]*)\}/);

        const paperId = generateId('paper');
        const paper = {
          id: paperId,
          userId: payload.userId,
          username: payload.username,
          title: titleMatch ? titleMatch[1] : 'Untitled',
          authors: authorMatch ? authorMatch[1].split(/\s+and\s+/i) : [],
          year: yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(),
          venue: venueMatch ? venueMatch[1] : '',
          abstract: abstractMatch ? abstractMatch[1] : '',
          tags: [],
          citations: 0,
          createdAt: new Date().toISOString(),
        };
        await kvSetJson('papers:' + paperId, paper);
        await kvListAdd('users:' + payload.userId + ':papers', paperId);
        imported++;
      }
    } else if (ext === 'csv') {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const paperId = generateId('paper');
          const paper = {
            id: paperId,
            userId: payload.userId,
            username: payload.username,
            title: values[0] || 'Untitled',
            authors: values[1] ? values[1].split(';').map(a => a.trim()) : [],
            year: parseInt(values[2]) || new Date().getFullYear(),
            venue: values[3] || '',
            abstract: values[4] || '',
            tags: [],
            citations: 0,
            createdAt: new Date().toISOString(),
          };
          await kvSetJson('papers:' + paperId, paper);
          await kvListAdd('users:' + payload.userId + ':papers', paperId);
          imported++;
        }
      }
    } else if (ext === 'ris') {
      const entries = text.split('ER  -').filter(e => e.includes('TY  -'));
      for (const entry of entries) {
        const titleMatch = entry.match(/TI\s*-\s*(.*)/);
        const authorMatch = entry.match(/AU\s*-\s*(.*)/);
        const yearMatch = entry.match(/PY\s*-\s*(\d{4})/);
        const venueMatch = entry.match(/JO\s*-\s*(.*)/);

        const paperId = generateId('paper');
        const paper = {
          id: paperId,
          userId: payload.userId,
          username: payload.username,
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          authors: authorMatch ? [authorMatch[1].trim()] : [],
          year: yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(),
          venue: venueMatch ? venueMatch[1].trim() : '',
          abstract: '',
          tags: [],
          citations: 0,
          createdAt: new Date().toISOString(),
        };
        await kvSetJson('papers:' + paperId, paper);
        await kvListAdd('users:' + payload.userId + ':papers', paperId);
        imported++;
      }
    } else if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
      // Create as material
      const materialId = generateId('mat');
      const material = {
        id: materialId,
        userId: payload.userId,
        username: payload.username,
        title: fileName.replace(/\.[^.]+$/, ''),
        type: ext === 'md' || ext === 'markdown' ? 'markdown' : 'note',
        category: 'notes',
        description: '',
        content: text.substring(0, 50000), // Limit content size
        fileName: fileName,
        fileSize: text.length,
        fileUrl: '',
        tags: [],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await kvSetJson('materials:' + materialId, material);
      await kvListAdd('users:' + payload.userId + ':materials', materialId);
      imported++;
    } else if (ext === 'pdf' || ext === 'docx') {
      // Create as material without content extraction
      const materialId = generateId('mat');
      const material = {
        id: materialId,
        userId: payload.userId,
        username: payload.username,
        title: fileName.replace(/\.[^.]+$/, ''),
        type: ext === 'pdf' ? 'pdf' : 'file',
        category: 'other',
        description: `Imported ${ext.toUpperCase()} file`,
        content: '',
        fileName: fileName,
        fileSize: text.length,
        fileUrl: '',
        tags: [],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await kvSetJson('materials:' + materialId, material);
      await kvListAdd('users:' + payload.userId + ':materials', materialId);
      imported++;
    } else {
      return apiError(`Unsupported file format: .${ext}`, 400, 'VALIDATION_ERROR', request);
    }

    return success({ imported }, 'Import completed', request);
  } catch (e) {
    console.error('[BatchImport] Error:', e);
    return apiError('Import failed', 400, 'BAD_REQUEST', request);
  }
}

// ============================================================
// 主入口 (Edge Functions 命名导出方式)
// ============================================================

// ---- 系统监控辅助函数 ----
async function recordRequestMetrics(request, response, durationMs) {
  try {
    const isError = response && (response.status >= 400 || response.status === 0);
    // 总请求数
    const requests = parseInt(await kvGet('system:metrics:requests') || '0', 10);
    await kvSet('system:metrics:requests', String(requests + 1));
    // 错误数
    if (isError) {
      const errors = parseInt(await kvGet('system:metrics:errors') || '0', 10);
      await kvSet('system:metrics:errors', String(errors + 1));
    }
    // 总响应时间
    const totalTime = parseInt(await kvGet('system:metrics:responseTime') || '0', 10);
    await kvSet('system:metrics:responseTime', String(totalTime + Math.round(durationMs)));
    // 记录启动时间（首次请求时）
    const startup = await kvGet('system:metrics:startup');
    if (!startup) {
      await kvSet('system:metrics:startup', String(Date.now()));
    }
    // 记录最近请求时间（用于计算 24h 请求）
    const recentKey = 'system:metrics:recent:' + Math.floor(Date.now() / 1000);
    await kvSet(recentKey, '1', { expirationTtl: 86400 });
    // 记录每日请求计数
    const today = new Date().toISOString().slice(0, 10);
    const todayVal = parseInt(await kvGet('system:metrics:daily:' + today) || '0', 10);
    await kvSet('system:metrics:daily:' + today, String(todayVal + 1));
  } catch (e) {
    // 监控记录失败不应影响主请求
  }
}

async function logActivity(action, target, user, status) {
  try {
    const activities = await kvGetJson('system:activities') || [];
    const entry = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      action,
      target: target || '',
      user: user || 'system',
      status: status || 'success',
      time: new Date().toISOString(),
    };
    activities.unshift(entry);
    if (activities.length > 30) activities.length = 30;
    await kvSetJson('system:activities', activities);
  } catch (e) {
    // 日志记录失败不应影响主请求
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  // 初始化 KV Storage (EdgeOne Pages KV 为全局变量，非 env 属性)
  if (!ACADEMIC_HUB_KV && typeof globalThis.ACADEMIC_HUB_KV !== 'undefined') {
    ACADEMIC_HUB_KV = globalThis.ACADEMIC_HUB_KV;
  }

  // 从环境变量获取 JWT_SECRET
  const JWT_SECRET = env.JWT_SECRET || 'academic-hub-v4-jwt-secret-key-2026-prod';

  // 初始化系统账户
  await initAdmin();

  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: makeCorsHeaders(request) });
  }

  const startTime = Date.now();
  let response = null;

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const segments = path.split('/').filter(Boolean);

  // 路由分发
  // ========================================
  // 认证路由
  // ========================================
  if (segments[0] === 'auth') {
    if (segments[1] === 'login') return handleLogin(request, JWT_SECRET);
    if (segments[1] === 'register') return handleRegister(request, JWT_SECRET);
    if (segments[1] === 'me') return handleMe(request, JWT_SECRET);
    if (segments[1] === 'logout') return handleLogout(request);
    if (segments[1] === 'change-password') return handleChangePassword(request, JWT_SECRET);
  }

  // ========================================
  // 用户管理路由 (管理员)
  // ========================================
  if (segments[0] === 'users') {
    if (segments.length === 1) return handleGetUsers(request, JWT_SECRET);
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetUser(request, JWT_SECRET, segments[1]);
      if (request.method === 'PUT') return handleUpdateUser(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeleteUser(request, JWT_SECRET, segments[1]);
    }
  }

  // ========================================
  // 空间路由
  // ========================================
  if (segments[0] === 'spaces') {
    if (segments.length === 1) return handleGetSpaces(request);
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetSpace(request, segments[1]);
      if (request.method === 'PUT') return handleUpdateSpace(request, JWT_SECRET, segments[1]);
    }
    if (segments.length === 3 && segments[2] === 'materials' && request.method === 'GET') {
      return handleGetPublicMaterials(request, segments[1]);
    }
  }

  // ========================================
  // 论文批量导入
  // ========================================
  if (segments[0] === 'papers' && segments.length === 2 && segments[1] === 'batch-import' && request.method === 'POST') {
    return handleBatchImport(request, JWT_SECRET);
  }

  // ========================================
  // 论文路由
  // ========================================
  if (segments[0] === 'papers') {
    // GET /papers - 当前用户论文列表
    if (segments.length === 1 && request.method === 'GET') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      return handleGetPapers(request, payload.username);
    }
    // POST /papers/:id/favorite - 切换收藏
    if (segments.length === 3 && segments[2] === 'favorite' && request.method === 'POST') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const paper = await kvGetJson('papers:' + segments[1]);
      if (!paper) return notFound('Paper not found', request);
      paper.isFavorited = !paper.isFavorited;
      await kvSetJson('papers:' + segments[1], paper);
      return success({ isFavorited: paper.isFavorited }, 'Success', request);
    }
    if (request.method === 'POST') return handleCreatePaper(request, JWT_SECRET);
    // GET /papers/export - 导出文献
    if (segments.length === 2 && segments[1] === 'export' && request.method === 'GET') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const url = new URL(request.url);
      const format = url.searchParams.get('format') || 'json';
      const paperIds = await kvGetJson('users:' + payload.userId + ':papers') || [];
      const allPapers = [];
      for (const pid of paperIds) {
        const p = await kvGetJson('papers:' + pid);
        if (p) allPapers.push(p);
      }
      if (format === 'bibtex') {
        const bibtex = allPapers.map(p => {
          const key = p.id || 'ref' + Math.random().toString(36).substr(2, 6);
          return `@article{${key},\n  title={${p.title || ''}},\n  author={${(p.authors || []).join(' and ')}},\n  year={${p.year || ''}},\n  journal={${p.venue || ''}}\n}`;
        }).join('\n\n');
        return new Response(bibtex, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...makeCorsHeaders(request) } });
      }
      if (format === 'csv') {
        const header = 'id,title,authors,year,venue\n';
        const rows = allPapers.map(p => [
          p.id, p.title, (p.authors || []).join(';'), p.year, p.venue
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(header + rows, { headers: { 'Content-Type': 'text/csv; charset=utf-8', ...makeCorsHeaders(request) } });
      }
      return success({ papers: allPapers, count: allPapers.length }, 'Success', request);
    }
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetPaper(request, segments[1]);
      if (request.method === 'PUT') return handleUpdatePaper(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeletePaper(request, JWT_SECRET, segments[1]);
    }
    // Notes & Highlights — KV 持久化
    if (segments.length === 3 && segments[2] === 'notes' && request.method === 'GET') {
      const paper = await kvGetJson('papers:' + segments[1]);
      const notes = (paper && paper.notes) ? paper.notes : [];
      return success(notes, 'Success', request);
    }
    if (segments.length === 3 && segments[2] === 'notes' && request.method === 'POST') {
      try {
        const body = await request.json();
        const paper = await kvGetJson('papers:' + segments[1]);
        if (!paper) return notFound('Paper not found', request);
        const note = { id: generateId('note'), content: body.content || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (!paper.notes) paper.notes = [];
        paper.notes.push(note);
        await kvSetJson('papers:' + segments[1], paper);
        return success(note, 'Note created', request);
      } catch {
        return apiError('Invalid request', 400, 'BAD_REQUEST', request);
      }
    }
    if (segments.length === 4 && segments[2] === 'notes' && request.method === 'DELETE') {
      const paper = await kvGetJson('papers:' + segments[1]);
      if (!paper) return notFound('Paper not found', request);
      const noteId = segments[3];
      if (paper.notes) {
        paper.notes = paper.notes.filter(n => n.id !== noteId);
      }
      await kvSetJson('papers:' + segments[1], paper);
      return success({ deleted: true }, 'Note deleted', request);
    }
    if (segments.length === 3 && segments[2] === 'highlights' && request.method === 'GET') {
      const paper = await kvGetJson('papers:' + segments[1]);
      const highlights = (paper && paper.highlights) ? paper.highlights : [];
      return success(highlights, 'Success', request);
    }
    if (segments.length === 3 && segments[2] === 'highlights' && request.method === 'POST') {
      try {
        const body = await request.json();
        const paper = await kvGetJson('papers:' + segments[1]);
        if (!paper) return notFound('Paper not found', request);
        const hl = { id: generateId('hl'), text: body.text || '', color: body.color || '#fbbf24', note: body.note || '', page: body.page || '', createdAt: new Date().toISOString() };
        if (!paper.highlights) paper.highlights = [];
        paper.highlights.push(hl);
        await kvSetJson('papers:' + segments[1], paper);
        return success(hl, 'Highlight created', request);
      } catch {
        return apiError('Invalid request', 400, 'BAD_REQUEST', request);
      }
    }
  }

  // 用户的论文列表
  if (segments[0] === 'users' && segments[2] === 'papers') {
    return handleGetPapers(request, segments[1]);
  }

  // ========================================
  // 项目路由
  // ========================================
  if (segments[0] === 'projects') {
    // GET /projects - 当前用户项目列表
    if (segments.length === 1 && request.method === 'GET') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      return handleGetProjects(request, payload.username);
    }
    // GET /projects/public - 所有公开项目列表
    if (segments.length === 2 && segments[1] === 'public' && request.method === 'GET') {
      const userIds = await kvListGet('users:index');
      const allProjects = [];
      for (const uid of userIds) {
        const user = await kvGetJson('users:' + uid);
        if (!user) continue;
        const projectIds = await kvGetJson('users:' + uid + ':projects') || [];
        for (const pid of projectIds) {
          const project = await kvGetJson('projects:' + pid);
          if (project) {
            allProjects.push({
              ...project,
              ownerUsername: user.username,
              ownerDisplayName: user.displayName || user.username,
              ownerInstitution: user.institution || '',
              progress: project.progress ?? 0,
              goalCount: project.goalCount ?? (project.objectives?.length || 0),
              completedGoals: project.completedGoals ?? (project.objectives?.filter(o => o.completed)?.length || 0),
            });
          }
        }
      }
      // Sort by newest first
      allProjects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return success({ projects: allProjects, total: allProjects.length }, 'Success', request);
    }
    if (request.method === 'POST') return handleCreateProject(request, JWT_SECRET);
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetProject(request, segments[1]);
      if (request.method === 'PUT') return handleUpdateProject(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeleteProject(request, JWT_SECRET, segments[1]);
    }
  }

  // 用户的研究项目列表
  if (segments[0] === 'users' && segments[2] === 'projects') {
    return handleGetProjects(request, segments[1]);
  }

  // ========================================
  // 文献库路由
  // ========================================
  if (segments[0] === 'libraries') {
    // GET /libraries - 当前用户文献库列表
    if (segments.length === 1 && request.method === 'GET') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      return handleGetLibraries(request, payload.username);
    }
    if (segments.length === 3 && segments[2] === 'papers' && request.method === 'POST') {
      return handleAddPaperToLibrary(request, JWT_SECRET, segments[1]);
    }
    if (segments.length === 1 && request.method === 'POST') return handleCreateLibrary(request, JWT_SECRET);
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetLibrary(request, segments[1]);
      if (request.method === 'PUT') return handleUpdateLibrary(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeleteLibrary(request, JWT_SECRET, segments[1]);
    }
  }

  // 用户的文献库列表
  if (segments[0] === 'users' && segments[2] === 'libraries') {
    return handleGetLibraries(request, segments[1]);
  }

  // ========================================
  // 统计路由
  // ========================================
  if (segments[0] === 'stats' && request.method === 'GET') {
    // GET /stats/reading - 阅读统计
    if (segments[1] === 'reading') {
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const paperIds = await kvGetJson('users:' + payload.userId + ':papers') || [];
      const papers = [];
      for (const pid of paperIds) {
        const p = await kvGetJson('papers:' + pid);
        if (p) papers.push(p);
      }
      const readPapers = papers.filter(p => p.isRead).length;
      const readingPapers = papers.filter(p => p.readingStatus === 'reading').length;

      // Generate 90-day heatmap based on paper addedAt dates
      const today = new Date();
      const heatmapSize = 91; // 90 days + today
      const heatmap = new Array(heatmapSize).fill(0);
      const dateMap = new Map();

      // Helper to format date as YYYY-MM-DD in local timezone
      const fmtDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      for (const p of papers) {
        const dateField = p.addedAt || p.createdAt;
        if (dateField) {
          const d = new Date(dateField);
          const dateStr = fmtDate(d);
          dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        }
      }

      for (let i = 0; i < heatmapSize; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (heatmapSize - 1 - i));
        const dateStr = fmtDate(d);
        heatmap[i] = dateMap.get(dateStr) || 0;
      }

      // Calculate streak (consecutive days with activity, ending today)
      let streakDays = 0;
      for (let i = heatmapSize - 1; i >= 0; i--) {
        if (heatmap[i] > 0) {
          streakDays++;
        } else {
          // Allow one gap day for streak calculation
          if (i > 0 && heatmap[i - 1] > 0) {
            streakDays++;
            i--;
          } else {
            break;
          }
        }
      }

      // Calculate weekly read (this week, Monday to today)
      const dayOfWeek = today.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      let weeklyRead = 0;
      for (let i = heatmapSize - 1 - daysSinceMonday; i < heatmapSize; i++) {
        if (i >= 0) weeklyRead += heatmap[i];
      }

      return success({
        totalPapers: papers.length,
        weeklyRead,
        toRead: papers.length - readPapers,
        points: readPapers * 100 + readingPapers * 50,
        streakDays,
        weeklyHeatmap: heatmap,
        readPapers,
        readingPapers,
        unreadPapers: papers.length - readPapers - readingPapers,
        weeklyGoal: 5,
        weeklyCompleted: Math.min(weeklyRead, 5),
        totalReadingTime: readPapers * 45 + readingPapers * 20,
      }, 'Success', request);
    }
    return handleGetStats(request, JWT_SECRET);
  }

  // ========================================
  // 文献库路由
  // ========================================
  if (segments[0] === 'libraries') {
    // GET /libraries - 当前用户文献库列表
    if (segments.length === 1) {
      if (request.method === 'GET') {
        const payload = await requireAuth(request, JWT_SECRET);
        if (payload instanceof Response) return payload;
        return handleGetLibraries(request, payload.username);
      }
      if (request.method === 'POST') return handleCreateLibrary(request, JWT_SECRET);
    }
    if (segments.length === 3 && segments[2] === 'papers' && request.method === 'POST') {
      return handleAddPaperToLibrary(request, JWT_SECRET, segments[1]);
    }
    if (segments.length === 4 && segments[2] === 'papers' && request.method === 'DELETE') {
      const libId = segments[1];
      const paperId = segments[3];
      const payload = await requireAuth(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const lib = await kvGetJson('libraries:' + libId);
      if (!lib) return notFound('Library not found', request);
      if (lib.userId !== payload.userId && payload.role !== 'admin') return forbidden(request);
      const papers = lib.papers || [];
      const idx = papers.indexOf(paperId);
      if (idx > -1) {
        papers.splice(idx, 1);
        lib.papers = papers;
        lib.paperCount = papers.length;
        lib.updatedAt = new Date().toISOString();
        await kvSetJson('libraries:' + libId, lib);
      }
      const response = { ...lib, color: lib.color || '#3d5a80', icon: lib.icon || 'Library', paperIds: lib.papers || [], isDefault: lib.isDefault || false };
      return success(response, 'Paper removed from library', request);
    }
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetLibrary(request, segments[1]);
      if (request.method === 'PUT') return handleUpdateLibrary(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeleteLibrary(request, JWT_SECRET, segments[1]);
    }
  }

  // 用户的文献库列表
  if (segments[0] === 'users' && segments[2] === 'libraries') {
    return handleGetLibraries(request, segments[1]);
  }

  // ========================================
  // 资料路由
  // ========================================
  if (segments[0] === 'materials') {
    if (segments.length === 1) {
      if (request.method === 'GET') return handleGetMaterials(request, JWT_SECRET);
      if (request.method === 'POST') return handleCreateMaterial(request, JWT_SECRET);
    }
    if (segments.length === 2) {
      if (request.method === 'GET') return handleGetMaterial(request, segments[1]);
      if (request.method === 'PUT') return handleUpdateMaterial(request, JWT_SECRET, segments[1]);
      if (request.method === 'DELETE') return handleDeleteMaterial(request, JWT_SECRET, segments[1]);
    }
    if (segments.length === 3 && segments[2] === 'favorite' && request.method === 'POST') {
      return handleToggleMaterialFavorite(request, JWT_SECRET, segments[1]);
    }
  }

  // ========================================
  // 阅读记录路由
  // ========================================
  if (segments[0] === 'reading-records' && request.method === 'POST') {
    return success(null, 'Success', request);
  }

  // ========================================
  // 用户设置路由
  // ========================================
  if (segments[0] === 'settings') {
    if (request.method === 'GET') return handleGetSettings(request, JWT_SECRET);
    if (request.method === 'PUT') return handleUpdateSettings(request, JWT_SECRET);
  }

  // ========================================
  // 搜索处理器
  // ========================================

  async function handleSearchArxiv(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    if (!query.trim()) return success([], 'Empty query', request);

    try {
      const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=10`;
      const res = await fetch(arxivUrl, { method: 'GET' });
      const xml = await res.text();

      const entries = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];
        const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
        const id = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || '';
        const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim() || '';
        const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.trim() || '';
        const doiMatch = entry.match(/<arxiv:doi>([\s\S]*?)<\/arxiv:doi>/);
        const doi = doiMatch ? doiMatch[1].trim() : '';

        const authors = [];
        const authorRegex = /<name>([\s\S]*?)<\/name>/g;
        let authorMatch;
        while ((authorMatch = authorRegex.exec(entry)) !== null) {
          if (!authorMatch[1].includes('@')) authors.push(authorMatch[1].trim());
        }

        entries.push({
          id: id.split('/').pop() || id,
          title,
          authors,
          year: parseInt(published.split('-')[0], 10) || new Date().getFullYear(),
          venue: 'arXiv',
          abstract: summary,
          doi,
          url: id,
          citations: 0,
        });
      }
      return success(entries, 'Success', request);
    } catch (e) {
      console.error('[SearchArxiv] Error:', e);
      return success([], 'Search failed', request);
    }
  }

  // Simple memory cache for external API calls
  const ssCache = new Map();
  const ARXIV_CACHE = new Map();
  const CACHE_TTL_MS = 60000; // 60 seconds

  async function handleSearchSemanticScholar(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    if (!query.trim()) return success([], 'Empty query', request);

    // Check cache
    const cacheKey = query.toLowerCase().trim();
    const cached = ssCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return success(cached.data, 'Success (cached)', request);
    }

    try {
      const apiKey = url.searchParams.get('apiKey');
      const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,venue,abstract,citationCount,externalIds,url&limit=10`;
      const headers = { 'Accept': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      const res = await fetch(ssUrl, { method: 'GET', headers });
      if (!res.ok) {
        const errText = await res.text();
        console.error('[SearchSS] API error:', res.status, errText);
        return apiError(`Semantic Scholar API 暂时不可用 (${res.status})，请稍等后重试`, 502, 'EXTERNAL_API_ERROR', request);
      }
      const data = await res.json();
      const papers = (data.data || []).map((p) => ({
        id: p.paperId || '',
        title: p.title || '',
        authors: (p.authors || []).map(a => a.name).filter(Boolean),
        year: p.year || new Date().getFullYear(),
        venue: p.venue || '',
        abstract: p.abstract || '',
        doi: p.externalIds?.DOI || '',
        url: p.url || '',
        citations: p.citationCount || 0,
      }));
      ssCache.set(cacheKey, { data: papers, ts: Date.now() });
      return success(papers, 'Success', request);
    } catch (e) {
      console.error('[SearchSS] Error:', e);
      return success([], 'Search failed', request);
    }
  }

  async function handleImportZotero(request, JWT_SECRET) {
    const payload = await requireAuth(request, JWT_SECRET);
    if (payload instanceof Response) return payload;

    try {
      const body = await request.json();
      const { userId, apiKey } = body;
      if (!userId || !apiKey) {
        return apiError('Zotero userId and apiKey are required', 400, 'VALIDATION_ERROR', request);
      }

      const zoteroUrl = `https://api.zotero.org/users/${encodeURIComponent(userId)}/items?format=json&limit=25`;
      const res = await fetch(zoteroUrl, {
        method: 'GET',
        headers: { 'Zotero-API-Key': apiKey, 'Accept': 'application/json' },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Zotero] API error:', res.status, errText);
        return apiError('Zotero API error: ' + res.status, 502, 'EXTERNAL_API_ERROR', request);
      }

      const items = await res.json();
      const papers = [];
      for (const item of items) {
        const d = item.data || {};
        const creators = (d.creators || [])
          .filter(c => c.creatorType === 'author')
          .map(c => {
            if (c.firstName && c.lastName) return `${c.firstName} ${c.lastName}`;
            return c.name || c.lastName || c.firstName || '';
          })
          .filter(Boolean);
        const yearMatch = (d.date || '').match(/(\d{4})/);
        papers.push({
          id: `zotero-${d.key || item.key}`,
          title: d.title || '未命名文献',
          authors: creators,
          year: parseInt(yearMatch?.[1], 10) || new Date().getFullYear(),
          venue: d.publicationTitle || d.publisher || '',
          abstract: d.abstractNote || '',
          doi: d.DOI || '',
          url: d.url || '',
          tags: (d.tags || []).map(t => t.tag).filter(Boolean),
          citations: 0,
        });
      }
      return success(papers, 'Success', request);
    } catch (e) {
      console.error('[Zotero] Error:', e);
      return apiError('Zotero import failed', 500, 'EXTERNAL_API_ERROR', request);
    }
  }

  // ========================================
  // 搜索路由
  // ========================================
  if (segments[0] === 'search') {
    if (segments[1] === 'arxiv' && request.method === 'GET') return handleSearchArxiv(request);
    if (segments[1] === 'semantic-scholar' && request.method === 'GET') return handleSearchSemanticScholar(request);
    if (segments[1] === 'import' && request.method === 'POST') {
      return handleImportFromSearch(request, JWT_SECRET);
    }
  }

  // Zotero 导入路由
  if (segments[0] === 'import' && segments[1] === 'zotero' && request.method === 'POST') {
    return handleImportZotero(request, JWT_SECRET);
  }

  // ========================================
  // 管理后台路由
  // ========================================
  if (segments[0] === 'admin') {
    if (segments[1] === 'users' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const userIds = await kvListGet('users:index');
      const users = [];
      for (const uid of userIds) {
        const u = await kvGetJson('users:' + uid);
        if (u) {
          const { passwordHash, ...safe } = u;
          users.push(safe);
        }
      }
      return success({ users, pagination: { page: 1, limit: 20, total: users.length, totalPages: 1 } }, 'Success', request);
    }
    if (segments[1] === 'stats' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      try {
        const userIds = await kvListGet('users:index');
      let totalPapers = 0, totalProjects = 0, totalLibraries = 0;
      for (const uid of userIds) {
        const papers = await kvGetJson('users:' + uid + ':papers') || [];
        const projects = await kvGetJson('users:' + uid + ':projects') || [];
        const libraries = await kvGetJson('users:' + uid + ':libraries') || [];
        totalPapers += papers.length;
        totalProjects += projects.length;
        totalLibraries += libraries.length;
      }
      // 读取真实系统监控数据
      const totalRequests = parseInt(await kvGet('system:metrics:requests') || '0', 10);
      const totalErrors = parseInt(await kvGet('system:metrics:errors') || '0', 10);
      const totalResponseTime = parseInt(await kvGet('system:metrics:responseTime') || '0', 10);
      const startupTime = parseInt(await kvGet('system:metrics:startup') || '0', 10);
      // 计算 24h 请求数（基于每日计数器而非逐秒查询）
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const todayCount = parseInt(await kvGet('system:metrics:daily:' + today) || '0', 10);
      const yesterdayCount = parseInt(await kvGet('system:metrics:daily:' + yesterday) || '0', 10);
      const requests24h = todayCount + yesterdayCount;
      // 计算 KV 键数量及分组统计（防止 list() 不支持导致崩溃）
      let kvKeys = [];
      try {
        const kvListResult = await ACADEMIC_HUB_KV.list();
        kvKeys = (kvListResult && kvListResult.keys) ? kvListResult.keys : [];
      } catch (e) {
        console.error('[admin/stats] KV list failed:', e.message || e);
        kvKeys = [];
      }
      const kvBreakdown = {};
      for (const k of kvKeys) {
        const name = typeof k === 'string' ? k
          : (k.name || k.key || k.id || (typeof k === 'object' ? JSON.stringify(k) : String(k)));
        const prefix = (typeof name === 'string' ? name : String(name)).split(':')[0];
        kvBreakdown[prefix] = (kvBreakdown[prefix] || 0) + 1;
      }
      // 读取近7天每日请求量
      const dailyRequests = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().slice(0, 10);
        const dailyCount = parseInt(await kvGet('system:metrics:daily:' + dateStr) || '0', 10);
        dailyRequests.push({ date: dateStr.slice(5), requests: dailyCount });
      }
      // 计算可用性（基于启动时间）
      const uptimePercent = startupTime > 0
        ? Math.min(100, ((Date.now() - startupTime) / 1000 / 60).toFixed(2))
        : 100;
      return success({
        totalUsers: userIds.length,
        totalPapers,
        totalProjects,
        totalLibraries,
        systemHealth: { kv: 'healthy', edgeFunctions: 'healthy', cloudFunctions: 'healthy' },
        metrics: {
          totalRequests,
          requests24h,
          avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
          errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0,
          uptime: uptimePercent,
          kvUsage: kvKeys.length,
        },
        kvBreakdown,
        dailyRequests,
      }, 'Success', request);
      } catch (e) {
        console.error('[admin/stats] Handler error:', e.message || e);
        return apiError('Failed to load stats: ' + (e.message || 'unknown error'), 500, 'STATS_ERROR', request);
      }
    }

    // GET /admin/activities - 活动日志（支持筛选）
    if (segments[1] === 'activities' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      let activities = await kvGetJson('system:activities') || [];
      const url = new URL(request.url);
      const actionFilter = url.searchParams.get('action');
      const statusFilter = url.searchParams.get('status');
      const userFilter = url.searchParams.get('user');
      const searchFilter = url.searchParams.get('search');
      if (actionFilter) activities = activities.filter(a => a.action?.includes(actionFilter));
      if (statusFilter) activities = activities.filter(a => a.status === statusFilter);
      if (userFilter) activities = activities.filter(a => a.user?.includes(userFilter));
      if (searchFilter) {
        const s = searchFilter.toLowerCase();
        activities = activities.filter(a =>
          (a.action && a.action.toLowerCase().includes(s)) ||
          (a.target && a.target.toLowerCase().includes(s)) ||
          (a.user && a.user.toLowerCase().includes(s))
        );
      }
      // Pagination
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const total = activities.length;
      const start = (page - 1) * limit;
      const paginated = activities.slice(start, start + limit);
      return success({
        activities: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      }, 'Success', request);
    }

    // GET /admin/papers - 全站文献管理
    if (segments[1] === 'papers' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const url = new URL(request.url);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const yearFilter = url.searchParams.get('year');
      const tagFilter = url.searchParams.get('tag');
      const allPapers = [];
      const userIds = await kvListGet('users:index');
      for (const uid of userIds) {
        const paperIds = await kvListGet('users:' + uid + ':papers');
        for (const pid of paperIds) {
          const p = await kvGetJson('papers:' + pid);
          if (p) {
            const owner = await kvGetJson('users:' + uid);
            allPapers.push({ ...p, ownerUsername: owner?.username || uid, ownerDisplayName: owner?.displayName || owner?.username || uid });
          }
        }
      }
      let filtered = allPapers;
      if (search) {
        filtered = filtered.filter(p =>
          (p.title && p.title.toLowerCase().includes(search)) ||
          (p.authors && p.authors.some(a => a.toLowerCase().includes(search))) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(search)))
        );
      }
      if (yearFilter) filtered = filtered.filter(p => String(p.year) === yearFilter);
      if (tagFilter) filtered = filtered.filter(p => p.tags && p.tags.includes(tagFilter));
      filtered.sort((a, b) => new Date(b.createdAt || b.addedAt || 0) - new Date(a.createdAt || a.addedAt || 0));
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      // Collect unique years and tags for filters
      const years = [...new Set(allPapers.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);
      const tags = [...new Set(allPapers.flatMap(p => p.tags || []))].sort();
      return success({ papers: paginated, total, page, limit, totalPages: Math.ceil(total / limit) || 1, years, tags }, 'Success', request);
    }

    // DELETE /admin/papers/:id - 管理员删除文献
    if (segments[1] === 'papers' && segments[2] && request.method === 'DELETE') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const paperId = segments[2];
      const paper = await kvGetJson('papers:' + paperId);
      if (!paper) return notFound('Paper not found', request);
      // Remove from owner's list
      const userIds = await kvListGet('users:index');
      for (const uid of userIds) {
        await kvListRemove('users:' + uid + ':papers', paperId);
      }
      await kvDel('papers:' + paperId);
      return success({ deleted: true, paperId }, 'Paper deleted', request);
    }

    // GET /admin/projects - 全站项目管理
    if (segments[1] === 'projects' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const url = new URL(request.url);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const statusFilter = url.searchParams.get('status');
      const allProjects = [];
      const userIds = await kvListGet('users:index');
      for (const uid of userIds) {
        const projectIds = await kvListGet('users:' + uid + ':projects');
        for (const pid of projectIds) {
          const p = await kvGetJson('projects:' + pid);
          if (p) {
            const owner = await kvGetJson('users:' + uid);
            allProjects.push({ ...p, ownerUsername: owner?.username || uid, ownerDisplayName: owner?.displayName || owner?.username || uid });
          }
        }
      }
      let filtered = allProjects;
      if (search) {
        filtered = filtered.filter(p =>
          (p.title && p.title.toLowerCase().includes(search)) ||
          (p.description && p.description.toLowerCase().includes(search))
        );
      }
      if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      const statuses = [...new Set(allProjects.map(p => p.status).filter(Boolean))];
      return success({ projects: paginated, total, page, limit, totalPages: Math.ceil(total / limit) || 1, statuses }, 'Success', request);
    }

    // DELETE /admin/projects/:id - 管理员删除项目
    if (segments[1] === 'projects' && segments[2] && request.method === 'DELETE') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const projectId = segments[2];
      const project = await kvGetJson('projects:' + projectId);
      if (!project) return notFound('Project not found', request);
      const userIds = await kvListGet('users:index');
      for (const uid of userIds) {
        await kvListRemove('users:' + uid + ':projects', projectId);
      }
      await kvDel('projects:' + projectId);
      return success({ deleted: true, projectId }, 'Project deleted', request);
    }

    // GET /admin/settings - 系统设置
    if (segments[1] === 'settings' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const settings = await kvGetJson('system:settings') || {
        siteName: "Joan's Academic Hub",
        siteDescription: '一个现代化的学术文献管理与研究协作平台',
        allowRegistration: false,
        publicSpacesEnabled: true,
        jwtExpiryHours: 168,
        maxLoginAttempts: 5,
      };
      return success(settings, 'Success', request);
    }

    // PUT /admin/settings - 更新系统设置
    if (segments[1] === 'settings' && request.method === 'PUT') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      try {
        const body = await request.json();
        const current = await kvGetJson('system:settings') || {};
        const updated = { ...current, ...body, updatedAt: new Date().toISOString() };
        await kvSetJson('system:settings', updated);
        return success(updated, 'Settings updated', request);
      } catch (e) {
        return apiError('Invalid request', 400, 'BAD_REQUEST', request);
      }
    }

    // POST /admin/backup - 备份全站数据
    if (segments[1] === 'backup' && request.method === 'POST') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const backup = { users: [], papers: [], projects: [], spaces: [], libraries: [], exportedAt: new Date().toISOString() };
      const userIds = await kvListGet('users:index');
      for (const uid of userIds) {
        const u = await kvGetJson('users:' + uid);
        if (u) { const { passwordHash, ...safe } = u; backup.users.push(safe); }
      }
      for (const uid of userIds) {
        const paperIds = await kvListGet('users:' + uid + ':papers');
        for (const pid of paperIds) {
          const p = await kvGetJson('papers:' + pid);
          if (p) backup.papers.push(p);
        }
        const projectIds = await kvListGet('users:' + uid + ':projects');
        for (const pid of projectIds) {
          const p = await kvGetJson('projects:' + pid);
          if (p) backup.projects.push(p);
        }
        const space = await kvGetJson('spaces:' + (await kvGetJson('users:' + uid))?.username);
        if (space) backup.spaces.push(space);
      }
      return success(backup, 'Backup created', request);
    }

    // GET /admin/routes - API 路由列表
    if (segments[1] === 'routes' && request.method === 'GET') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;
      const routes = [
        { group: '认证', endpoints: [
          { method: 'POST', path: '/api/auth/login', desc: '用户登录' },
          { method: 'POST', path: '/api/auth/logout', desc: '用户登出' },
          { method: 'GET', path: '/api/auth/me', desc: '获取当前用户信息' },
        ]},
        { group: '用户', endpoints: [
          { method: 'GET', path: '/api/users', desc: '获取用户列表（Admin）' },
          { method: 'GET', path: '/api/users/:id', desc: '获取用户详情' },
          { method: 'PUT', path: '/api/users/:id', desc: '更新用户信息' },
          { method: 'DELETE', path: '/api/users/:id', desc: '删除用户（Admin）' },
        ]},
        { group: '空间', endpoints: [
          { method: 'GET', path: '/api/spaces', desc: '获取空间列表' },
          { method: 'GET', path: '/api/spaces/:username', desc: '获取空间详情' },
          { method: 'PUT', path: '/api/spaces/:username', desc: '更新空间' },
        ]},
        { group: '文献', endpoints: [
          { method: 'GET', path: '/api/papers', desc: '获取当前用户文献' },
          { method: 'POST', path: '/api/papers', desc: '添加文献' },
          { method: 'GET', path: '/api/papers/:id', desc: '获取文献详情' },
          { method: 'PUT', path: '/api/papers/:id', desc: '更新文献' },
          { method: 'DELETE', path: '/api/papers/:id', desc: '删除文献' },
          { method: 'POST', path: '/api/papers/:id/notes', desc: '添加笔记' },
          { method: 'POST', path: '/api/papers/batch-import', desc: '批量导入文献' },
        ]},
        { group: '项目', endpoints: [
          { method: 'GET', path: '/api/projects', desc: '获取当前用户项目' },
          { method: 'GET', path: '/api/projects/public', desc: '获取公开项目' },
          { method: 'POST', path: '/api/projects', desc: '创建项目' },
          { method: 'GET', path: '/api/projects/:id', desc: '获取项目详情' },
          { method: 'PUT', path: '/api/projects/:id', desc: '更新项目' },
          { method: 'DELETE', path: '/api/projects/:id', desc: '删除项目' },
        ]},
        { group: '文献库', endpoints: [
          { method: 'GET', path: '/api/libraries', desc: '获取文献库列表' },
          { method: 'POST', path: '/api/libraries', desc: '创建文献库' },
          { method: 'GET', path: '/api/libraries/:id', desc: '获取文献库详情' },
          { method: 'PUT', path: '/api/libraries/:id', desc: '更新文献库' },
          { method: 'DELETE', path: '/api/libraries/:id', desc: '删除文献库' },
        ]},
        { group: '资料', endpoints: [
          { method: 'GET', path: '/api/materials', desc: '获取资料列表' },
          { method: 'POST', path: '/api/materials', desc: '上传资料' },
          { method: 'GET', path: '/api/materials/:id', desc: '获取资料详情' },
          { method: 'PUT', path: '/api/materials/:id', desc: '更新资料' },
          { method: 'DELETE', path: '/api/materials/:id', desc: '删除资料' },
        ]},
        { group: '统计', endpoints: [
          { method: 'GET', path: '/api/stats/reading', desc: '阅读统计' },
        ]},
        { group: '搜索', endpoints: [
          { method: 'GET', path: '/api/search/arxiv', desc: 'ArXiv 搜索' },
          { method: 'GET', path: '/api/search/semantic-scholar', desc: 'Semantic Scholar 搜索' },
          { method: 'POST', path: '/api/search/import', desc: '从搜索导入' },
        ]},
        { group: '导入', endpoints: [
          { method: 'POST', path: '/api/import/zotero', desc: 'Zotero 导入' },
        ]},
        { group: 'AI', endpoints: [
          { method: 'GET', path: '/api/ai/conversations', desc: '获取对话列表' },
          { method: 'POST', path: '/api/ai/chat', desc: 'AI 对话' },
          { method: 'POST', path: '/api/ai/parse-paper', desc: '解析文献' },
        ]},
        { group: '管理后台', endpoints: [
          { method: 'GET', path: '/api/admin/users', desc: '获取用户列表' },
          { method: 'GET', path: '/api/admin/stats', desc: '获取系统统计' },
          { method: 'GET', path: '/api/admin/activities', desc: '获取活动日志' },
          { method: 'GET', path: '/api/admin/papers', desc: '全站文献管理' },
          { method: 'DELETE', path: '/api/admin/papers/:id', desc: '删除文献' },
          { method: 'GET', path: '/api/admin/projects', desc: '全站项目管理' },
          { method: 'DELETE', path: '/api/admin/projects/:id', desc: '删除项目' },
          { method: 'GET', path: '/api/admin/settings', desc: '获取系统设置' },
          { method: 'PUT', path: '/api/admin/settings', desc: '更新系统设置' },
          { method: 'POST', path: '/api/admin/backup', desc: '全站备份' },
          { method: 'GET', path: '/api/admin/routes', desc: 'API 路由列表' },
          { method: 'POST', path: '/api/admin/workbuddy/seed', desc: '注入种子数据' },
          { method: 'GET', path: '/api/admin/workbuddy/export', desc: '导出文献' },
          { method: 'POST', path: '/api/admin/workbuddy/clean', desc: '清理 KV 数据' },
          { method: 'POST', path: '/api/admin/workbuddy/reindex', desc: '重建索引' },
        ]},
        { group: '健康检查', endpoints: [
          { method: 'GET', path: '/api/hello', desc: '服务健康检查' },
        ]},
      ];
      return success({ routes }, 'Success', request);
    }

    // ---- WorkBuddy 管理通道 ----
    if (segments[1] === 'workbuddy') {
      const payload = await requireAdmin(request, JWT_SECRET);
      if (payload instanceof Response) return payload;

      // POST /admin/workbuddy/seed - 注入种子数据
      if (segments[2] === 'seed' && request.method === 'POST') {
        const seedPapers = [
          { id: 'paper-seed-1', title: 'Attention Is All You Need', authors: ['A. Vaswani', 'N. Shazeer'], year: 2017, venue: 'NeurIPS 2017', abstract: 'We propose a new simple network architecture, the Transformer.', tags: ['Transformer', 'Attention'], citations: 80000, createdAt: new Date().toISOString() },
          { id: 'paper-seed-2', title: 'BERT: Pre-training of Deep Bidirectional Transformers', authors: ['J. Devlin', 'M. Chang'], year: 2019, venue: 'NAACL 2019', abstract: 'We introduce a new language representation model called BERT.', tags: ['NLP', 'Pre-training'], citations: 120000, createdAt: new Date().toISOString() },
          { id: 'paper-seed-3', title: 'Deep Residual Learning for Image Recognition', authors: ['K. He', 'X. Zhang'], year: 2016, venue: 'CVPR 2016', abstract: 'We present a residual learning framework.', tags: ['CNN', 'ResNet'], citations: 200000, createdAt: new Date().toISOString() },
          { id: 'paper-seed-4', title: 'Generative Adversarial Networks', authors: ['I. Goodfellow', 'J. Pouget-Abadie'], year: 2014, venue: 'NeurIPS 2014', abstract: 'We propose a new framework for estimating generative models.', tags: ['GAN', 'Generative'], citations: 90000, createdAt: new Date().toISOString() },
          { id: 'paper-seed-5', title: 'ImageNet Classification with Deep Convolutional Neural Networks', authors: ['A. Krizhevsky', 'I. Sutskever'], year: 2012, venue: 'NeurIPS 2012', abstract: 'We trained a large, deep convolutional neural network.', tags: ['CNN', 'ImageNet'], citations: 150000, createdAt: new Date().toISOString() },
        ];
        const adminUser = await kvGetJson('users:admin');
        if (!adminUser) return apiError('Admin account not found', 404, 'NOT_FOUND', request);
        let added = 0;
        for (const paper of seedPapers) {
          const exists = await kvGetJson('papers:' + paper.id);
          if (!exists) {
            await kvSetJson('papers:' + paper.id, { ...paper, userId: 'admin', username: 'admin' });
            await kvListAdd('users:admin:papers', paper.id);
            added++;
          }
        }
        // Update admin space stats
        const adminPapers = await kvListGet('users:admin:papers');
        const space = await kvGetJson('spaces:admin');
        if (space) {
          space.stats.papers = adminPapers.length;
          await kvSetJson('spaces:admin', space);
        }
        return success({ added, total: adminPapers.length }, `Seed data injected: ${added} papers added`, request);
      }

      // GET /admin/workbuddy/export - 导出全部文献
      if (segments[2] === 'export' && request.method === 'GET') {
        const url = new URL(request.url);
        const format = url.searchParams.get('format') || 'json';
        const allPapers = [];
        const userIds = await kvListGet('users:index');
        for (const uid of userIds) {
          const paperIds = await kvListGet('users:' + uid + ':papers');
          for (const pid of paperIds) {
            const p = await kvGetJson('papers:' + pid);
            if (p) allPapers.push(p);
          }
        }
        if (format === 'bibtex') {
          const bibtex = allPapers.map(p => {
            const key = p.id || 'ref' + Math.random().toString(36).substr(2, 6);
            return `@article{${key},\n  title={${p.title || ''}},\n  author={${(p.authors || []).join(' and ')}},\n  year={${p.year || ''}},\n  journal={${p.venue || ''}}\n}`;
          }).join('\n\n');
          return new Response(bibtex, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...makeCorsHeaders(request) } });
        }
        if (format === 'csv') {
          const header = 'id,title,authors,year,venue,abstract,tags,citations\n';
          const rows = allPapers.map(p => [
            p.id, p.title, (p.authors || []).join(';'), p.year, p.venue, (p.abstract || '').replace(/"/g, '""'), (p.tags || []).join(';'), p.citations
          ].map(v => `"${v}"`).join(',')).join('\n');
          return new Response(header + rows, { headers: { 'Content-Type': 'text/csv; charset=utf-8', ...makeCorsHeaders(request) } });
        }
        return success({ papers: allPapers, count: allPapers.length }, 'Success', request);
      }

      // POST /admin/workbuddy/clean - 清理 KV 数据（保留 admin）
      if (segments[2] === 'clean' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const keepAdmin = body.keepAdmin !== false;
        let deleted = 0;
        // Clean papers (except admin's if keepAdmin)
        const userIds = await kvListGet('users:index');
        for (const uid of userIds) {
          if (keepAdmin && uid === 'admin') continue;
          const paperIds = await kvListGet('users:' + uid + ':papers');
          for (const pid of paperIds) {
            await kvDel('papers:' + pid);
            deleted++;
          }
          await kvDel('users:' + uid + ':papers');
          await kvDel('users:' + uid + ':projects');
          await kvDel('users:' + uid + ':libraries');
          await kvDel('users:' + uid + ':materials');
        }
        // Clean non-admin users
        if (!keepAdmin) {
          for (const uid of userIds) {
            const user = await kvGetJson('users:' + uid);
            if (user) {
              await kvDel('users:' + uid);
              await kvDel('users:by-username:' + user.username);
              await kvDel('spaces:' + user.username);
              await kvListRemove('users:index', uid);
              await kvListRemove('spaces:index', user.username);
              deleted++;
            }
          }
        }
        return success({ deleted, keepAdmin }, 'KV data cleaned', request);
      }

      // POST /admin/workbuddy/reindex - 重建索引
      if (segments[2] === 'reindex' && request.method === 'POST') {
        const usersIndex = await kvListGet('users:index');
        const spacesIndex = await kvListGet('spaces:index');
        let fixedUsers = 0, fixedSpaces = 0;
        // Rebuild users:index
        const allUserKeys = [];
        // Scan for users:* keys (memory-backed simulation)
        for (const uid of usersIndex) {
          const user = await kvGetJson('users:' + uid);
          if (user) {
            allUserKeys.push(uid);
            await kvSet('users:by-username:' + user.username, uid);
          }
        }
        await kvSetJson('users:index', allUserKeys);
        fixedUsers = allUserKeys.length;
        // Rebuild spaces:index
        const allSpaceKeys = [];
        for (const username of spacesIndex) {
          const space = await kvGetJson('spaces:' + username);
          if (space) {
            allSpaceKeys.push(username);
          }
        }
        await kvSetJson('spaces:index', allSpaceKeys);
        fixedSpaces = allSpaceKeys.length;
        // Recalculate stats for all spaces
        for (const username of allSpaceKeys) {
          const userId = await kvGet('users:by-username:' + username);
          if (userId) {
            const papers = await kvListGet('users:' + userId + ':papers');
            const projects = await kvListGet('users:' + userId + ':projects');
            const libraries = await kvListGet('users:' + userId + ':libraries');
            const space = await kvGetJson('spaces:' + username);
            if (space) {
              space.stats = { papers: papers.length, projects: projects.length, libraries: libraries.length };
              await kvSetJson('spaces:' + username, space);
            }
          }
        }
        return success({ fixedUsers, fixedSpaces }, 'Index rebuilt', request);
      }
    }
  }

  // ========================================
  // AI 路由
  // ========================================
  if (segments[0] === 'ai') {
    // —— 对话 CRUD（需认证）——
    if (segments[1] === 'conversations') {
      try {
        const authPayload = await authenticate(request, JWT_SECRET);
        if (!authPayload) return unauthorized(request);
        const userId = authPayload.userId || authPayload.sub || 'anonymous';

        // GET /api/ai/conversations — 获取所有对话（返回完整数据，含 messages）
        if (request.method === 'GET' && !segments[2]) {
          const index = await getConvIndex(userId);
          // 按 updatedAt 降序排列
          if (Array.isArray(index)) {
            index.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          }
          // 为每个对话加载完整数据
          const conversations = [];
          for (const entry of (Array.isArray(index) ? index : [])) {
            const conv = await getConversation(userId, entry.id);
            if (conv) conversations.push(conv);
          }
          return success(conversations, 'Success', request);
        }

        // GET /api/ai/conversations/:id — 获取单个对话
        if (request.method === 'GET' && segments[2]) {
          const conv = await getConversation(userId, segments[2]);
          if (!conv) return success(null, 'Conversation not found', request);
          return success(conv, 'Success', request);
        }

        // PUT /api/ai/conversations/:id — 保存/更新对话
        if (request.method === 'PUT' && segments[2]) {
          try {
            const body = await request.json();
            const convData = {
              ...body,
              userId,
              id: segments[2],
              updatedAt: new Date().toISOString(),
            };
            await saveConversation(userId, segments[2], convData);
            return success(convData, 'Conversation saved', request);
          } catch (e) {
            return apiError('Invalid request body', 400, 'INVALID_BODY', request);
          }
        }

        // DELETE /api/ai/conversations/:id — 删除对话
        if (request.method === 'DELETE' && segments[2]) {
          await kvDel(AI_CONV_PREFIX + userId + ':' + segments[2]);
          await removeFromConvIndex(userId, segments[2]);
          return success(null, 'Conversation deleted', request);
        }
      } catch (e) {
        console.error('[AI Conversations] Unhandled error:', e.message || e);
        return apiError('AI conversations error: ' + (e.message || 'unknown'), 500, 'AI_CONV_ERROR', request);
      }
    }

    if (segments[1] === 'chat' && request.method === 'POST') {
      return handleAiChat(request);
    }
    if (segments[1] === 'parse-paper' && request.method === 'POST') {
      return handleParsePaper(request);
    }
  }

  // ========================================
  // 健康检查
  // ========================================
  if (path === '/hello' || path === '/hello/') {
    return success({ message: "Joan's Academic Hub API", version: '6.0.0', kv: 'connected' }, 'Success', request);
  }

  // 其他路由返回 404
  return notFound('Not found', request);
}