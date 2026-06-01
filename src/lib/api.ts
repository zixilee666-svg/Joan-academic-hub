// ========================================
// API 客户端 — 前后端分离架构
// VITE_MOCK_MODE=true（默认）→ 纯前端 Mock，零网络请求
// VITE_MOCK_MODE=false → 调用真实后端 API
// 无需运行时探测，构建时即确定模式
// ========================================

import type { Paper, User, Project, Note, Highlight, ReadingRecord, ReadingStats, AIConversation, UserSettings, Library, Material } from '@/types';

// ---- API 错误类 ----
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- 错误代码枚举 ----
export const ApiErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

// ---- API 响应类型 ----
export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ---- 错误处理工具函数 ----
export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError(ApiErrorCode.NETWORK_ERROR, '网络连接失败，请检查网络');
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError(ApiErrorCode.TIMEOUT, '请求超时，请重试');
  }
  if (error instanceof Error) {
    return new ApiError(ApiErrorCode.UNKNOWN, error.message);
  }
  return new ApiError(ApiErrorCode.UNKNOWN, '发生未知错误');
}

// ---- 请求重试配置 ----
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- 请求拦截器类型 ----
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = (response: Response, config: RequestConfig) => Response | Promise<Response>;
type ErrorInterceptor = (error: ApiError, config: RequestConfig) => ApiError | Promise<ApiError>;

interface RequestConfig {
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
  signal?: AbortSignal;
  timeout?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ---- 拦截器注册表 ----
const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];

// ---- 拦截器注册函数 ----
export function addRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
}

export function addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
}

export function addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
  errorInterceptors.push(interceptor);
  return () => {
    const index = errorInterceptors.indexOf(interceptor);
    if (index > -1) errorInterceptors.splice(index, 1);
  };
}

// 构建时确定：是否使用 Mock（默认 true）
// 当部署到 EdgeOne 等纯前端环境时，VITE_MOCK_MODE 未设置 → 默认 Mock
// 当本地开发连接真实后端时，设置 VITE_MOCK_MODE=false
const IS_MOCK: boolean = import.meta.env.VITE_MOCK_MODE !== 'false';

if (IS_MOCK) {
  console.log('[Academic Hub] ✅ Mock 模式已启用（无需后端）');
} else {
  console.log('[Academic Hub] 🌐 真实 API 模式，后端地址:', API_BASE);
}

// ---- Mock 用户数据 ----
const mockUser: User = {
  id: 'mock-user-001',
  username: 'master',
  email: 'master@academic-hub.dev',
  institution: 'Joan 学术研究所',
  role: 'admin',
  createdAt: new Date().toISOString(),
  avatar: null,
};

// 贞德 (Joan) 用户 - 演示账号
export const mockJoanUser: User = {
  id: 'user-joan',
  username: 'joan',
  displayName: 'Joan Chen (贞德)',
  email: 'joan@academic-hub.local',
  institution: 'Fudan University',
  role: 'user',
  bio: 'PhD candidate researching Graph Neural Networks and Financial AI.',
  createdAt: '2025-01-01T00:00:00.000Z',
  avatar: '',
};

const mockToken = 'mock-jwt-token-' + Date.now();
const mockJoanToken = 'mock-joan-token-' + Date.now();

const mockPapers: Paper[] = [
  {
    id: 'p-001',
    title: 'Semi-Supervised Classification with Graph Convolutional Networks',
    authors: ['T.N. Kipf', 'M. Welling'],
    year: 2017,
    venue: 'ICLR 2017',
    venueType: 'conference',
    abstract: 'We present a scalable approach for semi-supervised learning on graph-structured data that is based on an efficient variant of convolutional neural networks operating directly on graphs.',
    keywords: ['GCN', 'semi-supervised', 'graph neural network'],
    doi: '10.5555/3295222.3295313',
    tags: ['GNN', '经典论文'],
    isFavorited: true,
    isRead: true,
    readingStatus: 'completed',
    notes: [],
    highlights: [],
    addedAt: '2026-04-20T10:00:00Z',
    url: 'https://arxiv.org/abs/1609.02907',
  },
  {
    id: 'p-002',
    title: 'Graph Attention Networks',
    authors: ['P. Veličković', 'G. Cucurull', 'A. Casanova', 'A. Romero', 'P. Liò', 'Y. Bengio'],
    year: 2018,
    venue: 'ICLR 2018',
    venueType: 'conference',
    abstract: 'We propose Graph Attention Networks (GATs), novel neural network architectures that operate on graph-structured data, leveraging masked self-attentional layers.',
    keywords: ['GAT', 'attention mechanism', 'graph neural network'],
    doi: '10.5555/3327758.3327825',
    tags: ['GNN', '注意力机制'],
    isFavorited: true,
    isRead: false,
    readingStatus: 'reading',
    notes: [],
    highlights: [],
    addedAt: '2026-04-21T08:00:00Z',
    url: 'https://arxiv.org/abs/1710.10903',
  },
  {
    id: 'p-003',
    title: 'Heterogeneous Graph Attention Network',
    authors: ['X. Wang', 'H. Ji', 'C. Shi', 'B. Wang', 'Y. Ye', 'P. Cui', 'P.S. Yu'],
    year: 2019,
    venue: 'WWW 2019',
    venueType: 'conference',
    abstract: 'In real world, different types of objects and rich interactions between them form heterogeneous information networks. We propose the Heterogeneous Graph Attention Network (HAN).',
    keywords: ['HAN', 'heterogeneous graph', 'attention', 'meta-path'],
    doi: '10.1145/3308558.3313418',
    tags: ['HGNN', '元路径'],
    isFavorited: false,
    isRead: false,
    readingStatus: 'unread',
    notes: [],
    highlights: [],
    addedAt: '2026-04-22T12:00:00Z',
    url: 'https://arxiv.org/abs/1903.07293',
  },
  {
    id: 'p-004',
    title: 'CARE-GNN: Collaborative Learning for Financial Fraud Detection',
    authors: ['Y. Liu', 'Y. Li', 'X. Wu', 'F. Ye', 'M. Ester', 'J. Liang'],
    year: 2020,
    venue: 'CIKM 2020',
    venueType: 'conference',
    abstract: 'We propose a novel graph-based approach, CARE-GNN, which effectively leverages the topological and relational information to improve financial fraud detection.',
    keywords: ['fraud detection', 'GNN', 'reinforcement learning', 'relation-aware'],
    tags: ['金融欺诈', '图方法'],
    isFavorited: true,
    isRead: true,
    readingStatus: 'completed',
    notes: [],
    highlights: [],
    addedAt: '2026-04-23T09:00:00Z',
  },
  {
    id: 'p-005',
    title: 'Heterogeneous Graph Transformer',
    authors: ['Y. Hu', 'Z. Li', 'D. Wang', 'S. Liang', 'Y. Chang', 'Q.V.H. Nguyen'],
    year: 2020,
    venue: 'WWW 2020',
    venueType: 'conference',
    abstract: 'We propose the Heterogeneous Graph Transformer (HGT) for modeling heterogeneous web data. HGT introduces a novel heterogeneous mutual attention mechanism.',
    keywords: ['HGT', 'heterogeneous graph', 'transformer', 'attention'],
    doi: '10.1145/3366423.3380287',
    tags: ['HGNN', 'Transformer'],
    isFavorited: false,
    isRead: false,
    readingStatus: 'reading',
    notes: [],
    highlights: [],
    addedAt: '2026-04-24T10:00:00Z',
    url: 'https://arxiv.org/abs/2003.01345',
  },
  {
    id: 'p-006',
    title: 'Inductive Representation Learning on Large Graphs',
    authors: ['W.L. Hamilton', 'R. Ying', 'J. Leskovec'],
    year: 2017,
    venue: 'NeurIPS 2017',
    venueType: 'conference',
    abstract: 'We present GraphSAGE, a general inductive learning framework that leverages node feature information to efficiently generate node embeddings for previously unseen data.',
    keywords: ['GraphSAGE', 'inductive learning', 'sampling', 'node embedding'],
    tags: ['GNN', '经典论文'],
    isFavorited: false,
    isRead: true,
    readingStatus: 'completed',
    notes: [],
    highlights: [],
    addedAt: '2026-04-24T11:00:00Z',
    url: 'https://arxiv.org/abs/1706.02216',
  },
  {
    id: 'p-007',
    title: 'Relational Graph Convolutional Networks',
    authors: ['M. Schlichtkrull', 'T.N. Kipf', 'R. Bloem', 'P. van den Berg', 'I. Titov', 'M. Welling'],
    year: 2018,
    venue: 'Relational Representation Learning, NIPS 2018 Workshop',
    venueType: 'conference',
    abstract: 'We propose relational graph convolutional networks (R-GCNs) which apply specialized aggregation functions to nodes belonging to different edge types.',
    keywords: ['RGCN', 'relational graph', 'knowledge graph'],
    tags: ['HGNN', '知识图谱'],
    isFavorited: false,
    isRead: false,
    readingStatus: 'unread',
    notes: [],
    highlights: [],
    addedAt: '2026-04-25T08:00:00Z',
    url: 'https://arxiv.org/abs/1703.06103',
  },
  {
    id: 'p-008',
    title: 'Dual Graph Convolutional Networks for Fraud Detection',
    authors: ['J. Dou', 'Y. Liu', 'F. Liu', 'X. Yu', 'J. Li'],
    year: 2020,
    venue: 'CIKM 2020',
    venueType: 'conference',
    abstract: 'We propose a dual Graph Convolutional Network (Dual-GCN) framework for fraud detection, which consists of a relation-aware GCN and an intuitionistic GCN.',
    keywords: ['fraud detection', 'dual GCN', 'heterogeneous graph'],
    tags: ['金融欺诈', '图方法'],
    isFavorited: false,
    isRead: false,
    readingStatus: 'unread',
    notes: [],
    highlights: [],
    addedAt: '2026-04-25T09:00:00Z',
  },
];

