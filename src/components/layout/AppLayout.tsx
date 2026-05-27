// ========================================
// AppLayout — 全局布局（侧边栏 + 主内容区）
// ========================================
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, FlaskConical, Settings,
  FileDown, Shield, Moon, Sun, Monitor,
  LogOut, Scale, Menu, X,
  FolderOpen, FileText, MessageSquare, Globe,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import SiteFooter from './SiteFooter';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/dashboard/library', icon: BookOpen, label: '文献库' },
  { to: '/dashboard/my-library', icon: FolderOpen, label: '我的文献库' },
  { to: '/dashboard/materials', icon: FileText, label: '个人资料' },
  { to: '/dashboard/ai-chat', icon: MessageSquare, label: 'AI 对话' },
  { to: '/dashboard/research', icon: FlaskConical, label: '我的研究' },
  { to: '/dashboard/import-export', icon: FileDown, label: '导入导出' },
  { to: '/dashboard/knowledge', icon: Database, label: '知识图谱' },
  { to: '/dashboard/settings', icon: Settings, label: '设置' },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: '管理后台' },
];

const publicItems = [
  { to: '/gallery', icon: Globe, label: '学术广场' },
];

export default function AppLayout() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const mode = useThemeStore(s => s.mode);
  const setMode = useThemeStore(s => s.setMode);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-primary-500 text-white shadow-glow'
        : 'text-primary-600 dark:text-ivory-100 hover:bg-primary-50 dark:hover:bg-primary-800'
    );

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const handleLogout = () => {
    logout();
    window.location.hash = '#/login';
  };

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Desktop (fixed, does not scroll with main content) */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-screen flex-col w-64 bg-white dark:bg-primary-800 border-r border-primary-100 dark:border-primary-700 shadow-card">
        {/* Logo */}
        <div className="p-6 border-b border-primary-100 dark:border-primary-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-primary-800 dark:text-ivory-100">
                Academic Hub
              </h1>
              <p className="text-xs text-primary-400">贞德·达尔克</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Public links */}
          {publicItems.map(item => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="my-2 border-t border-primary-100 dark:border-primary-700" />

          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={navLinkClass}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="my-4 border-t border-primary-100 dark:border-primary-700" />
              {adminItems.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-primary-100 dark:border-primary-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent-400 flex items-center justify-center text-white text-sm font-semibold">
              {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName || user?.username || 'User'}</p>
              <p className="text-xs text-primary-400">{user?.role === 'admin' ? '管理员' : '研究者'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cycleTheme} className="p-2 rounded-md hover:bg-primary-50 dark:hover:bg-primary-700 transition-colors" title="切换主题">
              <ThemeIcon className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-md hover:bg-error/10 text-primary-500 hover:text-error transition-colors" title="退出登录">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-primary-800/90 backdrop-blur-md border-b border-primary-100 dark:border-primary-700">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary-500" />
            <span className="font-display font-semibold">Academic Hub</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-[17.5rem] h-full bg-white dark:bg-primary-800 p-4 shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {publicItems.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="my-2 border-t border-primary-100 dark:border-primary-700" />
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {user?.role === 'admin' && (
                <>
                  <div className="my-4 border-t border-primary-100 dark:border-primary-700" />
                  {adminItems.map(item => (
                    <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Main content — offset by sidebar width on desktop */}
      <main className="flex-1 lg:ml-64 mt-14 lg:mt-0 flex flex-col">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-4 lg:p-8 max-w-7xl mx-auto flex-1"
        >
          <Outlet />
        </motion.div>
        <SiteFooter />
      </main>
    </div>
  );
}
