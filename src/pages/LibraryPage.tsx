// ========================================
// LibraryPage — 文献库 (增强版)
// 功能：搜索防抖、乐观更新、URL同步
// ========================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, Grid3X3, List, Star, ExternalLink,
  ChevronDown, BookOpen, Tag, X, SlidersHorizontal, RefreshCw,
  Upload, Pencil, Trash2, Eye, CheckSquare, Square, FileDown,
  FolderOpen, XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import AnimatedPage from '@/components/shared/AnimatedPage';
import EmptyState from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useDataStore } from '@/store/dataStore';
import type { Paper, Material } from '@/types';
import { ImportFromMaterialsDialog, ImportMaterialsButton } from '@/components/shared/ImportFromMaterials';
import { EditPaperDialog } from '@/components/shared/EditPaperDialog';
import { PdfPreviewDialog } from '@/components/shared/PdfPreviewDialog';
import { cn, formatDate } from '@/lib/utils';

// ---- 防抖 Hook ----
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ---- 乐观更新 Hook ----
function useOptimisticUpdate<T>(
  initialValue: T,
  onUpdate: (newValue: T) => Promise<boolean>
) {
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const update = useCallback(async (newValue: T) => {
    const previousValue = value;
    setValue(newValue);
    setPending(true);
    setError(false);

    try {
      const success = await onUpdate(newValue);
      if (!success) {
        setValue(previousValue);
        setError(true);
        return false;
      }
      return true;
    } catch {
      setValue(previousValue);
      setError(true);
      return false;
    } finally {
      setPending(false);
    }
  }, [value, onUpdate]);

  return { value, setValue, update, pending, error };
}

