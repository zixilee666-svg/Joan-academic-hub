// ========================================
// DashboardPage — 主页仪表盘 (API 集成版 + 增强交互)
// ========================================
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen, Star, Clock, Trophy, Flame, TrendingUp, FileText, FolderOpen,
  RefreshCw, ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AnimatedPage from '@/components/shared/AnimatedPage';
import { AnimatedCounter, formatNumber } from '@/components/shared/AnimatedCounter';
import JoanQuote from '@/components/shared/JoanQuote';
import { api } from '@/lib/api';
import { useDataStore } from '@/store/dataStore';
import type { Paper, Project, ReadingStats } from '@/types';
import { cn } from '@/lib/utils';

// ---------- 统计卡片 ----------
function StatCard({
  icon: Icon, label, value, sub, color, link, animationDelay = 0
}: {
  icon: React.ElementType; label: string; value: number;
  sub?: string; color: string; link?: string; animationDelay?: number;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (link) {
      navigate(link);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.3 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={cn(link && 'cursor-pointer')}
    >
      <Card className={cn(
        'h-full transition-all',
        link && 'hover:shadow-md hover:border-primary/30'
      )}>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', color)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-1">
              <AnimatedCounter
                value={value}
                duration={1.2}
                formatter={(v) => formatNumber(Math.round(v))}
                className="text-2xl font-bold tracking-tight"
              />
              {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            </div>
          </div>
          {link && (
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- 阅读热力图（专业版）----------
function ReadingHeatmap({ data }: { data: number[] }) {
  const days = ['一', '二', '三', '四', '五', '六', '日'];

  // ---- 统计摘要 ----
  const totalReads = data.reduce((sum, v) => sum + v, 0);
  const activeDays = data.filter(v => v > 0).length;
  const maxReads = Math.max(...data);
  const avgDaily = activeDays > 0 ? (totalReads / activeDays).toFixed(1) : '0';
  const avgAllDays = (totalReads / data.length).toFixed(1);

  // 连续活跃天数
  let currentStreak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] > 0) currentStreak++;
    else break;
  }

  // ---- 5级热力梯度（GitHub风格，更精致） ----
  const getLevel = (v: number): number => {
    if (v === 0) return 0;
    if (v <= 1) return 1;
    if (v <= 3) return 2;
    if (v <= 6) return 3;
    return 4;
  };

  const LEVEL_COLORS = [
    'bg-[#ebedf0] dark:bg-[#161b22]',
    'bg-[#9be9a8] dark:bg-[#0e4429]',
    'bg-[#40c463] dark:bg-[#006d32]',
    'bg-[#30a14e] dark:bg-[#26a641]',
    'bg-[#216e39] dark:bg-[#39d353]',
  ];

  const LEVEL_COLORS_SOLID = [
    '#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39',
  ];

  const getColorClass = (v: number) => LEVEL_COLORS[getLevel(v)];

  const getIntensityLabel = (v: number) => {
    if (v === 0) return '无阅读';
    if (v <= 1) return '少量阅读';
    if (v <= 3) return '适度阅读';
    if (v <= 6) return '大量阅读';
    return '阅读高峰';
  };

  // ---- 日历网格 ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = data.length;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (totalDays - 1));
  const startDayOfWeek = startDate.getDay();
  const daysBeforeMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const calendarStart = new Date(startDate);
  calendarStart.setDate(startDate.getDate() - daysBeforeMonday);

  const calendarEndDayOfWeek = today.getDay();
  const daysAfterSunday = calendarEndDayOfWeek === 0 ? 0 : 7 - calendarEndDayOfWeek;
  const calendarEnd = new Date(today);
  calendarEnd.setDate(today.getDate() + daysAfterSunday);

  const totalCells = Math.ceil((calendarEnd.getTime() - calendarStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weekCount = Math.ceil(totalCells / 7);

  // ---- 月份标签 ----
  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const weekStart = new Date(calendarStart);
    weekStart.setDate(calendarStart.getDate() + w * 7);
    const month = weekStart.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ weekIndex: w, label: weekStart.toLocaleDateString('zh-CN', { month: 'short' }) });
      lastMonth = month;
    }
  }

  // ---- 布局常量 ----
  const CELL = 16;
  const GAP = 4;
  const UNIT = CELL + GAP;
  const LABEL_W = 28;

  return (
    <TooltipProvider delayDuration={60}>
      <div>
        {/* ===== 统计摘要卡片 ===== */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs">
              <strong className="text-foreground font-semibold">{totalReads}</strong>
              <span className="text-muted-foreground ml-0.5">篇</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs">
              <strong className="text-foreground font-semibold">{activeDays}</strong>
              <span className="text-muted-foreground ml-0.5">天活跃</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs">
              日均 <strong className="text-foreground font-semibold">{avgAllDays}</strong>
              <span className="text-muted-foreground ml-0.5">篇</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs">
              最高 <strong className="text-foreground font-semibold">{maxReads}</strong>
              <span className="text-muted-foreground ml-0.5">篇/天</span>
            </span>
          </div>
          {currentStreak > 2 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse">
              <Flame className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs">
                <strong className="text-red-600 dark:text-red-400 font-semibold">{currentStreak}</strong>
                <span className="text-muted-foreground ml-0.5">天连续</span>
              </span>
            </div>
          )}
        </div>

        {/* ===== 月份标签 + 图例 ===== */}
        <div className="flex items-end justify-between mb-2">
          <div
            className="flex items-end text-[11px] text-muted-foreground font-medium select-none"
            style={{ paddingLeft: LABEL_W + GAP }}
          >
            {monthLabels.map((m, i) => {
              const prevIdx = i > 0 ? monthLabels[i - 1].weekIndex : 0;
              const offset = (m.weekIndex - prevIdx) * UNIT;
              return (
                <span
                  key={i}
                  style={{ marginLeft: i === 0 ? 0 : offset - 16 }}
                  className="tabular-nums"
                >
                  {m.label}
                </span>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground select-none">
            <span>少</span>
            {LEVEL_COLORS_SOLID.map((color, i) => (
              <div
                key={i}
                className="rounded-[3px]"
                style={{ width: 12, height: 12, backgroundColor: color }}
              />
            ))}
            <span>多</span>
          </div>
        </div>

        {/* ===== 网格主体 ===== */}
        <div className="flex" style={{ gap: GAP }}>
          {/* 星期标签 */}
          <div
            className="flex flex-col shrink-0 text-[11px] text-muted-foreground select-none font-medium"
            style={{ width: LABEL_W, gap: GAP }}
          >
            {days.map((d, i) => (
              <div key={d} className={cn(
                "flex items-center justify-end pr-1",
                (i === 5 || i === 6) && "text-amber-600 dark:text-amber-400"
              )} style={{ height: CELL }}>
                {d}
              </div>
            ))}
          </div>

          {/* 色块网格 */}
          <div className="flex overflow-x-auto pb-1" style={{ gap: GAP }}>
            {Array.from({ length: weekCount }).map((_, w) => (
              <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                {Array.from({ length: 7 }).map((_, d) => {
                  const cellDate = new Date(calendarStart);
                  cellDate.setDate(calendarStart.getDate() + w * 7 + d);
                  const dataIdx = Math.floor(
                    (cellDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const v = dataIdx >= 0 && dataIdx < data.length ? data[dataIdx] : 0;
                  const isToday = cellDate.getTime() === today.getTime();
                  const inFuture = cellDate.getTime() > today.getTime();
                  const level = getLevel(v);

                  const displayDate = cellDate.toLocaleDateString('zh-CN', {
                    month: 'long', day: 'numeric', weekday: 'long',
                  });

                  return (
                    <Tooltip key={d}>
                      <TooltipTrigger asChild>
                        <motion.div
                          initial={inFuture ? false : { scale: 0, opacity: 0 }}
                          animate={inFuture ? {} : { scale: 1, opacity: 1 }}
                          transition={{ delay: (w * 7 + d) * 0.0012, duration: 0.2 }}
                          className={cn(
                            'rounded-[4px] transition-all duration-150 cursor-default',
                            inFuture
                              ? 'bg-transparent'
                              : getColorClass(v),
                            !inFuture && level >= 3 && 'shadow-sm',
                            !inFuture && level === 4 && 'shadow-md',
                            !inFuture && v > 0 && [
                              'hover:scale-130 hover:z-10',
                              'hover:ring-2 hover:ring-primary/40 hover:shadow-lg',
                            ],
                            !inFuture && v === 0 && 'hover:ring-1 hover:ring-border hover:bg-border/50',
                            isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                          )}
                          style={{ width: CELL, height: CELL }}
                        />
                      </TooltipTrigger>
                      {!inFuture && (
                        <TooltipContent side="top" className="px-3 py-2 max-w-[220px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-semibold text-foreground text-xs">{displayDate}</span>
                              {isToday && (
                                <Badge variant="default" className="text-[10px] h-4 px-1.5">
                                  今天
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-[2px] shrink-0"
                                style={{ backgroundColor: LEVEL_COLORS_SOLID[level] }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {v === 0 ? (
                                  '无阅读记录'
                                ) : (
                                  <>
                                    <strong className="text-foreground">{v}</strong> 篇 ·
                                    <span className="ml-1">{getIntensityLabel(v)}</span>
                                  </>
                                )}
                              </span>
                            </div>
                            {v > 0 && dataIdx > 0 && data[dataIdx - 1] > 0 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                连续活跃第 {(() => {
                                  let s = 1;
                                  for (let k = dataIdx - 1; k >= 0; k--) {
                                    if (data[k] > 0) s++;
                                    else break;
                                  }
                                  return s;
                                })()} 天
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 移动端图例 */}
        <div className="flex sm:hidden items-center justify-end gap-1.5 mt-2.5 text-[10px] text-muted-foreground select-none">
          <span>少</span>
          {LEVEL_COLORS_SOLID.map((color, i) => (
            <div
              key={i}
              className="rounded-[3px]"
              style={{ width: 12, height: 12, backgroundColor: color }}
            />
          ))}
          <span>多</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------- 最近论文卡片 ----------
function RecentPaper({ paper }: { paper: Paper }) {
  return (
    <Link to={`/dashboard/paper/${paper.id}`} className="group">
      <div className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium group-hover:text-primary transition-colors">
            {paper.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.year}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {paper.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------- 项目进度卡片 ----------
function ProjectCard({ project }: { project: Project }) {
  const objectives = project.objectives || [];
  const completed = objectives.filter((o) => o.completed).length;
  const total = objectives.length;
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
    'in-progress': { label: '进行中', variant: 'default', color: 'text-primary' },
    'active': { label: '进行中', variant: 'default', color: 'text-primary' },
    'completed': { label: '已完成', variant: 'secondary', color: 'text-green-600' },
    'planned': { label: '计划中', variant: 'outline', color: 'text-muted-foreground' },
  };
  const st = statusMap[project.status] || statusMap['planned'];

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="line-clamp-2 text-sm font-semibold">{project.title || project.name || '未命名项目'}</h4>
            <Badge variant={st.variant} className="shrink-0 text-[10px]">{st.label}</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{completed}/{total} 目标完成</span>
              <span className="font-medium">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-1.5" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              {(project.relatedPaperIds || project.paperIds || []).length} 篇文献
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(project.updatedAt ? new Date(project.updatedAt) : new Date()).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- Loading Skeleton ----------
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 pt-6">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* 热力图骨架 */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
      {/* 论文和收藏骨架 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 p-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {/* 项目骨架 */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-4 border rounded-lg">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 主页面 ==========
export default function DashboardPage() {
  const { papers, projects, papersLoaded, projectsLoaded, ensurePapers, ensureProjects, invalidateAll } = useDataStore();
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ReadingStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      // 并行发起所有请求，谁先到谁先渲染
      await Promise.all([
        // 阅读统计：独立容错，失败降级为 0
        (async () => {
          try {
            const statsRes = await api.getReadingStats();
            if (statsRes.success && statsRes.data) {
              setStats(statsRes.data);
            }
          } catch (statsErr: any) {
            console.warn('[Dashboard] 阅读统计加载失败:', statsErr.message || statsErr);
          } finally {
            setStatsLoaded(true);
          }
        })(),
        ensurePapers(),
        ensureProjects(),
      ]);
    } catch (err) {
      console.error('[Dashboard] 数据加载失败:', err);
      toast.error('加载数据失败，请刷新重试');
    } finally {
      setRefreshing(false);
    }
  }, [ensurePapers, ensureProjects]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateAll();
    setStatsLoaded(false);
    await loadData();
    toast.success('数据已刷新');
  }, [loadData, invalidateAll]);

  // 计算衍生数据
  const recentPapers = papers
    .slice()
    .sort((a, b) => new Date(b.addedAt || b.addedDate || '').getTime() - new Date(a.addedAt || a.addedDate || '').getTime())
    .slice(0, 5);

  const favorites = papers.filter((p) => p.isFavorited);
  const allTags = Array.from(new Set(papers.flatMap((p) => p.tags)));

  const loading = !papersLoaded || !projectsLoaded;

  if (loading) {
    return (
      <AnimatedPage>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-20 w-72" />
          </div>
          <DashboardSkeleton />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* 顶部欢迎 + 语录 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                欢迎回来，研究者 ⚖️
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-full hover:bg-accent transition-colors"
                title="刷新数据"
              >
                <RefreshCw className={cn(
                  'h-4 w-4 text-muted-foreground',
                  refreshing && 'animate-spin'
                )} />
              </motion.button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              以圣洁纯粹之心，行理性严谨之事
            </p>
          </div>
          <JoanQuote className="hidden sm:block max-w-xs" />
        </div>

        {/* 统计卡片 — stats 未加载时显示骨架屏 */}
        {stats ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              icon={BookOpen} label="文献总量" value={stats.totalPapers}
              sub="篇" color="bg-primary"
              link="/dashboard/library"
              animationDelay={0}
            />
            <StatCard
              icon={TrendingUp} label="本周阅读" value={stats.weeklyRead}
              sub="篇" color="bg-emerald-500"
              link="/dashboard/library"
              animationDelay={0.05}
            />
            <StatCard
              icon={Star} label="收藏文献" value={favorites.length}
              sub="篇" color="bg-amber-500"
              link="/dashboard/library"
              animationDelay={0.1}
            />
            <StatCard
              icon={Flame} label="连续天数" value={stats.streakDays}
              sub="天" color="bg-orange-500"
              animationDelay={0.15}
            />
            <StatCard
              icon={Trophy} label="学术积分" value={stats.points}
              sub="分" color="bg-accent"
              animationDelay={0.2}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-8" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 阅读热力图 */}
        {stats && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-500/10">
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">阅读热力图</CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      近 {stats.weeklyHeatmap.length} 天阅读活动分布
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ReadingHeatmap data={stats.weeklyHeatmap} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 最近添加 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">最近添加</CardTitle>
                <Link to="/library" className="text-xs text-primary hover:underline">
                  查看全部 →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentPapers.length > 0 ? (
                <div className="space-y-1">
                  {recentPapers.map((paper) => (
                    <RecentPaper key={paper.id} paper={paper} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  暂无文献，<Link to="/import" className="text-primary hover:underline">导入文献</Link>开始你的学术之旅
                </p>
              )}
            </CardContent>
          </Card>

          {/* 收藏精选 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">收藏精选</CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {favorites.slice(0, 4).map((paper) => (
                      <Link key={paper.id} to={`/dashboard/paper/${paper.id}`} className="group block">
                        <div className="flex items-start gap-2.5">
                          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-medium group-hover:text-primary transition-colors">
                              {paper.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {paper.year} · {paper.venue} · {paper.citationCount || 0} 引用
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground text-center">
                    共 {favorites.length} 篇收藏文献
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无收藏文献
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 研究项目 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">研究项目</CardTitle>
              <Link to="/research" className="text-xs text-primary hover:underline">
                管理项目 →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {projects.map((proj) => (
                  <ProjectCard key={proj.id} project={proj} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无研究项目，<Link to="/research" className="text-primary hover:underline">创建第一个项目</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
