// =======================================
// Knowledge Graph Query & Retrieval Library v1.0
// 功能：从静态知识图谱中检索相关知识片段，用于AI对话context注入
// =======================================

import type { KnowledgeSnippet, KnowledgeEntity, KnowledgeGraph } from '../types';
import academicKnowledgeGraph from '../data/knowledgeGraph';
import projectKnowledgeGraph from '../data/projectKnowledge';

// ----- 内存中的知识图谱（合并学术+项目） -----

let mergedGraph: KnowledgeGraph | null = null;

// 本地动态知识图谱（从localStorage加载，用户导入的Zotero论文等）
const LOCAL_KG_KEY = 'academic_hub_local_kg';

interface LocalKnowledgeGraph {
  entities: import('../types').KnowledgeEntity[];
  relations: import('../types').KnowledgeRelation[];
  updatedAt: string;
}

export function getLocalKG(): LocalKnowledgeGraph {
  try {
    const raw = localStorage.getItem(LOCAL_KG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return { entities: [], relations: [], updatedAt: new Date().toISOString() };
}

function saveLocalKG(kg: LocalKnowledgeGraph): void {
  try {
    localStorage.setItem(LOCAL_KG_KEY, JSON.stringify(kg));
  } catch (e) {
    console.warn('[KG] Failed to save local KG:', e);
  }
}

/** 将Zotero论文添加到本地知识图谱 */
export function addZoteroPapersToLocalKG(papers: any[]): void {
  const localKG = getLocalKG();
  const now = new Date().toISOString();

  for (const paper of papers) {
    // 检查是否已存在（按zoteroKey或id去重）
    const existingIdx = localKG.entities.findIndex(e => e.id === `paper:${paper.id}` || e.source === `zotero:${paper.zoteroKey}`);
    if (existingIdx >= 0) {
      // 更新现有实体
      localKG.entities[existingIdx] = {
        ...localKG.entities[existingIdx],
        name: paper.title || localKG.entities[existingIdx].name,
        description: (paper.abstract || '').slice(0, 200),
        content: paper.abstract || '',
        updatedAt: now,
      };
    } else {
      // 添加新实体
      localKG.entities.push({
        id: `paper:${paper.id}`,
        type: 'paper',
        name: paper.title || 'Unknown',
        description: (paper.abstract || '').slice(0, 200),
        content: paper.abstract || '',
        source: `zotero:${paper.zoteroKey || paper.id}`,
        tags: paper.tags || [],
        metadata: {
          year: paper.year,
          venue: paper.venue,
          doi: paper.doi,
          citations: paper.citations,
          noteCount: paper.noteCount,
        },
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  localKG.updatedAt = now;
  saveLocalKG(localKG);
  // 清除合并缓存，下次重新合并
  mergedGraph = null;
}

export function getMergedGraph(): KnowledgeGraph {
  if (mergedGraph) return mergedGraph;

  // 1. 合并学术知识图谱和项目知识图谱
  const staticEntities = [
    ...academicKnowledgeGraph.entities,
    ...projectKnowledgeGraph.entities,
  ];
  const staticRelations = [
    ...academicKnowledgeGraph.relations,
    ...projectKnowledgeGraph.relations,
  ];

  // 2. 加载本地动态知识图谱（用户导入的Zotero论文等）
  const localKG = getLocalKG();

  // 3. 合并所有实体和关系
  const allEntities = [
    ...staticEntities,
    ...localKG.entities,
  ];
  const allRelations = [
    ...staticRelations,
    ...localKG.relations,
  ];

  mergedGraph = {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    entities: allEntities,
    relations: allRelations,
  };

  return mergedGraph;
}

// ----- 检索函数 -----

/**
 * 从知识图谱中检索与查询相关的知识片段
 * 第一阶段：简单关键词匹配（后续升级到向量语义搜索）
 *
 * @param query - 用户查询字符串
 * @param maxResults - 最大返回结果数（默认3）
 * @returns KnowledgeSnippet[] - 相关知识片段数组
 */
export function searchKnowledge(query: string, maxResults: number = 3): KnowledgeSnippet[] {
  const graph = getMergedGraph();
  const queryLower = query.toLowerCase();
  const snippets: KnowledgeSnippet[] = [];

  // 遍历所有实体，计算相关性得分
  for (const entity of graph.entities) {
    const relevance = calculateRelevance(entity, queryLower);
    if (relevance > 0.1) { // 阈值：只返回相关性>0.1的实体
      snippets.push({
        entityId: entity.id,
        content: formatEntityAsContext(entity),
        relevance,
        source: entity.source || 'unknown',
      });
    }
  }

  // 按相关性得分降序排序，取前maxResults个
  snippets.sort((a, b) => b.relevance - a.relevance);
  return snippets.slice(0, maxResults);
}

/**
 * 根据实体ID获取实体详情
 */
export function getEntityById(id: string): KnowledgeEntity | null {
  const graph = getMergedGraph();
  return graph.entities.find(e => e.id === id) || null;
}

/**
 * 获取与某实体相关的所有实体
 */
export function getRelatedEntities(id: string): KnowledgeEntity[] {
  const graph = getMergedGraph();
  const relatedIds = new Set<string>();

  // 找出所有与id相关的边
  for (const rel of graph.relations) {
    if (rel.source === id) relatedIds.add(rel.target);
    if (rel.target === id) relatedIds.add(rel.source);
  }

  // 返回相关实体
  return graph.entities.filter(e => relatedIds.has(e.id));
}

/**
 * 计算实体与查询的相关性得分（0-1）
 * 简单启发式：基于名称、描述、标签、内容中的关键词匹配
 */
function calculateRelevance(entity: KnowledgeEntity, queryLower: string): number {
  let score = 0;

  // 1. 名称匹配（权重最高）
  if (entity.name.toLowerCase().includes(queryLower)) {
    score += 0.5;
  }

  // 2. 描述匹配
  if (entity.description && entity.description.toLowerCase().includes(queryLower)) {
    score += 0.3;
  }

  // 3. 标签匹配
  if (entity.tags) {
    for (const tag of entity.tags) {
      if (tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())) {
        score += 0.2;
        break;
      }
    }
  }

  // 4. 内容匹配
  if (entity.content && entity.content.toLowerCase().includes(queryLower)) {
    score += 0.15;
  }

  // 5. 关键词精确匹配加分
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  for (const word of queryWords) {
    if (entity.name.toLowerCase().includes(word)) score += 0.05;
    if (entity.tags && entity.tags.some(t => t.toLowerCase().includes(word))) score += 0.03;
  }

  // 归一化到0-1
  return Math.min(score, 1.0);
}

/**
 * 将实体格式化为AI上下文文本
 */
function formatEntityAsContext(entity: KnowledgeEntity): string {
  const parts: string[] = [];

  parts.push(`【${entity.type.toUpperCase()}: ${entity.name}】`);

  if (entity.description) {
    parts.push(entity.description);
  }

  if (entity.content) {
    // 内容截断到500字符（避免context过长）
    const truncated = entity.content.length > 500
      ? entity.content.slice(0, 500) + '...'
      : entity.content;
    parts.push(truncated);
  }

  if (entity.tags && entity.tags.length > 0) {
    parts.push(`标签：${entity.tags.join(', ')}`);
  }

  return parts.join('\n');
}

// ===== 子图划分 =====

export interface KnowledgeSubgraph {
  id: string;
  name: string;
  description: string;
  icon: string;
  entityIds: string[]; // 子图包含的实体ID列表
}

/** 预定义的子图分类 */
const SUBGRAPH_DEFS: Omit<KnowledgeSubgraph, 'entityIds'>[] = [
  {
    id: 'subgraph:gnn-basics',
    name: 'GNN 基础理论',
    description: '图神经网络核心概念与经典模型',
    icon: 'Network',
  },
  {
    id: 'subgraph:mtpnet',
    name: 'MTPNet 论文',
    description: '多时间感知模式网络的架构与机制',
    icon: 'Clock',
  },
  {
    id: 'subgraph:baselines',
    name: '基线模型',
    description: 'HGNN领域经典基线方法对比',
    icon: 'BarChart3',
  },
  {
    id: 'subgraph:fraud-detection',
    name: '欺诈检测任务',
    description: '金融欺诈检测的核心任务与评估',
    icon: 'Shield',
  },
  {
    id: 'subgraph:datasets',
    name: '数据集',
    description: 'YelpChi、Amazon、TFinance等实验数据集',
    icon: 'Database',
  },
  {
    id: 'subgraph:advanced',
    name: '前沿方法',
    description: '对比学习、伪装识别、概念漂移等前沿技术',
    icon: 'Sparkles',
  },
];

/** 子图实体ID映射（硬编码分类） */
const SUBGRAPH_ENTITY_MAP: Record<string, string[]> = {
  'subgraph:gnn-basics': [
    'concept:gnn', 'concept:hgnn', 'concept:meta-path',
    'method:gcn', 'method:gat', 'method:graphsage', 'method:han',
  ],
  'subgraph:mtpnet': [
    'method:mtpnet', 'concept:temporal-graph', 'concept:fraud-detection',
    'dataset:yelpchi', 'dataset:amazon', 'metric:auc', 'metric:f1',
  ],
  'subgraph:baselines': [
    'method:gcn', 'method:gat', 'method:graphsage', 'method:han',
    'method:rgcn', 'method:hgt',
  ],
  'subgraph:fraud-detection': [
    'concept:fraud-detection', 'task:node-classification', 'task:anomaly-detection',
    'concept:class-imbalance', 'concept:concept-drift', 'metric:auc', 'metric:f1',
  ],
  'subgraph:datasets': [
    'dataset:yelpchi', 'dataset:amazon', 'dataset:tfinance',
    'task:node-classification', 'concept:fraud-detection',
  ],
  'subgraph:advanced': [
    'method:cafu-hgfm', 'method:th-gcl', 'concept:class-imbalance',
    'concept:concept-drift', 'concept:meta-path',
  ],
};

export function getSubgraphs(): KnowledgeSubgraph[] {
  const graph = getMergedGraph();
  const entityMap = new Map(graph.entities.map(e => [e.id, e]));

  return SUBGRAPH_DEFS.map(def => {
    const ids = SUBGRAPH_ENTITY_MAP[def.id] || [];
    // 过滤掉不存在的实体
    const validIds = ids.filter(id => entityMap.has(id));
    return {
      ...def,
      entityIds: validIds,
    };
  }).filter(sg => sg.entityIds.length > 0);
}

export function getSubgraphData(subgraphId: string): { entities: KnowledgeEntity[]; relations: import('../types').KnowledgeRelation[] } {
  const graph = getMergedGraph();
  const entityIds = new Set(SUBGRAPH_ENTITY_MAP[subgraphId] || []);

  const entities = graph.entities.filter(e => entityIds.has(e.id));
  const relations = graph.relations.filter(
    r => entityIds.has(r.source) && entityIds.has(r.target)
  );

  return { entities, relations };
}

// ===== Topic 关键词 → 子图映射 =====

/** 主页面知识节点 label → 子图 ID 的硬编码映射表 */
const TOPIC_TO_SUBGRAPH: Record<string, string> = {
  // GNN 基础理论 → 核心模型与方法
  GCN: 'subgraph:gnn-basics',
  GAT: 'subgraph:gnn-basics',
  GraphSAGE: 'subgraph:gnn-basics',
  GIN: 'subgraph:gnn-basics',
  MessagePassing: 'subgraph:gnn-basics',
  Aggregation: 'subgraph:gnn-basics',
  NodeEmbedding: 'subgraph:gnn-basics',
  AttentionMechanism: 'subgraph:gnn-basics',
  SpectralGraph: 'subgraph:gnn-basics',
  // 前沿方法 → 对比学习 / 三元组损失
  ContrastiveLoss: 'subgraph:advanced',
  TripletLoss: 'subgraph:advanced',
  // 数据集
  CoraDataset: 'subgraph:datasets',
  PubMedDataset: 'subgraph:datasets',
  RedditDataset: 'subgraph:datasets',
  // 欺诈检测
  CrossEntropy: 'subgraph:fraud-detection',
};

/**
 * 根据 topic 关键词查找对应的子图 ID
 * 策略：先查硬编码映射表，再按实体名模糊匹配回退，都未命中返回 null
 */
export function getSubgraphByTopic(topic: string): string | null {
  // Step 1: 硬编码映射
  if (TOPIC_TO_SUBGRAPH[topic]) return TOPIC_TO_SUBGRAPH[topic];

  // Step 2: 宽松匹配（忽略大小写）
  const topicLower = topic.toLowerCase();
  for (const [key, sgId] of Object.entries(TOPIC_TO_SUBGRAPH)) {
    if (key.toLowerCase() === topicLower) return sgId;
  }

  // Step 3: 遍历所有子图，按实体名模糊匹配
  const subgraphs = getSubgraphs();
  const graph = getMergedGraph();
  for (const sg of subgraphs) {
    for (const entityId of sg.entityIds) {
      const entity = graph.entities.find(e => e.id === entityId);
      if (!entity) continue;
      if (entity.name.toLowerCase().includes(topicLower)) return sg.id;
      if (topicLower.includes(entity.name.toLowerCase())) return sg.id;
    }
  }

  return null;
}

// ----- 导出默认实例（单例模式） -----

const knowledgeGraphLib = {
  searchKnowledge,
  getEntityById,
  getRelatedEntities,
  getSubgraphs,
  getSubgraphData,
  getSubgraphByTopic,
};

export default knowledgeGraphLib;
