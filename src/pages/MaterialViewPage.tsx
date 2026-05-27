// ========================================
// MaterialViewPage — 资料原文查看页面
// 支持: PDF / DOCX / TXT / MD / PPT / LINK
// ========================================
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import mammoth from 'mammoth';
import {
  ArrowLeft, FileText, Link2, ExternalLink, Download,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, BookOpen, Hash, Calendar,
  Tag, FileImage, Image as ImageIcon, Table as TableIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AnimatedPage from '@/components/shared/AnimatedPage';
import { api } from '@/lib/api';
import type { Material } from '@/types';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const categoryLabels: Record<string, string> = {
  book: '电子书', report: '报告', courseware: '课件',
  slides: '幻灯片', notes: '笔记', reference: '参考资料', other: '其他',
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── PDF Viewer ──
function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState('');

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setError('');
  }, []);

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <div className="text-center py-12 text-destructive">
          <p>{error}</p>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mt-2 inline-block">
            在外部打开
          </a>
        </div>
      ) : (
        <>
          <Document
            file={fileUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={(err) => setError(err.message || '无法加载 PDF')}
            loading={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
            className="max-w-full"
          >
            <Page pageNumber={pageNumber} scale={scale} renderTextLayer renderAnnotationLayer className="shadow-lg" />
          </Document>
          {numPages > 0 && (
            <div className="flex items-center gap-2 mt-4 sticky bottom-4 bg-background/80 backdrop-blur rounded-full px-4 py-2 border shadow-sm">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[70px] text-center">{pageNumber} / {numPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.5, s - 0.2))} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(3, s + 0.2))} disabled={scale >= 3}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Text Viewer ──
function TextViewer({ text, type }: { text: string; type: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-lg border bg-muted/30 p-6">
        <pre className={cn(
          'text-sm whitespace-pre-wrap leading-relaxed',
          type === 'markdown' || type === 'note' ? 'font-mono' : ''
        )}>
          {text}
        </pre>
      </div>
    </div>
  );
}

// ── DOCX Viewer ──
function DocxViewer({ fileUrl }: { fileUrl: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error('无法加载文件'); return r.arrayBuffer(); })
      .then(buf => mammoth.extractRawText({ arrayBuffer: buf }))
      .then(r => { setText(r.value); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [fileUrl]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="text-center py-12 text-destructive">{error}</div>;
  return <TextViewer text={text} type="docx" />;
}

// ── Image Viewer ──
function ImageViewer({ src, alt }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">图片加载失败</p>
        <p className="text-sm text-muted-foreground mt-1 break-all max-w-md">{src}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {!loaded && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={src}
        alt={alt || '图片'}
        className={cn('max-w-full max-h-[70vh] object-contain rounded-lg shadow-md', loaded ? 'block' : 'hidden')}
        onLoad={() => setLoaded(true)}
        onError={() => setErr(true)}
      />
    </div>
  );
}

// ── CSV / Table Viewer ──
function TableViewer({ content }: { content: string }) {
  const rows = useMemo(() => {
    // Simple CSV parser
    const lines = content.trim().split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }, [content]);

  if (rows.length === 0) {
    return <TextViewer text="【CSV 内容为空】" type="csv" />;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return (
    <div className="overflow-auto max-h-[70vh] rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted sticky top-0">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 text-left font-medium border-b whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} className={cn('border-b', ri % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Unsupported Viewer ──
function UnsupportedViewer({ fileUrl, fileName }: { fileUrl?: string; fileName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileImage className="h-16 w-16 text-muted-foreground mb-4" />
      <p className="text-lg font-medium text-muted-foreground">暂不支持在线预览此格式</p>
      <p className="text-sm text-muted-foreground mt-1">{fileName || '未知文件'}</p>
      {fileUrl && (
        <Button asChild variant="outline" className="mt-4 gap-2">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            下载或外部打开
          </a>
        </Button>
      )}
    </div>
  );
}

// ── Link Viewer ──
function LinkViewer({ material }: { material: Material }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Link2 className="h-16 w-16 text-primary mb-4" />
      <p className="text-lg font-medium">外部链接</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-md break-all">{material.content}</p>
      {material.content && (
        <Button asChild className="mt-4 gap-2">
          <a href={material.content} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            打开链接
          </a>
        </Button>
      )}
    </div>
  );
}

// ── Main Page ──
export default function MaterialViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadMaterial(id);
  }, [id]);

  const loadMaterial = async (materialId: string) => {
    setLoading(true);
    try {
      const res = await api.getMaterial(materialId);
      if (res.success && res.data) {
        setMaterial(res.data);
      } else {
        setError('资料不存在或已被删除');
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getFileExt = (fileName?: string) => fileName?.split('.').pop()?.toLowerCase() || '';

  const renderViewer = () => {
    if (!material) return null;

    // Link type
    if (material.type === 'link') {
      return <LinkViewer material={material} />;
    }

    const ext = getFileExt(material.fileName);
    const url = material.fileUrl;
    const hasContent = !!material.content;

    // ── 1. 文本类：用 content 渲染 ──
    if (hasContent) {
      // TXT / MD / Markdown
      if (['txt', 'md', 'markdown'].includes(ext)) {
        return <TextViewer text={material.content!} type={ext} />;
      }
      // DOCX
      if (ext === 'docx') {
        return <TextViewer text={material.content!} type="docx" />;
      }
      // PDF text extraction
      if (ext === 'pdf') {
        return <TextViewer text={material.content!} type="pdf" />;
      }
      // CSV
      if (ext === 'csv') {
        return <TableViewer content={material.content!} />;
      }
      // NOTE / MARKDOWN type
      if (material.type === 'note' || material.type === 'markdown') {
        return <TextViewer text={material.content!} type={material.type} />;
      }
      // Content looks like an image URL or data URL
      if (material.content!.match(/^https?:\/\/.*\.(png|jpe?g|gif|svg|webp|bmp)/i) ||
          material.content!.startsWith('data:image/')) {
        return <ImageViewer src={material.content!} alt={material.title} />;
      }
    }

    // ── 2. 文件类：用 fileUrl 渲染 ──
    if (url) {
      // PDF
      if (ext === 'pdf' || material.type === 'pdf') {
        return <PdfViewer fileUrl={url} />;
      }
      // DOCX
      if (ext === 'docx') {
        return <DocxViewer fileUrl={url} />;
      }
      // Image
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
        return <ImageViewer src={url} alt={material.title} />;
      }
    }

    // ── 3. 回退：文件信息 + 下载提示 ──
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">此资料暂无可预览内容</p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasContent ? '内容格式不支持在线预览' : '未检测到可预览的文件内容或链接'}
        </p>
        {url && (
          <Button asChild variant="outline" className="mt-4 gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              下载或外部打开
            </a>
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AnimatedPage>
    );
  }

  if (error || !material) {
    return (
      <AnimatedPage>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">{error || '资料未找到'}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/dashboard/materials')}>
            <ArrowLeft className="h-4 w-4" />
            返回资料库
          </Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => navigate('/dashboard/materials')}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{material.title}</h1>
            {material.description && (
              <p className="text-sm text-muted-foreground mt-1">{material.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{categoryLabels[material.category] || material.category}</Badge>
              {material.fileName && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {material.fileName}
                </span>
              )}
              {material.fileSize !== undefined && material.fileSize > 0 && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {formatFileSize(material.fileSize)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(material.createdAt).toLocaleDateString('zh-CN')}
              </span>
              {material.tags.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {material.tags.join(', ')}
                </span>
              )}
            </div>
          </div>
          {material.fileUrl && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
              <a href={material.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                下载
              </a>
            </Button>
          )}
        </div>

        <Separator />

        {/* Viewer */}
        <Card>
          <CardContent className="pt-6">
            {renderViewer()}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