// ---- Mock Spaces (for GalleryPage) ----
const mockSpaces: Array<{
  username: string;
  displayName: string;
  institution: string;
  researchField: string;
  bio: string;
  paperCount: number;
  projectCount: number;
  viewCount: number;
  popularity: number;
}> = [
  {
    username: 'joan',
    displayName: '贞德 (Joan)',
    institution: 'Joan 学术研究所',
    researchField: 'graph-neural-network, knowledge-graph, fraud-detection',
    bio: '专注于图神经网络与知识图谱研究，致力于金融欺诈检测与学术工具的智能化。热爱分享学术知识，助您探索学术世界。',
    paperCount: 8,
    projectCount: 3,
    viewCount: 256,
    popularity: 95,
  },
  {
    username: 'zhang-wei',
    displayName: '张伟',
    institution: '清华大学',
    researchField: 'natural-language-processing, reinforcement-learning',
    bio: '研究方向为自然语言处理与强化学习的结合应用，特别关注对话系统与智能助手。',
    paperCount: 12,
    projectCount: 2,
    viewCount: 189,
    popularity: 87,
  },
  {
    username: 'li-ming',
    displayName: '李明',
    institution: '北京大学',
    researchField: 'computer-vision, knowledge-graph',
    bio: '计算机视觉与知识图谱交叉领域研究者，专注于多模态学习与视觉推理。',
    paperCount: 15,
    projectCount: 4,
    viewCount: 312,
    popularity: 92,
  },
  {
    username: 'wang-fang',
    displayName: '王芳',
    institution: '复旦大学',
    researchField: 'graph-neural-network, recommendation-system',
    bio: '图神经网络在推荐系统中的应用研究，探索用户行为建模与个性化推荐算法。',
    paperCount: 9,
    projectCount: 1,
    viewCount: 145,
    popularity: 78,
  },
  {
    username: 'chen-lei',
    displayName: '陈磊',
    institution: '上海交通大学',
    researchField: 'fraud-detection, graph-neural-network',
    bio: '金融欺诈检测领域专家，主要研究基于图神经网络的异常检测与风险评估。',
    paperCount: 18,
    projectCount: 5,
    viewCount: 420,
    popularity: 98,
  },
];

const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: 'HGNN 金融欺诈检测综述',
    description: '基于异质图神经网络的金融欺诈检测方法综述论文',
    status: 'active',
    goalCount: 12,
    completedGoals: 7,
    startDate: '2026-03-01',
    targetDate: '2026-06-30',
    tags: ['综述', 'HGNN', '金融欺诈'],
    paperIds: ['p-001', 'p-002', 'p-003', 'p-004', 'p-005'],
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'proj-002',
    name: '多尺度元路径融合实验',
    description: '基于多尺度元路径融合的异质图神经网络在电商欺诈检测中的应用实验',
    status: 'active',
    goalCount: 8,
    completedGoals: 2,
    startDate: '2026-04-15',
    targetDate: '2026-07-31',
    tags: ['实验', '元路径', '电商欺诈'],
    paperIds: ['p-003', 'p-004'],
    createdAt: '2026-04-15T00:00:00Z',
  },
  {
    id: 'proj-003',
    name: 'GNN 核心理论梳理',
    description: '系统梳理 GNN 核心理论：从谱图理论到消息传递范式',
    status: 'completed',
    goalCount: 10,
    completedGoals: 10,
    startDate: '2026-02-01',
    targetDate: '2026-04-01',
    tags: ['学习', 'GNN', '理论'],
    paperIds: ['p-001', 'p-002', 'p-006'],
    createdAt: '2026-02-01T00:00:00Z',
  },
];

// ---- Mock Libraries ----
// paper IDs hardcoded for static initialization order
const mockLibraries: Library[] = [
  {
    id: 'lib-all',
    name: '全部文献',
    color: '#3d5a80',
    icon: 'Library',
    paperIds: ['p-001','p-002','p-003','p-004','p-005','p-006','p-007','p-008'],
    createdAt: '2026-03-01T00:00:00Z',
    isDefault: true,
  },
  {
    id: 'lib-gnn',
    name: 'GNN 核心论文',
    description: '图神经网络经典论文',
    color: '#C9A96E',
    icon: 'Network',
    paperIds: ['p-001', 'p-002', 'p-006', 'p-007'],
    createdAt: '2026-03-05T00:00:00Z',
  },
  {
    id: 'lib-hgnn',
    name: '异质图神经网络',
    description: 'HGNN 相关研究论文',
    color: '#2D8A4E',
    icon: 'GitBranch',
    paperIds: ['p-003', 'p-005'],
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'lib-fraud',
    name: '金融欺诈检测',
    description: '图方法在金融欺诈检测中的应用',
    color: '#B91C1C',
    icon: 'ShieldAlert',
    paperIds: ['p-004', 'p-008'],
    createdAt: '2026-03-15T00:00:00Z',
  },
];

// ---- Mock Materials ----
const mockMaterials: Material[] = [
  {
    id: 'mat-001',
    title: '深度学习课件 - 第3章：卷积神经网络',
    type: 'markdown',
    category: 'courseware',
    description: 'CNN 基础与进阶概念讲解',
    content: '# 卷积神经网络\n\n卷积神经网络（CNN）是深度学习中处理图像数据的重要模型...',
    tags: ['深度学习', 'CNN', '课件'],
    isFavorite: true,
    createdAt: '2026-04-10T10:00:00Z',
  },
  {
    id: 'mat-002',
    title: '图神经网络前沿综述报告',
    type: 'pdf',
    category: 'report',
    description: '2025年GNN领域最新进展汇总',
    fileName: 'gnn-survey-2025.pdf',
    fileSize: 2458624,
    tags: ['GNN', '综述', '报告'],
    isFavorite: false,
    createdAt: '2026-04-15T14:30:00Z',
  },
  {
    id: 'mat-003',
    title: '机器学习数学基础笔记',
    type: 'note',
    category: 'notes',
    description: '线性代数、概率论、凸优化的核心公式与证明',
    content: '## 矩阵分解\n\n奇异值分解（SVD）是线性代数中最重要的分解之一...',
    tags: ['数学', '笔记', '机器学习'],
    isFavorite: true,
    createdAt: '2026-04-18T09:00:00Z',
  },
  {
    id: 'mat-004',
    title: '异质图表示学习综述',
    type: 'link',
    category: 'reference',
    description: 'Heterogeneous Graph Representation Learning: A Survey',
    content: 'https://arxiv.org/abs/2202.11066',
    tags: ['HGNN', '表示学习', '综述'],
    isFavorite: false,
    createdAt: '2026-04-20T11:00:00Z',
  },
];

// 生成91天模拟热力图数据（模拟真实阅读习惯）
function generateMockHeatmap(): number[] {
  const days = 91;
  const data: number[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dayOfWeek = d.getDay(); // 0=周日, 1=周一...

    // 基础活跃度：工作日 > 周末
    let base = dayOfWeek === 0 || dayOfWeek === 6 ? 0.3 : 0.7;

    // 随机波动
    const rand = Math.random();
    let value = 0;

    if (rand < 0.15 * base) {
      // 不活跃日
      value = 0;
    } else if (rand < 0.5 * base) {
      value = 1;
    } else if (rand < 0.8 * base) {
      value = Math.floor(Math.random() * 3) + 2; // 2-4
    } else if (rand < 0.95 * base) {
      value = Math.floor(Math.random() * 4) + 5; // 5-8
    } else {
      // 阅读高峰日（少量）
      value = Math.floor(Math.random() * 10) + 10; // 10-19
    }

    // 近期活跃度更高（模拟最近更活跃）
    const recency = i / days;
    if (recency > 0.7 && Math.random() > 0.3) {
      value = Math.max(value, Math.floor(Math.random() * 5) + 3);
    }

    data.push(value);
  }

  return data;
}

