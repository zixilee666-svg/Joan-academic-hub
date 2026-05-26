// ========================================
// AIChatPage — AI 学术对话助手 (增强版)
// 功能：输入框自动增高、代码块复制、消息动画
// ========================================
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Trash2, Plus, Scale,
  MessageSquare, User, BookOpen,
  Copy, CheckCheck, RefreshCw, Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import AnimatedPage from '@/components/shared/AnimatedPage';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store';
import type { AIMessage, AIConversation } from '@/types';

const QUICK_PROMPTS = [
  '帮我梳理 GCN 的核心数学推导',
  '解释元路径（Meta-Path）在异质图中的作用',
  '如何在图数据上处理类别不平衡问题',
  '推荐几篇 HGNN 在欺诈检测中的应用论文',
];

// ---- 代码块复制按钮 ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('代码已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
      title="复制代码"
    >
      {copied ? (
        <CheckCheck className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

export default function AIChatPage() {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [loadingConv, setLoadingConv] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 持久化 ref：跟踪最新 state 用于 save 时读取
  const messagesRef = useRef<AIMessage[]>([]);
  const conversationsRef = useRef<AIConversation[]>([]);

  // 输入框自动增高
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 同步 ref（用于延迟保存时读取最新状态）
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // 持久化当前对话到 KV
  const persistCurrentConv = useCallback((convId: string) => {
    setTimeout(() => {
      try {
        const conv = conversationsRef.current.find(c => c.id === convId);
        if (!conv || messagesRef.current.length === 0) return;
        const payload = {
          ...conv,
          messages: messagesRef.current,
          updatedAt: new Date().toISOString(),
        };
        const bodySize = JSON.stringify(payload).length;
        console.log(`[AIChat] Saving conv ${convId}: ${messagesRef.current.length} msgs, ${bodySize} bytes`);
        api.saveConversation(convId, payload).catch(e => console.error('[AIChat] Save failed:', e));
      } catch (e) {
        console.error('[AIChat] Persist error:', e);
      }
    }, 200); // 等 React 批量更新完成
  }, []);

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await api.getConversations();
        if (res.success && res.data && res.data.length > 0) {
          setConversations(res.data);
          const latest = res.data[0];
          setActiveConvId(latest.id);
          const visibleMessages = (latest.messages || []).filter((m: AIMessage) => m.role !== 'system');
          setMessages(visibleMessages);
          setShowQuickPrompts(visibleMessages.length === 0);
        }
      } catch {
        // No conversations yet
      } finally {
        setLoadingConv(false);
      }
    };
    loadConversations();
  }, []);

  // Create new conversation
  const createConversation = () => {
    const newConv: AIConversation = {
      id: 'conv-' + Date.now(),
      userId: 'current',
      title: '新的学术对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setMessages([]);
    setShowQuickPrompts(true);
  };

  // Send message
  const sendMessage = async (text?: string) => {
    const textToSend = (text || input).trim();
    if (!textToSend || isLoading) return;

    const settings = useSettingsStore.getState();
    const defaultModel = settings.aiModels.find(m => m.id === settings.defaultAiModelId);
    if (!defaultModel || !defaultModel.apiKey) {
      toast.error('请先前往「设置 → 外部工具 → AI 模型配置」添加并选择默认模型');
      return;
    }

    const userMsg: AIMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowQuickPrompts(false);

    try {
      // If no active conversation, create one first
      let convId = activeConvId;
      if (!convId) {
        const newConv: AIConversation = {
          id: 'conv-' + Date.now(),
          userId: 'current',
          title: textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : ''),
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        convId = newConv.id;
      }

      const defaultModel = settings.aiModels.find(m => m.id === settings.defaultAiModelId);
      if (!defaultModel || !defaultModel.apiKey) {
        toast.error('请先前往「设置 → 外部工具 → AI 模型」配置并选择默认模型');
        setIsLoading(false);
        return;
      }

      // Call API (mock or real)
      const response = await api.aiChat(convId, textToSend, undefined, defaultModel);

      // Check if response is SSE stream
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/event-stream') && response.body && typeof response.body.getReader === 'function') {
        // SSE streaming mode
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiContent = '';
        const aiMsgId = 'ai-' + Date.now();

        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        }]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]') break;
                try {
                  const data = JSON.parse(jsonStr);
                  // 兼容两种 SSE 格式：
                  // 1. {content: "..."} (旧格式 / 自定义格式)
                  // 2. {choices: [{delta: {content: "..."}}]} (OpenAI / DeepSeek 格式)
                  const content = data.content || data.choices?.[0]?.delta?.content;
                  if (content) {
                    aiContent += content;
                    setMessages(prev =>
                      prev.map(m => m.id === aiMsgId ? { ...m, content: aiContent } : m)
                    );
                  }
                } catch { /* ignore SSE parse errors */ }
              }
            }
          }
        } catch { /* stream error */ }

        // 流式完成后：同步 conversations 状态 + 持久化 KV
        const aiMsg: AIMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: aiContent || '贞德正在思考中...',
          timestamp: new Date().toISOString(),
        };
        if (convId) {
          setConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            return {
              ...c,
              messages: [...c.messages, userMsg, aiMsg],
              title: c.title === '新的学术对话'
                ? textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : '')
                : c.title,
              updatedAt: new Date().toISOString(),
            };
          }));
          persistCurrentConv(convId);
        }
      } else {
        // JSON response (mock mode or fallback)
        const data = await response.json();
        let replyContent = data?.data?.reply || data?.reply || '';
        if (!replyContent && data?.error) {
          replyContent = '⚠️ ' + data.error;
        }
        if (!replyContent) {
          replyContent = '贞德正在思考中...';
        }
        const aiMsg: AIMessage = {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);

        // Update conversation title if it's the first message
        if (convId) {
          setConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            return {
              ...c,
              messages: [...c.messages, userMsg, aiMsg],
              title: c.title === '新的学术对话'
                ? textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : '')
                : c.title,
              updatedAt: new Date().toISOString(),
            };
          }));
          persistCurrentConv(convId);
        }
      }
    } catch (err) {
      console.error('[AIChat] Error:', err);
      setMessages(prev => [...prev, {
        id: 'ai-error-' + Date.now(),
        role: 'assistant',
        content: '抱歉，请求出现问题。请检查网络连接后重试。',
        timestamp: new Date().toISOString(),
      }]);
      toast.error('AI 对话请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete conversation
  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveConvId(remaining[0]?.id || null);
      setMessages(remaining[0] ? (remaining[0].messages || []).filter((m: AIMessage) => m.role !== 'system') : []);
      setShowQuickPrompts(true);
    }
    // 同步删除 KV 中的对话
    api.deleteConversationRemote(id).catch(e => console.error('[AIChat] Delete failed:', e));
    toast.success('对话已删除');
  };

  // Copy message
  const copyMessage = (msg: AIMessage) => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Clear current chat
  const clearChat = () => {
    setMessages([]);
    setShowQuickPrompts(true);
    toast.success('对话已清空');
  };

  // Switch conversation
  const switchConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    setActiveConvId(id);
    if (conv) {
      setMessages((conv.messages || []).filter(m => m.role !== 'system'));
      setShowQuickPrompts((conv.messages || []).length <= 1);
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loadingConv) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
          <div className="text-center">
            <Scale className="h-8 w-8 text-primary animate-pulse mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">加载对话...</p>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  // Render markdown-like content
  const renderContent = (content: string, role: string) => {
    return content.split('\n').map((line, li) => {
      const isMath = line.includes('$') || line.includes('\\');
      if (isMath) {
        return (
          <pre key={li} className={cn('text-xs overflow-x-auto my-1', role === 'user' ? 'text-white/90' : 'text-foreground')}>
            {line.replace(/\$\$/g, '')}
          </pre>
        );
      }
      if (line.startsWith('## ')) return <h3 key={li} className={cn('text-sm font-bold mt-2 mb-1', role === 'user' ? 'text-white' : '')}>{line.slice(3)}</h3>;
      if (line.startsWith('### ')) return <h4 key={li} className={cn('text-xs font-semibold mt-1', role === 'user' ? 'text-white' : '')}>{line.slice(4)}</h4>;
      if (line.startsWith('- ')) return <li key={li} className={cn('text-sm my-0.5', role === 'user' ? 'text-white/90' : '')}>{line.slice(2)}</li>;
      if (line.startsWith('| ')) return <p key={li} className={cn('text-xs font-mono my-0.5', role === 'user' ? 'text-white/90' : '')}>{line}</p>;
      if (line.startsWith('**') && line.endsWith('**')) return <strong key={li} className={role === 'user' ? 'text-white' : ''}>{line.slice(2, -2)}</strong>;
      if (line === '---') return <hr key={li} className="my-2 border-border/50" />;
      if (line.trim() === '') return <br key={li} />;
      return <p key={li} className={cn('text-sm my-0.5', role === 'user' ? 'text-white/90' : '')}>{line}</p>;
    });
  };

  return (
    <AnimatedPage>
      <div className="flex gap-0 h-[calc(100vh-9rem)] rounded-xl overflow-hidden border bg-card">
        {/* Left: Conversation List */}
        <aside className="w-64 shrink-0 border-r bg-muted/30 hidden lg:flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="font-serif font-semibold text-sm">学术助手</span>
            </div>
            <Button size="sm" variant="ghost" onClick={createConversation} className="gap-1 p-1.5">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  点击 + 创建新对话
                </p>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => switchConversation(conv.id)}
                    className={cn(
                      'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-all cursor-pointer group',
                      conv.id === activeConvId ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted'
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', conv.id === activeConvId && 'text-primary')}>
                        {conv.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {(conv.messages || []).length} 条消息
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium">贞德·达尔克</p>
                <p className="text-[10px] text-muted-foreground">学术裁定者</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {activeConvId ? (conversations.find(c => c.id === activeConvId)?.title || '新对话') : '贞德学术助手'}
              </span>
              {!isLoading && messages.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{messages.length} 条消息</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearChat} className="gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" />
                  清空
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 py-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Scale className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-serif font-bold mb-2">贞德·达尔克</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  吾乃贞德，学术之路的守护者。无论 GNN 推导、文献综述还是实验设计，吾都将与主人同行。
                </p>
                {showQuickPrompts && (
                  <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        className="text-left px-4 py-2.5 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i === messages.length - 1 ? 0 : 0 }}
                  className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
                    msg.role === 'user' ? 'bg-accent-400 text-white' : 'bg-primary/10 text-primary'
                  )}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                  </div>

                  <div className={cn('flex-1 min-w-0', msg.role === 'user' && 'flex justify-end')}>
                    <div className={cn(
                      'inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]',
                      msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-muted rounded-tl-sm'
                    )}>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {renderContent(msg.content, msg.role)}
                      </div>
                    </div>
                    <div className={cn('flex items-center gap-2 mt-1', msg.role === 'user' ? 'justify-end' : '')}>
                      <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                      {msg.role === 'assistant' && (
                        <button onClick={() => copyMessage(msg)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copiedId === msg.id ? <CheckCheck className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-primary/10 text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-card/50 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="向贞德提问..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-40 overflow-y-auto"
                  style={{ minHeight: '48px', maxHeight: '160px' }}
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  size="default"
                  className="shrink-0 gap-2"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                按 Enter 发送，Shift + Enter 换行。贞德将尽力提供准确的学术回答。
              </p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
