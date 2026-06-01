// ========================================
// SettingsPage — 用户设置 (已迁移到 API + Zustand)
// ========================================
import { useState, useEffect } from 'react';
import {
  User, Palette, Quote, Bell, Shield, Info, Moon, Sun, Monitor,
  RotateCcw, Plug, BookOpen, Github, Activity, Bug,
  Sparkles, Plus, Trash2, Check, X, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnimatedPage from '@/components/shared/AnimatedPage';
import { useAuthStore } from '@/store';
import { useSettingsStore } from '@/store';
import { useThemeStore } from '@/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ThemeMode, CitationFormat, UserSettings, AIModelConfig } from '@/types';

function SettingsContent() {
  const user = useAuthStore((s) => s.user);
  const { mode, setMode } = useThemeStore();
  const settings = useSettingsStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [institution, setInstitution] = useState(user?.institution || '');
  const [researchField, setResearchField] = useState(user?.researchField || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingExternalTools, setSavingExternalTools] = useState(false);

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // AI Model management
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState<Partial<AIModelConfig>>({ provider: 'custom', baseUrl: '', apiKey: '', model: '', name: '' });

  const modelPresets = [
    { name: 'Kimi v1-8k', provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { name: 'Kimi v1-32k', provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k' },
    { name: 'Kimi v1-128k', provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-128k' },
    { name: 'DeepSeek Chat', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { name: 'DeepSeek Reasoner', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-reasoner' },
    { name: 'Doubao Seed 2.0 Pro', provider: 'doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2-0-pro-260215' },
    { name: 'Doubao Pro', provider: 'doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k-241215' },
    { name: 'Claude 3.5 Sonnet', provider: 'claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
    { name: 'OpenAI GPT-4o', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    { name: 'OpenAI GPT-4o-mini', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { name: 'newcli Claude', provider: 'claude', baseUrl: 'https://code.newcli.com/claude/v1', model: 'claude-opus-4-7' },
    { name: '自定义', provider: 'custom', baseUrl: '', model: '' },
  ];

  const themeOptions: { value: ThemeMode; label: string; icon: React.ElementType; desc: string }[] = [
    { value: 'light', label: '浅色', icon: Sun, desc: '明亮的象牙白主题' },
    { value: 'dark', label: '深色', icon: Moon, desc: '深邃的墨蓝色主题' },
    { value: 'system', label: '跟随系统', icon: Monitor, desc: '自动适配系统设置' },
  ];

  const citationOptions: { value: CitationFormat; label: string; desc: string }[] = [
    { value: 'bibtex', label: 'BibTeX', desc: '计算机科学常用' },
    { value: 'ieee', label: 'IEEE', desc: '工程与技术领域' },
    { value: 'gb7714', label: 'GB/T 7714-2015', desc: '中国国家标准' },
  ];

  // Sync local state with store user
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setInstitution(user.institution || '');
      setResearchField(user.researchField || '');
    }
  }, [user]);

  // Save profile to API
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateSettings({
        theme: mode,
        citationFormat: settings.citationFormat,
        notifications: settings.notifications,
      } as Partial<UserSettings>);
      toast.success('个人资料已保存');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save password to API
  const savePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('请填写当前密码和新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('新密码不能与当前密码相同');
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('密码已修改，请牢记新密码');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Reset visibility toggles
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      const message = err?.message || err?.error || '密码修改失败，请检查当前密码是否正确';
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  // Save external tools to API (enables cross-device sync)
  const saveExternalTools = async () => {
    setSavingExternalTools(true);
    try {
      await api.updateSettings({
        theme: mode,
        zoteroUserId: settings.zoteroUserId,
        zoteroApiKey: settings.zoteroApiKey,
        semanticScholarApiKey: settings.semanticScholarApiKey,
        githubToken: settings.githubToken,
        githubUsername: settings.githubUsername,
        imaApiKey: settings.imaApiKey,
        imaEndpoint: settings.imaEndpoint,
        crawlabEndpoint: settings.crawlabEndpoint,
        crawlabToken: settings.crawlabToken,
        aiModels: settings.aiModels,
        defaultAiModelId: settings.defaultAiModelId,
      } as any);
      toast.success('外部工具配置已保存到云端，其他设备登录后自动同步');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSavingExternalTools(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设置</h1>
          <p className="text-sm text-muted-foreground">管理个人偏好与账户设置</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="h-3.5 w-3.5" />
              个人资料
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              外观
            </TabsTrigger>
            <TabsTrigger value="citations" className="gap-1.5">
              <Quote className="h-3.5 w-3.5" />
              引用格式
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              通知
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              外部工具
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5">
              <Info className="h-3.5 w-3.5" />
              关于
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">个人信息</CardTitle>
                <CardDescription>管理你的公开资料信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                    {(displayName || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{displayName || '未设置'}</p>
                    <p className="text-sm text-muted-foreground">@{user?.username}</p>
                    <Badge variant="secondary" className="mt-1">
                      {user?.role === 'admin' ? '管理员' : '研究者'}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>用户名</Label>
                    <Input defaultValue={user?.username || ''} disabled className="mt-1.5" />
                    <p className="text-[11px] text-muted-foreground mt-1">用户名不可修改</p>
                  </div>
                  <div>
                    <Label>显示名称</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>所属机构</Label>
                    <Input
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="如：清华大学"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>研究领域</Label>
                    <Input
                      value={researchField}
                      onChange={(e) => setResearchField(e.target.value)}
                      placeholder="如：图神经网络"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  安全设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>当前密码</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="输入当前密码"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      tabIndex={-1}
                      aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>新密码</Label>
                    <div className="relative mt-1.5">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="输入新密码（至少6位）"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                        aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>确认新密码</Label>
                    <div className="relative mt-1.5">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="再次输入新密码"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={savePassword}
                    disabled={savingPassword}
                  >
                    {savingPassword ? '修改中...' : '更新密码'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">主题设置</CardTitle>
                <CardDescription>选择你偏好的视觉主题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-3 rounded-lg border-2 p-5 transition-all',
                        mode === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:border-primary/30'
                      )}
                    >
                      <div
                        className={cn(
                          'h-12 w-12 rounded-full flex items-center justify-center',
                          mode === opt.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                      {mode === opt.value && (
                        <Badge variant="default" className="text-[10px]">
                          当前
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Citations Tab */}
          <TabsContent value="citations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">默认引用格式</CardTitle>
                <CardDescription>
                  设置文献详情页复制引用时的默认格式
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {citationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => settings.setCitationFormat(opt.value)}
                      className={cn(
                        'flex items-center gap-4 rounded-lg border-2 p-4 transition-all w-full text-left',
                        settings.citationFormat === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:border-primary/30'
                      )}
                    >
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full shrink-0',
                          settings.citationFormat === opt.value
                            ? 'bg-primary ring-2 ring-primary/30'
                            : 'bg-muted-foreground/30'
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">通知偏好</CardTitle>
                <CardDescription>选择你希望接收的通知类型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    key: 'newPapers' as const,
                    label: '新论文推荐',
                    desc: '当有与你研究兴趣相关的论文发布时通知',
                  },
                  {
                    key: 'readingReminders' as const,
                    label: '阅读提醒',
                    desc: '每日阅读提醒，帮助你保持阅读习惯',
                  },
                  {
                    key: 'projectUpdates' as const,
                    label: '项目动态',
                    desc: '研究项目有新更新时通知',
                  },
                  {
                    key: 'pointsChange' as const,
                    label: '积分变化',
                    desc: '学术积分增减时通知',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings.notifications[item.key] ?? true}
                      onCheckedChange={(v) => settings.setNotification(item.key, v)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="mt-4 space-y-4">
            {/* Zotero */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Zotero 配置
                </CardTitle>
                <CardDescription>
                  配置 Zotero 账户信息后，可在导入导出页面直接从 Zotero 库导入文献。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="zotero-user-id">Zotero User ID</Label>
                  <Input
                    id="zotero-user-id"
                    value={settings.zoteroUserId}
                    onChange={(e) => settings.setZoteroConfig(e.target.value, settings.zoteroApiKey)}
                    placeholder="如: 12345678"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    在 <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Zotero 设置 → Feeds/API</a> 页面可找到 User ID
                  </p>
                </div>
                <div>
                  <Label htmlFor="zotero-api-key">Zotero API Key</Label>
                  <Input
                    id="zotero-api-key"
                    type="password"
                    value={settings.zoteroApiKey}
                    onChange={(e) => settings.setZoteroConfig(settings.zoteroUserId, e.target.value)}
                    placeholder="输入你的 Zotero 只读 API Key"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    在 <a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">创建新 Key</a> 页面生成，仅需「个人库 - 只读访问」权限
                  </p>
                </div>
                {(settings.zoteroUserId || settings.zoteroApiKey) && (
                  <Button variant="outline" size="sm" onClick={() => settings.setZoteroConfig('', '')}>清除配置</Button>
                )}
              </CardContent>
            </Card>

            {/* Semantic Scholar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Semantic Scholar API
                </CardTitle>
                <CardDescription>
                  配置 API Key 后可提高搜索速率限制，避免 429 错误。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ss-api-key">API Key</Label>
                  <Input
                    id="ss-api-key"
                    type="password"
                    value={settings.semanticScholarApiKey}
                    onChange={(e) => settings.setExternalApiConfig({ semanticScholarApiKey: e.target.value })}
                    placeholder="输入你的 Semantic Scholar API Key"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    在 <a href="https://www.semanticscholar.org/product/api#api-key-form" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Scholar API</a> 页面免费申请
                  </p>
                </div>
                {settings.semanticScholarApiKey && (
                  <Button variant="outline" size="sm" onClick={() => settings.setExternalApiConfig({ semanticScholarApiKey: '' })}>清除配置</Button>
                )}
              </CardContent>
            </Card>

            {/* GitHub */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </CardTitle>
                <CardDescription>
                  配置 Personal Access Token 后可同步 GitHub 项目与仓库信息。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="github-username">用户名</Label>
                  <Input
                    id="github-username"
                    value={settings.githubUsername}
                    onChange={(e) => settings.setExternalApiConfig({ githubUsername: e.target.value })}
                    placeholder="如: octocat"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="github-token">Personal Access Token</Label>
                  <Input
                    id="github-token"
                    type="password"
                    value={settings.githubToken}
                    onChange={(e) => settings.setExternalApiConfig({ githubToken: e.target.value })}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    在 <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub Settings → Developer settings → Personal access tokens</a> 生成
                  </p>
                </div>
                {(settings.githubUsername || settings.githubToken) && (
                  <Button variant="outline" size="sm" onClick={() => settings.setExternalApiConfig({ githubUsername: '', githubToken: '' })}>清除配置</Button>
                )}
              </CardContent>
            </Card>

            {/* IMA */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  IMA (Intelligent Medical Assistant)
                </CardTitle>
                <CardDescription>
                  配置 IMA 服务端点后，可与智能医学助手进行数据交互。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ima-endpoint">服务端点</Label>
                  <Input
                    id="ima-endpoint"
                    value={settings.imaEndpoint}
                    onChange={(e) => settings.setExternalApiConfig({ imaEndpoint: e.target.value })}
                    placeholder="如: https://ima.example.com/api"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="ima-api-key">API Key</Label>
                  <Input
                    id="ima-api-key"
                    type="password"
                    value={settings.imaApiKey}
                    onChange={(e) => settings.setExternalApiConfig({ imaApiKey: e.target.value })}
                    placeholder="输入你的 IMA API Key"
                    className="mt-1.5"
                  />
                </div>
                {(settings.imaEndpoint || settings.imaApiKey) && (
                  <Button variant="outline" size="sm" onClick={() => settings.setExternalApiConfig({ imaEndpoint: '', imaApiKey: '' })}>清除配置</Button>
                )}
              </CardContent>
            </Card>

            {/* Crawlab 爬虫控制 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Crawlab 爬虫控制
                </CardTitle>
                <CardDescription>
                  配置 Crawlab 服务端点与 Token，用于远程管理和监控爬虫任务。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="crawlab-endpoint">服务端点</Label>
                  <Input
                    id="crawlab-endpoint"
                    value={settings.crawlabEndpoint}
                    onChange={(e) => settings.setExternalApiConfig({ crawlabEndpoint: e.target.value })}
                    placeholder="如: https://crawlab.example.com/api"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="crawlab-token">Access Token</Label>
                  <Input
                    id="crawlab-token"
                    type="password"
                    value={settings.crawlabToken}
                    onChange={(e) => settings.setExternalApiConfig({ crawlabToken: e.target.value })}
                    placeholder="输入你的 Crawlab Access Token"
                    className="mt-1.5"
                  />
                </div>
                {(settings.crawlabEndpoint || settings.crawlabToken) && (
                  <Button variant="outline" size="sm" onClick={() => settings.setExternalApiConfig({ crawlabEndpoint: '', crawlabToken: '' })}>清除配置</Button>
                )}
              </CardContent>
            </Card>

            {/* AI 模型管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI 模型配置
                </CardTitle>
                <CardDescription>
                  配置多个 AI 模型（Kimi、DeepSeek、Doubao、Claude、OpenAI 等），用于 AI 对话和文献智能解析
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model List */}
                <div className="space-y-2">
                  {settings.aiModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">尚未配置任何 AI 模型</p>
                  ) : (
                    settings.aiModels.map((model) => (
                      <div
                        key={model.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all',
                          model.id === settings.defaultAiModelId
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{model.name}</p>
                            {model.id === settings.defaultAiModelId && (
                              <Badge variant="default" className="text-[10px]">默认</Badge>
                            )}
                            {model.apiKey ? (
                              <Badge variant="secondary" className="text-[10px]">已配置</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">未配置 Key</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {model.provider} · {model.model}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {model.id !== settings.defaultAiModelId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => { settings.setDefaultAiModel(model.id); toast.success(`「${model.name}」已设为默认模型`); }}
                            >
                              设为默认
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm(`确定删除模型「${model.name}」吗？`)) {
                                settings.removeAiModel(model.id);
                                toast.success('模型已删除');
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Model Button */}
                {!showAddModel ? (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddModel(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    添加模型
                  </Button>
                ) : (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">添加新模型</p>
                    <div>
                      <Label className="text-xs">选择预设</Label>
                      <select
                        value={`${newModel.provider}|${newModel.model}`}
                        onChange={(e) => {
                          const [provider, model] = e.target.value.split('|');
                          const preset = modelPresets.find(p => p.provider === provider && p.model === model);
                          if (preset) {
                            setNewModel({
                              ...newModel,
                              name: preset.name,
                              provider: preset.provider,
                              baseUrl: preset.baseUrl,
                              model: preset.model,
                            });
                          }
                        }}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="|">-- 选择预设模板 --</option>
                        {modelPresets.map((p) => (
                          <option key={`${p.provider}|${p.model}`} value={`${p.provider}|${p.model}`}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">显示名称</Label>
                        <Input
                          value={newModel.name || ''}
                          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                          placeholder="如: Kimi v1-8k"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">提供商</Label>
                        <Input
                          value={newModel.provider || ''}
                          onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                          placeholder="如: kimi"
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">API 地址</Label>
                        <Input
                          value={newModel.baseUrl || ''}
                          onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })}
                          placeholder="如: https://api.moonshot.cn/v1"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">模型 ID</Label>
                        <Input
                          value={newModel.model || ''}
                          onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
                          placeholder="如: moonshot-v1-8k"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">API Key</Label>
                        <Input
                          type="password"
                          value={newModel.apiKey || ''}
                          onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                          placeholder="sk-xxxxxxxx"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setShowAddModel(false); setNewModel({ provider: 'custom', baseUrl: '', apiKey: '', model: '', name: '' }); }}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!newModel.name || !newModel.baseUrl || !newModel.model) {
                            toast.error('请填写名称、API 地址和模型 ID');
                            return;
                          }
                          const id = `model-${Date.now()}`;
                          settings.addAiModel({
                            id,
                            name: newModel.name,
                            provider: newModel.provider || 'custom',
                            baseUrl: newModel.baseUrl,
                            apiKey: newModel.apiKey || '',
                            model: newModel.model,
                          });
                          if (!settings.defaultAiModelId) {
                            settings.setDefaultAiModel(id);
                          }
                          toast.success(`模型「${newModel.name}」已添加`);
                          setShowAddModel(false);
                          setNewModel({ provider: 'custom', baseUrl: '', apiKey: '', model: '', name: '' });
                        }}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        添加
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save External Tools to Cloud */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">同步到云端</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  将外部工具配置（API Keys、AI 模型等）保存到云端，其他设备登录后自动同步
                </p>
              </div>
              <Button
                onClick={saveExternalTools}
                disabled={savingExternalTools}
                size="sm"
              >
                {savingExternalTools ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-2xl">&#9878;</span>
                  Joan&apos;s Academic Hub
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    <span className="text-3xl">&#9878;</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">Joan&apos;s Academic Hub</h3>
                  <p className="text-sm text-muted-foreground mt-1">v2.0.0</p>
                  <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                    以圣洁纯粹之心，行理性严谨之事。学术文献管理平台，为研究者的求知之路执灯。
                  </p>
                </div>
                <Separator />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>前端</span>
                    <span className="font-mono text-xs">React 19 + TypeScript + Vite</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UI 框架</span>
                    <span className="font-mono text-xs">Tailwind CSS + shadcn/ui</span>
                  </div>
                  <div className="flex justify-between">
                    <span>后端</span>
                    <span className="font-mono text-xs">EdgeOne Cloud Functions</span>
                  </div>
                  <div className="flex justify-between">
                    <span>存储</span>
                    <span className="font-mono text-xs">EdgeOne KV</span>
                  </div>
                  <div className="flex justify-between">
                    <span>部署</span>
                    <span className="font-mono text-xs">EdgeOne Pages</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">重置设置</CardTitle>
                <CardDescription>将所有设置恢复为默认值</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="gap-2 text-error hover:bg-error/10 hover:text-error"
                  onClick={() => {
                    settings.resetSettings();
                    setMode('system');
                    toast.success('设置已重置为默认值');
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  重置所有设置
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AnimatedPage>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
