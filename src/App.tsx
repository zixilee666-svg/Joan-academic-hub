// ========================================
// Joan's Academic Hub — App 入口 v5.1
// ========================================
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useThemeSync } from '@/store/themeStore';
import DashboardPage from '@/pages/DashboardPage';
import LibraryPage from '@/pages/LibraryPage';
import PaperDetailPage from '@/pages/PaperDetailPage';
import ResearchPage from '@/pages/ResearchPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import AdminPage from '@/pages/AdminPage';
import ImportExportPage from '@/pages/ImportExportPage';
import MyLibraryPage from '@/pages/MyLibraryPage';
import MaterialsPage from '@/pages/MaterialsPage';
import MaterialViewPage from '@/pages/MaterialViewPage';
import AIChatPage from '@/pages/AIChatPage';
import KnowledgeGraphPage from '@/pages/KnowledgeGraphPage';
import AppLayout from '@/components/layout/AppLayout';
import PublicLayout from '@/components/layout/PublicLayout';
import AuthPage from '@/pages/AuthPage';
import GalleryPage from '@/pages/GalleryPage';
import PublicProfilePage from '@/pages/PublicProfilePage';
import RequireAuth from '@/components/common/RequireAuth';
import RequireAdmin from '@/components/common/RequireAdmin';

function ThemeSyncWrapper({ children }: { children: React.ReactNode }) {
  useThemeSync();
  return <>{children}</>;
}

function DashboardLayout() {
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}

function AdminLayout() {
  return (
    <RequireAdmin>
      <AppLayout />
    </RequireAdmin>
  );
}

function GalleryLayout() {
  return (
    <RequireAuth>
      <GalleryPage />
    </RequireAuth>
  );
}

/** 根路由：根据登录状态重定向 */
function RootRoute() {
  const token = localStorage.getItem('joan_auth_token');
  if (token) return <Navigate to="/gallery" replace />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* 公开路由 - 登录页、注册页、公开资料页 */}
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/login/:tab" element={<AuthPage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
        </Route>

        {/* 根路由 - 根据登录状态智能重定向 */}
        <Route path="/" element={<RootRoute />} />

        {/* 受保护路由 - 学术空间画廊（登录后才能访问） */}
        <Route path="/gallery" element={<GalleryLayout />} />

        {/* 受保护路由 - Dashboard */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="paper/:id" element={<PaperDetailPage />} />
          <Route path="my-library" element={<MyLibraryPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="material/:id" element={<MaterialViewPage />} />
          <Route path="ai-chat" element={<AIChatPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="project/:id" element={<ProjectDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="knowledge" element={<KnowledgeGraphPage />} />
        </Route>

        {/* 管理员路由 */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminPage />} />
        </Route>

        {/* 兼容旧路由 - 重定向 */}
        <Route path="/legacy" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="paper/:id" element={<PaperDetailPage />} />
          <Route path="my-library" element={<MyLibraryPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="ai-chat" element={<AIChatPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="knowledge" element={<KnowledgeGraphPage />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSyncWrapper>
        <TooltipProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: 'font-sans',
            }}
          />
        </TooltipProvider>
      </ThemeSyncWrapper>
    </HashRouter>
  );
}
