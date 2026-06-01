// ========================================
// ResearchPage — 研究项目管理
// Migrated to use API services layer
// ========================================
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, FlaskConical, BookOpen, Clock, Target, ChevronRight,
  CheckCircle2, Circle, Trash2, FolderOpen, Loader2, X, Settings2, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import AnimatedPage from '@/components/shared/AnimatedPage';
import EmptyState from '@/components/shared/EmptyState';
import JoanQuote from '@/components/shared/JoanQuote';
import { api } from '@/lib/api';
import type { Project, Paper, Objective } from '@/types';
import { cn, formatDate } from '@/lib/utils';

type ProjectStatus = Project['status'];

export default function ResearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newObjectiveText, setNewObjectiveText] = useState<Record<string, string>>({});
  const [managePapersOpen, setManagePapersOpen] = useState(false);
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [paperSearchQuery, setPaperSearchQuery] = useState('');

  // Load projects and papers on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, paperRes] = await Promise.all([
        api.getProjects(),
        api.getPapers({ pageSize: 200 }),
      ]);
      if (projRes.success && projRes.data) {
        setProjects(projRes.data);
      }
      if (paperRes.success && paperRes.data) {
        setPapers(paperRes.data);
      }
    } catch (err) {
      console.error('[ResearchPage] Load error:', err);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return projects;
    return projects.filter((p) => p.status === filterStatus);
  }, [projects, filterStatus]);

  // Filter papers in manage dialog by search query
  const filteredPapers = useMemo(() => {
    if (!paperSearchQuery.trim()) return papers;
    const q = paperSearchQuery.toLowerCase().trim();
    return papers.filter(p => {
      // 标题
      if (p.title?.toLowerCase().includes(q)) return true;
      // 作者 (兼容 string[] 和 string)
      const authorText = Array.isArray(p.authors) ? p.authors.join(' ') : (p.authors || '');
      if (authorText.toLowerCase().includes(q)) return true;
      // 年份
      if (String(p.year || '').includes(q)) return true;
      // 期刊/会议
      if (p.venue?.toLowerCase().includes(q)) return true;
      if (p.journal?.toLowerCase().includes(q)) return true;
      // 摘要
      if (p.abstract?.toLowerCase().includes(q)) return true;
      // DOI
      if (p.doi?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [papers, paperSearchQuery]);

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
    'in-progress': { label: '进行中', variant: 'default', color: 'bg-primary' },
    'active': { label: '进行中', variant: 'default', color: 'bg-primary' },
    'completed': { label: '已完成', variant: 'secondary', color: 'bg-green-500' },
    'planned': { label: '计划中', variant: 'outline', color: 'bg-muted-foreground' },
  };

  const toggleObjective = async (projectId: string, objectiveId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    const objs = proj.objectives || [];
    const newObjectives = objs.map((o) =>
      o.id === objectiveId ? { ...o, completed: !o.completed } : o
    );
    const completed = newObjectives.filter((o) => o.completed).length;
    const newProgress = newObjectives.length ? Math.round((completed / newObjectives.length) * 100) : 0;
    const newStatus: ProjectStatus = completed === newObjectives.length && newObjectives.length > 0 ? 'completed' : 'in-progress';

    // Optimistic update
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, objectives: newObjectives, progress: newProgress, status: newStatus, updatedAt: new Date().toISOString() }
        : p
    ));

    try {
      await api.updateProject(projectId, {
        objectives: newObjectives,
        progress: newProgress,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Revert on error
      setProjects(prev => prev.map(p => p.id === projectId ? proj : p));
      toast.error('更新目标失败');
    }
  };

  const addObjective = async (projectId: string, text: string) => {
    if (!text.trim()) return;
    const trimmedText = text.trim();

    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    const newObj: Objective = {
      id: 'obj-' + Date.now(),
      text: trimmedText,
      completed: false,
    };
    const newObjectives = [...(proj.objectives || []), newObj];

    // Optimistic update
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, objectives: newObjectives }
        : p
    ));
    setNewObjectiveText(prev => ({ ...prev, [projectId]: '' }));

    try {
      await api.updateProject(projectId, { objectives: newObjectives });
    } catch {
      // Revert on error
      setProjects(prev => prev.map(p => p.id === projectId ? proj : p));
      toast.error('添加目标失败');
    }
  };

  const deleteObjective = async (projectId: string, objectiveId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    const newObjectives = (proj.objectives || []).filter(o => o.id !== objectiveId);
    const completed = newObjectives.filter(o => o.completed).length;
    const newProgress = newObjectives.length ? Math.round((completed / newObjectives.length) * 100) : 0;
    const newStatus: ProjectStatus = completed === newObjectives.length && newObjectives.length > 0 ? 'completed' : 'in-progress';

    // Optimistic update
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, objectives: newObjectives, progress: newProgress, status: newStatus, updatedAt: new Date().toISOString() }
        : p
    ));

    try {
      await api.updateProject(projectId, {
        objectives: newObjectives,
        progress: newProgress,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success('目标已删除');
    } catch {
      // Revert on error
      setProjects(prev => prev.map(p => p.id === projectId ? proj : p));
      toast.error('删除目标失败');
    }
  };

  const deleteProject = async (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    // Optimistic update
    setProjects(prev => prev.filter(p => p.id !== projectId));

    try {
      await api.deleteProject(projectId);
      toast.success('项目已删除');
    } catch {
      // Revert on error
      if (proj) setProjects(prev => [proj, ...prev]);
      toast.error('删除项目失败');
    }
  };

  const createProject = async () => {
    if (!newTitle.trim()) return;

    try {
      const res = await api.createProject({
        name: newTitle.trim(),
        description: newDesc.trim(),
        status: 'planned',
        objectives: [],
        paperIds: [],
      });
      if (res.success && res.data) {
        setProjects(prev => [res.data, ...prev]);
        setNewTitle('');
        setNewDesc('');
        setCreateOpen(false);
        toast.success('项目已创建');
      }
    } catch {
      toast.error('创建项目失败');
    }
  };

  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === 'in-progress' || p.status === 'active').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const planned = projects.filter((p) => p.status === 'planned').length;
    return { total, inProgress, completed, planned };
  }, [projects]);

  const getRelatedPaper = (paperId: string): Paper | undefined => {
    return papers.find(p => p.id === paperId);
  };

  // Get paper IDs from project
  const getProjectPaperIds = (project: Project): string[] => {
    return project.relatedPaperIds || project.paperIds || [];
  };

  const openManagePapers = (project: Project) => {
    setManagingProject(project);
    setSelectedPaperIds(getProjectPaperIds(project));
    setPaperSearchQuery('');
    setManagePapersOpen(true);
  };

  const togglePaperSelection = (paperId: string) => {
    setSelectedPaperIds(prev =>
      prev.includes(paperId) ? prev.filter(id => id !== paperId) : [...prev, paperId]
    );
  };

  const saveProjectPapers = async () => {
    if (!managingProject) return;
    const previous = projects.find(p => p.id === managingProject.id);
    setProjects(prev => prev.map(p =>
      p.id === managingProject.id
        ? { ...p, paperIds: selectedPaperIds, relatedPaperIds: selectedPaperIds }
        : p
    ));
    try {
      await api.updateProject(managingProject.id, { paperIds: selectedPaperIds });
      toast.success('关联文献已更新');
      setManagePapersOpen(false);
    } catch {
      if (previous) {
        setProjects(prev => prev.map(p => p.id === managingProject.id ? previous : p));
      }
      toast.error('更新失败');
    }
  };

  const removePaperFromProject = async (projectId: string, paperId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const currentIds = getProjectPaperIds(project);
    const newIds = currentIds.filter(id => id !== paperId);
    const previous = project;
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, paperIds: newIds, relatedPaperIds: newIds } : p
    ));
    try {
      await api.updateProject(projectId, { paperIds: newIds });
      toast.success('文献已移除');
    } catch {
      setProjects(prev => prev.map(p => p.id === projectId ? previous : p));
      toast.error('移除失败');
    }
  };

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">我的研究</h1>
            <p className="text-sm text-muted-foreground">
              管理研究项目，追踪目标进度
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建研究项目</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>项目名称</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="输入项目名称..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>项目描述</Label>
                  <Textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="描述研究目标与范围..."
                    className="mt-1.5"
                    rows={4}
                  />
                </div>
                <Button onClick={createProject} className="w-full" disabled={!newTitle.trim()}>
                  创建项目
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-8 w-10" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '总项目', value: stats.total, color: 'text-primary' },
              { label: '进行中', value: stats.inProgress, color: 'text-blue-500' },
              { label: '已完成', value: stats.completed, color: 'text-green-500' },
              { label: '计划中', value: stats.planned, color: 'text-muted-foreground' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'in-progress', 'completed', 'planned'] as const).map((s) => (
            <Badge
              key={s}
              variant={filterStatus === s ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? '全部' : statusConfig[s].label}
            </Badge>
          ))}
        </div>

        {/* Projects */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-8 w-8" />}
            title="暂无研究项目"
            description="创建你的第一个研究项目，开始组织文献与目标。"
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((project, i) => {
              const projectPaperIds = getProjectPaperIds(project);
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="overflow-hidden">
                    {/* Project Header */}
                    <CardContent
                      className="pt-5 pb-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedProject(expandedProject === project.id ? null : project.id)
                      }
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FlaskConical className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-semibold">{project.title || project.name || '未命名项目'}</h3>
                              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                {project.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={statusConfig[project.status]?.variant || 'outline'}>
                                {statusConfig[project.status]?.label || '未知'}
                              </Badge>
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 text-muted-foreground transition-transform',
                                  expandedProject === project.id && 'rotate-90'
                                )}
                              />
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {(project.objectives || []).filter((o) => o.completed).length}/{(project.objectives || []).length} 目标
                              </span>
                              <span className="font-medium">{project.progress || 0}%</span>
                            </div>
                            <Progress value={project.progress || 0} className="h-1.5" />
                          </div>

                          {/* Meta */}
                          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              {projectPaperIds.length} 篇文献
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              更新于 {formatDate(project.updatedAt || '')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {expandedProject === project.id && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <Separator />
                          <div className="p-5 space-y-4">
                            {/* Joan Quote */}
                            <JoanQuote category="academic" />

                            {/* Objectives */}
                            <div>
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                研究目标
                              </h4>
                              <div className="space-y-2">
                                {(project.objectives || []).map((obj) => (
                                  <div
                                    key={obj.id}
                                    className="flex items-center gap-3 group"
                                  >
                                    <button
                                      onClick={() => toggleObjective(project.id, obj.id)}
                                      className="shrink-0"
                                    >
                                      {obj.completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                      ) : (
                                        <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                                      )}
                                    </button>
                                    <span
                                      className={cn(
                                        'text-sm flex-1',
                                        obj.completed && 'line-through text-muted-foreground'
                                      )}
                                    >
                                      {obj.text}
                                    </span>
                                    <button
                                      onClick={() => deleteObjective(project.id, obj.id)}
                                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                      title="删除目标"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                                {(project.objectives || []).length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    暂无目标，在下方输入框添加。
                                  </p>
                                )}
                                {/* Add objective input */}
                                <div className="flex items-center gap-2 mt-3">
                                  <Input
                                    value={newObjectiveText[project.id] || ''}
                                    onChange={(e) => setNewObjectiveText(prev => ({ ...prev, [project.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addObjective(project.id, newObjectiveText[project.id] || '');
                                      }
                                    }}
                                    placeholder="添加新目标..."
                                    className="text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addObjective(project.id, newObjectiveText[project.id] || '')}
                                    disabled={!newObjectiveText[project.id]?.trim()}
                                  >
                                    添加
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Related Papers */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <BookOpen className="h-4 w-4" />
                                  关联文献 ({projectPaperIds.length})
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openManagePapers(project);
                                  }}
                                >
                                  <Settings2 className="h-3 w-3" />
                                  管理文献
                                </Button>
                              </div>
                              {projectPaperIds.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {projectPaperIds.map((pid) => {
                                    const paper = getRelatedPaper(pid);
                                    if (!paper) return null;
                                    return (
                                      <div
                                        key={pid}
                                        className="group flex items-start gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors"
                                      >
                                        <Link to={`/dashboard/paper/${pid}`} className="flex items-start gap-2 flex-1 min-w-0">
                                          <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                                          <div className="min-w-0">
                                            <p className="line-clamp-1 text-xs font-medium group-hover:text-primary transition-colors">
                                              {paper.title}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                              {paper.year} · {paper.venue}
                                            </p>
                                          </div>
                                        </Link>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removePaperFromProject(project.id, pid);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-destructive/10"
                                          title="移除"
                                        >
                                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground py-2">暂无关联文献，点击「管理文献」添加。</p>
                              )}
                            </div>

                            {/* Notes */}
                            {project.notes && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">研究笔记</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-md p-3">
                                  {project.notes}
                                </p>
                              </div>
                            )}

                            {/* Manage Papers Dialog */}
                            <Dialog open={managePapersOpen} onOpenChange={setManagePapersOpen}>
                              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>管理关联文献</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3 mt-2">
                                  <p className="text-xs text-muted-foreground">
                                    选择要关联到「{managingProject?.name || managingProject?.title}」的文献
                                  </p>
                                  {/* Search input */}
                                  {papers.length > 0 && (
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        placeholder="按标题、作者、年份、期刊检索…"
                                        value={paperSearchQuery}
                                        onChange={(e) => setPaperSearchQuery(e.target.value)}
                                        className="pl-9 pr-8 text-sm"
                                      />
                                      {paperSearchQuery && (
                                        <button
                                          onClick={() => setPaperSearchQuery('')}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {papers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      暂无可用文献
                                    </p>
                                  ) : filteredPapers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                      未找到匹配「{paperSearchQuery}」的文献
                                    </p>
                                  ) : (
                                    <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                                      {paperSearchQuery.trim() && (
                                        <p className="text-[11px] text-muted-foreground px-1">
                                          找到 {filteredPapers.length} 篇匹配文献
                                        </p>
                                      )}
                                      {filteredPapers.map((paper) => (
                                        <label
                                          key={paper.id}
                                          className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                          <Checkbox
                                            checked={selectedPaperIds.includes(paper.id)}
                                            onCheckedChange={() => togglePaperSelection(paper.id)}
                                            className="mt-0.5"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium line-clamp-1">{paper.title}</p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                              {Array.isArray(paper.authors) ? paper.authors.slice(0, 2).join(', ') : paper.authors} · {paper.year} · {paper.venue || paper.journal}
                                            </p>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <DialogFooter className="mt-4">
                                  <Button variant="outline" onClick={() => setManagePapersOpen(false)}>
                                    取消
                                  </Button>
                                  <Button onClick={saveProjectPapers}>
                                    保存 ({selectedPaperIds.length} 篇)
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(project.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                删除项目
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
