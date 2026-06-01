/**
 * AI 论文解析器（前端直连 AI API，绕过 Cloud Function 超时限制）
 *
 * 为什么不用 Cloud Function？
 * - EdgeOne CF 平台超时约 60s 硬限制，DeepSeek 非流式调用容易超时
 * - 前端直连无中间层超时，稳定可靠
 */

export interface ParseResult {
  title: string;
  authors: string[];
  year: number;
  month: number | null;
  venue: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  abstract: string;
  keywords: string[];
  citations: { bibtex: string; ieee: string; gb7714: string };
  references: { title: string; authors: string[]; year: number; venue: string }[];
}

interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ============================================================
// 主入口：直接调用 AI API 解析论文文本
// ============================================================

export async function parsePaperDirectly(
  text: string,
  modelConfig: ModelConfig,
  signal?: AbortSignal
): Promise<{ success: boolean; data?: ParseResult; error?: string }> {
  const { baseUrl, apiKey, model } = modelConfig;

  if (!text || text.trim().length < 50) {
    return { success: false, error: '文本太短，无法解析' };
  }

  const systemPrompt = `You are a scholarly paper metadata extractor. Given paper text (title, authors, abstract), extract metadata. Output ONLY a valid JSON object.

Fields:
- "title": string
- "authors": string[]
- "year": number
- "month": number|null
- "venue": string (journal/conference)
- "volume": string
- "issue": string
- "pages": string (e.g. "123-145")
- "doi": string
- "url": string
- "abstract": string
- "keywords": string[]

Rules:
1. ONLY output the JSON object — no markdown, no code fences, no explanation.
2. Missing fields → "", [], or null.
3. Keep the abstract to at most 3 sentences if long.`;

  const truncatedText = text.slice(0, 3000);
  const userPrompt = `Extract metadata from this paper text:\n${truncatedText}`;

  const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
  const url = base + '/chat/completions';

  console.log('[aiParser] Calling AI API:', { model, url: url.replace(/https?:\/\/[^/]+/, '***') });

  // ---- AI API 调用 ----
  let aiContent: string;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.05,
        max_tokens: 600,
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      console.error('[aiParser] AI API error:', res.status, errText.slice(0, 300));
      return { success: false, error: `AI API 返回错误 ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    aiContent = data.choices?.[0]?.message?.content || '';
    console.log('[aiParser] AI content length:', aiContent.length);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求已取消' };
    }
    console.error('[aiParser] Fetch error:', err.message);
    return { success: false, error: `AI API 请求失败: ${err.message}` };
  }

  // ---- 解析 AI 返回的 JSON ----
  let parsed = tryParseJson(aiContent);

  // Fallback: 正则提取
  if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
    console.log('[aiParser] JSON parse yielded empty, trying regex fallback...');
    parsed = extractWithRegex(aiContent);
  }

  // Second fallback: 从原始文本提取
  if (!parsed || !(parsed.title || parsed.authors?.length || parsed.abstract)) {
    console.log('[aiParser] Regex fallback also empty, trying from original text...');
    parsed = extractWithRegex(text.slice(0, 4000));
  }

  // ---- 组装结果 ----
  const result: ParseResult = {
    title: parsed?.title || '',
    authors: Array.isArray(parsed?.authors) ? parsed.authors : [],
    year: Number(parsed?.year) || new Date().getFullYear(),
    month: parsed?.month ?? null,
    venue: parsed?.venue || parsed?.journal || '',
    volume: parsed?.volume || '',
    issue: parsed?.issue || parsed?.number || '',
    pages: parsed?.pages || '',
    doi: parsed?.doi || '',
    url: parsed?.url || '',
    abstract: parsed?.abstract || '',
    keywords: Array.isArray(parsed?.keywords) ? parsed.keywords : [],
    citations: {
      bibtex: generateBibTeX(result as any),
      ieee: generateIEEE(result as any),
      gb7714: generateGB7714(result as any),
    },
    references: Array.isArray(parsed?.references) ? parsed.references : [],
  };

  // Re-generate citations with assembled result
  result.citations = {
    bibtex: generateBibTeX(result),
    ieee: generateIEEE(result),
    gb7714: generateGB7714(result),
  };

  const hasMeaningfulData = result.title || result.authors.length > 0 || result.abstract;
  if (!hasMeaningfulData) {
    console.error('[aiParser] No meaningful data extracted, raw AI content:', aiContent.slice(0, 500));
    return { success: false, error: 'AI 未能从文本中提取到有效的文献信息，请检查文本内容或稍后重试' };
  }

  console.log('[aiParser] Parse success:', JSON.stringify(result).slice(0, 300));
  return { success: true, data: result };
}

// ============================================================
// JSON 解析（支持 markdown 代码块清理）
// ============================================================

function tryParseJson(str: string): Record<string, any> | null {
  try {
    let jsonStr = str.trim();

    // 移除 markdown 代码块
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // 找到最外层 {}
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

// ============================================================
// 正则 fallback 提取（当 AI JSON 解析失败时）
// ============================================================

function extractWithRegex(text: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Title
  const titleMatch =
    text.match(/(?:Title|题目)[:\s]*([^\n]{10,200})/i) ||
    text.match(/^([A-Z][^\n.!?]{10,200})\n/gm);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Authors
  const authorMatch = text.match(/(?:Authors|作者)[:\s]*([^\n]{5,200})/i);
  if (authorMatch) {
    result.authors = authorMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  // Year
  const yearMatch =
    text.match(/(?:Year|年份|©)\s*[:\s]*(\d{4})/i) ||
    text.match(/(\d{4})\s*(?:IEEE|ACM|Springer|Elsevier)/i);
  if (yearMatch) result.year = parseInt(yearMatch[1]);

  // Abstract
  const abstractMatch = text.match(
    /(?:Abstract|摘要)[\s\S]{0,50}?([\s\S]{50,2000}?)(?:\n\s*\n|\n(?:Index|Keywords|I\.?\s+INTRODUCTION|\d+\.?\s+[A-Z]))/i
  );
  if (abstractMatch) result.abstract = abstractMatch[1].trim().replace(/\s+/g, ' ').slice(0, 1500);

  // Venue
  const venueMatch =
    text.match(/(?:Journal|Conference|Venue|期刊|会议)[:\s]*([^\n]{3,100})/i) ||
    text.match(/IEEE Transactions on ([^\n,]{5,100})/i);
  if (venueMatch) result.venue = venueMatch[1].trim();

  // DOI
  const doiMatch =
    text.match(/DOI[:\s]*([^\s]{10,100})/i) ||
    text.match(/(10\.\d{4,9}\/[\S]+)/i);
  if (doiMatch) result.doi = doiMatch[1].trim();

  return result;
}

// ============================================================
// 引用格式生成器
// ============================================================

function generateBibTeX(p: Record<string, any>): string {
  const key = p.citeKey || `cite:${p.year || '????'}`;
  const authors = (p.authors || []).join(' and ');
  return `@article{${key},
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

function generateIEEE(p: Record<string, any>): string {
  const authors = (p.authors || [])
    .map(a => {
      const parts = a.split(' ');
      return parts.length > 1 ? `${parts[parts.length - 1]}, ${parts[0][0]}.` : a;
    })
    .join(', ');
  return `${authors}, "${p.title || ''}," ${p.venue || ''}, vol. ${p.volume || ''}, no. ${p.issue || ''}, pp. ${p.pages || ''}, ${p.year || ''}.`;
}

function generateGB7714(p: Record<string, any>): string {
  const lang = /[\u4e00-\u9fa5]/.test(p.title || (p.authors || []).join('') || '') ? 'zh' : 'en';
  if (lang === 'zh') {
    return `${(p.authors || []).join('，') || ''}. ${p.title || ''}[J]. ${p.venue || ''}, ${p.year || ''}, ${p.volume || ''}(${p.issue || ''}): ${p.pages || ''}.`;
  }
  return `${(p.authors || []).join(', ') || ''}. ${p.title || ''}[J]. ${p.venue || ''}, ${p.year || ''}, ${p.volume || ''}(${p.issue || ''}): ${p.pages || ''}.`;
}
