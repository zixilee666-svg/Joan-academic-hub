import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Network, Clock, BarChart3, Shield, Database, Sparkles,
  Search, X, BookOpen, Tag, Calendar, ArrowRight, LayoutGrid, List
} from 'lucide-react';
import {
  getMergedGraph, getSubgraphs, getSubgraphData, getEntityById, getRelatedEntities,
  getSubgraphByTopic,
  type KnowledgeEntity, type KnowledgeRelation,
} from '@/lib/knowledgeGraph';
import KnowledgeGraphCanvas from '@/components/knowledge/KnowledgeGraphCanvas';

const ICON_MAP: Record<string, React.ReactNode> = {
  Network: <Network className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  BarChart3: <BarChart3 className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Database: <Database className="w-6 h-6" />,
  Sparkles: <Sparkles className="w-6 h-6" />,
};

const TYPE_LABELS: Record<string, string> = {
  concept: '概念', paper: '论文', method: '方法',
  dataset: '数据集', task: '任务', metric: '指标',
  code: '代码', note: '笔记', author: '作者',
};

const TYPE_COLORS: Record<string, string> = {
  concept: 'bg-blue-50 text-blue-700 border-blue-200',
  paper: 'bg-amber-50 text-amber-700 border-amber-200',
  method: 'bg-purple-50 text-purple-700 border-purple-200',
  dataset: 'bg-green-50 text-green-700 border-green-200',
  task: 'bg-red-50 text-red-700 border-red-200',
  metric: 'bg-teal-50 text-teal-700 border-teal-200',
  code: 'bg-gray-50 text-gray-700 border-gray-200',
  note: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  author: 'bg-pink-50 text-pink-700 border-pink-200',
};

const RELATION_LABELS: Record<string, string> = {
  is_a: '是一种', part_of: '属于', used_in: '被用于',
  proposed_in: '被提出于', outperforms: '优于', cites: '引用',
  related_to: '相关于', has_code: '有代码实现',
};

