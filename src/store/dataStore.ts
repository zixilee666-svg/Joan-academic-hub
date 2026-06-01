// ========================================
// dataStore — 全局数据缓存层
// 解决页面切换时重复拉取 papers/projects/libraries 的问题
// ========================================
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Paper, Project, Library } from '@/types';

interface DataStoreState {
  // ===== 数据 =====
  papers: Paper[];
  projects: Project[];
  libraries: Library[];

  // ===== 加载状态 =====
  papersLoaded: boolean;
  projectsLoaded: boolean;
  librariesLoaded: boolean;
  papersLoading: boolean;
  projectsLoading: boolean;
  librariesLoading: boolean;

  // ===== 错误 =====
  papersError: string | null;
  projectsError: string | null;
  librariesError: string | null;

  // ===== 确保数据已加载（仅在未加载/未加载中时拉取） =====
  ensurePapers: () => Promise<void>;
  ensureProjects: () => Promise<void>;
  ensureLibraries: () => Promise<void>;

  // ===== 缓存失效（数据变更后调用） =====
  invalidatePapers: () => void;
  invalidateProjects: () => void;
  invalidateLibraries: () => void;
  invalidateAll: () => void;

  // ===== 乐观更新（变更后同步更新缓存，避免重新拉取） =====
  restorePapers: (papers: Paper[]) => void;
  restoreProjects: (projects: Project[]) => void;
  addToPapers: (paper: Paper) => void;
  removeFromPapers: (id: string) => void;
  updateInPapers: (paper: Paper) => void;
  addToProjects: (project: Project) => void;
  removeFromProjects: (id: string) => void;
  updateInProjects: (project: Project) => void;
  addToLibraries: (lib: Library) => void;
  removeFromLibraries: (id: string) => void;
  updateInLibraries: (lib: Library) => void;
}

export const useDataStore = create<DataStoreState>((set, get) => ({
  // ===== 初始状态 =====
  papers: [],
  projects: [],
  libraries: [],
  papersLoaded: false,
  projectsLoaded: false,
  librariesLoaded: false,
  papersLoading: false,
  projectsLoading: false,
  librariesLoading: false,
  papersError: null,
  projectsError: null,
  librariesError: null,

  // ===== ensurePapers =====
  ensurePapers: async () => {
    const { papersLoaded, papersLoading } = get();
    if (papersLoaded || papersLoading) return;
    set({ papersLoading: true, papersError: null });
    try {
      const res = await api.getPapers({ pageSize: 200 });
      if (res.success && res.data) {
        set({ papers: res.data, papersLoaded: true, papersLoading: false });
      } else {
        set({ papersError: '加载文献失败', papersLoading: false });
      }
    } catch (err: any) {
      set({ papersError: err.message || '加载文献失败', papersLoading: false });
    }
  },

  // ===== ensureProjects =====
  ensureProjects: async () => {
    const { projectsLoaded, projectsLoading } = get();
    if (projectsLoaded || projectsLoading) return;
    set({ projectsLoading: true, projectsError: null });
    try {
      const res = await api.getProjects();
      if (res.success && res.data) {
        set({ projects: res.data, projectsLoaded: true, projectsLoading: false });
      } else {
        set({ projectsError: '加载项目失败', projectsLoading: false });
      }
    } catch (err: any) {
      set({ projectsError: err.message || '加载项目失败', projectsLoading: false });
    }
  },

  // ===== ensureLibraries =====
  ensureLibraries: async () => {
    const { librariesLoaded, librariesLoading } = get();
    if (librariesLoaded || librariesLoading) return;
    set({ librariesLoading: true, librariesError: null });
    try {
      const res = await api.getLibraries();
      if (res.success && res.data) {
        set({ libraries: res.data, librariesLoaded: true, librariesLoading: false });
      } else {
        set({ librariesError: '加载文献库失败', librariesLoading: false });
      }
    } catch (err: any) {
      set({ librariesError: err.message || '加载文献库失败', librariesLoading: false });
    }
  },

  // ===== 缓存失效 =====
  invalidatePapers: () => set({ papers: [], papersLoaded: false, papersLoading: false, papersError: null }),
  invalidateProjects: () => set({ projects: [], projectsLoaded: false, projectsLoading: false, projectsError: null }),
  invalidateLibraries: () => set({ libraries: [], librariesLoaded: false, librariesLoading: false, librariesError: null }),
  invalidateAll: () => set({
    papers: [], projects: [], libraries: [],
    papersLoaded: false, projectsLoaded: false, librariesLoaded: false,
    papersLoading: false, projectsLoading: false, librariesLoading: false,
    papersError: null, projectsError: null, librariesError: null,
  }),

  // ===== 回滚/恢复（用于乐观更新失败时回退整个数组） =====
  restorePapers: (papers) => set({ papers }),
  restoreProjects: (projects) => set({ projects }),

  // ===== 乐观更新：papers =====
  addToPapers: (paper) => set(s => ({ papers: [paper, ...s.papers] })),
  removeFromPapers: (id) => set(s => ({ papers: s.papers.filter(p => p.id !== id) })),
  updateInPapers: (paper) => set(s => ({
    papers: s.papers.map(p => p.id === paper.id ? { ...p, ...paper } : p),
  })),

  // ===== 乐观更新：projects =====
  addToProjects: (project) => set(s => ({ projects: [project, ...s.projects] })),
  removeFromProjects: (id) => set(s => ({ projects: s.projects.filter(p => p.id !== id) })),
  updateInProjects: (project) => set(s => ({
    projects: s.projects.map(p => p.id === project.id ? { ...p, ...project } : p),
  })),

  // ===== 乐观更新：libraries =====
  addToLibraries: (lib) => set(s => ({ libraries: [lib, ...s.libraries] })),
  removeFromLibraries: (id) => set(s => ({ libraries: s.libraries.filter(l => l.id !== id) })),
  updateInLibraries: (lib) => set(s => ({
    libraries: s.libraries.map(l => l.id === lib.id ? { ...l, ...lib } : l),
  })),
}));
