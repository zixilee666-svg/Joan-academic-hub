import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Database, BookOpen, FileText, Lightbulb, BarChart3, Code, NotebookText, User } from 'lucide-react';
import knowledgeGraphLib, { getMergedGraph, getLocalKG, addZoteroPapersToLocalKG, type KnowledgeEntity } from '@/lib/knowledgeGraph';

export default function KnowledgeGraphPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // 获取所有实体（静态+本地动态）
  const allEntities = useMemo(() => {
    const graph = getMergedGraph();
    return graph.entities || [];
  }, []);

  // 获取本地动态实体（用户导入的Zotero论文等）
  const localKG = useMemo(() => getLocalKG(), []);

  // 过滤实体
  const filteredEntities = useMemo(() => {
    let result = allEntities;
    if (filterType !== 'all') {
      result = result.filter(e => e.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [allEntities, filterType, searchQuery]);

  const typeColors: Record<string, string> = {
    concept: 'bg-blue-100 text-blue-800',
    paper: 'bg-green-100 text-green-800',
    method: 'bg-purple-100 text-purple-800',
    dataset: 'bg-orange-100 text-orange-800',
    task: 'bg-pink-100 text-pink-800',
    metric: 'bg-yellow-100 text-yellow-800',
    code: 'bg-gray-100 text-gray-800',
    note: 'bg-teal-100 text-teal-800',
    author: 'bg-red-100 text-red-800',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    concept: <Lightbulb className="h-4 w-4" />,
    paper: <BookOpen className="h-4 w-4" />,
    method: <BarChart3 className="h-4 w-4" />,
    dataset: <Database className="h-4 w-4" />,
    task: <FileText className="h-4 w-4" />,
    metric: <BarChart3 className="h-4 w-4" />,
    code: <Code className="h-4 w-4" />,
    note: <NotebookText className="h-4 w-4" />,
    author: <User className="h-4 w-4" />,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">知识图谱</h1>
            <p className="text-muted-foreground mt-1">
              查看和管理学术知识图谱（静态 {allEntities.length - localKG.entities.length} + 本地动态 {localKG.entities.length}）
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['concept', 'paper', 'method', 'dataset'] as const).map(type => {
            const count = allEntities.filter(e => e.type === type).length;
            return (
              <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterType(filterType === type ? 'all' : type)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${typeColors[type].replace('text-', 'bg-').replace('-800', '-100')}`}>
                    {typeIcons[type]}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground capitalize">{type}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识实体..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Entity List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              实体列表 ({filteredEntities.length})
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFilterType('all')}>
                全部
              </Button>
              {(['concept', 'paper', 'method', 'dataset', 'task', 'metric', 'code', 'note', 'author'] as const).map(type => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map(entity => (
              <Card key={entity.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${typeColors[entity.type]?.split(' ')[0] || 'bg-gray-100'}`}>
                        {typeIcons[entity.type] || <FileText className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-base line-clamp-2">{entity.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {entity.type} • {new Date(entity.updatedAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={typeColors[entity.type]}>
                      {entity.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {entity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {entity.description}
                    </p>
                  )}
                  {entity.tags && entity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entity.tags.slice(0, 5).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {entity.tags.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{entity.tags.length - 5}
                        </Badge>
                      )}
                    </div>
                  )}
                  {entity.source && (
                    <p className="text-xs text-muted-foreground mt-2">
                      来源: {entity.source}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEntities.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>未找到匹配的知识实体</p>
              <p className="text-sm">尝试调整搜索条件或筛选类型</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
