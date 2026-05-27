// =======================================
// Knowledge Graph Canvas — 力导向图谱可视化 v1.0
// 纯 Canvas 实现，无第三方依赖
// =======================================
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { KnowledgeEntity, KnowledgeRelation } from '@/lib/knowledgeGraph';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  borderColor: string;
  selected: boolean;
}

interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  type: string;
  weight: number;
}

const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  concept:  { bg: '#dbeafe', border: '#3b82f6' },
  paper:    { bg: '#dcfce7', border: '#22c55e' },
  method:   { bg: '#f3e8ff', border: '#a855f7' },
  dataset:  { bg: '#ffedd5', border: '#f97316' },
  task:     { bg: '#fce7f3', border: '#ec4899' },
  metric:   { bg: '#fef9c3', border: '#eab308' },
  code:     { bg: '#f3f4f6', border: '#6b7280' },
  note:     { bg: '#ccfbf1', border: '#14b8a6' },
  author:   { bg: '#fee2e2', border: '#ef4444' },
};

const TYPE_LABELS: Record<string, string> = {
  is_a: '是一种', part_of: '属于', used_in: '被用于',
  proposed_in: '被提出', outperforms: '优于', cites: '引用',
  related_to: '相关', has_code: '有代码',
};

// ---- 力导向模拟 ----
function simulateForces(
  nodes: GraphNode[], edges: GraphEdge[],
  width: number, height: number, iterations: number = 100
) {
  const CENTER_X = width / 2;
  const CENTER_Y = height / 2;
  const CENTER_FORCE = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    // 斥力：节点间互相排斥
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist); // 斥力强度
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // 引力：边连接的节点互相吸引
    for (const edge of edges) {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealLen = 180;
      const force = (dist - idealLen) * 0.005 * (edge.weight || 0.5);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      edge.source.vx += fx;
      edge.source.vy += fy;
      edge.target.vx -= fx;
      edge.target.vy -= fy;
    }

    // 中心引力
    for (const node of nodes) {
      node.vx += (CENTER_X - node.x) * CENTER_FORCE;
      node.vy += (CENTER_Y - node.y) * CENTER_FORCE;
    }

    // 更新位置 + 阻尼
    for (const node of nodes) {
      node.vx *= 0.85;
      node.vy *= 0.85;
      node.x += node.vx;
      node.y += node.vy;
      // 限制在画布内
      node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
      node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
    }
  }
}

// ---- 绘制 ----
function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[], edges: GraphEdge[],
  width: number, height: number,
  offsetX: number, offsetY: number, scale: number
) {
  ctx.clearRect(0, 0, width, height);

  // 背景
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 绘制边
  for (const edge of edges) {
    const sx = edge.source.x, sy = edge.source.y;
    const tx = edge.target.x, ty = edge.target.y;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = edge.weight > 0.7 ? '#94a3b8' : '#cbd5e1';
    ctx.lineWidth = 1 + (edge.weight || 0.5) * 2;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 关系标签（中间）
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const label = TYPE_LABELS[edge.type] || edge.type;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 4);
  }

  // 绘制节点
  for (const node of nodes) {
    const { x, y, radius, color, borderColor, label, selected } = node;

    // 阴影
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fill();

    // 节点圆
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = selected ? '#1e293b' : borderColor;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();

    // 标签
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayLabel = label.length > 10 ? label.slice(0, 9) + '…' : label;
    ctx.fillText(displayLabel, x, y + radius + 4);
  }

  ctx.restore();
}

// ---- 主组件 ----
interface Props {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  onSelectEntity: (entity: KnowledgeEntity) => void;
}

export default function KnowledgeGraphCanvas({ entities, relations, onSelectEntity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 拖拽状态
  const dragRef = useRef<{ active: boolean; nodeIdx: number; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number } | null>(null);

  // 构建图数据
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = entities.map((e, i) => {
      const colors = TYPE_COLORS[e.type] || { bg: '#f3f4f6', border: '#6b7280' };
      // 初始位置：按类型分组，环形分布
      const angle = (i / entities.length) * Math.PI * 2;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: dimensions.width / 2 + Math.cos(angle) * radius,
        y: dimensions.height / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        radius: Math.max(20, Math.min(36, 16 + (e.name.length > 15 ? 8 : 0))),
        color: colors.bg,
        borderColor: colors.border,
        selected: e.id === selectedId,
      };
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edges: GraphEdge[] = relations
      .map(r => {
        const src = nodeMap.get(r.source);
        const tgt = nodeMap.get(r.target);
        if (!src || !tgt) return null;
        return { source: src, target: tgt, type: r.type, weight: r.weight || 0.5 };
      })
      .filter(Boolean) as GraphEdge[];

    // 运行力导向
    simulateForces(nodes, edges, dimensions.width, dimensions.height, 150);

    return { nodes, edges };
  }, [entities, relations, selectedId, dimensions]);

  // 绘制循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGraph(ctx, graphData.nodes, graphData.edges, dimensions.width, dimensions.height, offset.x, offset.y, scale);
  }, [graphData, dimensions, offset, scale]);

  // 自适应尺寸
  useEffect(() => {
    const handleResize = () => {
      const parent = canvasRef.current?.parentElement;
      if (parent) {
        setDimensions({ width: parent.clientWidth, height: Math.max(500, parent.clientHeight) });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 坐标转换：屏幕 → 画布
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (sx - rect.left - offset.x) / scale,
      y: (sy - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  // 命中检测
  const hitTest = useCallback((sx: number, sy: number) => {
    const { x, y } = screenToCanvas(sx, sy);
    // 从后往前检测（上层节点优先）
    for (let i = graphData.nodes.length - 1; i >= 0; i--) {
      const n = graphData.nodes[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return i;
    }
    return -1;
  }, [graphData.nodes, screenToCanvas]);

  // 鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const idx = hitTest(e.clientX, e.clientY);
    if (idx >= 0) {
      // 拖拽节点
      dragRef.current = { active: true, nodeIdx: idx, startX: e.clientX, startY: e.clientY };
      setSelectedId(graphData.nodes[idx].id);
      onSelectEntity(entities.find(en => en.id === graphData.nodes[idx].id)!);
    } else {
      // 平移画布
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    }
  }, [hitTest, graphData.nodes, entities, onSelectEntity, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current?.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      // 直接移动节点（在力导向中会被覆盖，这里仅做视觉反馈）
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
    } else if (panRef.current?.active) {
      setOffset({
        x: panRef.current.ox + (e.clientX - panRef.current.startX),
        y: panRef.current.oy + (e.clientY - panRef.current.startY),
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.2, Math.min(3, s * delta)));
  }, []);

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden bg-slate-50">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          className="w-8 h-8 bg-white border rounded shadow flex items-center justify-center text-sm hover:bg-slate-50"
          onClick={() => setScale(s => Math.min(3, s * 1.2))}
        >+</button>
        <button
          className="w-8 h-8 bg-white border rounded shadow flex items-center justify-center text-sm hover:bg-slate-50"
          onClick={() => setScale(s => Math.max(0.2, s / 1.2))}
        >−</button>
        <button
          className="w-8 h-8 bg-white border rounded shadow flex items-center justify-center text-xs hover:bg-slate-50"
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
        >⟲</button>
      </div>
    </div>
  );
}
