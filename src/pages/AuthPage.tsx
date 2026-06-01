// ========================================
// AuthPage — 管理员登录页面
// ========================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Eye, EyeOff, ArrowRight, LogIn, XCircle, Lock } from 'lucide-react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';
import { useSettingsStore } from '@/store/userStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated (parse Zustand persist format correctly)
  useEffect(() => {
    const raw = localStorage.getItem('joan_auth_token');
    if (!raw) return;
    let token: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      token = parsed?.state?.token || null;
    } catch {
      token = raw;
    }
    if (token) navigate('/gallery', { replace: true });
  }, [navigate]);

  // Login state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const res = await authService.login(loginForm.username, loginForm.password);
      if (res.success && res.data) {
        useAuthStore.getState().setToken(res.data.token);
        useAuthStore.getState().setUser(res.data.user);

        // Pull cloud-synced settings (external tools, AI models, etc.)
        try {
          const settingsRes = await api.getSettings();
          if (settingsRes.success && settingsRes.data) {
            useSettingsStore.getState().loadFromBackend(settingsRes.data as any);
          }
        } catch {
          // Non-critical: fall back to localStorage defaults
        }

        navigate('/gallery', { replace: true });
      } else {
        setLoginError(res.error || '登录失败');
      }
    } catch (err: any) {
      setLoginError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory-100 dark:bg-primary-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 shadow-glow mb-4"
          >
            <Scale className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-primary-800 dark:text-ivory-100">
            Joan's Academic Hub
          </h1>
          <p className="text-sm text-primary-400 mt-1">贞德·达尔克学术专属空间</p>
        </div>

        <Card className="border-primary-200 dark:border-primary-700">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 text-primary-500 mb-2">
              <Lock className="w-5 h-5" />
              <span className="text-sm font-medium">管理员登录</span>
            </div>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="text-center mb-2">
                <CardTitle className="text-xl">欢迎回来</CardTitle>
                <CardDescription>登录以继续您的学术研究</CardDescription>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4 shrink-0" />
                  {loginError}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="login-username">用户名</Label>
                <Input
                  id="login-username"
                  placeholder="请输入用户名"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">密码</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    登录
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              <div className="text-center">
                <p className="text-xs text-primary-400">
                  管理员账户: admin / 123456
                </p>
              </div>
            </CardContent>
          </form>
        </Card>

        <p className="text-center text-xs text-primary-400 mt-6">
          以圣洁纯粹之心，行理性严谨之事
        </p>
      </motion.div>
    </div>
  );
}