const mockWeeklyHeatmap = generateMockHeatmap();

const mockReadingStats: ReadingStats = {
  totalPapers: 162,
  weeklyRead: mockWeeklyHeatmap.slice(-7).reduce((a, b) => a + b, 0),
  toRead: 18,
  points: 2840,
  streakDays: (() => {
    let streak = 0;
    for (let i = mockWeeklyHeatmap.length - 1; i >= 0; i--) {
      if (mockWeeklyHeatmap[i] > 0) {
        streak++;
      } else if (i > 0 && mockWeeklyHeatmap[i - 1] > 0) {
        streak++;
        i--;
      } else {
        break;
      }
    }
    return streak;
  })(),
  weeklyHeatmap: mockWeeklyHeatmap,
  readPapers: 58,
  readingPapers: 12,
  unreadPapers: 92,
  weeklyGoal: 10,
  weeklyCompleted: Math.min(mockWeeklyHeatmap.slice(-7).reduce((a, b) => a + b, 0), 10),
  totalReadingTime: 2840,
};

function mockDelay(ms = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Mock 密码存储（localStorage 持久化） ----
const MOCK_PWD_PREFIX = 'mock_pwd:';
const MOCK_DEFAULT_PASSWORDS: Record<string, string> = {
  admin: '123456',
  joan: '11223344',
};

function getMockPassword(username: string): string {
  try {
    const stored = localStorage.getItem(MOCK_PWD_PREFIX + username);
    return stored || MOCK_DEFAULT_PASSWORDS[username] || '';
  } catch {
    return MOCK_DEFAULT_PASSWORDS[username] || '';
  }
}

function setMockPassword(username: string, password: string): void {
  try {
    localStorage.setItem(MOCK_PWD_PREFIX + username, password);
  } catch { /* localStorage 不可用时静默忽略 */ }
}

// ---- Mock 搜索结果生成器 ----
function generateMockSearchResults(query: string, source: 'arxiv' | 'semantic', count: number): any[] {
  const q = query || 'graph neural network';
  const templates = [
    {
      titleFn: (idx: number) => `A Comprehensive Study of ${q} Using Graph Neural Networks`,
      venue: source === 'arxiv' ? 'arXiv' : 'NeurIPS',
      authors: ['Alice Chen', 'Bob Zhang', 'Carol Wang'],
      year: 2025,
      citations: 142,
      abstractFn: (idx: number) => `This paper presents a comprehensive study of applying graph neural networks to ${q}. We propose a novel framework that leverages heterogeneous attention mechanisms to capture complex relational patterns. Experimental results on multiple benchmark datasets demonstrate state-of-the-art performance.`,
    },
    {
      titleFn: (idx: number) => `Heterogeneous ${q} Detection via Multi-Scale Attention`,
      venue: source === 'arxiv' ? 'arXiv' : 'KDD',
      authors: ['David Liu', 'Eve Kim', 'Frank Wu'],
      year: 2025,
      citations: 89,
      abstractFn: (idx: number) => `We propose a heterogeneous graph attention network for ${q} detection. Our model incorporates multi-scale neighborhood aggregation and cross-type message passing to effectively handle diverse node and edge types. Extensive experiments validate the effectiveness of our approach.`,
    },
    {
      titleFn: (idx: number) => `Temporal Dynamics in ${q}: A Graph-Based Approach`,
      venue: source === 'arxiv' ? 'arXiv' : 'ICLR',
      authors: ['Grace Park', 'Henry Li', 'Iris Zhao'],
      year: 2024,
      citations: 67,
      abstractFn: (idx: number) => `This work explores temporal dynamics in ${q} using dynamic graph neural networks. We introduce a temporal attention mechanism that adaptively weighs historical information based on relevance to current predictions. The proposed method achieves significant improvements on real-world datasets.`,
    },
    {
      titleFn: (idx: number) => `Self-Supervised Learning for ${q} Representation`,
      venue: source === 'arxiv' ? 'arXiv' : 'ICML',
      authors: ['Jack Yang', 'Kelly Sun', 'Leo Huang'],
      year: 2024,
      citations: 53,
      abstractFn: (idx: number) => `We present a self-supervised learning framework for learning robust representations in ${q} tasks. By designing a novel contrastive objective that preserves both structural and semantic information, our method achieves competitive performance without requiring labeled data.`,
    },
    {
      titleFn: (idx: number) => `A Survey of Deep Learning Methods for ${q}`,
      venue: source === 'arxiv' ? 'arXiv' : 'IEEE TPAMI',
      authors: ['Mike Zhou', 'Nina Xu', 'Oliver Ma'],
      year: 2024,
      citations: 210,
      abstractFn: (idx: number) => `This survey provides a comprehensive overview of deep learning approaches for ${q}. We categorize existing methods into supervised, semi-supervised, and unsupervised paradigms, and discuss their strengths, weaknesses, and application scenarios.`,
    },
    {
      titleFn: (idx: number) => `Adversarial Robustness in ${q} Graph Models`,
      venue: source === 'arxiv' ? 'arXiv' : 'AAAI',
      authors: ['Patty He', 'Quinn Lin', 'Ray Tang'],
      year: 2024,
      citations: 38,
      abstractFn: (idx: number) => `We investigate the adversarial robustness of graph neural networks in ${q} scenarios. Through systematic perturbation analysis, we identify key vulnerabilities and propose defense mechanisms that enhance model reliability under adversarial conditions.`,
    },
    {
      titleFn: (idx: number) => `Contrastive Graph Learning for Enhanced ${q} Analysis`,
      venue: source === 'arxiv' ? 'arXiv' : 'WWW',
      authors: ['Sara Deng', 'Tom Shi', 'Uma Patel'],
      year: 2023,
      citations: 95,
      abstractFn: (idx: number) => `This paper introduces a contrastive graph learning paradigm for ${q} analysis. By maximizing mutual information between local and global graph representations, our model learns expressive node embeddings that capture both fine-grained and holistic graph properties.`,
    },
    {
      titleFn: (idx: number) => `Large-Scale ${q} Mining with Efficient Graph Sampling`,
      venue: source === 'arxiv' ? 'arXiv' : 'VLDB',
      authors: ['Vic Rong', 'Wendy Jiang', 'Xiao He'],
      year: 2023,
      citations: 72,
      abstractFn: (idx: number) => `We address the scalability challenge in large-scale ${q} mining by proposing an efficient graph sampling strategy. Our method selectively samples informative subgraphs, significantly reducing computational cost while maintaining high detection accuracy.`,
    },
  ];

  const results = [];
  const topics = ['Fraud Detection', 'Anomaly Detection', 'Recommendation', 'Classification', 'Link Prediction'];
  const subtopics = ['Attention Mechanism', 'Message Passing', 'Graph Convolution', 'Temporal Modeling', 'Self-Supervision'];

  for (let i = 0; i < count; i++) {
    const tmpl = templates[i % templates.length];
    const extraTags = i === 0 ? ['OA', 'TopCited'] : i === 1 ? ['OA'] : [];
    results.push({
      id: source === 'arxiv'
        ? `${String(2101 + Math.floor(i / 6)).padStart(2, '0')}.${String(10001 + i * 137).padStart(2, '0')}`
        : `paper-ss-${1000 + i}`,
      title: tmpl.titleFn(i),
      authors: i >= templates.length
        ? [...tmpl.authors.slice(0, -1), `Author ${i}`]
        : tmpl.authors,
      year: tmpl.year - (i >= templates.length * 2 ? 1 : 0),
      venue: tmpl.venue,
      abstract: tmpl.abstractFn(i),
      doi: `10.1234/mock.2025.${String(1000 + i).padStart(4, '0')}`,
      url: source === 'arxiv' ? `https://arxiv.org/abs/${String(2101 + i).padStart(2, '0')}.${String(10001 + i * 137).padStart(2, '0')}` : `https://api.semanticscholar.org/${i}`,
      citations: tmpl.citations - (i * 7) + (i * 3),
      ...(source === 'semantic' ? {
        influentialCitations: Math.floor((tmpl.citations - i * 7) * 0.3),
        tldr: `This paper introduces a novel approach for ${q} using graph-based deep learning techniques with state-of-the-art results.`,
        openAccessPdf: i < 4 ? `https://arxiv.org/pdf/${String(2101 + i).padStart(2, '0')}.${String(10001 + i * 137).padStart(2, '0')}.pdf` : '',
        isOpenAccess: i < 4,
        publicationTypes: ['JournalArticle'],
      } : {}),
      ...(source === 'arxiv' ? {
        primaryCategory: ['cs.LG', 'cs.AI', 'cs.SI', 'stat.ML'][i % 4],
        pdfUrl: `https://arxiv.org/pdf/${String(2101 + i).padStart(2, '0')}.${String(10001 + i * 137).padStart(2, '0')}`,
        updated: new Date(2025, 0, 15 - i).toISOString(),
      } : {}),
    });
  }
  return results;
}

// ---- Mock 请求处理器 ----
function handleMockRequest(path: string, method: string, body?: any): any {
  // Auth
  if (path === '/auth/login' && method === 'POST') {
    const { username, password } = body || {};
    if (!username || !password) throw new Error('请输入用户名和密码');
    // 检查 Mock 密码（支持修改后的密码）
    const expectedPassword = getMockPassword(username);
    if (username === 'admin' && password === expectedPassword) {
      const adminUser = { ...mockUser, username: 'admin', id: 'admin-fixed', role: 'admin' as const, displayName: 'Administrator' };
      return { success: true, data: { token: mockToken, user: adminUser } };
    }
    // 贞德演示账号
    if (username === 'joan' && password === expectedPassword) {
      return { success: true, data: { token: mockJoanToken, user: mockJoanUser } };
    }
    // 其他已注册用户（通过 localStorage 中的模拟密码验证）
    if (expectedPassword && password === expectedPassword) {
      const user = { ...mockUser, username, id: 'mock-user-' + username };
      return { success: true, data: { token: mockToken, user } };
    }
    throw new Error('用户名或密码错误');
  }
  if (path === '/auth/register' && method === 'POST') {
    const { username, password } = body || {};
    if (!username || !password) throw new Error('请填写必要信息');
    // 保存注册密码到 localStorage，确保后续登录可用
    setMockPassword(username, password);
    const newUser = { ...mockUser, id: 'mock-user-' + Date.now(), username, institution: body?.institution };
    return { success: true, data: { token: mockToken, user: newUser } };
  }
  if (path === '/auth/me' && method === 'GET') {
    const stored = localStorage.getItem('joan_academic_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const user = parsed?.state?.user || parsed?.user || parsed;
        return { success: true, data: user };
      } catch {
        return { success: true, data: mockUser };
      }
    }
    return { success: true, data: mockUser };
  }
  if (path === '/auth/logout' && method === 'POST') {
    return { success: true };
  }

  // Change password (Mock) — 支持真实保存新密码
  if (path === '/auth/change-password' && method === 'POST') {
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, '请填写当前密码和新密码');
    }
    if (newPassword.length < 6) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, '新密码至少 6 个字符');
    }
    // 从 localStorage 读取当前存储的密码（不是固定值）
    const storedUser = localStorage.getItem('joan_academic_user');
    let username = 'admin';
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        username = parsed?.state?.user?.username || parsed?.user?.username || parsed?.username || 'admin';
      } catch { /* ignore */ }
    }
    const expectedPassword = getMockPassword(username);
    if (currentPassword !== expectedPassword) {
      throw new ApiError('INVALID_PASSWORD', '当前密码错误');
    }
    // 真正保存新密码到 localStorage
    setMockPassword(username, newPassword);
    console.log(`[Mock] 密码已修改 (用户: ${username})`);
    return { success: true, message: 'Password changed successfully' };
  }

  // Papers — list GET (only /papers or /papers?query, NOT /papers/:id)
  if (/^\/papers(\?|$)/.test(path) && !path.includes('/notes') && !path.includes('/highlights') && !path.includes('/favorite') && !path.includes('/batch-import') && !path.includes('/export') && method === 'GET') {
    const paramStr = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(paramStr);
    let results = [...mockPapers];
    if (params.get('search')) {
      const q = params.get('search')!.toLowerCase();
      results = results.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some(a => a.toLowerCase().includes(q)) ||
        p.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    if (params.get('tag')) {
      const tag = params.get('tag')!.toLowerCase();
      results = results.filter(p => p.tags.some(t => t.toLowerCase().includes(tag)));
    }
    return { success: true, data: results, total: results.length };
  }

  if (path.match(/^\/papers\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === id);
    if (!paper) throw new Error('Paper not found');
    return { success: true, data: paper };
  }

  if (path === '/papers' && method === 'POST') {
    const newPaper: Paper = {
      id: 'p-' + Date.now(),
      title: body?.title || 'Untitled',
      authors: body?.authors || [],
      year: body?.year || 2026,
      venue: body?.venue || '',
      venueType: body?.venueType || 'preprint',
      abstract: body?.abstract || '',
      keywords: body?.keywords || [],
      tags: body?.tags || [],
      isFavorited: false,
      isRead: false,
      readingStatus: 'unread',
      notes: [],
      highlights: [],
      addedAt: new Date().toISOString(),
    };
    mockPapers.push(newPaper);
    return { success: true, data: newPaper };
  }

  if (path.match(/^\/papers\/[^/]+$/) && (method === 'PUT' || method === 'PATCH')) {
    const id = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === id);
    if (!paper) throw new Error('Paper not found');
    Object.assign(paper, body);
    return { success: true, data: paper };
  }

  if (path.match(/^\/papers\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const idx = mockPapers.findIndex(p => p.id === id);
    if (idx >= 0) mockPapers.splice(idx, 1);
    return { success: true };
  }

  if (path.match(/^\/papers\/[^/]+\/favorite$/) && method === 'POST') {
    const id = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === id);
    if (paper) paper.isFavorited = !paper.isFavorited;
    return { success: true, data: { isFavorited: paper?.isFavorited ?? false } };
  }

  // Projects
  if (path === '/projects' && method === 'GET') {
    return { success: true, data: mockProjects };
  }
  if (path.match(/^\/projects\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const proj = mockProjects.find(p => p.id === id);
    if (!proj) throw new Error('Project not found');
    return { success: true, data: proj };
  }
  if (path === '/projects' && method === 'POST') {
    const newProj: Project = {
      id: 'proj-' + Date.now(),
      name: body?.name || 'New Project',
      description: body?.description || '',
      status: 'active',
      goalCount: 0,
      completedGoals: 0,
      startDate: body?.startDate || new Date().toISOString().slice(0, 10),
      targetDate: body?.targetDate || '',
      tags: body?.tags || [],
      paperIds: body?.paperIds || [],
      createdAt: new Date().toISOString(),
    };
    mockProjects.push(newProj);
    return { success: true, data: newProj };
  }
  if (path.match(/^\/projects\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[2];
    const proj = mockProjects.find(p => p.id === id);
    if (!proj) throw new Error('Project not found');
    Object.assign(proj, body);
    return { success: true, data: proj };
  }
  if (path.match(/^\/projects\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const idx = mockProjects.findIndex(p => p.id === id);
    if (idx >= 0) mockProjects.splice(idx, 1);
    return { success: true };
  }

  // Spaces — list GET
  if (path.startsWith('/spaces') && !path.includes('/') && method === 'GET') {
    const paramStr = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(paramStr);
    let results = [...mockSpaces];
    const search = params.get('search')?.toLowerCase();
    const field = params.get('field');
    const sort = params.get('sort') || 'popularity';
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '12');

    // 搜索过滤
    if (search) {
      results = results.filter(s =>
        s.displayName.toLowerCase().includes(search) ||
        s.institution.toLowerCase().includes(search) ||
        s.researchField.toLowerCase().includes(search)
      );
    }

    // 领域过滤
    if (field) {
      results = results.filter(s => s.researchField.includes(field));
    }

    // 排序
    if (sort === 'popularity') {
      results.sort((a, b) => b.popularity - a.popularity);
    } else if (sort === 'papers') {
      results.sort((a, b) => b.paperCount - a.paperCount);
    } else if (sort === 'recent') {
      results.sort((a, b) => b.viewCount - a.viewCount);
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const paginated = results.slice(offset, offset + limit);

    return { success: true, data: { spaces: paginated, total } };
  }

  // Notes
  if (path.match(/^\/papers\/[^/]+\/notes$/) && method === 'GET') {
    const paperId = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === paperId);
    return { success: true, data: paper?.notes || [] };
  }
  if (path.match(/^\/papers\/[^/]+\/notes$/) && method === 'POST') {
    const paperId = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === paperId);
    const newNote: Note = {
      id: 'note-' + Date.now(),
      paperId,
      content: body?.content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (paper) { if (!paper.notes) paper.notes = []; paper.notes.push(newNote); }
    return { success: true, data: newNote };
  }
  // DELETE note
  if (path.match(/^\/papers\/[^/]+\/notes\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const paperId = parts[2];
    const noteId = parts[4];
    const paper = mockPapers.find(p => p.id === paperId);
    if (paper && paper.notes) {
      paper.notes = paper.notes.filter((n: Note) => n.id !== noteId);
    }
    return { success: true };
  }

  // Highlights
  if (path.match(/^\/papers\/[^/]+\/highlights$/) && method === 'GET') {
    const paperId = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === paperId);
    return { success: true, data: paper?.highlights || [] };
  }
  if (path.match(/^\/papers\/[^/]+\/highlights$/) && method === 'POST') {
    const paperId = path.split('/')[2];
    const paper = mockPapers.find(p => p.id === paperId);
    const newHl: Highlight = {
      id: 'hl-' + Date.now(),
      paperId,
      text: body?.text || '',
      color: body?.color || '#FFD700',
      note: body?.note,
      page: body?.page,
      createdAt: new Date().toISOString(),
    };
    if (paper) { if (!paper.highlights) paper.highlights = []; paper.highlights.push(newHl); }
    return { success: true, data: newHl };
  }

  // Reading Stats
  if (path === '/stats/reading' && method === 'GET') {
    return { success: true, data: mockReadingStats };
  }

  // Reading Records
  if (path === '/reading-records' && method === 'POST') {
    return { success: true };
  }

  // Search (Mock: dynamic data based on query)
  if (path.includes('/search/arxiv') && method === 'GET') {
    const paramStr = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(paramStr);
    const query = params.get('query') || '';
    const maxResults = parseInt(params.get('max_results') || '10', 10);
    const start = parseInt(params.get('start') || '0', 10);
    const data = generateMockSearchResults(query, 'arxiv', maxResults);
    return { success: true, data: { data, total: 45, offset: start, limit: maxResults } };
  }
  if (path.includes('/search/semantic-scholar') && method === 'GET') {
    const paramStr = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(paramStr);
    const query = params.get('query') || '';
    const limit = parseInt(params.get('limit') || '10', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    const data = generateMockSearchResults(query, 'semantic', limit);
    const nextOffset = offset + limit < 45 ? offset + limit : null;
    return { success: true, data: { data, total: 45, offset, limit, next: nextOffset } };
  }
  if (path === '/search/import' && method === 'POST') {
    return { success: true, data: body };
  }

  // AI Chat & Parse (Mock handlers)
  if (path === '/api-ai/chat' && method === 'POST') {
    return { success: true, data: { reply: 'Mock AI 响应：这是一个测试回复。', conversationId: 'conv-mock-001' } };
  }
  if (path === '/api-ai/parse-paper' && method === 'POST') {
    return { success: true, data: { title: 'Mock Paper Title', authors: ['Author One', 'Author Two'], year: 2024, venue: 'Mock Conference', abstract: 'This is a mock abstract for testing purposes.' } };
  }
  if (path === '/ai/conversations' && method === 'GET') {
    return { success: true, data: [] };
  }

  // Settings
  if (path === '/settings' && method === 'GET') {
    return {
      success: true,
      data: {
        theme: 'system',
        citationFormat: 'ieee',
        language: 'zh-CN',
        autoSave: true,
        notifications: {
          newPapers: true,
          readingReminders: true,
          projectUpdates: true,
          pointsChange: false,
        },
      },
    };
  }
  if (path === '/settings' && method === 'PUT') {
    return { success: true, data: body };
  }

  // ---- Libraries ----
  if (path === '/libraries' && method === 'GET') {
    return { success: true, data: mockLibraries };
  }
  if (path.match(/^\/libraries\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const lib = mockLibraries.find(l => l.id === id);
    if (!lib) throw new Error('Library not found');
    return { success: true, data: lib };
  }
  if (path === '/libraries' && method === 'POST') {
    const newLib: Library = {
      id: 'lib-' + Date.now(),
      name: body?.name || '新文献库',
      description: body?.description || '',
      color: body?.color || '#3d5a80',
      icon: body?.icon || 'Folder',
      paperIds: body?.paperIds || [],
      createdAt: new Date().toISOString(),
    };
    mockLibraries.push(newLib);
    return { success: true, data: newLib };
  }
  if (path.match(/^\/libraries\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[2];
    const lib = mockLibraries.find(l => l.id === id);
    if (!lib) throw new Error('Library not found');
    if (lib.isDefault) throw new Error('默认文献库不可修改');
    Object.assign(lib, body, { updatedAt: new Date().toISOString() });
    return { success: true, data: lib };
  }
  if (path.match(/^\/libraries\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const lib = mockLibraries.find(l => l.id === id);
    if (!lib) throw new Error('Library not found');
    if (lib.isDefault) throw new Error('默认文献库不可删除');
    const idx = mockLibraries.findIndex(l => l.id === id);
    if (idx >= 0) mockLibraries.splice(idx, 1);
    return { success: true };
  }
  if (path.match(/^\/libraries\/[^/]+\/papers$/) && method === 'POST') {
    const libId = path.split('/')[2];
    const lib = mockLibraries.find(l => l.id === libId);
    if (!lib) throw new Error('Library not found');
    if (body?.paperId && !lib.paperIds.includes(body.paperId)) {
      lib.paperIds.push(body.paperId);
    }
    if (body?.paperIds) {
      body.paperIds.forEach((pid: string) => {
        if (!lib.paperIds.includes(pid)) lib.paperIds.push(pid);
      });
    }
    return { success: true, data: lib };
  }
  if (path.match(/^\/libraries\/[^/]+\/papers\/[^/]+$/) && method === 'DELETE') {
    const parts = path.split('/');
    const libId = parts[2];
    const paperId = parts[4];
    const lib = mockLibraries.find(l => l.id === libId);
    if (!lib) throw new Error('Library not found');
    lib.paperIds = lib.paperIds.filter(id => id !== paperId);
    return { success: true };
  }

  // ---- Materials ----
  if (path === '/materials' && method === 'GET') {
    const paramStr = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(paramStr);
    let results = [...mockMaterials];
    if (params.get('category')) {
      results = results.filter(m => m.category === params.get('category'));
    }
    if (params.get('type')) {
      results = results.filter(m => m.type === params.get('type'));
    }
    if (params.get('tag')) {
      const tag = params.get('tag')!;
      results = results.filter(m => m.tags.includes(tag));
    }
    return { success: true, data: results, total: results.length };
  }
  if (path.match(/^\/materials\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const mat = mockMaterials.find(m => m.id === id);
    if (!mat) throw new Error('Material not found');
    return { success: true, data: mat };
  }
  if (path === '/materials' && method === 'POST') {
    const newMat: Material = {
      id: 'mat-' + Date.now(),
      title: body?.title || '新资料',
      type: body?.type || 'file',
      category: body?.category || 'other',
      description: body?.description || '',
      content: body?.content || '',
      fileName: body?.fileName,
      fileSize: body?.fileSize,
      fileUrl: body?.fileUrl,
      tags: body?.tags || [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
    };
    mockMaterials.push(newMat);
    return { success: true, data: newMat };
  }
  if (path.match(/^\/materials\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[2];
    const mat = mockMaterials.find(m => m.id === id);
    if (!mat) throw new Error('Material not found');
    Object.assign(mat, body, { updatedAt: new Date().toISOString() });
    return { success: true, data: mat };
  }
  if (path.match(/^\/materials\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const idx = mockMaterials.findIndex(m => m.id === id);
    if (idx >= 0) mockMaterials.splice(idx, 1);
    return { success: true };
  }
  if (path.match(/^\/materials\/[^/]+\/favorite$/) && method === 'POST') {
    const id = path.split('/')[2];
    const mat = mockMaterials.find(m => m.id === id);
    if (mat) mat.isFavorite = !mat.isFavorite;
    return { success: true, data: { isFavorite: mat?.isFavorite ?? false } };
  }

  // ---- Admin ----
  if (path.startsWith('/admin/users') && method === 'GET') {
    const mockAdminUsers = [
      { id: 'admin-fixed', username: 'admin', displayName: 'Administrator', role: 'admin', isActive: true, createdAt: '2026-01-10T00:00:00Z' },
      { id: 'user-joan', username: 'joan', displayName: 'Joan Chen (贞德)', role: 'user', isActive: true, createdAt: '2025-01-01T00:00:00Z', institution: 'Fudan University' },
    ];
    const params = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
    let users = [...mockAdminUsers];
    if (params.get('search')) {
      const q = params.get('search')!.toLowerCase();
      users = users.filter(u => u.username.includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q)));
    }
    return { success: true, data: { users, pagination: { page: 1, limit: 20, total: users.length, totalPages: 1 } } };
  }
  if (path.match(/^\/admin\/users\/[^/]+$/) && method === 'PUT') {
    return { success: true, data: body };
  }
  if (path === '/admin/stats' && method === 'GET') {
    return {
      success: true,
      data: {
        totalUsers: 2, totalPapers: mockPapers.length, totalProjects: mockProjects.length,
        systemHealth: { kv: 'healthy', edgeFunctions: 'healthy', cloudFunctions: 'healthy' }
      }
    };
  }

  // Fallback
  console.warn(`[Mock API] 未处理的请求: ${method} ${path}`);
  return { success: true };
}

// ---- 搜索辅助函数（前端直连外部 API，绕过 EdgeOne Pages Edge Function 网络沙箱） ----

/** 提取 XML 标签内容 */
function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

/** 提取 XML 中的作者列表 */
function extractXmlAuthors(xml: string): string[] {
  const authors: string[] = [];
  const regex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    authors.push(m[1].trim());
  }
  return authors;
}

/** 提取 XML 中的年份 */
function extractXmlYear(xml: string): number {
  const published = extractXmlTag(xml, 'published');
  if (published) {
    const yearMatch = published.match(/^(\d{4})/);
    if (yearMatch) return parseInt(yearMatch[1], 10);
  }
  return new Date().getFullYear();
}

/** 提取 XML 中的链接 */
function extractXmlLink(xml: string, title: string): string | null {
  const regex = new RegExp(`<link[^>]*title="${title}"[^>]*href="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// ---- API 客户端类 ----
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    const raw = localStorage.getItem('joan_auth_token');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || null;
    } catch {
      return raw; // Direct token string
    }
  }

  /** 主请求方法：同步判断 Mock 或真实 API，支持重试和拦截器 */
  private async request<T>(path: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    // 准备请求配置
    const config: RequestConfig = {
      path,
      method: (options.method || 'GET').toUpperCase(),
      headers: (options.headers as Record<string, string>) || {},
      body: options.body as string,
      timeout: options.timeout,
    };

    // 应用请求拦截器
    for (const interceptor of requestInterceptors) {
      config.headers = { ...config.headers, ...(await interceptor(config)).headers };
    }

    // Mock 模式处理
    if (IS_MOCK) {
      return this.mockRequest<T>(config);
    }

    // 真实 API 请求（带重试机制）
    return this.realRequest<T>(config, options);
  }

  /** 真实 API 请求（带重试机制） */
  private async realRequest<T>(
    config: RequestConfig,
    options: RequestInit,
    attempt = 0
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutMs = config.timeout ?? 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = config.path.startsWith('/api-external/') || config.path.startsWith('/api-ai/')
        ? config.path
        : `${this.baseUrl}${config.path}`;
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 应用响应拦截器
      let processedResponse = response;
      for (const interceptor of responseInterceptors) {
        processedResponse = await interceptor(processedResponse, config);
      }

      // 错误处理
      if (!response.ok) {
        let errorMessage = response.statusText;
        let errorCode: string = ApiErrorCode.UNKNOWN;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorCode = errorData.code || ApiErrorCode.UNKNOWN;
        } catch { /* ignore parse error */ }

        // 根据状态码确定错误类型
        if (response.status === 401) {
          errorCode = ApiErrorCode.UNAUTHORIZED;
        } else if (response.status === 403) {
          errorCode = ApiErrorCode.FORBIDDEN;
        } else if (response.status === 404) {
          errorCode = ApiErrorCode.NOT_FOUND;
        } else if (response.status >= 500) {
          errorCode = ApiErrorCode.SERVER_ERROR;
        }

        const apiError = new ApiError(errorCode, errorMessage, response.status);

        // 应用错误拦截器
        let finalError = apiError;
        for (const interceptor of errorInterceptors) {
          finalError = await interceptor(finalError, config);
        }

        throw finalError;
      }

      const data = await processedResponse.json();

      // 处理成功但业务逻辑错误的情况
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        const apiError = new ApiError(
          data.code || ApiErrorCode.UNKNOWN,
          data.error || data.message || '请求失败',
          response.status
        );
        throw apiError;
      }

      return data as T;
    } catch (error) {
      // 如果是可重试的错误且未超过最大重试次数
      if (
        attempt < MAX_RETRIES &&
        error instanceof ApiError &&
        (error.code === ApiErrorCode.NETWORK_ERROR ||
          error.code === ApiErrorCode.SERVER_ERROR ||
          error.code === ApiErrorCode.TIMEOUT)
      ) {
        console.log(`[API] 请求失败，${RETRY_DELAY * (attempt + 1)}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY * (attempt + 1)); // 指数退避
        return this.realRequest<T>(config, options, attempt + 1);
      }

      // 应用错误拦截器
      if (error instanceof ApiError) {
        let finalError = error;
        for (const interceptor of errorInterceptors) {
          finalError = await interceptor(finalError, config);
        }
        throw finalError;
      }

      // 未知错误转换为 ApiError
      throw handleApiError(error);
    }
  }

  /** Mock 请求：纯本地处理，无网络 IO */
  private async mockRequest<T>(config: RequestConfig): Promise<T> {
    await mockDelay(10 + Math.random() * 20); // 轻量延时，模拟网络 RTT
    let body: any = undefined;
    if (config.body && typeof config.body === 'string') {
      try { body = JSON.parse(config.body); } catch { /* ignore */ }
    }
    try {
      return handleMockRequest(config.path, config.method, body) as T;
    } catch (err: any) {
      throw new ApiError(ApiErrorCode.UNKNOWN, err.message || 'Mock request failed');
    }
  }

  /** 同步检查当前是否为 Mock 模式 */
  isMock(): boolean {
    return IS_MOCK;
  }

  // ---- Auth ----
  async login(username: string, password: string) {
    return this.request<ApiResponse<{ token: string; user: User }>>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    );
  }

  async register(data: { username: string; password: string; institution?: string }) {
    return this.request<ApiResponse<{ token: string; user: User }>>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getMe() {
    return this.request<{ success: boolean; data: User }>('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<ApiResponse<null>>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // ---- Papers ----
  async getPapers(params?: { search?: string; tag?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ success: boolean; data: Paper[]; total: number }>(
      `/papers?${query.toString()}`
    );
  }

  async getPaper(id: string) {
    return this.request<{ success: boolean; data: Paper }>(`/papers/${id}`);
  }

  async createPaper(paper: Partial<Paper>) {
    return this.request<{ success: boolean; data: Paper }>(
      '/papers',
      { method: 'POST', body: JSON.stringify(paper) }
    );
  }

  async updatePaper(id: string, paper: Partial<Paper>) {
    return this.request<{ success: boolean; data: Paper }>(
      `/papers/${id}`,
      { method: 'PUT', body: JSON.stringify(paper) }
    );
  }

  async deletePaper(id: string) {
    return this.request(`/papers/${id}`, { method: 'DELETE' });
  }

  async toggleFavorite(id: string) {
    return this.request<{ success: boolean; data: { isFavorited: boolean } }>(
      `/papers/${id}/favorite`,
      { method: 'POST' }
    );
  }

  // ---- Libraries ----
  async getLibraries() {
    return this.request<{ success: boolean; data: Library[] }>('/libraries');
  }
  async getLibrary(id: string) {
    return this.request<{ success: boolean; data: Library }>(`/libraries/${id}`);
  }
  async createLibrary(data: Partial<Library>) {
    return this.request<{ success: boolean; data: Library }>(
      '/libraries',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }
  async updateLibrary(id: string, data: Partial<Library>) {
    return this.request<{ success: boolean; data: Library }>(
      `/libraries/${id}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
  }
  async deleteLibrary(id: string) {
    return this.request(`/libraries/${id}`, { method: 'DELETE' });
  }
  async addPaperToLibrary(libraryId: string, paperId: string) {
    return this.request<{ success: boolean; data: Library }>(
      `/libraries/${libraryId}/papers`,
      { method: 'POST', body: JSON.stringify({ paperId }) }
    );
  }
  async removePaperFromLibrary(libraryId: string, paperId: string) {
    return this.request(
      `/libraries/${libraryId}/papers/${paperId}`,
      { method: 'DELETE' }
    );
  }

  // ---- Materials ----
  async getMaterials(params?: { category?: string; type?: string; tag?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.type) query.set('type', params.type);
    if (params?.tag) query.set('tag', params.tag);
    return this.request<{ success: boolean; data: Material[]; total: number }>(
      `/materials?${query.toString()}`
    );
  }
  async getMaterial(id: string) {
    return this.request<{ success: boolean; data: Material }>(`/materials/${id}`);
  }
  async createMaterial(data: Partial<Material>) {
    return this.request<{ success: boolean; data: Material }>(
      '/materials',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }
  async updateMaterial(id: string, data: Partial<Material>) {
    return this.request<{ success: boolean; data: Material }>(
      `/materials/${id}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
  }
  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, { method: 'DELETE' });
  }
  async toggleMaterialFavorite(id: string) {
    return this.request<{ success: boolean; data: { isFavorite: boolean } }>(
      `/materials/${id}/favorite`,
      { method: 'POST' }
    );
  }

  // ---- Projects ----
  async getProjects() {
    return this.request<{ success: boolean; data: Project[] }>('/projects');
  }

  async getProject(id: string) {
    return this.request<{ success: boolean; data: Project }>(`/projects/${id}`);
  }

  async createProject(project: Partial<Project>) {
    return this.request<{ success: boolean; data: Project }>(
      '/projects',
      { method: 'POST', body: JSON.stringify(project) }
    );
  }

  async updateProject(id: string, project: Partial<Project>) {
    return this.request<{ success: boolean; data: Project }>(
      `/projects/${id}`,
      { method: 'PUT', body: JSON.stringify(project) }
    );
  }

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  // ---- Notes ----
  async getNotes(paperId: string) {
    return this.request<{ success: boolean; data: Note[] }>(
      `/papers/${paperId}/notes`
    );
  }

  async addNote(paperId: string, content: string) {
    return this.request<{ success: boolean; data: Note }>(
      `/papers/${paperId}/notes`,
      { method: 'POST', body: JSON.stringify({ content }) }
    );
  }

  async deleteNote(paperId: string, noteId: string) {
    return this.request(`/papers/${paperId}/notes/${noteId}`, { method: 'DELETE' });
  }

  // ---- Highlights ----
  async getHighlights(paperId: string) {
    return this.request<{ success: boolean; data: Highlight[] }>(
      `/papers/${paperId}/highlights`
    );
  }

  async saveHighlight(paperId: string, highlight: Partial<Highlight>) {
    return this.request<{ success: boolean; data: Highlight }>(
      `/papers/${paperId}/highlights`,
      { method: 'POST', body: JSON.stringify(highlight) }
    );
  }

  // ---- Reading Records ----
  async recordReading(paperId: string, action: ReadingRecord['action'], duration?: number) {
    return this.request('/reading-records', {
      method: 'POST',
      body: JSON.stringify({ paperId, action, duration }),
    });
  }

  async getReadingStats() {
    return this.request<{ success: boolean; data: ReadingStats }>('/stats/reading');
  }

  // ---- Search ----
  async searchArxiv(query: string, start = 0, maxResults = 10) {
    // Mock 模式下走原有 Mock 逻辑
    if (IS_MOCK) {
      return this.request<{ success: boolean; data: { data: any[]; total: number; offset: number; limit: number } }>(
        `/search/arxiv?query=${encodeURIComponent(query)}&start=${start}&max_results=${maxResults}`
      );
    }

    // 真实模式：前端直连 arXiv API（绕过 EdgeOne Pages Edge Function 网络沙箱限制）
    if (!query.trim()) {
      return { success: true, data: { data: [], total: 0, offset: start, limit: maxResults } } as { success: boolean; data: { data: any[]; total: number; offset: number; limit: number } };
    }

    const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=${start}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    try {
      const response = await fetch(arxivUrl, {
        headers: { 'User-Agent': 'JoanAcademicHub/1.0 (mailto:academic@hub.local)' },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new ApiError(ApiErrorCode.SERVER_ERROR, `arXiv API error: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();

      // 解析 arXiv Atom XML
      const papers: any[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match: RegExpExecArray | null;
      while ((match = entryRegex.exec(xmlText)) !== null) {
        const entry = match[1];
        papers.push({
          id: extractXmlTag(entry, 'id')?.replace('http://arxiv.org/abs/', '') || '',
          title: extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim() || 'Untitled',
          authors: extractXmlAuthors(entry),
          year: extractXmlYear(entry),
          summary: extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim() || '',
          venue: 'arXiv',
          pdfUrl: extractXmlLink(entry, 'pdf') || '',
          abstractUrl: extractXmlLink(entry, 'alternate') || '',
          published: extractXmlTag(entry, 'published') || '',
          updated: extractXmlTag(entry, 'updated') || '',
        });
      }

      const totalMatch = xmlText.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
      const total = totalMatch ? parseInt(totalMatch[1], 10) : papers.length;

      return {
        success: true,
        data: {
          data: papers,
          total,
          offset: start,
          limit: maxResults,
        },
      };
    } catch (error) {
      console.error('[searchArxiv] Direct fetch error:', error);
      throw handleApiError(error);
    }
  }

  async searchSemanticScholar(query: string, offset = 0, limit = 10, apiKey?: string) {
    // Mock 模式下走原有 Mock 逻辑
    if (IS_MOCK) {
      const qs = new URLSearchParams();
      qs.set('query', query);
      qs.set('offset', String(offset));
      qs.set('limit', String(limit));
      if (apiKey) qs.set('apiKey', apiKey);
      return this.request<{ success: boolean; data: { data: any[]; total: number; offset: number; limit: number; next: number | null } }>(
        `/search/semantic-scholar?${qs.toString()}`
      );
    }

    // 真实模式：前端直连 Semantic Scholar API（绕过 EdgeOne Pages Edge Function 网络沙箱限制）
    if (!query.trim()) {
      return { success: true, data: { data: [], total: 0, offset, limit, next: null } } as { success: boolean; data: { data: any[]; total: number; offset: number; limit: number; next: number | null } };
    }

    const fields = 'title,authors,year,venue,publicationVenue,abstract,externalIds,citationCount,url,openAccessPdf';
    const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}&fields=${fields}`;

    const headers: Record<string, string> = {
      'User-Agent': 'JoanAcademicHub/1.0 (mailto:academic@hub.local)',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
      const response = await fetch(ssUrl, {
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        throw new ApiError(ApiErrorCode.SERVER_ERROR, `Semantic Scholar API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const papers = (json.data || []).map((p: any) => ({
        id: p.paperId || p.externalIds?.DOI || p.externalIds?.ArXiv || '',
        title: p.title || 'Untitled',
        authors: (p.authors || []).map((a: any) => a.name || ''),
        year: p.year || null,
        venue: (p.publicationVenue && p.publicationVenue.name) ? p.publicationVenue.name : (p.venue || ''),
        abstract: p.abstract || '',
        citations: p.citationCount || 0,
        url: p.url || '',
        doi: p.externalIds?.DOI || '',
        pdfUrl: p.openAccessPdf?.url || '',
        source: 'Semantic Scholar',
      }));

      const nextOffset = json.next ? offset + limit : null;

      return {
        success: true,
        data: {
          data: papers,
          total: json.total || 0,
          offset,
          limit,
          next: nextOffset,
        },
      };
    } catch (error) {
      console.error('[searchSemanticScholar] Direct fetch error:', error);
      throw handleApiError(error);
    }
  }

  async importFromSearch(paper: any) {
    return this.request<{ success: boolean; data: Paper }>(
      '/search/import',
      { method: 'POST', body: JSON.stringify(paper) }
    );
  }

  async importZotero(userId: string, apiKey: string, importNotes = true, importAttachments = false) {
    return this.request<{ success: boolean; data: { papers: any[]; notes: any[]; stats: any; errors?: any[] } }>(
      '/import/zotero',
      { method: 'POST', body: JSON.stringify({ userId, apiKey, importNotes, importAttachments }) }
    );
  }

  async importZoteroKV(zoteroData: any, username?: string) {
    return this.request<{
      success: boolean;
      data: { papers: { imported: number; skipped: number }; notes: { imported: number }; libraries: { created: number }; errors?: any[] };
      message: string;
    }>(
      '/admin/workbuddy/import-zotero-kv',
      { method: 'POST', body: JSON.stringify({ ...zoteroData, username }) }
    );
  }

  // ---- AI ----
  async aiChat(conversationId: string | null, message: string, context?: string, modelConfig?: { baseUrl: string; apiKey: string; model: string }) {
    if (IS_MOCK) {
      await mockDelay(500);
      return new Response(JSON.stringify({
        success: true,
        data: { reply: 'Mock AI 响应：这是一个测试回复。', conversationId: 'conv-mock-001' },
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return fetch('/api-ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
      },
      body: JSON.stringify({ conversationId, message, context, modelConfig }),
    });
  }

  // 对话保存使用 localStorage（Cloud Function 无法访问 KV，降级为前端持久化）
  async getConversations() {
    try {
      const raw = localStorage.getItem('ai_conversations');
      const conversations = raw ? JSON.parse(raw) : [];
      return { success: true, data: conversations };
    } catch {
      return { success: true, data: [] };
    }
  }

  async getConversation(convId: string) {
    try {
      const raw = localStorage.getItem('ai_conversations');
      const conversations = raw ? JSON.parse(raw) : [];
      const conv = conversations.find((c: any) => c.id === convId) || null;
      return { success: true, data: conv };
    } catch {
      return { success: true, data: null };
    }
  }

  async saveConversation(convId: string, data: any) {
    try {
      const raw = localStorage.getItem('ai_conversations');
      const conversations: any[] = raw ? JSON.parse(raw) : [];
      const idx = conversations.findIndex((c: any) => c.id === convId);
      if (idx >= 0) {
        conversations[idx] = { ...data, updatedAt: new Date().toISOString() };
      } else {
        conversations.unshift({ ...data, updatedAt: new Date().toISOString() });
      }
      localStorage.setItem('ai_conversations', JSON.stringify(conversations));
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async deleteConversationRemote(convId: string) {
    try {
      const raw = localStorage.getItem('ai_conversations');
      const conversations: any[] = raw ? JSON.parse(raw) : [];
      const filtered = conversations.filter((c: any) => c.id !== convId);
      localStorage.setItem('ai_conversations', JSON.stringify(filtered));
      return { success: true };
    } catch {
      return { success: true };
    }
  }

  async parsePaper(text: string, modelConfig?: { baseUrl: string; apiKey: string; model: string }) {
    // Mock 模式：返回模拟解析结果
    if (IS_MOCK) {
      await mockDelay(200);
      const sampleTitle = text.split('\n')[0] || 'Sample Paper Title';
      return {
        success: true,
        data: {
          title: sampleTitle.replace(/^#+\s*/, ''),
          authors: ['Zhang Wei', 'Li Ming'],
          year: new Date().getFullYear(),
          month: null,
          venue: 'arXiv preprint',
          volume: '',
          issue: '',
          pages: '',
          doi: '',
          url: '',
          abstract: 'This is a mock abstract for the paper. The actual parsing uses AI to extract metadata.',
          keywords: ['machine learning', 'graph neural network'],
          citations: {
            bibtex: `@article{mock,\n  title = {Mock Paper},\n  author = {Zhang Wei and Li Ming},\n  year = {${new Date().getFullYear()}}\n}`,
            ieee: `W. Zhang and M. Li, "Mock Paper," arXiv preprint, ${new Date().getFullYear()}.`,
            gb7714: `Zhang Wei, Li Ming. Mock Paper[J]. arXiv preprint, ${new Date().getFullYear()}.`,
          },
          references: [],
        },
      };
    }

    // 生产模式：前端直连 AI API（绕过 Cloud Function 超时限制）
    if (!modelConfig?.apiKey) {
      return { success: false, error: '请先前往「设置 → 外部工具 → AI 模型」配置并选择默认模型', data: undefined as any };
    }
    const { parsePaperDirectly } = await import('@/lib/aiParser');
    return parsePaperDirectly(text, modelConfig) as any;
  }

  // ---- Import/Export ----
  async batchImport(file: File) {
    if (IS_MOCK) {
      await mockDelay(500);
      return new Response(JSON.stringify({ success: true, imported: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    return fetch(`${this.baseUrl}/papers/batch-import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  }

  async exportPapers(format: 'bibtex' | 'csv', paperIds?: string[]) {
    if (IS_MOCK) {
      await mockDelay(300);
      const bibtex = mockPapers.map(p =>
        `@article{${p.id},\n  title={${p.title}},\n  author={${p.authors.join(' and ')}},\n  year={${p.year}},\n  journal={${p.venue}}\n}`
      ).join('\n\n');
      const content = format === 'bibtex' ? bibtex : 'id,title,authors,year,venue\n' + mockPapers.map(p =>
        `${p.id},"${p.title}","${p.authors.join('; ')}",${p.year},${p.venue}`
      ).join('\n');
      return new Response(content, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    const query = new URLSearchParams({ format });
    if (paperIds) query.set('ids', paperIds.join(','));
    return fetch(`${this.baseUrl}/papers/export?${query.toString()}`, {
      headers: this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {},
    });
  }

  // ---- Settings ----
  async getSettings() {
    return this.request<{ success: boolean; data: UserSettings }>('/settings');
  }

  async updateSettings(settings: Partial<UserSettings>) {
    return this.request<{ success: boolean; data: UserSettings }>(
      '/settings',
      { method: 'PUT', body: JSON.stringify(settings) }
    );
  }

  // ---- Admin ----
  async getAdminUsers(params?: { search?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<{ success: boolean; data: { users: any[]; pagination: any } }>(
      `/admin/users?${query.toString()}`
    );
  }

  async updateUser(userId: string, data: Partial<{ role: string; isActive: boolean; displayName: string; email: string; institution: string; bio: string }>) {
    return this.request<ApiResponse<User>>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: string) {
    return this.request<ApiResponse<null>>(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAdminStats() {
    return this.request<{ success: boolean; data: any }>('/admin/stats');
  }

  async getAdminActivities(params?: { action?: string; status?: string; user?: string; search?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.status) query.set('status', params.status);
    if (params?.user) query.set('user', params.user);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<{ success: boolean; data: { activities: any[]; total: number; page: number; limit: number; totalPages: number } }>(`/admin/activities?${query.toString()}`);
  }

  async getAdminPapers(params?: { search?: string; year?: string; tag?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.year) query.set('year', params.year);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<{ success: boolean; data: { papers: any[]; total: number; page: number; limit: number; totalPages: number; years: number[]; tags: string[] } }>(`/admin/papers?${query.toString()}`);
  }

  async deleteAdminPaper(paperId: string) {
    return this.request<ApiResponse<{ deleted: boolean }>>(`/admin/papers/${paperId}`, { method: 'DELETE' });
  }

  async getAdminProjects(params?: { search?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<{ success: boolean; data: { projects: any[]; total: number; page: number; limit: number; totalPages: number; statuses: string[] } }>(`/admin/projects?${query.toString()}`);
  }

  async deleteAdminProject(projectId: string) {
    return this.request<ApiResponse<{ deleted: boolean }>>(`/admin/projects/${projectId}`, { method: 'DELETE' });
  }

  async getAdminSettings() {
    return this.request<{ success: boolean; data: any }>('/admin/settings');
  }

  async updateAdminSettings(settings: Record<string, any>) {
    return this.request<{ success: boolean; data: any }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async createAdminBackup() {
    return this.request<{ success: boolean; data: any }>('/admin/backup', { method: 'POST' });
  }

  async getAdminRoutes() {
    return this.request<{ success: boolean; data: { routes: any[] } }>('/admin/routes');
  }

  /** WorkBuddy: 注入种子数据 */
  async adminSeedData() {
    return this.request<{ success: boolean; data: { added: number; total: number } }>('/admin/workbuddy/seed', { method: 'POST' });
  }

  /** WorkBuddy: 导出全部文献 */
  async adminExportPapers(format: 'bibtex' | 'csv' | 'json' = 'json') {
    // Parse token from Zustand persist format or plain string
    const rawToken = localStorage.getItem('joan_auth_token');
    let token = '';
    if (rawToken) {
      try { token = JSON.parse(rawToken)?.state?.token || rawToken; } catch { token = rawToken; }
    }
    if (format === 'json') {
      return this.request<{ success: boolean; data: { papers: any[]; count: number } }>(`/admin/workbuddy/export?format=${format}`);
    }
    // For bibtex/csv, return raw text
    const res = await fetch(`${API_BASE}/admin/workbuddy/export?format=${format}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return { success: res.ok, data: await res.text() };
  }

  /** WorkBuddy: 清理 KV 数据 */
  async adminCleanKv(keepAdmin = true) {
    return this.request<{ success: boolean; data: { deleted: number; keepAdmin: boolean } }>('/admin/workbuddy/clean', {
      method: 'POST',
      body: JSON.stringify({ keepAdmin }),
    });
  }

  /** WorkBuddy: 重建索引 */
  async adminReindex() {
    return this.request<{ success: boolean; data: { fixedUsers: number; fixedSpaces: number } }>('/admin/workbuddy/reindex', { method: 'POST' });
  }

  /** 获取公开项目列表 */
  async getPublicProjects() {
    return this.request<{ success: boolean; data: { projects: any[]; total: number } }>('/projects/public');
  }

  /** 获取学术空间列表（Spaces Gallery） */
  async getSpaces(params?: { search?: string; field?: string; sort?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.field) query.set('field', params.field);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<{ success: boolean; data: { spaces: any[]; total: number } }>(`/spaces?${query}`);
  }
}

export const api = new ApiClient(API_BASE);
