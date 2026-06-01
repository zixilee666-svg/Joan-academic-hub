/**
 * AI 论文解析器（前端直连 AI API，绕过 Cloud Function 超时限制）
 *
 * v2 — 全面强化：
 *   + BibTeX/RIS 结构化预处理
 *   + max_tokens 600→1500（前端无超时限制）
 *   + 正则 fallback 覆盖 BibTeX/RIS/CSV/纯文本
 *   + AI 原始返回调试日志
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

  if (!text || text.trim().length < 30) {
    return { success: false, error: '文本太短，无法解析' };
  }

  // ---- 步骤 1：BibTeX/RIS 结构化预处理 ----
  const preExtracted = preExtractStructured(text);
  if (preExtracted) {
    console.log('[aiParser] Pre-extracted from structured format (BibTeX/RIS):',
      JSON.stringify(preExtracted).slice(0, 300));
  }

  // ---- 步骤 2：清理文本后发送给 AI（作为补充源） ----
  const cleanedText = cleanInputText(text).slice(0, 6000);
  const userPrompt = preExtracted
    ? `Pre-extracted fields (from BibTeX/RIS):\n${JSON.stringify(preExtracted, null, 2)}\n\nFull text (for abstract/keywords):\n${cleanedText.slice(0, 2000)}`
    : `Extract metadata from this paper text:\n${cleanedText}`;

  // ---- 步骤 3：AI API 调用 ----
  let aiContent: string;
  try {
    const base = baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
    const url = base + '/chat/completions';

    console.log('[aiParser] Calling AI API:', { model, inputLen: cleanedText.length });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.05,
        max_tokens: 1500,
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
    console.log('[aiParser] AI raw response (first 500):', aiContent.slice(0, 500));
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求已取消' };
    }
    console.error('[aiParser] Fetch error:', err.message);
    return { success: false, error: `AI API 请求失败: ${err.message}` };
  }

  // ---- 步骤 4：多层解析（AI JSON → 正则 fallback → 预处理合并） ----
  let aiParsed = tryParseJson(aiContent);
  console.log('[aiParser] AI JSON parsed:', aiParsed ? 'success' : 'null');

  // Fallback 1: 从 AI 文本中正则提取
  if (!aiParsed || !(aiParsed.title || aiParsed.authors?.length || aiParsed.abstract)) {
    console.log('[aiParser] AI JSON empty/incomplete, trying regex on AI response...');
    const reExtracted = extractWithRegex(aiContent);
    aiParsed = mergeParsed(aiParsed || {}, reExtracted);
  }

  // Fallback 2: 从原始文本正则提取
  if (!aiParsed || !(aiParsed.title || aiParsed.authors?.length || aiParsed.abstract)) {
    console.log('[aiParser] Still incomplete, trying regex on original text...');
    const reExtracted2 = extractWithRegex(text.slice(0, 8000));
    aiParsed = mergeParsed(aiParsed || {}, reExtracted2);
  }

  // ---- 步骤 5：合并预处理结果与 AI 结果（预处理权威 + AI 补充） ----
  aiParsed = mergeParsed(preExtracted || {}, aiParsed, 'pre');

  // ---- 步骤 6：组装最终结果 ----
  const dataFields = {
    title: aiParsed?.title || '',
    authors: Array.isArray(aiParsed?.authors) ? aiParsed.authors : [],
    year: Number(aiParsed?.year) || new Date().getFullYear(),
    month: aiParsed?.month ?? null,
    venue: aiParsed?.venue || aiParsed?.journal || '',
    volume: aiParsed?.volume || '',
    issue: aiParsed?.issue || aiParsed?.number || '',
    pages: aiParsed?.pages || '',
    doi: aiParsed?.doi || '',
    url: aiParsed?.url || '',
    abstract: aiParsed?.abstract || '',
    keywords: Array.isArray(aiParsed?.keywords) ? aiParsed.keywords : [],
    references: Array.isArray(aiParsed?.references) ? aiParsed.references : [],
  };

  const result: ParseResult = {
    ...dataFields,
    citations: {
      bibtex: generateBibTeX(dataFields),
      ieee: generateIEEE(dataFields),
      gb7714: generateGB7714(dataFields),
    },
  };

  const hasMeaningfulData = result.title || result.authors.length > 0 || result.abstract;
  if (!hasMeaningfulData) {
    console.error('[aiParser] No meaningful data extracted. Raw AI content:', aiContent.slice(0, 500));
    return { success: false, error: 'AI 未能从文本中提取到有效的文献信息。请检查文本是否包含论文标题、作者等信息，或尝试手动填入。' };
  }

  console.log('[aiParser] Parse success:', JSON.stringify({
    title: result.title?.slice(0, 60),
    authors: result.authors?.join(', ')?.slice(0, 60),
    year: result.year,
    venue: result.venue,
  }));
  return { success: true, data: result };
}

// ============================================================
// System Prompt
// ============================================================

const SYSTEM_PROMPT = `You are a scholarly paper metadata extractor. Given paper text (which may include BibTeX, RIS, or plain text), extract all available metadata. Output ONLY a valid JSON object.

Fields:
- "title": string
- "authors": string[]
- "year": number
- "month": number|null
- "venue": string (journal/conference name)
- "volume": string
- "issue": string
- "pages": string (e.g. "123-145")
- "doi": string
- "url": string
- "abstract": string
- "keywords": string[]

Rules:
1. ONLY output the JSON object — no markdown, no code fences, no explanation.
2. For BibTeX input, extract from the structured fields.
3. Missing fields → "", [], or null.
4. Keep abstract to at most 3 sentences.`;

// ============================================================
// 步骤 1：BibTeX / RIS 结构化预处理
// ============================================================

function preExtractStructured(text: string): Record<string, any> | null {
  // ---- BibTeX 检测 ----
  const bibMatch = text.match(/@\w+\s*\{\s*[^,]*,\s*\n?([\s\S]*?)\}/i);
  if (bibMatch) {
    console.log('[aiParser] Detected BibTeX format');
    const fields = bibMatch[1];
    const result: Record<string, any> = {};

    // 提取 title
    const titleMatch = fields.match(/title\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (titleMatch) result.title = titleMatch[1].replace(/\s+/g, ' ').trim();

    // 提取 author
    const authorMatch = fields.match(/author\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (authorMatch) {
      result.authors = authorMatch[1]
        .split(/\s+and\s+/i)
        .map(a => a.replace(/,/g, '').trim())
        .filter(Boolean);
    }

    // 提取 journal / booktitle
    const journalMatch = fields.match(/(?:journal|booktitle)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);
    if (journalMatch) result.venue = journalMatch[1].trim();

    // 提取 year
    const yearMatch = fields.match(/year\s*=\s*[{\s]*(\d{4})[}\s]*/);
    if (yearMatch) result.year = parseInt(yearMatch[1]);

    // 提取 volume
    const volMatch = fields.match(/volume\s*=\s*[{\s]*([\d]+)[}\s]*/);
    if (volMatch) result.volume = volMatch[1];

    // 提取 number / issue
    const numMatch = fields.match(/(?:number|issue)\s*=\s*[{\s]*([\d]+)[}\s]*/i);
    if (numMatch) result.issue = numMatch[1];

    // 提取 pages
    const pagesMatch = fields.match(/pages\s*=\s*\{([^{}]+)\}/);
    if (pagesMatch) result.pages = pagesMatch[1].replace(/--/g, '-');

    // 提取 doi
    const doiMatch = fields.match(/doi\s*=\s*\{([^{}]+)\}/i) ||
      fields.match(/doi\s*=\s*(10\.\d{4,9}\/[\S]+)/i);
    if (doiMatch) result.doi = doiMatch[1].trim();

    // 提取 url
    const urlMatch = fields.match(/url\s*=\s*\{([^{}]+)\}/i);
    if (urlMatch) result.url = urlMatch[1].trim();

    // 提取 abstract
    const absMatch = fields.match(/abstract\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);
    if (absMatch) result.abstract = absMatch[1].replace(/\s+/g, ' ').trim().slice(0, 2000);

    // 提取 keywords
    const kwMatch = fields.match(/keywords\s*=\s*\{([^{}]+)\}/i);
    if (kwMatch) result.keywords = kwMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);

    const hasData = result.title || result.authors?.length;
    return hasData ? result : null;
  }

  // ---- RIS 检测 ----
  if (/^TY\s+-/im.test(text)) {
    console.log('[aiParser] Detected RIS format');
    const result: Record<string, any> = { authors: [] };

    const risFields: Record<string, string> = {};
    const risRegex = /^([A-Z][A-Z0-9])\s+-\s+(.+)$/gm;
    let m;
    while ((m = risRegex.exec(text)) !== null) {
      risFields[m[1]] = (risFields[m[1]] || '') + (risFields[m[1]] ? '; ' : '') + m[2].trim();
    }

    if (risFields['TI']) result.title = risFields['TI'];
    if (risFields['T1']) result.title = result.title || risFields['T1'];
    if (risFields['AU']) result.authors = risFields['AU'].split(/;\s*/).filter(Boolean);
    if (risFields['PY']) result.year = parseInt(risFields['PY']);
    if (risFields['Y1']) result.year = result.year || parseInt(risFields['Y1']);
    if (risFields['JO'] || risFields['JF']) result.venue = risFields['JO'] || risFields['JF'];
    if (risFields['T2']) result.venue = result.venue || risFields['T2'];
    if (risFields['VL']) result.volume = risFields['VL'];
    if (risFields['IS']) result.issue = risFields['IS'];
    if (risFields['SP']) result.pages = risFields['SP'] + (risFields['EP'] ? '-' + risFields['EP'] : '');
    if (risFields['DO']) result.doi = risFields['DO'];
    if (risFields['UR'] || risFields['L1']) result.url = risFields['UR'] || risFields['L1'];
    if (risFields['AB'] || risFields['N2']) result.abstract = risFields['AB'] || risFields['N2'];
    if (risFields['KW']) result.keywords = risFields['KW'].split(/;\s*/).filter(Boolean);

    const hasData = result.title || result.authors?.length;
    return hasData ? result : null;
  }

  // ---- CSV/TSV（简化）检测 ----
  if (text.includes(',') && /\n[^,]+,/.test(text.slice(0, 500))) {
    const csvParsed = tryParseCsv(text);
    if (csvParsed && (csvParsed.title || csvParsed.authors?.length)) {
      console.log('[aiParser] Detected CSV/TSV format');
      return csvParsed;
    }
  }

  return null;
}

