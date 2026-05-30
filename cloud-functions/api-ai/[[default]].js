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

    const currentYear = new Date().getFullYear();

    const systemPrompt = `You are an expert scholarly paper metadata extractor. Your task is to thoroughly analyze the provided paper text and extract ALL possible metadata fields with high precision. Output ONLY a valid JSON object.

Required JSON fields (extract from the text, do NOT guess or hallucinate):
- "title": string, exact paper title as written
- "authors": string array, full author names in order (e.g., ["J. Smith", "A. B. Chen"])
- "year": number, exact publication year (e.g., 2024). If not found, use null.
- "month": number or null, publication month 1-12. If not found, use null.
- "venue": string, full journal or conference name (e.g., "IEEE Transactions on Knowledge and Data Engineering", "ACM SIGKDD 2024"). Do NOT abbreviate.
- "volume": string or "", volume number if present
- "issue": string or "", issue number if present
- "pages": string or "", page range e.g. "123-145" or "e12345"
- "doi": string or "", DOI identifier including "10." prefix
- "url": string or "", paper URL if present in the text
- "abstract": string, the COMPLETE abstract text. Do NOT truncate or summarize.
- "keywords": string array, keywords or key phrases from the paper
- "sourceType": string, one of "journal", "conference", "preprint", "book", "thesis". Infer from venue.
- "citationCount": number or null, if citation count is mentioned in text
- "researchMethod": string or "", brief description of the core methodology (1-2 sentences)
- "mainContribution": string or "", the paper's primary contribution (1-2 sentences)
- "limitations": string or "", limitations or future work mentioned (1-2 sentences)
- "conclusion": string or "", key conclusion or findings (1-2 sentences)
- "references": array of { "title": string, "authors": string[], "year": number, "venue": string }, up to 5 most important references

CRITICAL RULES:
1. Output ONLY the JSON object. No markdown, no code fences, no explanations, no preamble.
2. If a field is NOT found in the text, use empty string "" for strings, empty array [] for arrays, or null for numbers.
3. NEVER fabricate data. If year is not found, use null — do NOT guess.
4. The "abstract" field must contain the FULL abstract text, not a summary.
5. The JSON must be valid and parseable. All string values must be properly escaped.`;

    // 保留更多文本内容（8000字符），给AI更多上下文
    const truncatedText = text.slice(0, 8000);
    const userPrompt = `Analyze the following academic paper text thoroughly and extract all metadata into JSON.\n\n=== PAPER TEXT ===\n${truncatedText}\n=== END ===`;

    console.log(`[CF-ParsePaper] Input text length: ${text.length}, truncated to: ${truncatedText.length}, model: ${model}`);

    const res = await callOpenAICompatibleApi(
      baseUrl, apiKey, model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { stream: false, temperature: 0.05, maxTokens: 4096, timeout: 55000 }
    );

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage;

    console.log(`[CF-ParsePaper] AI response length: ${content.length}, tokens used: ${usage?.total_tokens || 'unknown'}`);

    // 尝试 1：直接解析 JSON
    let parsed = tryParseJson(content);

    // 尝试 2：正则提取（从AI输出中）
    if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
      console.log('[CF-ParsePaper] JSON parse empty, trying regex fallback on AI output...');
      parsed = extractWithRegex(content);
    }

    // 尝试 3：从原始文本提取
    if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
      console.log('[CF-ParsePaper] Regex fallback empty, trying from original text...');
      parsed = extractWithRegex(text.slice(0, 6000));
    }

    // 年份校验：如果AI返回的年份不合理，从原始文本重新提取
    let year = parsed.year;
    if (year === null || year === undefined || year === '' || year < 1900 || year > currentYear) {
      const extractedYear = extractYearFromText(text);
      if (extractedYear && extractedYear >= 1900 && extractedYear <= currentYear) {
        year = extractedYear;
        console.log(`[CF-ParsePaper] Year corrected from ${parsed.year} to ${year}`);
      } else {
        year = null; // 不猜测，使用 null
      }
    }

    const result = {
      title: (parsed.title || '').trim(),
      authors: Array.isArray(parsed.authors) ? parsed.authors.filter(Boolean) : [],
      year: year,
      month: validateMonth(parsed.month),
      venue: (parsed.venue || parsed.journal || '').trim(),
      volume: (parsed.volume || '').toString().trim(),
      issue: (parsed.issue || parsed.number || '').toString().trim(),
      pages: (parsed.pages || '').toString().trim(),
      doi: (parsed.doi || '').trim(),
      url: (parsed.url || '').trim(),
      abstract: (parsed.abstract || '').trim(),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
      sourceType: (parsed.sourceType || inferSourceType(parsed.venue || '')).toLowerCase(),
      citationCount: Number(parsed.citationCount) || null,
      researchMethod: (parsed.researchMethod || '').trim(),
      mainContribution: (parsed.mainContribution || '').trim(),
      limitations: (parsed.limitations || '').trim(),
      conclusion: (parsed.conclusion || '').trim(),
      references: Array.isArray(parsed.references) ? parsed.references.slice(0, 5) : [],
    };

    const hasMeaningfulData = result.title || result.authors.length > 0 || result.abstract;
    if (!hasMeaningfulData) {
      return jsonResponse({
        success: false,
        error: 'AI 未能从文本中提取到有效的文献信息，请检查文本内容或稍后重试',
      }, 422);
    }

    // 生成引用格式
    const citations = {
      bibtex: generateBibTeX(result),
      ieee: generateIEEE(result),
      gb7714: generateGB7714(result),
    };

    return jsonResponse({
      success: true,
      data: { ...result, citations },
    });
  } catch (e) {
    console.error('[CF-ParsePaper] Error:', e.name, e.message);
    return jsonResponse({ success: false, error: e.message }, 502);
  }
}

