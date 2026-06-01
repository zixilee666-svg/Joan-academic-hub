// ========================================
// Joan's Academic Hub — 类型定义 v3.0 (Enhanced)
// ========================================

// ----- 用户 -----
export interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  email?: string;
  institution?: string;
  researchField?: string;
  bio?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ----- 文献库管理 -----
export interface Library {
  id: string;
  name: string;
  description?: string;
  color: string;       // 图标颜色
  icon: string;       // 图标名称 (lucide icon name)
  paperIds: string[]; // 库中的论文ID
  createdAt: string;
  updatedAt?: string;
  isDefault?: boolean; // 是否为默认库
}

// ----- 文献 -----
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  venueType: 'journal' | 'conference' | 'preprint';
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  abstract: string;
  keywords: string[];
  pdfUrl?: string;
  url?: string;
  citationCount?: number;
  isFavorited: boolean;
  isRead?: boolean;
  readingStatus?: 'unread' | 'reading' | 'completed';
  addedDate?: string;
  addedAt?: string;
  tags: string[];
  joanNote?: string;
  notes?: Note[];
  highlights?: Highlight[];
  addedBy?: string;
  libraryId?: string; // 所属文献库ID
}

// ----- 个人资料 -----
export type MaterialType = 'pdf' | 'markdown' | 'note' | 'link' | 'file';
export type MaterialCategory =
  | 'courseware'    // 课件
  | 'slides'        // 幻灯片
  | 'notes'         // 个人笔记
  | 'book'          // 电子书
  | 'reference'     // 参考资料
  | 'report'        // 报告
  | 'other';        // 其他

export interface Material {
  id: string;
  title: string;
  type: MaterialType;
  category: MaterialCategory;
  description?: string;
  content?: string;     // 文本内容或链接URL
  fileName?: string;    // 上传文件名
  fileSize?: number;    // 文件大小(bytes)
  fileUrl?: string;     // 上传后的URL
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

// ----- 项目 -----
export interface Project {
  id: string;
  name?: string;
  title?: string;
  description: string;
  progress?: number;
  status: 'in-progress' | 'completed' | 'planned' | 'active';
  goalCount?: number;
  completedGoals?: number;
  startDate?: string;
  targetDate?: string;
  relatedPaperIds?: string[];
  paperIds?: string[];
  objectives?: Objective[];
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

export interface Objective {
  id: string;
  text: string;
  completed: boolean;
}

// ----- 笔记 -----
export interface Note {
  id: string;
  paperId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

// ----- 高亮 -----
export interface Highlight {
  id: string;
  paperId: string;
  pageNumber?: number;
  page?: number;
  text: string;
  color: string;
  note?: string;
  createdAt: string;
  userId?: string;
}

// ----- 阅读记录 -----
export interface ReadingRecord {
  id?: string;
  paperId: string;
  userId?: string;
  action: 'open' | 'read' | 'favorite' | 'note';
  duration?: number;
  timestamp?: string;
}

// ----- 活动 -----
export interface Activity {
  id: string;
  type: 'favorite' | 'read' | 'create-project' | 'level-up' | 'add-note';
  description: string;
  timestamp: string;
  paperId?: string;
  projectId?: string;
}

// ----- AI 对话 -----
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

// ----- AI 模型配置 -----
export interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ----- 设置 -----
export type ThemeMode = 'light' | 'dark' | 'system';
export type CitationFormat = 'bibtex' | 'ieee' | 'gb7714';

export interface UserSettings {
  theme: ThemeMode;
  citationFormat: CitationFormat;
  language?: string;
  autoSave?: boolean;
  notifications: {
    email?: boolean;
    push?: boolean;
    weekly?: boolean;
    newPapers?: boolean;
    readingReminders?: boolean;
    projectUpdates?: boolean;
    pointsChange?: boolean;
  };
  // External tools — synced across devices via backend KV
  zoteroUserId?: string;
  zoteroApiKey?: string;
  semanticScholarApiKey?: string;
  githubToken?: string;
  githubUsername?: string;
  imaApiKey?: string;
  imaEndpoint?: string;
  crawlabEndpoint?: string;
  crawlabToken?: string;
  aiModels?: AIModelConfig[];
  defaultAiModelId?: string;
}

// ----- 阅读统计 -----
export interface ReadingStats {
  totalPapers: number;
  weeklyRead: number;
  toRead: number;
  points: number;
  streakDays: number;
  weeklyHeatmap: number[];
  readPapers?: number;
  readingPapers?: number;
  unreadPapers?: number;
  weeklyGoal?: number;
  weeklyCompleted?: number;
  totalReadingTime?: number;
}

// ----- API 通用 -----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  message?: string;
}

// ----- Space / Multi-tenant -----
export interface SpaceConfig {
  username: string;
  displayName: string;
  institution?: string;
  researchField?: string;
  avatar?: string;
  bio?: string;
  isPublic: boolean;
  paperCount: number;
  projectCount: number;
  viewCount: number;
  popularity: number;
  lastActiveAt: string;
  createdAt: string;
  theme?: SpaceTheme;
}

export interface SpaceTheme {
  primaryColor?: string;
  accentColor?: string;
  layout?: 'classic' | 'modern' | 'minimal' | 'card';
  showPapers?: boolean;
  showProjects?: boolean;
  showStats?: boolean;
  customCSS?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalPapers: number;
  totalProjects: number;
  totalSpaces: number;
  activeUsers: number;
  recentActivities: Array<{ type: string; description: string; timestamp: string }>;
  systemHealth: {
    kv: 'healthy' | 'degraded' | 'down';
    edgeFunctions: 'healthy' | 'degraded' | 'down';
    cloudFunctions: 'healthy' | 'degraded' | 'down';
  };
}
