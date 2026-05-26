import { apiClient } from './api';
import type { User, AuthResponse } from '@/types';

export const authService = {
  login: (username: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { username, password }),

  register: (data: {
    username: string;
    password: string;
    displayName?: string;
    email?: string;
    institution?: string;
    researchField?: string;
  }) =>
    apiClient.post<AuthResponse>('/auth/register', data),

  me: () =>
    apiClient.get<User>('/auth/me'),

  logout: () =>
    apiClient.post<null>('/auth/logout'),

  updateProfile: (data: Partial<User>) =>
    apiClient.put<User>('/auth/me', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<null>('/auth/change-password', { currentPassword, newPassword }),
};
