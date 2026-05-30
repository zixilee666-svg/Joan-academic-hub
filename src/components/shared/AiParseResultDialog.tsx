// ========================================
// AiParseResultDialog — AI 解析结果预览与编辑
// ========================================
import { useState, useEffect } from 'react';
import {
  Sparkles, Save, X, Plus, Trash2, BookOpen,
  Quote, FileText, Users, Calendar, Hash, Link,
  Tag, AlignLeft, ChevronDown,   ChevronUp,
  Lightbulb, AlertTriangle, CheckCircle, Microscope,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ParsedPaperResult {
  title: string;
  authors: string[];
  year: number | null;
  month: number | null;
  venue: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  abstract: string;
  keywords: string[];
  sourceType: string;
  citationCount: number | null;
  researchMethod: string;
  mainContribution: string;
  limitations: string;
  conclusion: string;
  citations: {
    bibtex: string;
    ieee: string;
    gb7714: string;
  };
  references: { title: string; authors: string[]; year: number; venue: string }[];
}

interface AiParseResultDialogProps {
  open: boolean;
  result: ParsedPaperResult | null;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (data: ParsedPaperResult) => void;
}

export default function AiParseResultDialog({
  open,
  result,
  onOpenChange,
  onConfirm,
}: AiParseResultDialogProps) {
  const [form, setForm] = useState<ParsedPaperResult>({
    title: '', authors: [], year: null, month: null,
    venue: '', volume: '', issue: '', pages: '', doi: '', url: '',
    abstract: '', keywords: [],
    sourceType: '', citationCount: null,
    researchMethod: '', mainContribution: '', limitations: '', conclusion: '',
    citations: { bibtex: '', ieee: '', gb7714: '' },
    references: [],
  });
  const [showCitations, setShowCitations] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showAbstract, setShowAbstract] = useState(false);
  const [newAuthor, setNewAuthor] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    if (result && open) {
      setForm({ ...result });
    }
  }, [result, open]);

  const updateField = <K extends keyof ParsedPaperResult>(
    field: K,
    value: ParsedPaperResult[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addAuthor = () => {
    if (newAuthor.trim()) {
      updateField('authors', [...form.authors, newAuthor.trim()]);
      setNewAuthor('');
    }
  };

  const removeAuthor = (idx: number) => {
    updateField('authors', form.authors.filter((_, i) => i !== idx));
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      updateField('keywords', [...form.keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (idx: number) => {
    updateField('keywords', form.keywords.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (!form.title.trim()) {
      toast.error('标题不能为空');
      return;
    }
    onConfirm?.(form);
    onOpenChange(false);
  };

  if (!result) return null;

  const hasCitations = form.citations.bibtex || form.citations.ieee || form.citations.gb7714;
  const hasReferences = form.references.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 解析结果 — 请确认并编辑
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-6 pb-2">
          <div className="space-y-5">
            {/* Title */}
            <div>
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <FileText className="h-3.5 w-3.5" />
                标题
              </Label>
              <Input
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                className="mt-1.5"
                placeholder="文献标题"
              />
            </div>

            {/* Authors */}
            <div>
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Users className="h-3.5 w-3.5" />
                作者
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {form.authors.map((author, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {author}
                    <button
                      onClick={() => removeAuthor(idx)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAuthor()}
                    placeholder="添加作者"
                    className="h-7 w-32 text-xs"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addAuthor}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Year / Month / Venue / SourceType */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Calendar className="h-3.5 w-3.5" />
                  年份
                </Label>
                <Input
                  type="number"
                  value={form.year ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    updateField('year', v ? Number(v) : null);
                  }}
                  placeholder="如 2024"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  月份
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.month ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    updateField('month', v ? Number(v) : null);
                  }}
                  placeholder="1-12"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <BookOpen className="h-3.5 w-3.5" />
                  期刊/会议
                </Label>
                <Input
                  value={form.venue}
                  onChange={e => updateField('venue', e.target.value)}
                  className="mt-1.5"
                  placeholder="期刊或会议名称"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <BarChart3 className="h-3.5 w-3.5" />
                  类型
                </Label>
                <Input
                  value={form.sourceType}
                  onChange={e => updateField('sourceType', e.target.value)}
                  className="mt-1.5"
                  placeholder="journal/conference"
                />
              </div>
            </div>

            {/* Volume / Issue / Pages / DOI / URL / CitationCount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  卷号
                </Label>
                <Input
                  value={form.volume}
                  onChange={e => updateField('volume', e.target.value)}
                  className="mt-1.5"
                  placeholder="42"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  期号
                </Label>
                <Input
                  value={form.issue}
                  onChange={e => updateField('issue', e.target.value)}
                  className="mt-1.5"
                  placeholder="3"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  页码
                </Label>
                <Input
                  value={form.pages}
                  onChange={e => updateField('pages', e.target.value)}
                  className="mt-1.5"
                  placeholder="123-145"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Hash className="h-3.5 w-3.5" />
                  DOI
                </Label>
                <Input
                  value={form.doi}
                  onChange={e => updateField('doi', e.target.value)}
                  className="mt-1.5"
                  placeholder="10.xxxx/xxxx"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <BarChart3 className="h-3.5 w-3.5" />
                  引用次数
                </Label>
                <Input
                  type="number"
                  value={form.citationCount ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    updateField('citationCount', v ? Number(v) : null);
                  }}
                  className="mt-1.5"
                  placeholder="如 128"
                />
              </div>
              <div className="col-span-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Link className="h-3.5 w-3.5" />
                  URL
                </Label>
                <Input
                  value={form.url}
                  onChange={e => updateField('url', e.target.value)}
                  className="mt-1.5"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Abstract — with expand/collapse */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <AlignLeft className="h-3.5 w-3.5" />
                  摘要
                </Label>
                {form.abstract.length > 300 && (
                  <button
                    onClick={() => setShowAbstract(!showAbstract)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAbstract ? '收起' : '展开'}
                  </button>
                )}
              </div>
              <Textarea
                value={form.abstract}
                onChange={e => updateField('abstract', e.target.value)}
                className={cn(
                  'mt-1.5 transition-all',
                  showAbstract || form.abstract.length <= 300 ? 'min-h-[120px]' : 'min-h-[80px]'
                )}
                placeholder="文献摘要..."
                readOnly={false}
              />
            </div>

            {/* Academic Analysis Fields */}
            {(form.researchMethod || form.mainContribution || form.limitations || form.conclusion) && (
              <div className="rounded-lg border bg-accent/20 p-4 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Microscope className="h-3.5 w-3.5" />
                  学术分析
                </h4>
                {form.researchMethod && (
                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                      <Lightbulb className="h-3 w-3" />
                      研究方法
                    </Label>
                    <p className="mt-1 text-sm text-foreground">{form.researchMethod}</p>
                  </div>
                )}
                {form.mainContribution && (
                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                      <CheckCircle className="h-3 w-3" />
                      核心贡献
                    </Label>
                    <p className="mt-1 text-sm text-foreground">{form.mainContribution}</p>
                  </div>
                )}
                {form.limitations && (
                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                      <AlertTriangle className="h-3 w-3" />
                      局限性与未来工作
                    </Label>
                    <p className="mt-1 text-sm text-foreground">{form.limitations}</p>
                  </div>
                )}
                {form.conclusion && (
                  <div>
                    <Label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                      <CheckCircle className="h-3 w-3" />
                      主要结论
                    </Label>
                    <p className="mt-1 text-sm text-foreground">{form.conclusion}</p>
                  </div>
                )}
              </div>
            )}

            {/* Keywords */}
            <div>
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Tag className="h-3.5 w-3.5" />
                关键词
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {form.keywords.map((kw, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1 pr-1">
                    {kw}
                    <button
                      onClick={() => removeKeyword(idx)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKeyword()}
                    placeholder="添加关键词"
                    className="h-7 w-32 text-xs"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addKeyword}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Citations (readonly) */}
            {hasCitations && (
              <div className="rounded-lg border">
                <button
                  onClick={() => setShowCitations(!showCitations)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Quote className="h-4 w-4 text-primary" />
                    引用格式
                  </span>
                  {showCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showCitations && (
                  <div className="px-3 pb-3 space-y-3">
                    {form.citations.bibtex && (
                      <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">BibTeX</Label>
                        <pre className="mt-1 text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                          {form.citations.bibtex}
                        </pre>
                      </div>
                    )}
                    {form.citations.ieee && (
                      <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">IEEE</Label>
                        <pre className="mt-1 text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                          {form.citations.ieee}
                        </pre>
                      </div>
                    )}
                    {form.citations.gb7714 && (
                      <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">GB/T 7714</Label>
                        <pre className="mt-1 text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                          {form.citations.gb7714}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* References (readonly) */}
            {hasReferences && (
              <div className="rounded-lg border">
                <button
                  onClick={() => setShowReferences(!showReferences)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="h-4 w-4 text-primary" />
                    参考文献 ({form.references.length})
                  </span>
                  {showReferences ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showReferences && (
                  <div className="px-3 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
                    {form.references.map((ref, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">
                        <p className="font-medium text-foreground">{ref.title}</p>
                        <p>{ref.authors.join(', ')} · {ref.year} · {ref.venue}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
          <Button onClick={handleConfirm}>
            <Save className="h-4 w-4 mr-1" />
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
