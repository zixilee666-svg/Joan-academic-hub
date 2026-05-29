/**
 * Cloud Function: Academic Search Proxy
 *
 * 为什么用 Cloud Function 而不用 Edge Function？
 * - Edge Function (V8 isolate) 无法访问外部网络（fetch 外部域名会 net_exception_timeout）
 * - Cloud Function (Node.js) 可以正常访问外部 API
 *
 * 路由（使用 /api-external/ 前缀避免与 Edge Function 的 /api/(.*) 冲突）：
 *   GET /api-external/search/arxiv?query=...&start=...&max_results=...
 *   GET /api-external/search/semantic-scholar?query=...&offset=...&limit=...&apiKey=...
 */

// ============================================================
// CORS
// ============================================================
function corsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Max-Age': '86400',
  };
}

function successJson(data, message = 'Success') {
  const body = { success: true, data, Message: message };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorJson(message, status = 502) {
  const body = { success: false, data: [], Message: message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ============================================================
// arXiv 搜索
// ============================================================
async function handleSearchArxiv(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const start = parseInt(url.searchParams.get('start') || '0', 10);
  const maxResults = Math.min(parseInt(url.searchParams.get('max_results') || '10', 10), 50);

  if (!query.trim()) {
    return successJson({ data: [], total: 0, offset: start, limit: maxResults }, 'Empty query');
  }

  try {
    const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=${start}&max_results=${maxResults}`;
    console.log('[Search-Arxiv] Fetching:', arxivUrl);

    const res = await fetch(arxivUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'AcademicHub/1.1 (mailto:research@academichub.local)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error('[Search-Arxiv] HTTP error:', res.status, res.statusText);
      return successJson({ data: [], total: 0, offset: start, limit: maxResults },
        `arXiv API 返回状态码 ${res.status}，请稍后重试`);
    }

    const xml = await res.text();
    if (!xml.includes('<entry>')) {
      return successJson({ data: [], total: 0, offset: start, limit: maxResults }, 'No results found');
    }

    // Parse totalResults
    const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    // Parse entries
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
        ?.replace(/\s+/g, ' ').trim() || '';
      const id = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || '';
      const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim() || '';
      const updated = (entry.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1]?.trim() || '';
      const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]
        ?.replace(/\s+/g, ' ').trim() || '';
      const doiMatch = entry.match(/<arxiv:doi>([\s\S]*?)<\/arxiv:doi>/);
      const doi = doiMatch ? doiMatch[1].trim() : '';

      const catMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
      const primaryCategory = catMatch ? catMatch[1] : '';

      const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
      const pdfUrl = pdfMatch ? pdfMatch[1] : '';

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
        pdfUrl,
        primaryCategory,
        updated,
        citations: 0,
      });
    }

    return successJson({ data: entries, total, offset: start, limit: maxResults });
  } catch (e) {
    console.error('[Search-Arxiv] Exception:', e.message);
    return successJson({ data: [], total: 0, offset: start, limit: maxResults },
      `arXiv 搜索异常: ${e.message}`);
  }
}

// ============================================================
// Semantic Scholar 搜索
// ============================================================
async function handleSearchSemanticScholar(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 100);
  const apiKey = url.searchParams.get('apiKey');

  if (!query.trim()) {
    return successJson({ data: [], total: 0, offset, limit, next: null }, 'Empty query');
  }

  try {
    const fields = [
      'title', 'authors', 'year', 'venue', 'abstract',
      'citationCount', 'influentialCitationCount', 'externalIds',
      'url', 'openAccessPdf', 'isOpenAccess', 'tldr', 'publicationTypes',
    ].join(',');
    const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}&offset=${offset}`;
    console.log('[Search-SS] Fetching:', ssUrl);

    const headers = { 'Accept': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    const res = await fetch(ssUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error('[Search-SS] HTTP error:', res.status, res.statusText);
      if (res.status === 429) {
        return errorJson('请求过于频繁，请等待 10-20 秒后重试', 429);
      }
      return successJson({ data: [], total: 0, offset, limit, next: null },
        `Semantic Scholar API 返回状态码 ${res.status}，请稍等后重试`);
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
      arxivId: p.externalIds?.ArXiv || '',
      url: p.url || '',
      citations: p.citationCount || 0,
      influentialCitations: p.influentialCitationCount || 0,
      tldr: p.tldr?.text || '',
      openAccessPdf: p.openAccessPdf?.url || '',
      isOpenAccess: p.isOpenAccess || false,
      publicationTypes: p.publicationTypes || [],
    }));

    const nextOffset = data.next || null;
    return successJson({ data: papers, total: data.total || papers.length, offset, limit, next: nextOffset });
  } catch (e) {
    console.error('[Search-SS] Exception:', e.message);
    return successJson({ data: [], total: 0, offset, limit, next: null },
      `Semantic Scholar 搜索异常: ${e.message}`);
  }
}

// ============================================================
// Main Handler
// ============================================================
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'GET') {
    return errorJson('Method not allowed', 405);
  }

  let response;
  if (path.endsWith('/search/arxiv')) {
    response = await handleSearchArxiv(request);
  } else if (path.endsWith('/search/semantic-scholar')) {
    response = await handleSearchSemanticScholar(request);
  } else {
    response = errorJson('Unknown search endpoint', 404);
  }

  // Attach CORS headers
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
