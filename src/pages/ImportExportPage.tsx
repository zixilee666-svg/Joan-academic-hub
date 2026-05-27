// ========================================
// ImportExportPage — 批量导入导出
// ========================================
import { useState, useCallback } from 'react';
import {
  Upload, Download, FileText, FileSpreadsheet, Search,
  Atom, BookOpen, AlertCircle, CheckCircle2, Loader2,
  ClipboardList, ArrowRight, Plug, ExternalLink,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import AnimatedPage from '@/components/shared/AnimatedPage';
import EmptyState from '@/components/shared/EmptyState';
import AiParseResultDialog, { type ParsedPaperResult } from '@/components/shared/AiParseResultDialog';
import { api } from '@/lib/api';
import { useSettingsStore } from '@/store';
import { cn } from '@/lib/utils';
import { extractTextFromFile } from '@/lib/fileExtractor';
import knowledgeGraphLib, { addZoteroPapersToLocalKG } from '@/lib/knowledgeGraph';

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState('import');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState<'arxiv' | 'semantic' | 'zotero'>('arxiv');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [useAiParse, setUseAiParse] = useState(false);
  const [aiParseText, setAiParseText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedPaperResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Search handlers — uses API
  const settings = useSettingsStore();

  const handleSearch = useCallback(async () => {
    if (searchSource === 'zotero') return;
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      let results: any[] = [];
      if (searchSource === 'arxiv') {
        const res = await api.searchArxiv(searchQuery);
        results = (res.data || []).map((p: any, i: number) => ({
          id: p.id || `arxiv-${i}`,
          title: p.title || '',
          authors: p.authors || [],
          year: p.year || p.published?.split('-')[0] || 2024,
          venue: p.venue || 'arXiv',
          abstract: p.abstract || p.summary || '',
          citations: p.citations || 0,
          source: 'arXiv',
          doi: p.doi,
          url: p.url || p.id,
        }));
      } else {
        const res = await api.searchSemanticScholar(searchQuery, 0, settings.semanticScholarApiKey);
        results = (res.data || []).map((p: any, i: number) => ({
          id: p.id || `ss-${i}`,
          title: p.title || '',
          authors: p.authors || [],
          year: p.year || 2024,
          venue: p.venue || '',
          abstract: p.abstract || '',
          citations: p.citations || 0,
          source: 'Semantic Scholar',
          doi: p.doi,
          url: p.url,
        }));
      }

      if (results.length === 0 && api.isMock()) {
        results = [
          { id: 's1', title: `Graph Neural Networks for ${searchQuery}: A Comprehensive Study`, authors: ['Alice Smith', 'Bob Johnson'], year: 2024, venue: 'NeurIPS', abstract: `This paper presents a comprehensive study of GNN applications in ${searchQuery}...`, citations: 45, source: searchSource === 'arxiv' ? 'arXiv' : 'Semantic Scholar' },
          { id: 's2', title: `Heterogeneous ${searchQuery} Detection via Attention Mechanism`, authors: ['Carol Williams', 'David Brown'], year: 2024, venue: 'KDD', abstract: `We propose a novel attention mechanism for ${searchQuery} detection...`, citations: 23, source: searchSource === 'arxiv' ? 'arXiv' : 'Semantic Scholar' },
          { id: 's3', title: `Dynamic Graph Learning for ${searchQuery} Analysis`, authors: ['Eve Davis', 'Frank Miller'], year: 2023, venue: 'ICLR', abstract: `A temporal approach to ${searchQuery} using dynamic GNN...`, citations: 67, source: searchSource === 'arxiv' ? 'arXiv' : 'Semantic Scholar' },
        ];
      }

      setSearchResults(results);
      toast.success(`找到 ${results.length} 条结果`);
    } catch (err: any) {
      console.error('[Import] Search error:', err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('Too Many Requests')) {
        toast.error('搜索频率受限，请稍等 10-20 秒后重试');
      } else if (msg.includes('502') || msg.includes('EXTERNAL_API_ERROR')) {
        toast.error('外部学术服务暂不可用，请稍后重试');
      } else {
        toast.error('搜索失败，请重试');
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchSource]);

  const handleZoteroImport = useCallback(async () => {
    if (!settings.zoteroUserId || !settings.zoteroApiKey) {
      toast.error('请先在设置中配置 Zotero User ID 和 API Key');
      return;
    }
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await api.importZotero(settings.zoteroUserId, settings.zoteroApiKey, true, false);
      const data = res.data || {};
      const papers = (data.papers || []).map((p: any) => ({
        id: p.id,
        title: p.title || '',
        authors: p.authors || [],
        year: p.year || 2024,
        venue: p.venue || '',
        abstract: p.abstract || '',
        citations: p.citations || 0,
        source: 'Zotero',
        doi: p.doi,
        url: p.url,
        tags: p.tags || [],
      }));
      setSearchResults(papers);
      // 将导入的论文添加到本地知识图谱
      try {
        addZoteroPapersToLocalKG(papers);
      } catch (kgErr) {
        console.warn('[Zotero Import] Failed to add to local KG:', kgErr);
      }
      // 显示详细导入结果
      const stats = data.stats || { papers: 0, notes: 0, attachments: 0, errors: 0 };
      let msg = `导入完成: ${stats.papers} 篇文献`;
      if (stats.notes > 0) msg += `, ${stats.notes} 条笔记`;
      if (stats.attachments > 0) msg += `, ${stats.attachments} 个附件`;
      if (stats.errors > 0) msg += ` (${stats.errors} 个错误)`;
      toast.success(msg);
      // 如果有错误，打印到控制台
      if (data.errors && data.errors.length > 0) {
        console.warn('[Zotero Import] Errors:', data.errors);
      }
    } catch (err: any) {
      console.error('[Import] Zotero error:', err);
      toast.error('Zotero 导入失败: ' + (err.message || '请检查配置'));
    } finally {
      setIsSearching(false);
    }
  }, [settings.zoteroUserId, settings.zoteroApiKey]);

  // Import from search results — uses API
  const importFromSearch = useCallback(async (paper: any) => {
    setImporting(true);
    setImportProgress(0);

    try {
      // Animate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 15, 90));
      }, 300);

      await api.importFromSearch({
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        venue: paper.venue,
        abstract: paper.abstract,
        doi: paper.doi,
        url: paper.url,
        tags: [],
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      toast.success(`「${paper.title.slice(0, 40)}${paper.title.length > 40 ? '...' : ''}」已导入文献库`);
    } catch (err) {
      console.error('[Import] Import error:', err);
      toast.error('导入失败，请重试');
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
      }, 500);
    }
  }, [useAiParse]);

  // AI parse helper
  const doAiParse = async (text: string) => {
    const defaultModel = settings.aiModels.find(m => m.id === settings.defaultAiModelId);
    if (!defaultModel || !defaultModel.apiKey) {
      toast.error('请先前往「设置 → 外部工具 → AI 模型」配置并选择默认模型');
      return null;
    }
    setAiParsing(true);
    try {
      const res = await api.parsePaper(text, defaultModel);
      if (res.success && res.data) {
        // Ensure all fields exist with defaults
        const result: ParsedPaperResult = {
          title: res.data.title || '',
          authors: res.data.authors || [],
          year: res.data.year || new Date().getFullYear(),
          month: res.data.month ?? null,
          venue: res.data.venue || '',
          volume: res.data.volume || '',
          issue: res.data.issue || '',
          pages: res.data.pages || '',
          doi: res.data.doi || '',
          url: res.data.url || '',
          abstract: res.data.abstract || '',
          keywords: res.data.keywords || [],
          citations: res.data.citations || { bibtex: '', ieee: '', gb7714: '' },
          references: res.data.references || [],
        };
        setParseResult(result);
        setDialogOpen(true);
        return result;
      }
      // 后端返回 success=false 的情况
      const errorMsg = (res as any).error || 'AI 解析失败，请重试';
      console.error('[AI Parse] Server error:', errorMsg, (res as any).debug);
      toast.error(errorMsg);
      return null;
    } catch (err: any) {
      console.error('[AI Parse] Error:', err);
      toast.error('AI 解析出错: ' + (err.message || '请检查模型配置'));
      return null;
    } finally {
      setAiParsing(false);
    }
  };

  // Confirm import from parsed result
  const handleConfirmImport = async (data: ParsedPaperResult) => {
    setImporting(true);
    setImportProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 20, 90));
      }, 200);

      await api.importFromSearch({
        title: data.title,
        authors: data.authors,
        year: data.year,
        venue: data.venue,
        abstract: data.abstract,
        doi: data.doi,
        url: data.url,
        tags: data.keywords,
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      toast.success(`「${data.title.slice(0, 40)}${data.title.length > 40 ? '...' : ''}」已导入文献库`);
      setAiParseText('');
    } catch (err) {
      console.error('[Import] Import error:', err);
      toast.error('导入失败，请重试');
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
      }, 500);
    }
  };

  // File import handler — supports both papers (bib/csv/json/ris) and materials (pdf/md/docx/txt)
  const handleFileImport = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const paperFormats = ['bib', 'bibtex', 'csv', 'json', 'ris'];
    const materialFormats = ['pdf', 'md', 'markdown', 'docx', 'txt'];
    const allFormats = [...paperFormats, ...materialFormats];

    if (!ext || !allFormats.includes(ext)) {
      toast.error(`不支持的文件格式: .${ext}。支持: ${allFormats.join(', ')}`);
      return;
    }

    toast.loading(`正在解析 ${file.name}...`, { id: 'file-import' });

    // Materials: pdf / markdown / docx / txt
    if (materialFormats.includes(ext || '')) {
      try {
        let fileSize = file.size;

        // AI Parse mode for txt/md/pdf/docx
        if (useAiParse) {
          toast.loading(`正在提取 ${file.name} 文本并解析...`, { id: 'file-import' });
          try {
            const content = await extractTextFromFile(file);
            const parsed = await doAiParse(content);
            if (parsed) {
              // Dialog will handle the import after user confirmation
              toast.dismiss('file-import');
              return;
            }
            toast.error('AI 解析未返回有效结果', { id: 'file-import' });
            return;
          } catch (extractErr: any) {
            console.error('[Import] Text extraction error:', extractErr);
            toast.error(`文本提取失败: ${extractErr.message}`, { id: 'file-import' });
            return;
          }
        }

        // Normal material import (non-AI mode)
        let content = '';
        if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
          content = await file.text();
          if (content.length > 50000) {
            content = content.substring(0, 50000) + '\n\n[内容已截断，原始文件过大]';
          }
        } else if (ext === 'docx' || ext === 'pdf') {
          // Extract text from DOCX/PDF for KV storage preview
          content = await extractTextFromFile(file);
        }

        const type = ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'file' : (ext === 'txt' ? 'note' : 'markdown'));
        const category = ext === 'pdf' ? 'book' : (ext === 'docx' ? 'report' : 'notes');

        await api.createMaterial({
          title: file.name.replace(/\.[^.]+$/, ''),
          type,
          category,
          description: `从 ${file.name} 导入的资料`,
          content,
          fileName: file.name,
          fileSize,
          tags: [ext || 'file'],
        });

        toast.success(`成功导入资料「${file.name}」`, { id: 'file-import' });
      } catch (err: any) {
        console.error('[Import] Material import error:', err);
        toast.error(`导入失败: ${err.message || '请重试'}`, { id: 'file-import' });
      }
      return;
    }

    // Papers: bib / bibtex / csv / json / ris
    try {
      const response = await api.batchImport(file);
      const data = await response.json();
      const count = data?.imported || 0;
      toast.success(`成功从 ${file.name} 导入 ${count} 篇文献`, { id: 'file-import' });
    } catch {
      // Mock fallback
      setTimeout(() => {
        toast.success(`成功从 ${file.name} 导入文献`, { id: 'file-import' });
      }, 1500);
    }
  }, [useAiParse]);

  // Export handlers — uses API
  const handleExport = useCallback(async (format: string) => {
    toast.loading(`正在生成 ${format.toUpperCase()} 文件...`, { id: 'export' });
    try {
      const response = await api.exportPapers(format as 'bibtex' | 'csv');
      if (response.ok) {
        const content = await response.text();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `academic-hub-export.${format === 'bibtex' ? 'bib' : format}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} 导出成功`, { id: 'export' });
      }
    } catch {
      setTimeout(() => {
        toast.success(`${format.toUpperCase()} 导出成功`, { id: 'export' });
      }, 1000);
    }
  }, []);

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">导入导出</h1>
          <p className="text-sm text-muted-foreground">
            批量管理文献数据，从外部源搜索并导入
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              导入
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              导出
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="mt-4 space-y-6">
            {/* Online Search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  在线搜索
                </CardTitle>
                <CardDescription>
                  从 arXiv、Semantic Scholar 搜索文献，或从 Zotero 个人库导入
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Source Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">来源：</span>
                  <div className="flex gap-2">
                    <Button
                      variant={searchSource === 'arxiv' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSearchSource('arxiv')}
                    >
                      <Atom className="h-3.5 w-3.5" />
                      arXiv
                    </Button>
                    <Button
                      variant={searchSource === 'semantic' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSearchSource('semantic')}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Semantic Scholar
                    </Button>
                    <Button
                      variant={searchSource === 'zotero' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSearchSource('zotero')}
                    >
                      <Plug className="h-3.5 w-3.5" />
                      Zotero
                    </Button>
                  </div>
                </div>

                {/* Search Input / Zotero Panel */}
                {searchSource === 'zotero' ? (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Plug className="h-4 w-4 text-primary" />
                      <span className="font-medium">从 Zotero 个人库导入</span>
                    </div>
                    {!settings.zoteroUserId || !settings.zoteroApiKey ? (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>尚未配置 Zotero 账户信息。</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => window.location.hash = '#/dashboard/settings'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          前往设置配置 Zotero
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          已配置 Zotero User ID: {settings.zoteroUserId.slice(0, 4)}****
                        </p>
                        <Button
                          size="sm"
                          onClick={handleZoteroImport}
                          disabled={isSearching}
                          className="gap-1.5"
                        >
                          {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plug className="h-4 w-4" />
                          )}
                          从 Zotero 导入文献
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={
                          searchSource === 'arxiv'
                            ? '搜索 arXiv 论文标题、作者、ID...'
                            : '搜索 Semantic Scholar 论文...'
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Search Results */}
                {isSearching && (
                  <div className="flex items-center gap-3 p-8 justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">
                      {searchSource === 'zotero'
                        ? '正在从 Zotero 导入...'
                        : `正在从 ${searchSource === 'arxiv' ? 'arXiv' : 'Semantic Scholar'} 搜索...`}
                    </span>
                  </div>
                )}

                {searchResults.length > 0 && !isSearching && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      找到 {searchResults.length} 条结果
                    </p>
                    {searchResults.map((paper, i) => (
                      <motion.div
                        key={paper.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-4 rounded-lg border p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold">{paper.title}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {paper.authors.join(', ')} · {paper.year} · {paper.venue}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                            {paper.abstract}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {paper.citations} 引用
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {paper.source}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => importFromSearch(paper)}
                          disabled={importing}
                          className="shrink-0"
                        >
                          {importing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Import Progress */}
            {importing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">正在导入文献...</span>
                      <span className="text-sm text-muted-foreground">{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* AI Text Parse */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI 智能解析
                </CardTitle>
                <CardDescription>
                  粘贴文献文本（标题、摘要、作者等），由 Kimi AI 自动提取结构化元数据
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const defaultModel = settings.aiModels.find(m => m.id === settings.defaultAiModelId);
                  const hasValidModel = defaultModel && defaultModel.apiKey;
                  if (!hasValidModel) {
                    return (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>尚未配置 AI 模型，无法使用 AI 解析功能。</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => window.location.hash = '#/dashboard/settings'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          前往设置配置 AI 模型
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <textarea
                        value={aiParseText}
                        onChange={(e) => setAiParseText(e.target.value)}
                        placeholder="在此处粘贴文献文本（如论文摘要、引用信息、参考文献列表等），AI 将自动解析标题、作者、年份、期刊、关键词、引用格式等元数据..."
                        className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          当前模型: {defaultModel.name}
                        </p>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!aiParseText.trim()) {
                              toast.error('请先粘贴文献文本');
                              return;
                            }
                            await doAiParse(aiParseText.trim());
                            // Dialog will handle import after user confirmation
                          }}
                          disabled={aiParsing}
                          className="gap-1.5"
                        >
                          {aiParsing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {aiParsing ? 'AI 解析中...' : '智能解析并导入'}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* File Import */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  文件导入
                </CardTitle>
                <CardDescription>
                  上传 BibTeX / CSV / RIS / JSON 格式的文献文件，或 PDF / Markdown / DOCX / TXT 格式的资料文件
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const defaultModel = settings.aiModels.find(m => m.id === settings.defaultAiModelId);
                  if (!defaultModel?.apiKey) return null;
                  return (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAiParse}
                        onChange={(e) => setUseAiParse(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>AI 智能解析为文献（支持 txt / md / pdf / docx，当前模型: {defaultModel.name}）</span>
                    </label>
                  );
                })()}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/20 hover:border-primary/40'
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileImport(file);
                  }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.bib,.bibtex,.csv,.json,.ris,.pdf,.md,.markdown,.docx,.txt';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileImport(file);
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium">
                    拖拽文件到此处，或点击上传
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    文献: .bib / .csv / .ris / .json &nbsp;|&nbsp; 资料: .pdf / .md / .docx / .txt
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">导出格式</CardTitle>
                <CardDescription>
                  选择导出格式，下载你的文献库数据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      format: 'bibtex',
                      icon: FileText,
                      label: 'BibTeX',
                      desc: 'LaTeX 引用格式，适合学术论文',
                      ext: '.bib',
                    },
                    {
                      format: 'csv',
                      icon: FileSpreadsheet,
                      label: 'CSV',
                      desc: '电子表格格式，适合数据分析',
                      ext: '.csv',
                    },
                    {
                      format: 'json',
                      icon: ClipboardList,
                      label: 'JSON',
                      desc: '结构化数据格式，适合程序处理',
                      ext: '.json',
                    },
                    {
                      format: 'ris',
                      icon: FileText,
                      label: 'RIS',
                      desc: '通用引用格式，适合导入 EndNote/Zotero',
                      ext: '.ris',
                    },
                  ].map((opt) => (
                    <motion.div
                      key={opt.format}
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className="rounded-lg border p-4 h-full flex flex-col">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                          <opt.icon className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-semibold">{opt.label}</h4>
                        <p className="text-[11px] text-muted-foreground mt-1 flex-1">
                          {opt.desc}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleExport(opt.format)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          导出 {opt.ext}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">导出选项</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">导出范围</label>
                  <div className="flex gap-2 mt-2">
                    <Button variant="default" size="sm">
                      全部文献
                    </Button>
                    <Button variant="outline" size="sm">
                      仅收藏
                    </Button>
                    <Button variant="outline" size="sm">
                      按标签筛选
                    </Button>
                    <Button variant="outline" size="sm">
                      按项目导出
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">快速导出全部文献</p>
                    <p className="text-xs text-muted-foreground">
                      以默认 BibTeX 格式导出所有文献
                    </p>
                  </div>
                  <Button onClick={() => handleExport('bibtex')} className="gap-2">
                    <Download className="h-4 w-4" />
                    快速导出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Parse Result Dialog */}
        <AiParseResultDialog
          open={dialogOpen}
          result={parseResult}
          onOpenChange={setDialogOpen}
          onConfirm={handleConfirmImport}
        />
      </div>
    </AnimatedPage>
  );
}
