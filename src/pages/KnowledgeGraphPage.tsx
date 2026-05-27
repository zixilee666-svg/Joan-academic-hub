import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, Database, BookOpen, FileText, Lightbulb, BarChart3, Code,
  NotebookText, User, Link2, ArrowRight, Layers, Calendar, Tag, Info, Network, List,
} from 'lucide-react';
import {
  getMergedGraph, getLocalKG, getEntityById, getRelatedEntities,
  type KnowledgeEntity, type KnowledgeRelation,
} from '@/lib/knowledgeGraph';
import KnowledgeGraphCanvas from '@/components/knowledge/KnowledgeGraphCanvas';

type ViewTab = 'list' | 'graph';

export default function KnowledgeGraphPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('graph'); // 默认显示图谱
  const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const graph = useMemo(() => getMergedGraph(), []);
  const allEntities = graph.entities || [];
  const allRelations = graph.relations || [];
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

  // 打开实体详情
  const openEntityDetail = (entity: KnowledgeEntity) => {
    setSelectedEntity(entity);
    setDialogOpen(true);
  };

  // 获取实体的关系
  const getEntityRelations = (entityId: string): KnowledgeRelation[] => {
    return allRelations.filter(r => r.source === entityId || r.target === entityId);
  };

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

  const relationTypeLabels: Record<string, string> = {
    is_a: '是一种', part_of: '属于', used_in: '被用于',
    proposed_in: '被提出于', outperforms: '优于', cites: '引用',
    related_to: '相关于', has_code: '有代码实现',
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">知识图谱</h1>
            <p className="text-muted-foreground mt-1">
              可视化查看学术知识图谱（静态 {allEntities.length - localKG.entities.length} + 本地动态 {localKG.entities.length}）
            </p>
          </div>
          {/* 视图切换 */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewTab === 'graph' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewTab('graph')}
            >
              <Network className="h-4 w-4 mr-1" />
              图谱
            </Button>
            <Button
              variant={viewTab === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewTab('list')}
            >
              <List className="h-4 w-4 mr-1" />
              列表
            </Button>
          </div>
        </div>

        {/* Graph View */}
        {viewTab === 'graph' && (
          <div className="space-y-4">
            {/* 图例 */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(typeColors).map(([type, cls]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${cls.split(' ')[0]}`} />
                  <span>{type}</span>
                </div>
              ))}
            </div>

            {/* 图谱画布 */}
            <div className="h-[600px] border rounded-lg overflow-hidden bg-slate-50 relative">
              <KnowledgeGraphCanvas
                nodes={filteredEntities}
                links={allRelations}
                onNodeClick={openEntityDetail}
              />
            </div>

            {/* 操作提示 */}
            <p className="text-xs text-muted-foreground text-center">
              滚轮缩放 · 拖拽画布平移 · 点击节点查看详情
            </p>
          </div>
        )}

        {/* List View */}
        {viewTab === 'list' && (
          <div className="space-y-4">
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
                <div className="flex gap-2 flex-wrap">
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
                  <Card
                    key={entity.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openEntityDetail(entity)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${typeColors[entity.type]?.split(' ')[0] || 'bg-gray-100'}`}>
                            {typeIcons[entity.type] || <FileText className="h-4 w-4" />}
                          </div>
                          <div>
                            <CardTitle className="text-base line-clamp-2">{entity.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {entity.type} &bull; {new Date(entity.updatedAt).toLocaleDateString()}
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
        )}

        {/* Entity Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {selectedEntity && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[selectedEntity.type]?.split(' ')[0] || 'bg-gray-100'}`}>
                      {typeIcons[selectedEntity.type] || <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedEntity.name}</DialogTitle>
                      <DialogDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={typeColors[selectedEntity.type]}>
                          {selectedEntity.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ID: {selectedEntity.id}
                        </span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Description */}
                  {selectedEntity.description && (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4" />
                        描述
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedEntity.description}
                      </p>
                    </div>
                  )}

                  {/* Content */}
                  {selectedEntity.content && (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        详细内容
                      </h3>
                      <div className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-4 rounded-lg whitespace-pre-wrap">
                        {selectedEntity.content}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedEntity.tags && selectedEntity.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4" />
                        标签
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedEntity.tags.map(tag => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source & Dates */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
                    {selectedEntity.source && (
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        来源: {selectedEntity.source}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      创建: {new Date(selectedEntity.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      更新: {new Date(selectedEntity.updatedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Relations */}
                  {(() => {
                    const relations = getEntityRelations(selectedEntity.id);
                    if (relations.length === 0) return null;
                    return (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                          <Link2 className="h-4 w-4" />
                          知识关系 ({relations.length})
                        </h3>
                        <div className="space-y-2">
                          {relations.map((rel, idx) => {
                            const isSource = rel.source === selectedEntity.id;
                            const otherId = isSource ? rel.target : rel.source;
                            const otherEntity = getEntityById(otherId);
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => {
                                  if (otherEntity) {
                                    setSelectedEntity(otherEntity);
                                  }
                                }}
                              >
                                <span className="font-medium">{selectedEntity.name}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="outline" className="text-xs">
                                  {relationTypeLabels[rel.type] || rel.type}
                                  {rel.weight !== undefined && ` (${(rel.weight * 100).toFixed(0)}%)`}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className={`font-medium ${otherEntity ? 'text-primary hover:underline' : 'text-muted-foreground'}`}>
                                  {otherEntity?.name || otherId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Related Entities */}
                  {(() => {
                    const related = getRelatedEntities(selectedEntity.id);
                    if (related.length === 0) return null;
                    return (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                          <Layers className="h-4 w-4" />
                          相关实体 ({related.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {related.map(entity => (
                            <Card
                              key={entity.id}
                              className="cursor-pointer hover:shadow-sm transition-shadow"
                              onClick={() => setSelectedEntity(entity)}
                            >
                              <CardContent className="p-3 flex items-center gap-2">
                                <div className={`p-1 rounded ${typeColors[entity.type]?.split(' ')[0] || 'bg-gray-100'}`}>
                                  {typeIcons[entity.type] || <FileText className="h-3 w-3" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{entity.name}</p>
                                  <p className="text-xs text-muted-foreground">{entity.type}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
