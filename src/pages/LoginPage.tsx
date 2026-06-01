import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scale, Eye, EyeOff, ArrowRight, LogIn } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/userStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [justLoggedIn, setJustLoggedIn] = useState(false)

  // 已登录 → 跳转首页
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await api.login(username, password)
      if (res.success && res.data) {
        useAuthStore.getState().setUser(res.data.user)
        useAuthStore.getState().setToken(res.data.token)

        // Pull cloud-synced settings (external tools, AI models, etc.)
        try {
          const settingsRes = await api.getSettings();
          if (settingsRes.success && settingsRes.data) {
            useSettingsStore.getState().loadFromBackend(settingsRes.data as any);
          }
        } catch {
          // Non-critical: fall back to localStorage defaults
        }

        setJustLoggedIn(true)
      } else {
        // TypeScript无法自动收窄ApiResponse联合类型，使用'in'检查错误属性
        setError('error' in res && res.error ? res.error : '登录失败')
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  // 登录中或已登录则不渲染表单
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ivory-100 dark:bg-primary-900">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-primary-500 font-serif">贞德正在为您准备...</p>
        </div>
      </div>
    )
  }

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
          <CardHeader className="text-center">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" />
              欢迎回来
            </CardTitle>
            <CardDescription>
              登录以继续您的学术研究
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-md bg-error/10 text-error text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    登录
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              <div className="text-center">
                <p className="text-xs text-primary-400">
                  默认账户: admin / 123456
                </p>
              </div>
            </CardContent>
          </form>
        </Card>

        <p className="text-center text-xs text-primary-400 mt-6">
          ⚖️ 以圣洁纯粹之心，行理性严谨之事
        </p>
      </motion.div>
    </div>
  )
}
