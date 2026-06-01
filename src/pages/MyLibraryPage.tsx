// ========================================
// MyLibraryPage — 文献库管理页面
// 支持：增/删/改名文献库、论文分配到库、拖拽排序
// ========================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Plus, FolderOpen, Folder, Edit2, Trash2,
  ChevronRight, BookOpen, X, Check, FolderPlus,
  GripVertical, MoreHorizontal, Star, ExternalLink,
  Library as LibraryIcon, Upload, Pencil, PlusCircle,
  CheckSquare, Square, Download, Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedPage from '@/components/shared/AnimatedPage';
import EmptyState from '@/components/shared/EmptyState';
import { api } from '@/lib/api';
import { useDataStore } from '@/store/dataStore';
import type { Library, Paper, Material } from '@/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import { ImportFromMaterialsDialog, ImportMaterialsButton } from '@/components/shared/ImportFromMaterials';
import { EditPaperDialog } from '@/components/shared/EditPaperDialog';

// 预设颜色
const LIBRARY_COLORS = [
  '#3d5a80', '#C9A96E', '#2D8A4E', '#B91C1C',
  '#7C3AED', '#0891B2', '#D97706', '#DB2777',
];

// 预设图标
const LIBRARY_ICONS = [
  'Folder', 'BookOpen', 'Network', 'GitBranch',
  'ShieldAlert', 'FlaskConical', 'FileText', 'Star',
];