export default function KnowledgeGraphPage() {
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get('topic');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubgraph, setActiveSubgraph] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const subgraphs = useMemo(() => getSubgraphs(), []);
  const graph = useMemo(() => getMergedGraph(), []);

  const filteredSubgraphs = useMemo(() => {
    if (!searchQuery.trim()) return subgraphs;
    const q = searchQuery.toLowerCase();
    return subgraphs.filter(
      sg =>
        sg.name.toLowerCase().includes(q) ||
        sg.description.toLowerCase().includes(q)
    );
  }, [subgraphs, searchQuery]);

  const activeSubgraphData = useMemo(() => {
    if (!activeSubgraph) return null;
    return getSubgraphData(activeSubgraph);
  }, [activeSubgraph]);

  const activeSubgraphInfo = useMemo(
    () => subgraphs.find(sg => sg.id === activeSubgraph),
    [subgraphs, activeSubgraph]
  );

  // 从 URL ?topic=XXX 自动展开对应子图
  useEffect(() => {
    if (topicParam) {
      const sgId = getSubgraphByTopic(topicParam);
      if (sgId) setActiveSubgraph(sgId);
    }
  }, [topicParam]);

  const openEntityDetail = (entityId: string) => {
    const entity = getEntityById(entityId);
    if (entity) {
      setSelectedEntity(entity);
      setEntityDialogOpen(true);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">知识图谱</h1>
        <p className="text-muted-foreground mt-2">
          按主题划分的学术知识子图，点击卡片查看可视化图谱
        </p>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索子图..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="卡片视图"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="列表视图"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: '总实体', value: graph.entities.length },
          { label: '总关系', value: graph.relations.length },
          { label: '子图数', value: subgraphs.length },
          { label: '实体类型', value: new Set(graph.entities.map(e => e.type)).size },
        ].map(stat => (
          <Card key={stat.label} className="bg-muted/30">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== 卡片视图 ===== */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubgraphs.map(sg => {
            const entityCount = sg.entityIds.length;
            const typeCounts: Record<string, number> = {};
            sg.entityIds.forEach(id => {
              const e = graph.entities.find(x => x.id === id);
              if (e) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });

            return (
              <Card
                key={sg.id}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
                onClick={() => setActiveSubgraph(sg.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {ICON_MAP[sg.icon] || <Network className="w-6 h-6" />}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {entityCount} 个实体
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{sg.name}</CardTitle>
                  <CardDescription className="text-sm">{sg.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(typeCounts).slice(0, 4).map(([type, count]) => (
                      <span
                        key={type}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${TYPE_COLORS[type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
                      >
                        {TYPE_LABELS[type] || type} {count}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    查看图谱 <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== 列表视图 ===== */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-2">
          {filteredSubgraphs.map(sg => {
            const entityCount = sg.entityIds.length;
            const typeCounts: Record<string, number> = {};
            sg.entityIds.forEach(id => {
              const e = graph.entities.find(x => x.id === id);
              if (e) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });

            return (
              <div
                key={sg.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/40 cursor-pointer transition-all group"
                onClick={() => setActiveSubgraph(sg.id)}
              >
                {/* Icon */}
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  {ICON_MAP[sg.icon] || <Network className="w-5 h-5" />}
                </div>

                {/* Title + Description */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{sg.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{sg.description}</p>
                </div>

                {/* Type Tags */}
                <div className="hidden md:flex items-center gap-1 shrink-0">
                  {Object.entries(typeCounts).slice(0, 3).map(([type, count]) => (
                    <span
                      key={type}
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_COLORS[type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      {TYPE_LABELS[type] || type} {count}
                    </span>
                  ))}
                </div>

                {/* Entity Count + Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{entityCount}</Badge>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredSubgraphs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>未找到匹配的子图</p>
        </div>
      )}

      {/* ===== Subgraph Visualization Dialog ===== */}
      <Dialog open={!!activeSubgraph} onOpenChange={() => setActiveSubgraph(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {activeSubgraphInfo && ICON_MAP[activeSubgraphInfo.icon]}
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {activeSubgraphInfo?.name || '子图'}
                </DialogTitle>
                <DialogDescription>
                  {activeSubgraphInfo?.description || ''}
                  {activeSubgraphData && (
                    <span className="ml-2 text-muted-foreground">
                      · {activeSubgraphData.entities.length} 实体 · {activeSubgraphData.relations.length} 关系
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 px-6 pb-6">
            {activeSubgraphData && (
              <KnowledgeGraphCanvas
                nodes={activeSubgraphData.entities}
                links={activeSubgraphData.relations}
                onNodeClick={openEntityDetail}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Entity Detail Dialog ===== */}
      <Dialog open={entityDialogOpen} onOpenChange={setEntityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedEntity && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={TYPE_COLORS[selectedEntity.type] || ''}>
                    {TYPE_LABELS[selectedEntity.type] || selectedEntity.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {selectedEntity.id}
                  </span>
                </div>
                <DialogTitle className="text-xl">{selectedEntity.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {selectedEntity.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedEntity.description}
                  </p>
                )}

                {selectedEntity.content && (
                  <div className="bg-muted/40 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      详细内容
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedEntity.content}
                    </p>
                  </div>
                )}

                {selectedEntity.tags && selectedEntity.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      标签
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntity.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relations */}
                {(() => {
                  const rels = graph.relations.filter(
                    r => r.source === selectedEntity.id || r.target === selectedEntity.id
                  );
                  if (rels.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        知识关系 ({rels.length})
                      </h4>
                      <div className="space-y-2">
                        {rels.map((rel, idx) => {
                          const isSource = rel.source === selectedEntity.id;
                          const otherId = isSource ? rel.target : rel.source;
                          const other = getEntityById(otherId);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
                              onClick={() => other && openEntityDetail(other.id)}
                            >
                              <span className="font-medium text-primary">
                                {isSource ? '→' : '←'}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {RELATION_LABELS[rel.type] || rel.type}
                              </Badge>
                              <span className="truncate">
                                {other?.name || otherId}
                              </span>
                              {rel.weight && (
                                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                  权重 {rel.weight.toFixed(2)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Related entities */}
                {(() => {
                  const related = getRelatedEntities(selectedEntity.id);
                  if (related.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        相关实体
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {related.slice(0, 6).map(entity => (
                          <Card
                            key={entity.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => openEntityDetail(entity.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] ${TYPE_COLORS[entity.type] || ''}`}>
                                  {TYPE_LABELS[entity.type] || entity.type}
                                </Badge>
                                <span className="text-sm font-medium truncate">
                                  {entity.name}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      元数据
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(selectedEntity.metadata).map(([k, v]) => (
                        <div key={k} className="bg-muted/30 rounded px-3 py-2">
                          <span className="text-muted-foreground text-xs">{k}</span>
                          <div className="font-medium">{String(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