// ============================================================
// CSV/TSV 简易解析
// ============================================================

function tryParseCsv(text: string): Record<string, any> | null {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const header = lines[0].toLowerCase().split(/[,\t]/).map(h => h.trim().replace(/["']/g, ''));
  const data = lines[1].split(/[,\t]/).map(d => d.trim().replace(/^["']|["']$/g, ''));

  if (header.length < 2 || data.length < 2) return null;

  const result: Record<string, any> = {};
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h] = i; });

  // 灵活的列名映射
  const titleCols = ['title', 'name', 'paper title', '文献标题', '标题', '题名'];
  const authorCols = ['authors', 'author', 'authors_full_name', '作者'];
  const yearCols = ['year', 'publication year', '出版年', '年份'];
  const venueCols = ['venue', 'journal', 'conference', '期刊', '会议', 'publication venue', 'source'];
  const doiCols = ['doi'];
  const abstractCols = ['abstract', '摘要'];

  for (const col of titleCols) {
    if (idx[col] !== undefined) { result.title = data[idx[col]]; break; }
  }
  for (const col of authorCols) {
    if (idx[col] !== undefined) {
      result.authors = data[idx[col]].split(/[;&]/).map(s => s.trim()).filter(Boolean);
      break;
    }
  }
  for (const col of yearCols) {
    if (idx[col] !== undefined) { result.year = parseInt(data[idx[col]]) || undefined; break; }
  }
  for (const col of venueCols) {
    if (idx[col] !== undefined) { result.venue = data[idx[col]]; break; }
  }
  for (const col of doiCols) {
    if (idx[col] !== undefined) { result.doi = data[idx[col]]; break; }
  }
  for (const col of abstractCols) {
    if (idx[col] !== undefined) { result.abstract = data[idx[col]]; break; }
  }

  return (result.title || result.authors?.length) ? result : null;
}

// ============================================================
// 文本清理
// ============================================================

function cleanInputText(text: string): string {
  return text
    // 移除过长的空白行
    .replace(/\n{4,}/g, '\n\n\n')
    // 规范化 Unicode
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
}

// ============================================================
// 合并两层解析结果（preExtract 权威，aiParsed 补充）
// ============================================================

function mergeParsed(
  primary: Record<string, any>,
  secondary: Record<string, any>,
  mode: 'pre' | 'ai' = 'ai'
): Record<string, any> {
  const result: Record<string, any> = { ...secondary, ...primary };

  // 如果 primary 有有效数据，用 primary；否则用 secondary
  for (const key of ['title', 'venue', 'year', 'volume', 'issue', 'pages', 'doi', 'url', 'abstract']) {
    if (primary[key] && primary[key] !== '') {
      result[key] = primary[key];
    } else if (!result[key]) {
      result[key] = secondary[key] || '';
    }
  }

  // authors: primary 优先
  if (Array.isArray(primary.authors) && primary.authors.length > 0) {
    result.authors = primary.authors;
  } else if (!Array.isArray(result.authors) || result.authors.length === 0) {
    result.authors = Array.isArray(secondary.authors) ? secondary.authors : [];
  }

  // keywords: 合并去重
  const keywords = new Set<string>();
  (Array.isArray(primary.keywords) ? primary.keywords : []).forEach(k => keywords.add(k));
  (Array.isArray(secondary.keywords) ? secondary.keywords : []).forEach(k => keywords.add(k));
  result.keywords = [...keywords];

  return result;
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
  } catch (e) {
    console.log('[aiParser] JSON parse error:', (e as Error).message);
    return null;
  }
}

// ============================================================
// 正则 fallback 提取（v2 — 支持 BibTeX/RIS/纯文本）
// ============================================================

function extractWithRegex(text: string): Record<string, any> {
  const result: Record<string, any> = {};

  // ---- BibTeX 字段提取 ----
  const bibField = (name: string) => {
    const re = new RegExp(`${name}\\s*=\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}`, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  // Title (BibTeX)
  const bibTitle = bibField('title');
  if (bibTitle) result.title = bibTitle.replace(/\s+/g, ' ').trim();

  // Title (tagged / plain text)
  if (!result.title) {
    const titleMatch =
      text.match(/(?:Title|题目|TI\s+-)[:\s]*([^\n]{10,200})/i) ||
      text.match(/^#\s*(.+)$/m) ||
      text.match(/^([A-Z][^\n.!?]{15,200})\n/gm);
    if (titleMatch) result.title = (titleMatch[1] || titleMatch[2] || '').trim();
  }

  // Authors (BibTeX)
  const bibAuthor = bibField('author');
  if (bibAuthor) {
    result.authors = bibAuthor
      .split(/\s+and\s+/i)
      .map(a => a.replace(/,/g, '').trim())
      .filter(Boolean);
  }

  // Authors (tagged / plain text)
  if (!result.authors?.length) {
    const authorMatch =
      text.match(/(?:Authors|Author|AU\s+-|作者)[:\s]*([^\n]{5,300})/i);
    if (authorMatch) {
      result.authors = authorMatch[1].split(/[,;]|\band\b|\s{2,}/g).map(s => s.trim()).filter(Boolean);
    }
  }

  // Year (BibTeX)
  const bibYear = text.match(/year\s*=\s*[{\s]*(\d{4})[}\s]*/i);
  if (bibYear) result.year = parseInt(bibYear[1]);

  // Year (RIS)
  if (!result.year) {
    const risYear = text.match(/^PY\s+-\s+(\d{4})/im) || text.match(/^Y1\s+-\s+(\d{4})/im);
    if (risYear) result.year = parseInt(risYear[1]);
  }

  // Year (tagged / plain text)
  if (!result.year) {
    const yearMatch =
      text.match(/(?:Year|年份|Published|date|©)\s*[:\s]*(\d{4})/i) ||
      text.match(/[(\[](\d{4})[)\]]/) ||
      text.match(/(\d{4})\s*(?:IEEE|ACM|Springer|Elsevier)/i);
    if (yearMatch) result.year = parseInt(yearMatch[1]);
  }

  // Venue (BibTeX)
  const bibJournal = bibField('journal') || bibField('booktitle');
  if (bibJournal) result.venue = bibJournal.trim();

  // Venue (RIS)
  if (!result.venue) {
    const risVenue = text.match(/^(?:JO|JF|T2)\s+-\s+(.+)$/im);
    if (risVenue) result.venue = risVenue[1].trim();
  }

  // Venue (tagged / plain text)
  if (!result.venue) {
    const venueMatch =
      text.match(/(?:Journal|Conference|Venue|期刊|会议)[:\s]*([^\n]{3,100})/i) ||
      text.match(/IEEE Transactions on ([^\n,]{5,100})/i) ||
      text.match(/In Proceedings of ([^\n,]{5,100})/i);
    if (venueMatch) result.venue = venueMatch[1].trim();
  }

  // Volume (BibTeX)
  const bibVol = text.match(/volume\s*=\s*[{\s]*(\d+)[}\s]*/i);
  if (bibVol) result.volume = bibVol[1];

  // Volume (RIS)
  if (!result.volume) {
    const risVol = text.match(/^VL\s+-\s+(.+)$/im);
    if (risVol) result.volume = risVol[1].trim();
  }

  // Issue (BibTeX)
  const bibIssue = text.match(/(?:number|issue)\s*=\s*[{\s]*(\d+)[}\s]*/i);
  if (bibIssue) result.issue = bibIssue[1];

  // Issue (RIS)
  if (!result.issue) {
    const risIssue = text.match(/^IS\s+-\s+(.+)$/im);
    if (risIssue) result.issue = risIssue[1].trim();
  }

  // Pages (BibTeX)
  const bibPages = bibField('pages');
  if (bibPages) result.pages = bibPages.replace(/--/g, '-');

  // Pages (RIS)
  if (!result.pages) {
    const risSP = text.match(/^SP\s+-\s+(.+)$/im);
    const risEP = text.match(/^EP\s+-\s+(.+)$/im);
    if (risSP) result.pages = risSP[1] + (risEP ? '-' + risEP[1] : '');
  }

  // DOI (BibTeX + RIS + plain)
  const bibDoi = text.match(/doi\s*=\s*\{?(10\.\d{4,9}\/[\S]+)\}?/i);
  if (bibDoi) result.doi = bibDoi[1].trim();

  if (!result.doi) {
    const risDoi = text.match(/^DO\s+-\s+(.+)$/im);
    if (risDoi) result.doi = risDoi[1].trim();
  }

  if (!result.doi) {
    const plainDoi = text.match(/DOI[:\s]*([^\s]{10,100})/i) ||
      text.match(/(10\.\d{4,9}\/[\S]+)/i);
    if (plainDoi) result.doi = plainDoi[1].trim();
  }

  // URL (BibTeX + RIS + plain)
  const bibUrl = bibField('url');
  if (bibUrl) result.url = bibUrl;
  if (!result.url) {
    const risUrl = text.match(/^(?:UR|L1)\s+-\s+(.+)$/im);
    if (risUrl) result.url = risUrl[1].trim();
  }
  if (!result.url) {
    const plainUrl = text.match(/(https?:\/\/[^\s\n]{10,200})/i);
    if (plainUrl) result.url = plainUrl[1];
  }

  // Abstract (BibTeX)
  const bibAbs = bibField('abstract');
  if (bibAbs) result.abstract = bibAbs.replace(/\s+/g, ' ').trim().slice(0, 3000);

  // Abstract (RIS)
  if (!result.abstract) {
    const risAbs = text.match(/^(?:AB|N2)\s+-\s+(.+)$/im);
    if (risAbs) result.abstract = risAbs[1].trim();
  }

  // Abstract (tagged / plain text)
  if (!result.abstract) {
    const absMatch = text.match(
      /(?:Abstract|摘要|ABSTRACT)[\s\S]{0,50}?([\s\S]{50,3000}?)(?:\n\s*\n|\n(?:Index|Keywords|I\.?\s+INTRODUCTION|\d+\.?\s+[A-Z]|References|Bibliography))/i
    );
    if (absMatch) result.abstract = absMatch[1].trim().replace(/\s+/g, ' ').slice(0, 3000);
  }

  // Keywords (BibTeX + RIS)
  const bibKw = bibField('keywords');
  if (bibKw) result.keywords = bibKw.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  if (!result.keywords?.length) {
    const risKw = text.match(/^KW\s+-\s+(.+)$/im);
    if (risKw) result.keywords = risKw[1].split(/;\s*/).filter(Boolean);
  }

  if (!result.keywords?.length) {
    const kwMatch = text.match(/(?:Keywords|关键词|Keywords)[:\s]*([^\n]{5,200})/i);
    if (kwMatch) result.keywords = kwMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  console.log('[aiParser] Regex extracted:', JSON.stringify(result).slice(0, 300));
  return result;
}

// ============================================================
// 引用格式生成器
// ============================================================

function generateBibTeX(p: Record<string, any>): string {
  const firstAuthor = (p.authors || [])[0] || 'unknown';
  const key = p.citeKey || `${firstAuthor.replace(/\s+/g, '')}${p.year || ''}`;
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