export default function MyLibraryPage() {
  const { papers: allPapers, papersLoaded, ensurePapers, removeFromPapers, updateInPapers, restorePapers } = useDataStore();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('lib-all');
  const [search, setSearch] = useState('');

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [libForm, setLibForm] = useState({ name: '', description: '', color: '#3d5a80', icon: 'Folder' });
  const [libNameError, setLibNameError] = useState('');

  // Delete confirm dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState<Library | null>(null);

  // Move paper dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingPaper, setMovingPaper] = useState<Paper | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ library: Library; x: number; y: number } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [addPapersOpen, setAddPapersOpen] = useState(false);
  const [selectedPaperIdsToAdd, setSelectedPaperIdsToAdd] = useState<string[]>([]);

  // 批量管理状态
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchMoveDialogOpen, setBatchMoveDialogOpen] = useState(false);
  const [batchMoveTargetLibId, setBatchMoveTargetLibId] = useState<string>('');
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false);
  const [batchTagInput, setBatchTagInput] = useState('');
  const [batchTagMode, setBatchTagMode] = useState<'add' | 'remove'>('add');

  // 删除论文
  const handleDeletePaper = useCallback(async (paperId: string) => {
    if (!confirm('确定要删除这篇文献吗？此操作不可撤销。')) return;
    const previous = allPapers;
    removeFromPapers(paperId);
    setLibraries(prev => prev.map(l => ({
      ...l,
      paperIds: (l.paperIds || []).filter(id => id !== paperId),
    })));
    try {
      await api.deletePaper(paperId);
      toast.success('文献已删除');
    } catch {
      restorePapers(previous);
      toast.error('删除失败');
    }
  }, [allPapers, removeFromPapers, restorePapers]);

  const handleEditPaper = useCallback((paper: Paper) => {
    setEditingPaper(paper);
    setEditDialogOpen(true);
  }, []);

  const handlePaperUpdated = useCallback((updated: Paper) => {
    updateInPapers(updated);
  }, [updateInPapers]);

  // Load libraries and materials (papers via dataStore cache)
  const loadLibraries = useCallback(async () => {
    try {
      const [libRes, matRes] = await Promise.all([
        api.getLibraries(),
        api.getMaterials(),
      ]);
      if (libRes.success && libRes.data) {
        setLibraries(libRes.data);
        if (!selectedLibraryId || !libRes.data.find(l => l.id === selectedLibraryId)) {
          setSelectedLibraryId(libRes.data[0]?.id || 'lib-all');
        }
      }
      if (matRes.success && matRes.data) {
        const matData = (matRes as any).data || [];
        setMaterials(Array.isArray(matData) ? matData : (matData.data || []));
      }
    } catch {
      setLibraries([{
        id: 'lib-all', name: '全部文献', color: '#3d5a80',
        icon: 'Library', paperIds: [],
        createdAt: new Date().toISOString(), isDefault: true,
      }]);
    }
  }, [selectedLibraryId]);

  useEffect(() => {
    ensurePapers();
    loadLibraries();
  }, [ensurePapers, loadLibraries]);

  // Selected library
  const selectedLibrary = useMemo(
    () => libraries.find(l => l.id === selectedLibraryId) || libraries[0],
    [libraries, selectedLibraryId]
  );

  // Papers in selected library
  const libraryPapers = useMemo(() => {
    const lib = selectedLibrary;
    if (!lib) return [];
    if (lib.id === 'lib-all') return allPapers;
    const libPaperIds = new Set(lib.paperIds || []);
    return allPapers.filter(p => libPaperIds.has(p.id));
  }, [selectedLibrary, allPapers]);

  // 添加论文到当前文献库
  const openAddPapers = useCallback(() => {
    const currentIds = selectedLibrary?.paperIds || [];
    setSelectedPaperIdsToAdd(currentIds);
    setAddPapersOpen(true);
  }, [selectedLibrary]);

  const togglePaperToAdd = useCallback((paperId: string) => {
    setSelectedPaperIdsToAdd(prev =>
      prev.includes(paperId) ? prev.filter(id => id !== paperId) : [...prev, paperId]
    );
  }, []);

  const saveAddedPapers = useCallback(async () => {
    if (!selectedLibrary || selectedLibrary.isDefault) return;
    const currentIds = selectedLibrary.paperIds || [];
    const newIds = selectedPaperIdsToAdd.filter(id => !currentIds.includes(id));

    if (newIds.length === 0 && selectedPaperIdsToAdd.length === currentIds.length) {
      setAddPapersOpen(false);
      return;
    }

    // Optimistic update
    setLibraries(prev => prev.map(l =>
      l.id === selectedLibrary.id ? { ...l, paperIds: selectedPaperIdsToAdd } : l
    ));

    try {
      // Remove papers that were unchecked
      const removedIds = currentIds.filter(id => !selectedPaperIdsToAdd.includes(id));
      if (removedIds.length > 0) {
        await api.updateLibrary(selectedLibrary.id, { papers: selectedPaperIdsToAdd });
      }
      // Add new papers
      for (const paperId of newIds) {
        await api.addPaperToLibrary(selectedLibrary.id, paperId);
      }
      toast.success(`已更新关联文献`);
      setAddPapersOpen(false);
    } catch (err: any) {
      toast.error(err.message || '添加失败');
      loadLibraries();
    }
  }, [selectedLibrary, selectedPaperIdsToAdd, loadLibraries]);

  // Filter papers by search
  const filteredPapers = useMemo(() => {
    if (!search.trim()) return libraryPapers;
    const q = search.toLowerCase();
    return libraryPapers.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.authors.some(a => a.toLowerCase().includes(q)) ||
      p.venue.toLowerCase().includes(q)
    );
  }, [libraryPapers, search]);

  // ========== 批量管理功能 ==========

  // 切换批量选择模式
  const toggleBatchMode = useCallback(() => {
    setIsBatchMode(prev => !prev);
    setSelectedBatchIds([]);
  }, []);

  // 切换单篇论文选中状态
  const toggleBatchSelect = useCallback((paperId: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(paperId) ? prev.filter(id => id !== paperId) : [...prev, paperId]
    );
  }, []);

  // 全选
  const handleSelectAll = useCallback(() => {
    setSelectedBatchIds(filteredPapers.map(p => p.id));
  }, [filteredPapers]);

  // 取消全选
  const handleDeselectAll = useCallback(() => {
    setSelectedBatchIds([]);
  }, []);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedBatchIds.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedBatchIds.length} 篇文献吗？此操作不可撤销。`)) return;

    const previous = allPapers;
    // Optimistic update
    selectedBatchIds.forEach(id => removeFromPapers(id));
    setLibraries(prev => prev.map(l => ({
      ...l,
      paperIds: (l.paperIds || []).filter(id => !selectedBatchIds.includes(id)),
    })));
    setSelectedBatchIds([]);
    setIsBatchMode(false);

    try {
      await Promise.all(selectedBatchIds.map(id => api.deletePaper(id)));
      toast.success(`已删除 ${selectedBatchIds.length} 篇文献`);
    } catch {
      restorePapers(previous);
      toast.error('批量删除失败');
    }
  }, [selectedBatchIds, allPapers, removeFromPapers, restorePapers]);

  // 批量移动 - 打开对话框
  const openBatchMoveDialog = useCallback(() => {
    setBatchMoveTargetLibId('');
    setBatchMoveDialogOpen(true);
  }, []);

  // 批量移动 - 执行
  const handleBatchMove = useCallback(async () => {
    if (!batchMoveTargetLibId || selectedBatchIds.length === 0) return;
    const targetLib = libraries.find(l => l.id === batchMoveTargetLibId);
    if (!targetLib) return;

    // Optimistic update
    setLibraries(prev => prev.map(l => {
      if (l.id === batchMoveTargetLibId) {
        const newIds = [...(l.paperIds || [])];
        selectedBatchIds.forEach(id => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        return { ...l, paperIds: newIds };
      }
      return l;
    }));
    setBatchMoveDialogOpen(false);
    setSelectedBatchIds([]);
    setIsBatchMode(false);

    try {
      await Promise.all(
        selectedBatchIds.map(id => api.addPaperToLibrary(batchMoveTargetLibId, id))
      );
      toast.success(`已移动 ${selectedBatchIds.length} 篇文献到「${targetLib.name}」`);
    } catch (err: any) {
      toast.error(err.message || '批量移动失败');
      loadLibraries();
    }
  }, [batchMoveTargetLibId, selectedBatchIds, libraries, loadLibraries]);

  // 批量导出 - BibTeX
  const handleBatchExportBibtex = useCallback(() => {
    if (selectedBatchIds.length === 0) return;
    const papers = allPapers.filter(p => selectedBatchIds.includes(p.id));
    const bibtex = papers.map(p => {
      const key = p.id.replace(/[^a-zA-Z0-9]/g, '_');
      const authors = p.authors.join(' and ');
      const type = p.venue ? 'article' : 'misc';
      return `@${type}{${key},
  title={${p.title}},
  author={${authors}},
  year={${p.year || ''}},
  venue={${p.venue || ''}},
  url={${p.url || ''}}
}`;
    }).join('\n\n');

    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papers_${new Date().toISOString().slice(0, 10)}.bib`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${papers.length} 篇文献为 BibTeX`);
  }, [selectedBatchIds, allPapers]);

  // 批量导出 - CSV
  const handleBatchExportCsv = useCallback(() => {
    if (selectedBatchIds.length === 0) return;
    const papers = allPapers.filter(p => selectedBatchIds.includes(p.id));
    const header = 'Title,Authors,Venue,Year,URL,Tags';
    const rows = papers.map(p =>
      `"${(p.title || '').replace(/"/g, '""')}","${(p.authors || []).join('; ')}","${p.venue || ''}",${p.year || ''},"${p.url || ''}","${(p.tags || []).join('; ')}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${papers.length} 篇文献为 CSV`);
  }, [selectedBatchIds, allPapers]);

  // 批量标签 - 打开对话框
  const openBatchTagDialog = useCallback((mode: 'add' | 'remove') => {
    setBatchTagMode(mode);
    setBatchTagInput('');
    setBatchTagDialogOpen(true);
  }, []);

  // 批量标签 - 执行
  const handleBatchTag = useCallback(async () => {
    if (selectedBatchIds.length === 0 || !batchTagInput.trim()) return;
    const tags = batchTagInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;

    const previous = allPapers;
    // Optimistic update
    selectedBatchIds.forEach(id => {
      const paper = allPapers.find(p => p.id === id);
      if (!paper) return;
      const currentTags = paper.tags || [];
      const newTags = batchTagMode === 'add'
        ? [...new Set([...currentTags, ...tags])]
        : currentTags.filter(t => !tags.includes(t));
      updateInPapers({ ...paper, tags: newTags });
    });
    setBatchTagDialogOpen(false);
    setSelectedBatchIds([]);
    setIsBatchMode(false);

    try {
      await Promise.all(
        selectedBatchIds.map(id => {
          const paper = allPapers.find(p => p.id === id);
          if (!paper) return Promise.resolve();
          const currentTags = paper.tags || [];
          const newTags = batchTagMode === 'add'
            ? [...new Set([...currentTags, ...tags])]
            : currentTags.filter(t => !tags.includes(t));
          return api.updatePaper(id, { tags: newTags });
        })
      );
      toast.success(`已${batchTagMode === 'add' ? '添加' : '移除'}标签到 ${selectedBatchIds.length} 篇文献`);
    } catch {
      restorePapers(previous);
      toast.error('批量标签失败');
    }
  }, [selectedBatchIds, batchTagInput, batchTagMode, allPapers, updateInPapers, restorePapers]);

  // Open create dialog
  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingLibrary(null);
    setLibForm({ name: '', description: '', color: '#3d5a80', icon: 'Folder' });
    setLibNameError('');
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (lib: Library) => {
    setDialogMode('edit');
    setEditingLibrary(lib);
    setLibForm({
      name: lib.name,
      description: lib.description || '',
      color: lib.color,
      icon: lib.icon,
    });
    setLibNameError('');
    setDialogOpen(true);
    setContextMenu(null);
  };

  // Save library (create or update)
  const saveLibrary = async () => {
    if (!libForm.name.trim()) {
      setLibNameError('文献库名称不能为空');
      return;
    }
    try {
      if (dialogMode === 'create') {
        const res = await api.createLibrary({
          name: libForm.name.trim(),
          description: libForm.description.trim(),
          color: libForm.color,
          icon: libForm.icon,
        });
        if (res.success && res.data) {
          setLibraries(prev => [...prev, res.data]);
          setSelectedLibraryId(res.data.id);
          toast.success(`文献库「${res.data.name}」创建成功`);
        }
      } else if (editingLibrary) {
        const res = await api.updateLibrary(editingLibrary.id, {
          name: libForm.name.trim(),
          description: libForm.description.trim(),
          color: libForm.color,
          icon: libForm.icon,
        });
        if (res.success && res.data) {
          setLibraries(prev => prev.map(l => l.id === res.data.id ? res.data : l));
          toast.success(`文献库「${res.data.name}」已更新`);
        }
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    }
  };

  // Delete library
  const confirmDelete = async () => {
    if (!deletingLibrary) return;
    try {
      await api.deleteLibrary(deletingLibrary.id);
      setLibraries(prev => prev.filter(l => l.id !== deletingLibrary.id));
      if (selectedLibraryId === deletingLibrary.id) {
        setSelectedLibraryId('lib-all');
      }
      toast.success(`文献库「${deletingLibrary.name}」已删除`);
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingLibrary(null);
    }
  };

  // Move paper to another library
  const movePaper = async (targetLibId: string) => {
    if (!movingPaper) return;
    try {
      const targetLib = libraries.find(l => l.id === targetLibId);
      if (!targetLib) return;
      const targetPaperIds = targetLib.paperIds || [];
      if (!targetPaperIds.includes(movingPaper.id)) {
        await api.addPaperToLibrary(targetLibId, movingPaper.id);
      }
      setLibraries(prev => prev.map(l => {
        const ids = l.paperIds || [];
        if (l.id === targetLibId && !ids.includes(movingPaper.id)) {
          return { ...l, paperIds: [...ids, movingPaper.id] };
        }
        return l;
      }));
      toast.success(`已移动到「${targetLib.name}」`);
      setMoveDialogOpen(false);
      setMovingPaper(null);
    } catch (err: any) {
      toast.error(err.message || '移动失败');
    }
  };

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent, lib: Library) => {
    e.preventDefault();
    setContextMenu({ library: lib, x: e.clientX, y: e.clientY });
  };

  const loading = !papersLoaded;

  return (
    <AnimatedPage>
      <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
        {/* Left: Library Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">我的文献库</h2>
            <Button size="sm" variant="ghost" onClick={openCreateDialog} className="gap-1 text-primary-500">
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </div>

          {/* Library Tree */}
          <div className="flex-1 space-y-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              libraries.map(lib => {
                const isActive = lib.id === selectedLibraryId;
                return (
                  <div
                    key={lib.id}
                    onClick={() => setSelectedLibraryId(lib.id)}
                    onContextMenu={(e) => !lib.isDefault && handleContextMenu(e, lib)}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                      isActive
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'hover:bg-muted',
                      lib.isDefault && 'cursor-default'
                    )}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: lib.color }}
                    />
                    <LibraryIcon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-muted-foreground')} />
                    <span className="text-sm font-medium truncate flex-1">{lib.name}</span>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full shrink-0',
                      isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {lib.id === 'lib-all' ? allPapers.length : (lib.paperIds?.length ?? 0)}
                    </span>
                    {/* Hover actions */}
                    {!lib.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditDialog(lib); }}
                        className={cn(
                          'opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition-opacity',
                          isActive && 'opacity-100'
                        )}
                        onClickCapture={(e) => e.stopPropagation()}
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Import from materials */}
          <ImportMaterialsButton
            onClick={() => setImportDialogOpen(true)}
            count={materials.length}
          />

          {/* New Library Button */}
          <Button variant="outline" className="gap-2 w-full justify-start" onClick={openCreateDialog}>
            <FolderPlus className="h-4 w-4" />
            <span className="text-sm">创建新文献库</span>
          </Button>
        </aside>

        {/* Right: Paper List */}
        <div className="flex-1 space-y-4">
          {/* Import Dialog */}
          <ImportFromMaterialsDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            onImportSuccess={(paper) => {
              loadLibraries();
              if (paper) {
                setEditingPaper(paper);
                setEditDialogOpen(true);
              }
            }}
          />

          {/* Mobile library selector */}
          <div className="lg:hidden">
            <select
              value={selectedLibraryId}
              onChange={e => setSelectedLibraryId(e.target.value)}
              className="w-full p-2 rounded-lg border bg-background text-sm"
            >
              {libraries.map(lib => (
                <option key={lib.id} value={lib.id}>
                  {lib.name} ({lib.id === 'lib-all' ? allPapers.length : (lib.paperIds?.length ?? 0)})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索当前文献库中的论文..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Paper count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedLibrary?.name} · {filteredPapers.length} 篇论文
              {isBatchMode && selectedBatchIds.length > 0 && (
                <span className="ml-2 text-primary font-medium">
                  ({selectedBatchIds.length} 篇已选中)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {/* 批量管理按钮 */}
              {filteredPapers.length > 0 && (
                <Button
                  size="sm"
                  variant={isBatchMode ? 'default' : 'outline'}
                  className={cn('h-7 text-xs gap-1', isBatchMode && 'bg-primary text-white')}
                  onClick={toggleBatchMode}
                >
                  {isBatchMode ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" />
                      退出批量
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      批量管理
                    </>
                  )}
                </Button>
              )}
              {!selectedLibrary?.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={openAddPapers}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  添加论文
                </Button>
              )}
              {!selectedLibrary?.isDefault && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                  style={{ backgroundColor: selectedLibrary?.color + '20', color: selectedLibrary?.color }}
                >
                  <Edit2 className="h-3 w-3" />
                  可管理
                </span>
              )}
            </div>
          </div>

          {/* Papers */}
          {filteredPapers.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="文献库为空"
              description={search ? '未找到匹配的论文' : '该文献库中还没有论文。'}
              action={
                !selectedLibrary?.isDefault ? (
                  <Button size="sm" variant="outline" className="gap-1" onClick={openAddPapers}>
                    <PlusCircle className="h-4 w-4" />
                    添加论文
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
            <div className="space-y-2">
              {filteredPapers.map((paper, i) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div
                    className={cn(
                      "group flex items-start gap-4 rounded-lg border p-4 hover:shadow-md transition-all",
                      isBatchMode ? "hover:border-muted" : "hover:border-primary/30"
                    )}
                  >
                    {/* Batch mode checkbox */}
                    {isBatchMode && (
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectedBatchIds.includes(paper.id)}
                          onCheckedChange={() => toggleBatchSelect(paper.id)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {/* Book icon */}
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <Link to={`/dashboard/paper/${paper.id}`} className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
                            {paper.title}
                          </h3>
                        </Link>
                        {paper.isFavorited && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400 mt-0.5" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 ? ' et al.' : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{paper.venue}</Badge>
                        <span className="text-[11px] text-muted-foreground">{paper.year}</span>
                        {paper.tags.slice(0, 2).map(t => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions - 批量模式下隐藏 */}
                    <div className={cn(
                      "flex items-center gap-1 shrink-0",
                      isBatchMode ? "hidden" : "opacity-0 group-hover:opacity-100 transition-opacity"
                    )}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="编辑"
                        onClick={() => handleEditPaper(paper)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => handleDeletePaper(paper.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="移动到其他文献库"
                        onClick={() => { setMovingPaper(paper); setMoveDialogOpen(true); }}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Link to={`/dashboard/paper/${paper.id}`}>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="查看详情">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

              {/* 批量操作栏 */}
              {isBatchMode && selectedBatchIds.length > 0 && (
                <div className="sticky bottom-0 bg-background border-t p-4 flex items-center justify-between gap-4 shadow-lg mt-4">
                  {/* 左侧：已选中数量和全选/取消全选 */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{selectedBatchIds.length} 篇已选中</span>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      全选
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      取消全选
                    </button>
                  </div>

                  {/* 右侧：批量操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleBatchDelete}>
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={openBatchMoveDialog}>
                      <FolderOpen className="h-3.5 w-3.5" />
                      移动
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleBatchExportBibtex}>
                      <Download className="h-3.5 w-3.5" />
                      BibTeX
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleBatchExportCsv}>
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => openBatchTagDialog('add')}>
                      <Tag className="h-3.5 w-3.5" />
                      添加标签
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => openBatchTagDialog('remove')}>
                      <Tag className="h-3.5 w-3.5" />
                      移除标签
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Paper Dialog */}
      <EditPaperDialog
        open={editDialogOpen}
        paper={editingPaper}
        onOpenChange={setEditDialogOpen}
        onSaved={handlePaperUpdated}
      />

      {/* Add Papers to Library Dialog */}
      <Dialog open={addPapersOpen} onOpenChange={setAddPapersOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加论文到「{selectedLibrary?.name}」</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              选择要添加到此文献库的论文（已关联的论文默认勾选）
            </p>
            {allPapers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无可用论文
              </p>
            ) : (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                {allPapers.map((paper) => (
                  <label
                    key={paper.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedPaperIdsToAdd.includes(paper.id)}
                      onCheckedChange={() => togglePaperToAdd(paper.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-1">{paper.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {paper.authors.slice(0, 2).join(', ')} · {paper.year} · {paper.venue}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddPapersOpen(false)}>
              取消
            </Button>
            <Button onClick={saveAddedPapers}>
              保存 ({selectedPaperIdsToAdd.length} 篇)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Library Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? '创建新文献库' : '编辑文献库'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-1 block">文献库名称 *</label>
              <Input
                value={libForm.name}
                onChange={e => { setLibForm(f => ({ ...f, name: e.target.value })); setLibNameError(''); }}
                placeholder="例如：GNN核心论文"
                maxLength={50}
              />
              {libNameError && <p className="text-xs text-destructive mt-1">{libNameError}</p>}
            </div>
            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1 block">描述（可选）</label>
              <Textarea
                value={libForm.description}
                onChange={e => setLibForm(f => ({ ...f, description: e.target.value }))}
                placeholder="简要描述这个文献库的用途..."
                rows={2}
                maxLength={200}
              />
            </div>
            {/* Color */}
            <div>
              <label className="text-sm font-medium mb-2 block">颜色</label>
              <div className="flex gap-2 flex-wrap">
                {LIBRARY_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setLibForm(f => ({ ...f, color }))}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      libForm.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={saveLibrary}>
              {dialogMode === 'create' ? '创建' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除文献库</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除文献库「<strong>{deletingLibrary?.name}</strong>」吗？论文不会被删除，只是从该库中移除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Paper Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>移动论文到其他文献库</DialogTitle>
          </DialogHeader>
          {movingPaper && (
            <div className="py-2">
              <p className="text-sm font-medium mb-3">{movingPaper.title}</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {libraries.filter(l => l.id !== selectedLibraryId).map(lib => (
                  <button
                    key={lib.id}
                    onClick={() => movePaper(lib.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lib.color }} />
                    <LibraryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{lib.name}</span>
                    {(lib.paperIds || []).includes(movingPaper.id) && (
                      <Check className="h-3 w-3 ml-auto text-primary" />
                    )}
                  </button>
                ))}
                {libraries.filter(l => l.id !== selectedLibraryId).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无其他文献库</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveDialogOpen(false); setMovingPaper(null); }}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => openEditDialog(contextMenu.library)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                重命名
              </button>
              <button
                onClick={() => { setDeletingLibrary(contextMenu.library); setDeleteDialogOpen(true); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Batch Move Dialog */}
      <Dialog open={batchMoveDialogOpen} onOpenChange={setBatchMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量移动论文到其他文献库</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              将选中的 {selectedBatchIds.length} 篇论文移动到：
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {libraries.filter(l => l.id !== selectedLibraryId).map(lib => (
                <button
                  key={lib.id}
                  onClick={() => setBatchMoveTargetLibId(lib.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                    batchMoveTargetLibId === lib.id ? "bg-primary/10 border border-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lib.color }} />
                  <LibraryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{lib.name}</span>
                  {(lib.paperIds || []).filter(id => selectedBatchIds.includes(id)).length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {((lib.paperIds || []).filter(id => selectedBatchIds.includes(id)).length)} 已存在
                    </Badge>
                  )}
                </button>
              ))}
              {libraries.filter(l => l.id !== selectedLibraryId).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无其他文献库</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchMoveDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchMove} disabled={!batchMoveTargetLibId}>
              移动到此库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Tag Dialog */}
      <Dialog open={batchTagDialogOpen} onOpenChange={setBatchTagDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{batchTagMode === 'add' ? '批量添加标签' : '批量移除标签'}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              {batchTagMode === 'add' ? '为选中的 ' + selectedBatchIds.length + ' 篇论文添加标签（多个标签用逗号分隔）：' : '从选中的 ' + selectedBatchIds.length + ' 篇论文移除标签（多个标签用逗号分隔）：'}
            </p>
            <Input
              value={batchTagInput}
              onChange={e => setBatchTagInput(e.target.value)}
              placeholder="例如：图神经网络, 欺诈检测"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              提示：输入多个标签时，用逗号（中英文均可）分隔
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchTagDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchTag} disabled={!batchTagInput.trim()}>
              {batchTagMode === 'add' ? '添加标签' : '移除标签'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