function validateMonth(m) {
  const n = Number(m);
  if (n >= 1 && n <= 12) return n;
  return null;
}

function extractYearFromText(text) {
  // 多种模式匹配年份
  const patterns = [
    /(?:Published|Publication|出版|发表).*?(\d{4})/i,
    /©\s*(\d{4})/,
    /(\d{4})\s*(?:IEEE|ACM|Springer|Elsevier|Wiley|Nature|Science|arXiv)/i,
    /(?:Conference|Proceedings|Journal|Symposium).*?(\d{4})/i,
    /(\d{4})\s*,\s*Vol\./i,
    /Vol\.\s*\d+.*?(\d{4})/i,
    /(?:Received|Accepted|Published)\s*(?:on\s*)?(?:\w+\s+)?(\d{4})/i,
    /arXiv:\d+\.(\d{4})/, // arXiv ID 中的年份
    /(\d{4})\s*;\s*\d+\s*\(/, // PubMed 格式
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const year = parseInt(m[1]);
      if (year >= 1900 && year <= new Date().getFullYear()) return year;
    }
  }
  return null;
}

function inferSourceType(venue) {
  if (!venue) return '';
  const v = venue.toLowerCase();
  if (v.includes('arxiv')) return 'preprint';
  if (v.includes('conference') || v.includes('proceedings') || v.includes('symposium') || v.includes('workshop')) return 'conference';
  if (v.includes('journal') || v.includes('transactions') || v.includes('letters') || v.includes('review')) return 'journal';
  if (v.includes('thesis') || v.includes('dissertation')) return 'thesis';
  if (v.includes('book') || v.includes('handbook')) return 'book';
  return 'journal';
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
  const t = text;

  // Title
  const titleMatch = t.match(/(?:Title|题目)[:\s]*([^\n]{10,300})/i)
    || t.match(/^([A-Z][^\n.!?]{10,300})\n/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Authors
  const authorMatch = t.match(/(?:Authors?|作者)[:\s]*([^\n]{5,500})/i);
  if (authorMatch) {
    result.authors = authorMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  // Year
  result.year = extractYearFromText(t);

  // Abstract
  const abstractMatch = t.match(/(?:Abstract|摘要)[\s\S]{0,100}?([\s\S]{50,3000}?)(?:\n\s*\n|\n(?:Index|Keywords|Key\s*words|I\.?\s+INTRODUCTION|\d+\.?\s+[A-Z]|1\s+Introduction))/i);
  if (abstractMatch) {
    result.abstract = abstractMatch[1].trim().replace(/\s+/g, ' ').slice(0, 2500);
  }

  // Venue
  const venueMatch = t.match(/(?:Journal|Conference|Venue|Proceedings|期刊|会议)[:\s]*([^\n]{3,200})/i);
  if (venueMatch) result.venue = venueMatch[1].trim();

  // Volume / Issue / Pages
  const volMatch = t.match(/Vol\.?\s*(\d+)[\s,;]*/i) || t.match(/Volume[\s:]+(\d+)/i);
  if (volMatch) result.volume = volMatch[1];
  const issueMatch = t.match(/No\.?\s*(\d+)[\s,;]*/i) || t.match(/Issue[\s:]+(\d+)/i) || t.match(/\((\d+)\)/);
  if (issueMatch) result.issue = issueMatch[1];
  const pagesMatch = t.match(/pp\.?\s*([\d\-–]+)/i) || t.match(/Pages?[\s:]+([\d\-–]+)/i);
  if (pagesMatch) result.pages = pagesMatch[1].replace(/–/g, '-');

  // DOI
  const doiMatch = t.match(/DOI[\s:]+(10\.\d{4,9}\/[^\s]+)/i)
    || t.match(/(10\.\d{4,9}\/[^\s,;]+)/);
  if (doiMatch) result.doi = doiMatch[1].trim();

  // URL
  const urlMatch = t.match(/(https?:\/\/[^\s\)]+)/);
  if (urlMatch) result.url = urlMatch[1].trim();

  // Keywords
  const kwMatch = t.match(/(?:Keywords?|关键词)[\s:]*([^\n]{5,500})/i);
  if (kwMatch) {
    result.keywords = kwMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  // Source type
  result.sourceType = inferSourceType(result.venue);

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
  const type = p.sourceType === 'conference' ? 'inproceedings' : 'article';
  const venueKey = type === 'inproceedings' ? 'booktitle' : 'journal';
  let lines = [`@${type}{cite:${p.year || '????'},`];
  lines.push(`  title = {${escapeBibTeX(p.title || '')}},`);
  if (authors) lines.push(`  author = {${escapeBibTeX(authors)}},`);
  lines.push(`  ${venueKey} = {${escapeBibTeX(p.venue || '')}},`);
  if (p.year) lines.push(`  year = {${p.year}},`);
  if (p.volume) lines.push(`  volume = {${p.volume}},`);
  if (p.issue) lines.push(`  number = {${p.issue}},`);
  if (p.pages) lines.push(`  pages = {${p.pages}},`);
  if (p.doi) lines.push(`  doi = {${p.doi}},`);
  if (p.url) lines.push(`  url = {${p.url}},`);
  lines.push('}');
  return lines.join('\n');
}

function escapeBibTeX(str) {
  return str.replace(/([#%&_{}$])/g, '\\$1');
}

function generateIEEE(p) {
  const authors = (p.authors || []).map(a => {
    const parts = a.split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(x => x[0] + '.').join(' ');
      return `${last}, ${initials}`;
    }
    return a;
  }).join(', ');
  const parts = [];
  if (authors) parts.push(authors);
  if (p.title) parts.push(`"${p.title},"`);
  if (p.venue) parts.push(p.venue);
  const volIssue = [p.volume && `vol. ${p.volume}`, p.issue && `no. ${p.issue}`].filter(Boolean);
  if (volIssue.length) parts.push(volIssue.join(', '));
  if (p.pages) parts.push(`pp. ${p.pages}`);
  if (p.year) parts.push(p.year);
  return parts.join(', ') + '.';
}

function generateGB7714(p) {
  const lang = /[\u4e00-\u9fa5]/.test(p.title || p.authors?.join('') || '') ? 'zh' : 'en';
  const sep = lang === 'zh' ? '，' : ', ';
  const authors = (p.authors || []).join(sep);
  const typeLabel = p.sourceType === 'conference' ? '[C]' : p.sourceType === 'thesis' ? '[D]' : p.sourceType === 'book' ? '[M]' : '[J]';
  let s = '';
  if (authors) s += authors + '. ';
  if (p.title) s += p.title + typeLabel + '. ';
  if (p.venue) s += p.venue;
  if (p.year) s += ', ' + p.year;
  if (p.volume || p.issue) {
    s += ', ';
    if (p.volume) s += p.volume;
    if (p.issue) s += '(' + p.issue + ')';
  }
  if (p.pages) s += ': ' + p.pages;
  s += '.';
  return s;
}
