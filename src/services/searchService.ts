import { apiClient } from './api';
import type { Paper } from '@/types';

export interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year?: number;
  venue?: string;
  doi?: string;
  pdfUrl?: string;
  url?: string;
  source: 'arxiv' | 'crossref';
}

export const searchService = {
  arxiv: (query: string, start?: number) => {
    const params = new URLSearchParams({ query, ...(start ? { start: String(start) } : {}) });
    return apiClient.get<SearchResult[]>(`/api-external/search/arxiv?${params}`);
  },

  crossref: (query: string, rows?: number) => {
    const params = new URLSearchParams({ query, rows: String(rows || 10) });
    return apiClient.get<SearchResult[]>(`/search/crossref?${params}`);
  },

  importPaper: (paper: Partial<Paper>) => apiClient.post<Paper>('/import', paper),
};
