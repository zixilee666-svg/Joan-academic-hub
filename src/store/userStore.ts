import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CitationFormat, AIModelConfig } from '@/types';

interface NotificationSettings {
  newPapers: boolean;
  readingReminders: boolean;
  projectUpdates: boolean;
  pointsChange: boolean;
}

interface ExternalApiConfig {
  semanticScholarApiKey: string;
  githubToken: string;
  githubUsername: string;
  imaApiKey: string;
  imaEndpoint: string;
  crawlabEndpoint: string;
  crawlabToken: string;
}

interface UserSettingsState extends ExternalApiConfig {
  citationFormat: CitationFormat;
  notifications: NotificationSettings;
  zoteroUserId: string;
  zoteroApiKey: string;
  aiModels: AIModelConfig[];
  defaultAiModelId: string;
  setCitationFormat: (format: CitationFormat) => void;
  setNotification: (key: keyof NotificationSettings, value: boolean) => void;
  setZoteroConfig: (userId: string, apiKey: string) => void;
  setExternalApiConfig: (config: Partial<ExternalApiConfig>) => void;
  loadFromBackend: (data: Partial<UserSettingsState>) => void;
  setAiModels: (models: AIModelConfig[]) => void;
  addAiModel: (model: AIModelConfig) => void;
  removeAiModel: (id: string) => void;
  setDefaultAiModel: (id: string) => void;
  resetSettings: () => void;
}

const defaultNotifications: NotificationSettings = {
  newPapers: true,
  readingReminders: true,
  projectUpdates: true,
  pointsChange: true,
};

const defaultAiModels: AIModelConfig[] = [
  {
    id: 'kimi-8k',
    name: 'Kimi v1-8k',
    provider: 'kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: '',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
  },
];

export const useSettingsStore = create<UserSettingsState>()(
  persist(
    (set) => ({
      citationFormat: 'bibtex',
      notifications: { ...defaultNotifications },
      zoteroUserId: '',
      zoteroApiKey: '',
      semanticScholarApiKey: '',
      githubToken: '',
      githubUsername: '',
      imaApiKey: '',
      imaEndpoint: '',
      crawlabEndpoint: '',
      crawlabToken: '',
      aiModels: [...defaultAiModels],
      defaultAiModelId: 'kimi-8k',

      setCitationFormat: (format) => set({ citationFormat: format }),

      setNotification: (key, value) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        })),

      setZoteroConfig: (userId, apiKey) => set({ zoteroUserId: userId, zoteroApiKey: apiKey }),

  setExternalApiConfig: (config) => set((state) => ({ ...state, ...config })),

  loadFromBackend: (data: Partial<UserSettingsState>) =>
        set((state) => {
          // 外部工具字段：后端返回空字符串时保留本地值（后端可能是 DEFAULT_SETTINGS）
          const externalFields = [
            'zoteroUserId', 'zoteroApiKey',
            'semanticScholarApiKey', 'githubToken', 'githubUsername',
            'imaApiKey', 'imaEndpoint', 'crawlabEndpoint', 'crawlabToken',
          ] as const;

          const resolved: Partial<UserSettingsState> = {};
          for (const key of externalFields) {
            // 若后端显式传了字段（包括空字符串），用后端值；否则保留本地值
            // 注意：后端若返回 { zoteroUserId: "" }（默认值），这里不区分"未传"和"空值"
            // 因为 DEFAULT_SETTINGS 总是包含空字符串，所以保留本地值更安全
            const backendVal = (data as any)[key];
            const localVal = (state as any)[key];
            (resolved as any)[key] = (backendVal !== undefined && backendVal !== '') ? backendVal : localVal;
          }

          console.log('[loadFromBackend] incoming data:', data);
          console.log('[loadFromBackend] resolved external fields:', resolved);
          console.log('[loadFromBackend] current state:', {
            zoteroUserId: state.zoteroUserId,
            zoteroApiKey: state.zoteroApiKey ? '***' : '',
            aiModels: state.aiModels.length,
          });

          return {
            ...state,
            ...data,
            ...resolved,
            aiModels: (data.aiModels && data.aiModels.length > 0) ? data.aiModels : state.aiModels,
            defaultAiModelId: data.defaultAiModelId || state.defaultAiModelId,
          };
        }),

  setAiModels: (models) => set({ aiModels: models }),

      addAiModel: (model) =>
        set((state) => ({ aiModels: [...state.aiModels, model] })),

      removeAiModel: (id) =>
        set((state) => {
          const filtered = state.aiModels.filter((m) => m.id !== id);
          const newDefaultId =
            state.defaultAiModelId === id
              ? (filtered[0]?.id || '')
              : state.defaultAiModelId;
          return { aiModels: filtered, defaultAiModelId: newDefaultId };
        }),

      setDefaultAiModel: (id) => set({ defaultAiModelId: id }),

      resetSettings: () =>
        set({
          citationFormat: 'bibtex',
          notifications: { ...defaultNotifications },
          zoteroUserId: '',
          zoteroApiKey: '',
          semanticScholarApiKey: '',
          githubToken: '',
          githubUsername: '',
          imaApiKey: '',
          imaEndpoint: '',
          crawlabEndpoint: '',
          crawlabToken: '',
          aiModels: [...defaultAiModels],
          defaultAiModelId: 'kimi-8k',
        }),
    }),
    {
      name: 'joan_academic_settings',
    }
  )
);
