import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn, ZoomOut, RotateCcw, Move, Info,
  Circle, Square, Diamond, Triangle, Hexagon
} from 'lucide-react';

// ===== Types =====

interface GraphNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  borderColor: string;
  shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon';
  fontSize: number;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

interface KnowledgeGraphCanvasProps {
  nodes: { id: string; name: string; type: string }[];
  links: { source: string; target: string; relation?: string; type?: string; weight?: number }[];
  onNodeClick?: (nodeId: string) => void;
}

// ===== Color Palette - Vivid & High Contrast =====
const TYPE_COLORS: Record<string, { fill: string; border: string; shape: GraphNode['shape'] }> = {
  concept:   { fill: '#E8F4FD', border: '#2196F3', shape: 'circle' },
  paper:     { fill: '#FFF3E0', border: '#FF9800', shape: 'diamond' },
  method:    { fill: '#F3E5F5', border: '#9C27B0', shape: 'hexagon' },
  dataset:   { fill: '#E8F5E9', border: '#4CAF50', shape: 'square' },
  task:      { fill: '#FFEBEE', border: '#F44336', shape: 'triangle' },
  metric:    { fill: '#E0F2F1', border: '#009688', shape: 'circle' },
  code:      { fill: '#ECEFF1', border: '#607D8B', shape: 'square' },
  note:      { fill: '#FFF8E1', border: '#FFC107', shape: 'circle' },
  author:    { fill: '#FCE4EC', border: '#E91E63', shape: 'circle' },
};

const DEFAULT_COLOR = { fill: '#F5F5F5', border: '#9E9E9E', shape: 'circle' as const };

const RELATION_LABELS: Record<string, string> = {
  is_a: '是一种', part_of: '属于', used_in: '被用于',
  proposed_in: '被提出于', outperforms: '优于', cites: '引用',
  related_to: '相关于', has_code: '有代码实现', uses: '使用',
};

// ===== Shape Drawing =====
function drawShape(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  shape: GraphNode['shape'],
  fill: string,
  border: string,
  isHovered: boolean,
  isSelected: boolean
) {
  const r = radius;
  ctx.save();

  // Drop shadow for depth
  ctx.shadowColor = isHovered ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = isHovered ? 16 : 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = isHovered ? 4 : 2;

  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 1.3, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 1.3, y);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 1.2, y + r);
      ctx.lineTo(x - r * 1.2, y + r);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default: // circle
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }

  // Fill
  ctx.fillStyle = fill;
  ctx.fill();

  // Border
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = isSelected ? 3.5 : isHovered ? 2.5 : 2;
  ctx.strokeStyle = isSelected ? '#1a237e' : border;
  ctx.stroke();

  // Inner highlight (glossy effect)
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  ctx.restore();
}

