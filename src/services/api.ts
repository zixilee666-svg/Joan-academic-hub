/**
 * Joan's Academic Hub — API Service
 * 支持 Mock 和真实 API 双模式
 */

import type { ApiResponse } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
// 与 src/lib/api.ts 保持一致：默认 Mock 模式（未设置 VITE_MOCK_MODE 时）
// 生产部署时设置 VITE_MOCK_MODE=false 启用真实 API
const IS_MOCK: boolean = import.meta.env.VITE_MOCK_MODE !== 'false';

// ============================================================
// 工具函数
// ============================================================

export async function getToken(): Promise<string | null> {
  try {
    return JSON.parse(localStorage.getItem('joan_auth_token') || 'null');
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem('joan_auth_token', JSON.stringify(token));
}

export function clearToken() {
  localStorage.removeItem('joan_auth_token');
  localStorage.removeItem('joan_academic_user');
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('joan_academic_user') || 'null');
  } catch {
    return null;
  }
}

export function setCurrentUser(user: any) {
  localStorage.setItem('joan_academic_user', JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem('joan_academic_user');
}

// ============================================================
// 请求封装
// ============================================================

interface RequestConfig {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = config;
  
  // Mock 模式处理
  if (IS_MOCK) {
    const mockResult = handleMock(endpoint, method, body);
    if (mockResult) return mockResult as ApiResponse<T>;
  }
  
  const token = await getToken();
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (res.status === 401) {
    clearToken();
    clearCurrentUser();
    window.location.hash = '#/login';
    throw new Error('Unauthorized');
  }
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// ============================================================
// Mock 数据处理
// ============================================================

const mockUser = {
  id: 'admin',
  username: 'admin',
  displayName: 'Administrator',
  email: 'admin@academic-hub.local',
  role: 'admin',
  institution: 'Joan Academic Hub',
  createdAt: new Date().toISOString(),
};

const mockToken = 'mock-jwt-token-' + Date.now();

// Mock 论文数据
const mockPapers = [
  {
    id: 'paper-1',
    title: 'Graph Neural Networks for Fraud Detection: A Comprehensive Survey',
    abstract: 'This paper provides a comprehensive survey of graph neural networks applied to financial fraud detection...',
    authors: ['Wei Zhang', 'Joan Chen'],
    year: 2025,
    venue: 'IEEE Transactions on Knowledge and Data Engineering',
    tags: ['GNN', 'Fraud Detection', 'Financial Security'],
    citations: 45,
    doi: '10.1109/TKDE.2025.1234567',
  },
  {
    id: 'paper-2',
    title: 'Heterogeneous Graph Neural Networks for Credit Risk Assessment',
    abstract: 'We propose a novel heterogeneous GNN framework for credit risk assessment that leverages multiple entity types...',
    authors: ['Joan Chen', 'Wei Zhang', 'Li Ming'],
    year: 2024,
    venue: 'KDD 2024',
    tags: ['HGNN', 'Credit Risk', 'Heterogeneous Graph'],
    citations: 32,
    doi: '10.1145/3541234.5678901',
  },
];

// Mock 项目数据
const mockProjects = [
  {
    id: 'project-1',
    name: 'Graph-based Anti-Money Laundering System',
    description: 'Developing an AI-powered AML system using heterogeneous graph neural networks to detect suspicious transaction patterns.',
    status: 'active',
    progress: 65,
    tags: ['AML', 'GNN', 'Financial Crime'],
    startDate: '2025-01-15',
    endDate: '2026-06-30',
    objectives: [
      { id: 'obj-1', text: 'Design heterogeneous graph schema', completed: true },
      { id: 'obj-2', text: 'Implement HGNN model', completed: true },
      { id: 'obj-3', text: 'Deploy to production', completed: false },
    ],
  },
];

// Mock 文献库数据
const mockLibraries = [
  {
    id: 'lib-1',
    name: 'Graph Neural Networks',
    description: 'Collection of seminal papers on graph neural networks and their applications.',
    paperCount: 2,
    papers: mockPapers,
    tags: ['GNN', 'Deep Learning'],
  },
];

// Mock Joan 用户数据
const mockJoanUser = {
  id: 'user-joan',
  username: 'joan',
  displayName: 'Joan Chen (贞德)',
  email: 'joan@academic-hub.local',
  role: 'user',
  institution: 'Fudan University',
  bio: 'PhD candidate researching Graph Neural Networks and Financial AI. Passionate about applying ML to solve real-world problems.',
  avatar: '',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockJoanToken = 'mock-joan-token-' + Date.now();

function handleMock(endpoint: string, method: string, body?: any): any {
  // 登录
  if (endpoint === '/auth/login' && method === 'POST') {
    const { username, password } = body || {};
    if (!username || !password) throw new Error('请输入用户名和密码');
    
    if (username === 'admin' && password === '123456') {
      return { success: true, data: { token: mockToken, user: mockUser } };
    }
    if (username === 'joan' && password === '11223344') {
      return { success: true, data: { token: mockJoanToken, user: mockJoanUser } };
    }
    throw new Error('用户名或密码错误');
  }
  
  // 注册
  if (endpoint === '/auth/register' && method === 'POST') {
    const { username, password } = body || {};
    if (!username || !password) throw new Error('请输入用户名和密码');
    if (username === 'admin') throw new Error('用户名已存在');
    
    const newUser = {
      id: `user-${Date.now()}`,
      username,
      displayName: body.displayName || username,
      email: body.email || '',
      role: 'user',
      institution: '',
      createdAt: new Date().toISOString(),
    };
    
    return { success: true, data: { token: 'mock-token-' + Date.now(), user: newUser } };
  }
  
  // 获取当前用户
  if (endpoint === '/auth/me' && method === 'GET') {
    const token = localStorage.getItem('joan_auth_token');
    if (token) {
      if (token === mockToken) return { success: true, data: mockUser };
      if (token === mockJoanToken) return { success: true, data: mockJoanUser };
    }
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }
  
  // 登出
  if (endpoint === '/auth/logout' && method === 'POST') {
    return { success: true, data: null, message: 'Logout successful' };
  }
  
  // 获取 Joan 的论文
  if (endpoint === '/users/joan/papers' && method === 'GET') {
    return { success: true, data: mockPapers };
  }
  
  // 获取 Joan 的项目
  if (endpoint === '/users/joan/projects' && method === 'GET') {
    return { success: true, data: mockProjects };
  }
  
  // 获取 Joan 的文献库
  if (endpoint === '/users/joan/libraries' && method === 'GET') {
    return { success: true, data: mockLibraries };
  }
  
  // 创建论文
  if (endpoint === '/papers' && method === 'POST') {
    const paper = { id: `paper-${Date.now()}`, ...body, createdAt: new Date().toISOString() };
    return { success: true, data: paper };
  }
  
  // 获取所有空间
  if (endpoint === '/spaces' && method === 'GET') {
    return { success: true, data: [mockJoanUser] };
  }
  
  // 获取 Joan 空间
  if (endpoint === '/spaces/joan' && method === 'GET') {
    return { success: true, data: { ...mockJoanUser, stats: { papers: 2, projects: 1, libraries: 1 } } };
  }
  
  // 健康检查
  if (endpoint === '/hello' && method === 'GET') {
    return { success: true, data: { message: "Joan's Academic Hub API", version: '5.0.0' } };
  }
  
  return null;
}

// ============================================================
// API 客户端
// ============================================================

export const apiClient = {
  // GET 请求
  get: <T>(url: string) => request<T>(url, { method: 'GET' }),
  
  // POST 请求
  post: <T>(url: string, body?: any) => request<T>(url, { method: 'POST', body }),
  
  // PUT 请求
  put: <T>(url: string, body?: any) => request<T>(url, { method: 'PUT', body }),
  
  // DELETE 请求
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};

// ============================================================
// 专用 API 函数
// ============================================================

// 认证
export const authApi = {
  login: (username: string, password: string) => 
    apiClient.post<{ token: string; user: any }>('/auth/login', { username, password }),
  
  register: (data: { username: string; password: string; email?: string; displayName?: string }) =>
    apiClient.post<{ token: string; user: any }>('/auth/register', data),
  
  me: () => apiClient.get<any>('/auth/me'),
  
  logout: () => apiClient.post('/auth/logout'),
};

// 用户
export const userApi = {
  getUsers: () => apiClient.get<any[]>('/users'),
  getUser: (id: string) => apiClient.get<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => apiClient.put<any>(`/users/${id}`, data),
  deleteUser: (id: string) => apiClient.delete(`/users/${id}`),
};

// 空间
export const spaceApi = {
  getSpaces: () => apiClient.get<any[]>('/spaces'),
  getSpace: (username: string) => apiClient.get<any>(`/spaces/${username}`),
  updateSpace: (username: string, data: any) => apiClient.put<any>(`/spaces/${username}`, data),
};

// 论文
export const paperApi = {
  getPapers: (username: string) => apiClient.get<any[]>(`/users/${username}/papers`),
  getPaper: (id: string) => apiClient.get<any>(`/papers/${id}`),
  createPaper: (data: any) => apiClient.post<any>('/papers', data),
  updatePaper: (id: string, data: any) => apiClient.put<any>(`/papers/${id}`, data),
  deletePaper: (id: string) => apiClient.delete(`/papers/${id}`),
};

// 项目
export const projectApi = {
  getProjects: (username: string) => apiClient.get<any[]>(`/users/${username}/projects`),
  getProject: (id: string) => apiClient.get<any>(`/projects/${id}`),
  createProject: (data: any) => apiClient.post<any>('/projects', data),
  updateProject: (id: string, data: any) => apiClient.put<any>(`/projects/${id}`, data),
  deleteProject: (id: string) => apiClient.delete(`/projects/${id}`),
};

// 文献库
export const libraryApi = {
  getLibraries: (username: string) => apiClient.get<any[]>(`/users/${username}/libraries`),
  getLibrary: (id: string) => apiClient.get<any>(`/libraries/${id}`),
  createLibrary: (data: any) => apiClient.post<any>('/libraries', data),
  updateLibrary: (id: string, data: any) => apiClient.put<any>(`/libraries/${id}`, data),
  deleteLibrary: (id: string) => apiClient.delete(`/libraries/${id}`),
};

// 统计 (管理员)
export const statsApi = {
  getStats: () => apiClient.get<any>('/stats'),
};

export { API_BASE, IS_MOCK };