type ViewMode = 'grid' | 'list';
type SortKey = 'addedDate' | 'year' | 'citationCount' | 'title';
type SortDir = 'asc' | 'desc';

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { papers, papersLoaded, ensurePapers, invalidatePapers, removeFromPapers, updateInPapers, addToPapers } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);

  // URL同步状态 - 从URL读取初始值
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag'));
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'grid'
  );
  const [sortKey, setSortKey] = useState<SortKey>(
    (searchParams.get('sort') as SortKey) || 'addedDate'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (searchParams.get('dir') as SortDir) || 'desc'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(
    searchParams.get('fav') === '1'
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  // PDF Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPaper, setPreviewPaper] = useState<Paper | null>(null);

  // 批量管理状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 防抖搜索（300ms）
  const debouncedSearch = useDebounce(searchInput, 300);

  // 更新URL参数
  const updateUrl = useCallback((
    updates: Record<string, string | null>
  ) => {
    const newParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === '0') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // 搜索变化时更新URL
  useEffect(() => {
    updateUrl({ q: debouncedSearch || null });
  }, [debouncedSearch, updateUrl]);

  // 标签变化时更新URL
  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
    updateUrl({ tag });
  };

  // 收藏变化时更新URL
  const handleFavoritesChange = (checked: boolean) => {
    setOnlyFavorites(checked);
    updateUrl({ fav: checked ? '1' : null });
  };

  // 排序变化时更新URL
  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    setSortDir('desc');
    updateUrl({ sort: key, dir: 'desc' });
  };

  // 视图变化时更新URL
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    updateUrl({ view: mode });
  };

  // Load materials + ensure papers cached
  useEffect(() => {
    let cancelled = false;
    const loadMats = async () => {
      try {
        const matRes = await api.getMaterials();
        if (!cancelled && matRes.success && (matRes as any).data) {
          const matData = (matRes as any).data;
          setMaterials(Array.isArray(matData) ? matData : (matData.data || []));
        }
      } catch (e) {
        console.error('[LibraryPage] Failed to load materials:', e);
      }
    };
    ensurePapers();
    loadMats();
    return () => { cancelled = true; };
  }, [ensurePapers]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      invalidatePapers();
      await ensurePapers();
      toast.success('文献库已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  }, [invalidatePapers, ensurePapers]);

  // 收藏切换（乐观更新）
  const handleToggleFavorite = useCallback(async (paperId: string, currentState: boolean) => {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    // 乐观更新：立即更新缓存
    updateInPapers({ ...paper, isFavorited: !currentState });
    try {
      await api.toggleFavorite(paperId);
    } catch {
      // 失败时回滚
      updateInPapers({ ...paper, isFavorited: currentState });
      toast.error('操作失败');
    }
  }, [papers, updateInPapers]);

  // 删除论文
  const handleDeletePaper = useCallback(async (paperId: string) => {
    if (!confirm('确定要删除这篇文献吗？此操作不可撤销。')) return;
    const backup = papers.find(p => p.id === paperId);
    removeFromPapers(paperId);
    try {
      await api.deletePaper(paperId);
      toast.success('文献已删除');
    } catch {
      if (backup) addToPapers(backup);
      toast.error('删除失败');
    }
  }, [papers, removeFromPapers, addToPapers]);

  // 编辑论文
  const handleEditPaper = useCallback((paper: Paper) => {
    setEditingPaper(paper);
    setEditDialogOpen(true);
  }, []);

  const handlePaperUpdated = useCallback((updated: Paper) => {
    updateInPapers(updated);
  }, [updateInPapers]);

  // ---- 批量管理操作 ----
  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) setSelectedIds(new Set()); // 退出时清空选择
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 篇文献吗？此操作不可撤销。`)) return;

    const idsToDelete = Array.from(selectedIds);
    const backups = papers.filter((p) => selectedIds.has(p.id));

    // 乐观删除
    idsToDelete.forEach((id) => removeFromPapers(id));
    setSelectedIds(new Set());

    try {
      await Promise.all(idsToDelete.map((id) => api.deletePaper(id)));
      toast.success(`已删除 ${idsToDelete.length} 篇文献`);
    } catch {
      // 回滚
      backups.forEach((p) => addToPapers(p));
      toast.error('批量删除失败，已恢复');
    }
  }, [selectedIds, papers, removeFromPapers, addToPapers]);

  const handleBatchExport = useCallback(async (format: 'bibtex' | 'csv') => {
    if (selectedIds.size === 0) return;
    try {
      const response = await api.exportPapers(format, Array.from(selectedIds));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `papers_${format}_${new Date().toISOString().slice(0, 10)}.${format === 'bibtex' ? 'bib' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`已导出 ${selectedIds.size} 篇文献 (${format.toUpperCase()})`);
    } catch {
      toast.error('导出失败');
    }
  }, [selectedIds]);

  // All unique tags from loaded papers
  const allTags = useMemo(
    () => Array.from(new Set(papers.flatMap((p) => p.tags))).sort(),
    [papers]
  );

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...papers];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.keywords.some((k) => k.toLowerCase().includes(q)) ||
          p.venue.toLowerCase().includes(q)
      );
    }

    if (selectedTag) {
      result = result.filter((p) => p.tags.includes(selectedTag));
    }

    if (onlyFavorites) {
      result = result.filter((p) => p.isFavorited);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'addedDate':
          cmp = new Date(a.addedAt || a.addedDate || '1970-01-01').getTime() -
                new Date(b.addedAt || b.addedDate || '1970-01-01').getTime();
          break;
        case 'year':
          cmp = a.year - b.year;
          break;
        case 'citationCount':
          cmp = (a.citationCount || 0) - (b.citationCount || 0);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [papers, debouncedSearch, selectedTag, onlyFavorites, sortKey, sortDir]);

  // 批量全选（依赖 filtered，必须在此定义之后）
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((p) => p.id)));
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      handleSortChange(key);
    }
  };

  // Loading = papers not yet cached
  const loading = !papersLoaded;

  // Loading skeleton
  if (loading) {
    return (
      <AnimatedPage>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <div className="flex gap-1 mb-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-3 mt-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">文献库</h1>
            <p className="text-sm text-muted-foreground">
              共 {papers.length} 篇文献 · 已筛选 {filtered.length} 篇
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={batchMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleBatchMode}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              {batchMode ? '退出批量' : '批量管理'}
            </Button>
            <ImportMaterialsButton
              onClick={() => setImportDialogOpen(true)}
              count={materials.length}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              刷新
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewChange('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewChange('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索标题、作者、关键词、会议..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            筛选
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                showFilters && 'rotate-180'
              )}
            />
          </Button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">标签筛选</span>
                        {selectedTag && (
                          <button
                            onClick={() => handleTagSelect(null)}
                            className="text-xs text-primary hover:underline"
                          >
                            清除
                          </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTag === tag ? 'default' : 'outline'}
                          className="cursor-pointer select-none"
                          onClick={() => handleTagSelect(selectedTag === tag ? null : tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">排序方式</label>
                    <div className="flex flex-wrap gap-2 ml-2">
                      {(
                        [
                          ['addedDate', '添加时间'],
                          ['year', '年份'],
                          ['citationCount', '引用量'],
                          ['title', '标题'],
                        ] as [SortKey, string][]
                      ).map(([key, label]) => (
                        <Badge
                          key={key}
                          variant={sortKey === key ? 'default' : 'outline'}
                          className="cursor-pointer select-none"
                          onClick={() => handleSortChange(key)}
                        >
                          {label}
                          {sortKey === key &&
                            (sortDir === 'desc' ? ' ↓' : ' ↑')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyFavorites}
                        onChange={(e) => handleFavoritesChange(e.target.checked)}
                        className="mr-2"
                      />
                      仅显示收藏
                    </label>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Batch Operations Toolbar */}
        <AnimatePresence>
          {batchMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      已选择 {selectedIds.size} / {filtered.length} 篇
                    </span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllFiltered}
                      disabled={selectedIds.size === filtered.length}
                      className="gap-1.5"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      全选
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAll}
                      disabled={selectedIds.size === 0}
                      className="gap-1.5"
                    >
                      <Square className="h-3.5 w-3.5" />
                      取消
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBatchExport('bibtex')}
                      disabled={selectedIds.size === 0}
                      className="gap-1.5"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      BibTeX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBatchExport('csv')}
                      disabled={selectedIds.size === 0}
                      className="gap-1.5"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                      disabled={selectedIds.size === 0}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import Dialog */}
        <ImportFromMaterialsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportSuccess={(paper) => {
            handleRefresh();
            if (paper) {
              setEditingPaper(paper);
              setEditDialogOpen(true);
            }
          }}
        />

        {/* Edit Dialog */}
        <EditPaperDialog
          open={editDialogOpen}
          paper={editingPaper}
          onOpenChange={setEditDialogOpen}
          onSaved={handlePaperUpdated}
        />

        {/* PDF Preview Dialog */}
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          pdfUrl={previewPaper?.pdfUrl || previewPaper?.url}
          title={previewPaper?.title}
        />

        {/* Papers Grid / List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="没有找到匹配的文献"
            description={
              searchInput
                ? `未找到与「${searchInput}」匹配的文献，请尝试其他关键词。`
                : '当前筛选条件下没有文献，请调整筛选条件。'
            }
            action={
              searchInput ? (
                <Button variant="outline" onClick={() => setSearchInput('')}>
                  清除搜索
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((paper, i) => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={batchMode ? '#' : `/dashboard/paper/${paper.id}`} onClick={(e) => { if (batchMode) { e.preventDefault(); toggleSelect(paper.id); } }}>
                  <PaperCard
                    paper={paper}
                    onToggleFavorite={handleToggleFavorite}
                    onEdit={handleEditPaper}
                    onDelete={handleDeletePaper}
                    onPreview={(p) => { setPreviewPaper(p); setPreviewOpen(true); }}
                    batchMode={batchMode}
                    selected={selectedIds.has(paper.id)}
                    onSelect={toggleSelect}
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((paper, i) => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link to={batchMode ? '#' : `/dashboard/paper/${paper.id}`} onClick={(e) => { if (batchMode) { e.preventDefault(); toggleSelect(paper.id); } }}>
                  <PaperListItem
                    paper={paper}
                    onToggleFavorite={handleToggleFavorite}
                    onEdit={handleEditPaper}
                    onDelete={handleDeletePaper}
                    onPreview={(p) => { setPreviewPaper(p); setPreviewOpen(true); }}
                    batchMode={batchMode}
                    selected={selectedIds.has(paper.id)}
                    onSelect={toggleSelect}
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}

// ---------- Grid Card ----------
function PaperCard({ paper, onToggleFavorite, onEdit, onDelete, onPreview, batchMode, selected, onSelect }: {
  paper: Paper; onToggleFavorite: (id: string, current: boolean) => void;
  onEdit: (paper: Paper) => void; onDelete: (id: string) => void; onPreview?: (paper: Paper) => void;
  batchMode?: boolean; selected?: boolean; onSelect?: (id: string) => void;
}) {
  return (
    <Card className="group h-full transition-all hover:shadow-card-hover cursor-pointer">
      <CardContent className="pt-5 pb-4 flex flex-col h-full">
        {/* Tags + Batch Checkbox */}
        <div className="flex flex-wrap gap-1 mb-3 items-center">
          {batchMode && onSelect && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(paper.id); }}
              className="mr-1 shrink-0"
            >
              {selected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          {paper.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
              {t}
            </Badge>
          ))}
          <div className={cn("ml-auto flex items-center gap-1.5 transition-opacity", batchMode ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            {(paper.pdfUrl || paper.url) && onPreview && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreview(paper); }}
                className="hover:scale-110 transition-transform"
                title="预览 PDF"
              >
                <Eye className="h-3 w-3 text-muted-foreground hover:text-primary" />
              </button>
            )}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(paper); }}
              className="hover:scale-110 transition-transform"
              title="编辑"
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(paper.id); }}
              className="hover:scale-110 transition-transform"
              title="删除"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onToggleFavorite(paper.id, paper.isFavorited); }}
              className="hover:scale-110 transition-transform"
            >
              <Star className={cn(
                'h-3 w-3',
                paper.isFavorited ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
              )} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
          {paper.title}
        </h3>

        {/* Authors */}
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
          {paper.authors.slice(0, 2).join(', ')}
          {paper.authors.length > 2 ? ' et al.' : ''}
        </p>

        {/* Meta */}
        <div className="mt-auto pt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-medium">{paper.venue}</span>
          <span>{paper.year}</span>
          <span>{paper.citationCount} 引用</span>
        </div>

        {/* Joan Note preview */}
        {paper.joanNote && (
          <p className="mt-2 line-clamp-2 text-[11px] text-primary-400 dark:text-primary-300 italic border-t border-primary-100 dark:border-primary-700 pt-2">
            ⚖️ {paper.joanNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- List Item ----------
function PaperListItem({ paper, onToggleFavorite, onEdit, onDelete, onPreview, batchMode, selected, onSelect }: {
  paper: Paper; onToggleFavorite: (id: string, current: boolean) => void;
  onEdit: (paper: Paper) => void; onDelete: (id: string) => void; onPreview?: (paper: Paper) => void;
  batchMode?: boolean; selected?: boolean; onSelect?: (id: string) => void;
}) {
  return (
    <div className={cn("group flex items-start gap-4 rounded-lg border p-4 transition-all hover:shadow-card hover:border-primary/30", selected && "bg-primary/5 border-primary/30")}>
      {batchMode && onSelect ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(paper.id); }}
          className="mt-0.5 shrink-0"
        >
          {selected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="mt-0.5 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold group-hover:text-primary transition-colors flex-1">
            {paper.title}
          </h3>
          <div className={cn("flex items-center gap-1.5 shrink-0 transition-opacity", batchMode ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            {(paper.pdfUrl || paper.url) && onPreview && (
              <button
                onClick={(e) => { e.preventDefault(); onPreview(paper); }}
                className="hover:scale-110 transition-transform"
                title="预览 PDF"
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
              </button>
            )}
            <button
              onClick={(e) => { e.preventDefault(); onEdit(paper); }}
              className="hover:scale-110 transition-transform"
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onDelete(paper.id); }}
              className="hover:scale-110 transition-transform"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onToggleFavorite(paper.id, paper.isFavorited); }}
              className="hover:scale-110 transition-transform"
            >
              <Star className={cn(
                'h-3.5 w-3.5',
                paper.isFavorited ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
              )} />
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 ? ' et al.' : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {paper.venue}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{paper.year}</span>
          <span className="text-[11px] text-muted-foreground">
            {paper.citationCount} 引用
          </span>
          {paper.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
              {t}
            </Badge>
          ))}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {formatDate(paper.addedAt || paper.addedDate || '')}
          </span>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
    </div>
  );
}