// ===== Text Drawing =====
function drawNodeText(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  fontSize: number,
  maxWidth: number,
  isHovered: boolean
) {
  ctx.save();
  ctx.font = `${isHovered ? '700' : '600'} ${fontSize}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text background for readability
  const lines: string[] = [];
  const words = text.split(/(?=[A-Z])|(?<=[a-z])(?=[A-Z])|\s+/).filter(Boolean);
  let currentLine = '';

  for (const word of words) {
    const test = currentLine + (currentLine ? ' ' : '') + word;
    if (ctx.measureText(test).width <= maxWidth) {
      currentLine = test;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // If text too long, truncate to 2 lines
  const displayLines = lines.slice(0, 2);
  if (lines.length > 2) {
    displayLines[1] = displayLines[1].slice(0, -3) + '...';
  }

  const lineHeight = fontSize * 1.3;
  const totalHeight = displayLines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  // Draw text shadow for readability
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 6;

  for (let i = 0; i < displayLines.length; i++) {
    const line = displayLines[i];
    const textY = startY + i * lineHeight;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(line, x, textY);
  }

  ctx.restore();
}

// ===== Component =====

export default function KnowledgeGraphCanvas({ nodes: rawNodes, links: rawLinks, onNodeClick }: KnowledgeGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const animationRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Type icon mapping
  const typeIcon = useCallback((type: string) => {
    switch (type) {
      case 'concept': return <Circle className="w-3 h-3" />;
      case 'paper': return <Diamond className="w-3 h-3" />;
      case 'method': return <Hexagon className="w-3 h-3" />;
      case 'dataset': return <Square className="w-3 h-3" />;
      case 'task': return <Triangle className="w-3 h-3" />;
      default: return <Circle className="w-3 h-3" />;
    }
  }, []);

  // Build graph nodes with deterministic circular initial layout
  const nodes = useMemo<GraphNode[]>(() => {
    const w = dimensions.w;
    const h = dimensions.h;
    const cx = w / 2;
    const cy = h / 2;
    const count = rawNodes.length;
    // Distribute nodes in a circle; if many nodes, use multiple rings
    const ringRadius = Math.min(w, h) * 0.28;
    return rawNodes.map((n, i) => {
      const color = TYPE_COLORS[n.type] || DEFAULT_COLOR;
      // Angle-based placement for stability
      const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
      const x = cx + ringRadius * Math.cos(angle);
      const y = cy + ringRadius * Math.sin(angle);
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        x, y,
        vx: 0, vy: 0,
        radius: 38,
        color: color.fill,
        borderColor: color.border,
        shape: color.shape,
        fontSize: 11,
      };
    });
  }, [rawNodes, dimensions]);

  const links = useMemo<GraphLink[]>(() =>
    rawLinks.map(l => {
      const relType = l.relation || l.type || '';
      return {
        source: l.source,
        target: l.target,
        relation: RELATION_LABELS[relType] || relType || '相关',
        weight: l.weight ?? 1,
      };
    }),
    [rawLinks]
  );

  // Force simulation state refs
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());

  useEffect(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach(n => map.set(n.id, n));
    nodeMapRef.current = map;
  }, [nodes]);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const w = dimensions.w;
    const h = dimensions.h;
    const nodeMap = nodeMapRef.current;

    let frame = 0;

    const simulate = () => {
      frame++;
      // Run physics for 300 frames initially, then only when dragging
      if (frame > 300 && !isDragging && !draggingNode) {
        draw();
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }

      // Repulsion (scaled by node count to prevent explosion in small graphs)
      const repulsionStrength = nodes.length <= 5 ? 800 * 800 : 1400 * 1400;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // Soft cap: don't explode when nodes are very close
          const safeDist = Math.max(dist, a.radius + b.radius + 10);
          const force = repulsionStrength / (safeDist * safeDist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Spring (links) — stronger pull for sparse graphs
      const linkCount = links.length;
      const springStrength = linkCount < nodes.length ? 0.015 : 0.008;
      const targetDist = Math.min(w, h) * 0.22;
      for (const link of links) {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - targetDist) * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity (stronger for small graphs to keep nodes in view)
      const centerStrength = nodes.length <= 5 ? 0.003 : 0.0012;
      for (const node of nodes) {
        const dx = w / 2 - node.x;
        const dy = h / 2 - node.y;
        node.vx += dx * centerStrength;
        node.vy += dy * centerStrength;
      }

      // Apply velocity with damping
      for (const node of nodes) {
        if (node.id === draggingNode) continue;
        node.vx *= 0.92;
        node.vy *= 0.92;
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraint
        const margin = 60;
        node.x = Math.max(margin, Math.min(w - margin, node.x));
        node.y = Math.max(margin, Math.min(h - margin, node.y));
      }

      draw();
      animationRef.current = requestAnimationFrame(simulate);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background with subtle gradient
      const bgGradient = ctx.createLinearGradient(0, 0, w, h);
      bgGradient.addColorStop(0, '#f8fafc');
      bgGradient.addColorStop(1, '#eef2f7');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(200,210,225,0.3)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);

      // Draw links
      for (const link of links) {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const startX = a.x + nx * (a.radius + 3);
        const startY = a.y + ny * (a.radius + 3);
        const endX = b.x - nx * (b.radius + 3);
        const endY = b.y - ny * (b.radius + 3);

        // Link gradient
        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, a.borderColor + '80');
        grad.addColorStop(1, b.borderColor + '80');

        // Shadow for links
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.5, link.weight * 2);
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // Arrow
        const arrowSize = 10;
        const arrowX = endX - nx * arrowSize * 1.5;
        const arrowY = endY - ny * arrowSize * 1.5;
        const perpX = -ny;
        const perpY = nx;

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          arrowX + perpX * arrowSize * 0.5,
          arrowY + perpY * arrowSize * 0.5
        );
        ctx.lineTo(
          arrowX - perpX * arrowSize * 0.5,
          arrowY - perpY * arrowSize * 0.5
        );
        ctx.closePath();
        ctx.fillStyle = b.borderColor + 'CC';
        ctx.fill();

        // Relation label
        if (scale > 0.5) {
          const mx = (startX + endX) / 2;
          const my = (startY + endY) / 2;
          const angle = Math.atan2(dy, dx);

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle > Math.PI / 2 || angle < -Math.PI / 2 ? angle + Math.PI : angle);

          const text = link.relation;
          ctx.font = 'bold 10px "Inter", sans-serif';
          const textWidth = ctx.measureText(text).width;
          const padX = 6;
          const padY = 3;

          // Label background
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.strokeStyle = '#d0d5dd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-textWidth / 2 - padX, -7 - padY, textWidth + padX * 2, 14 + padY * 2, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#374151';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        drawShape(ctx, node.x, node.y, node.radius, node.shape, node.color, node.borderColor, isHovered, isSelected);
        drawNodeText(ctx, node.x, node.y, node.name, node.fontSize, node.radius * 1.6, isHovered);
      }

      ctx.restore();
    };

    initializedRef.current = true;
    simulate();

    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes, links, scale, offset, hoveredNode, selectedNode, isDragging, draggingNode, dimensions]);

  // Mouse handlers
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  const getNodeAt = useCallback((wx: number, wy: number) => {
    const nodeMap = nodeMapRef.current;
    for (const node of nodeMap.values()) {
      const dx = wx - node.x;
      const dy = wy - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 5) return node;
    }
    return null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
    const node = getNodeAt(wx, wy);
    if (node) {
      setDraggingNode(node.id);
      setSelectedNode(node.id);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
    const node = getNodeAt(wx, wy);
    setHoveredNode(node ? node.id : null);

    if (draggingNode && nodeMapRef.current.has(draggingNode)) {
      const n = nodeMapRef.current.get(draggingNode)!;
      n.x = wx;
      n.y = wy;
      n.vx = 0;
      n.vy = 0;
    } else if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingNode) {
      setDraggingNode(null);
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newScale = Math.max(0.2, Math.min(3, scale * zoomFactor));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setOffset({
      x: mouseX - (mouseX - offset.x) * (newScale / scale),
      y: mouseY - (mouseY - offset.y) * (newScale / scale),
    });
    setScale(newScale);
  };

  const handleNodeClickInternal = (nodeId: string) => {
    setSelectedNode(nodeId);
    onNodeClick?.(nodeId);
  };

  // Controls
  const handleZoomIn = () => setScale(s => Math.min(3, s * 1.25));
  const handleZoomOut = () => setScale(s => Math.max(0.2, s / 1.25));
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawNodes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
    return counts;
  }, [rawNodes]);

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-xl overflow-hidden border-2 border-gray-200/80 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-lg px-3 py-2 shadow-md">
        <div className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">节点类型</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(TYPE_COLORS).map(([type, { border, fill }]) => (
            typeCounts[type] ? (
              <div key={type} className="flex items-center gap-1">
                <span
                  className="inline-block rounded-sm"
                  style={{
                    width: 10, height: 10,
                    backgroundColor: fill,
                    border: `2px solid ${border}`,
                  }}
                />
                <span className="text-[11px] text-gray-600 font-medium">
                  {type === 'concept' ? '概念' : type === 'paper' ? '论文' : type === 'method' ? '方法' : type === 'dataset' ? '数据集' : type === 'task' ? '任务' : type === 'metric' ? '指标' : type === 'code' ? '代码' : type === 'note' ? '笔记' : type === 'author' ? '作者' : type}
                  <span className="text-gray-400 ml-0.5">({typeCounts[type]})</span>
                </span>
              </div>
            ) : null
          ))}
        </div>
      </div>

      {/* Scale indicator */}
      <div className="absolute top-3 right-3 z-10 bg-white/80 backdrop-blur-sm rounded-md px-2 py-1 text-[11px] text-gray-500 font-mono">
        {(scale * 100).toFixed(0)}%
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.w, height: dimensions.h }}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={(e) => {
          const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
          const node = getNodeAt(wx, wy);
          if (node) handleNodeClickInternal(node.id);
        }}
      />

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        <Button variant="secondary" size="icon" className="w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md border border-gray-200 hover:bg-white" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" className="w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md border border-gray-200 hover:bg-white" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" className="w-9 h-9 bg-white/90 backdrop-blur-sm shadow-md border border-gray-200 hover:bg-white" onClick={handleReset}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[11px] text-gray-400 bg-white/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200/60">
        <Move className="w-3 h-3" />
        <span>拖拽平移 · 滚轮缩放 · 点击节点查看详情</span>
        <Info className="w-3 h-3" />
      </div>
    </div>
  );
}
