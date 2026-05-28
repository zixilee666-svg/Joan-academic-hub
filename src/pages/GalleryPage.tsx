import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  BookOpen,
  Globe,
  Sparkles,
  ArrowRight,
  LogOut,
  FlaskConical,
  Target,
  Calendar,
} from 'lucide-react';
import { spaceService, type SpaceConfig } from '@/services/spaceService';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AnimatedPage from '@/components/shared/AnimatedPage';
import Loading from '@/components/common/Loading';
import Pagination from '@/components/common/Pagination';
import JoanLearningGNN from '@/components/gallery/JoanLearningGNN';

// ── SpaceCard ──
function SpaceCard({ space, featured = false }: { space: SpaceConfig; featured?: boolean }) {
  const initials = (space.displayName || space.username).charAt(0).toUpperCase();
  const bgColors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
  const colorIdx = space.username.charCodeAt(0) % bgColors.length;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Card className={`h-full overflow-hidden transition-all duration-300 hover:shadow-xl ${featured ? 'ring-2 ring-primary/50 shadow-lg' : ''}`}>
        <Link to={`/u/${space.username}`} className="block">
          {/* Featured badge */}
          {featured && (
            <div className="bg-gradient-to-r from-primary to-accent-500 text-white text-center py-1 text-xs font-medium">
              <Sparkles className="inline w-3 h-3 mr-1" />
              官方示范空间
            </div>
          )}

          <CardContent className="pt-5 pb-4">
            {/* Avatar + Name */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-display text-lg font-bold shadow-md ${bgColors[colorIdx]}`}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold truncate">
                  {space.displayName || space.username}
                </h3>
                {space.institution && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {space.institution}
                  </p>
                )}
              </div>
            </div>

            {/* Bio */}
            {space.bio && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {space.bio}
              </p>
            )}

            {/* Research tags */}
            {space.researchField && (
              <div className="flex flex-wrap gap-1 mb-3">
                {space.researchField.split(/[,，、]/).slice(0, 3).map((f) => (
                  <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {f.trim()}
                  </Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t text-xs">
              <div className="text-center">
                <div className="font-semibold text-foreground">{space.paperCount}</div>
                <div className="text-muted-foreground">文献</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">{space.projectCount}</div>
                <div className="text-muted-foreground">项目</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">{space.viewCount}</div>
                <div className="text-muted-foreground">浏览</div>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
}

// ── ProjectCard ──
function ProjectCard({ project }: { project: any }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    'in-progress': { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    planned: { label: '计划中', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    completed: { label: '已完成', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
    archived: { label: '已归档', color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-950/30' },
  };
  const cfg = statusConfig[project.status] || statusConfig.planned;
  const progress = project.progress || 0;

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-xl">
        <Link to={`/dashboard/project/${project.id}`} className="block">
          <CardContent className="pt-5 pb-4">
            {/* Status badge */}
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className={cn('text-[10px]', cfg.color, cfg.bg)}>
                {cfg.label}
              </Badge>
              {project.tags && project.tags.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {project.tags[0]}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2">
              {project.name}
            </h3>

            {/* Description */}
            {project.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {project.description}
              </p>
            )}

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Owner + Goals */}
            <div className="flex items-center justify-between pt-3 border-t text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {(project.ownerDisplayName || project.ownerUsername || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-muted-foreground truncate max-w-[80px]">
                  {project.ownerDisplayName || project.ownerUsername}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Target className="w-3 h-3" />
                <span>{project.completedGoals || 0}/{project.goalCount || 0}</span>
              </div>
            </div>

            {/* Date */}
            {project.createdAt && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                <Calendar className="w-3 h-3" />
                <span>{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            )}
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
}

// ── Gallery Page ──
export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [spaces, setSpaces] = useState<SpaceConfig[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [field, setField] = useState(searchParams.get('field') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'popularity');
  const [totalSpaces, setTotalSpaces] = useState(0);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page') || '1'));
  const [viewMode, setViewMode] = useState<'spaces' | 'projects'>('spaces');
  const pageSize = 12;

  const updateSearchParams = useCallback(
    (updates: Record<string, string>) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        Object.entries(updates).forEach(([k, v]) => {
          if (v) params.set(k, v);
          else params.delete(k);
        });
        return params;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    updateSearchParams({
      search,
      field,
      sort,
      page: String(currentPage),
    });
  }, [search, field, sort, currentPage, updateSearchParams]);

  useEffect(() => {
    if (viewMode === 'spaces') {
      loadSpaces();
    } else {
      loadProjects();
    }
  }, [search, field, sort, currentPage, viewMode]);

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const res = await spaceService.list({ search, field, sort, page: currentPage });
      if (res.success && res.data) {
        setSpaces(res.data.spaces || []);
        setTotalSpaces(res.data.total || 0);
      }
    } catch (e) {
      console.error('Failed to load spaces:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getPublicProjects();
      if (res.success && res.data) {
        setProjects(res.data.projects || []);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setCurrentPage(1);
  };

  const handleFieldChange = (value: string) => {
    setField(value === 'all' ? '' : value);
    setCurrentPage(1);
  };

  // 贞德的示范空间始终排在第一位
  const joanSpace = spaces.find(s => s.username === 'joan');
  const otherSpaces = spaces.filter(s => s.username !== 'joan');

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-br from-ivory-50 via-white to-ivory-100 dark:from-primary-900 dark:via-primary-900 dark:to-primary-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-primary-800 dark:text-ivory-100 font-display mb-3">
              <Sparkles className="inline w-8 h-8 mr-2 text-accent-500" />
              学术贞德画廊
            </h1>
            <p className="text-base text-primary-500 dark:text-primary-300 max-w-2xl mx-auto">
              探索贞德的学术世界，发现图神经网络与金融欺诈检测的前沿研究
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Link to="/dashboard">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/25">
                <BookOpen className="w-5 h-5" />
                进入我的学术中心
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => {
                useAuthStore.getState().logout();
                window.location.hash = '#/login';
              }}
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </Button>
          </motion.div>
        </div>

        {/* View Mode Tabs */}
        <motion.div
          className="flex justify-center gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <Button
            variant={viewMode === 'spaces' ? 'default' : 'outline'}
            size="lg"
            className="gap-2"
            onClick={() => setViewMode('spaces')}
          >
            <Globe className="w-4 h-4" />
            学术贞德
          </Button>
          <Button
            variant={viewMode === 'projects' ? 'default' : 'outline'}
            size="lg"
            className="gap-2"
            onClick={() => setViewMode('projects')}
          >
            <FlaskConical className="w-4 h-4" />
            研究项目
          </Button>
        </motion.div>

        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-primary-800/80 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <Input
                    placeholder={viewMode === 'spaces' ? '搜索学者、机构、研究领域...' : '搜索项目名称、研究者...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-11 text-base"
                  />
                </div>
                {viewMode === 'spaces' && (
                  <>
                    <Select value={field || 'all'} onValueChange={handleFieldChange}>
                      <SelectTrigger className="w-full sm:w-[180px] h-11">
                        <SelectValue placeholder="研究领域" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部领域</SelectItem>
                        <SelectItem value="graph-neural-network">图神经网络</SelectItem>
                        <SelectItem value="natural-language-processing">自然语言处理</SelectItem>
                        <SelectItem value="computer-vision">计算机视觉</SelectItem>
                        <SelectItem value="reinforcement-learning">强化学习</SelectItem>
                        <SelectItem value="fraud-detection">欺诈检测</SelectItem>
                        <SelectItem value="recommendation-system">推荐系统</SelectItem>
                        <SelectItem value="knowledge-graph">知识图谱</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sort} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-full sm:w-[160px] h-11">
                        <SelectValue placeholder="排序方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="popularity">🔥 最受欢迎</SelectItem>
                        <SelectItem value="recent">🕐 最近活跃</SelectItem>
                        <SelectItem value="papers">📚 文献最多</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <div className="mt-8">
          {loading ? (
            <Loading message={viewMode === 'spaces' ? '正在召唤学术贞德...' : '正在加载研究项目...'} />
          ) : viewMode === 'spaces' ? (
            spaces.length === 0 ? (
              <motion.div
                className="py-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <JoanLearningGNN />
              </motion.div>
            ) : (
              <>
                {/* Featured: Joan's Space */}
                {joanSpace && (
                  <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-lg font-semibold text-primary-700 dark:text-ivory-200 mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-accent-500" />
                      官方示范空间
                    </h2>
                    <div className="max-w-md">
                      <SpaceCard space={joanSpace} featured />
                    </div>
                  </motion.div>
                )}

                {/* Other Spaces */}
                {otherSpaces.length > 0 && (
                  <>
                    <h2 className="text-lg font-semibold text-primary-700 dark:text-ivory-200 mb-4">
                      全部学术贞德
                    </h2>
                    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {otherSpaces.map((space, idx) => (
                        <motion.div
                          key={space.username}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.3 }}
                        >
                          <SpaceCard space={space} />
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}

                {/* Pagination */}
                {Math.ceil(totalSpaces / pageSize) > 1 && (
                  <div className="pt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(totalSpaces / pageSize)}
                      onPageChange={(page) => {
                        setCurrentPage(page);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  </div>
                )}
              </>
            )
          ) : (
            projects.length === 0 ? (
              <motion.div
                className="py-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <JoanLearningGNN />
              </motion.div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-primary-700 dark:text-ivory-200 mb-4">
                  全部研究项目
                </h2>
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project, idx) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <ProjectCard project={project} />
                    </motion.div>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
