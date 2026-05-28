import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 学术贞德画廊 - 《创造亚当》式GNN学习动态场景
 * 零依赖 | 背景透明 | SVG矢量绘制+CSS动画+Canvas粒子 | 响应式
 *
 * 场景布局（完整提示词方案）：
 *  左侧 - Ruler白贞德（亚当位置，半躺斜卧，左臂伸展）
 *  右侧 - Avenger黑贞（上帝位置，悬浮伸手，暗色能量光环）
 *  中央 - 两指间GNN核心节点图（知识之火）
 *  环绕 - GNN知识节点系统（四类节点+连线+流动光点）
 */

// ════════════════════════════════════════════════════════════╗
//  GNN知识图谱数据
// ════════════════════════════════════════════════════════════╝

const GNN_CATEGORIES = {
  gnn: {
    name: 'GNN模型',
    shape: 'hexagon' as const,
    color: '#F4D03F',
    bg: 'rgba(244,208,63,0.18)',
    border: '#F4D03F',
    items: [
      { label: 'GCN', sub: 'Graph Convolutional', link: '/knowledge-graph/gnn-types/gcn' },
      { label: 'GAT', sub: 'Graph Attention', link: '/knowledge-graph/gnn-types/gat' },
      { label: 'GraphSAGE', sub: 'Sample & Aggregate', link: '/knowledge-graph/gnn-types/graphsage' },
      { label: 'GIN', sub: 'Graph Isomorphism', link: '/knowledge-graph/gnn-types/gin' },
      { label: 'GAE/VGAE', sub: 'Graph Auto-Encoder', link: '/knowledge-graph/gnn-types/gae-vgae' },
      { label: 'DiffPool', sub: 'Hierarchical Pool', link: '/knowledge-graph/gnn-types/diffpool' },
    ],
  },
  loss: {
    name: '损失函数',
    shape: 'circle' as const,
    color: '#3498DB',
    bg: 'rgba(52,152,219,0.18)',
    border: '#3498DB',
    items: [
      { label: 'CrossEntropy', sub: '交叉熵损失', link: '/knowledge-graph/loss-functions/cross-entropy' },
      { label: 'Reconstruction', sub: '重构损失', link: '/knowledge-graph/loss-functions/reconstruction' },
      { label: 'KL Divergence', sub: 'KL散度', link: '/knowledge-graph/loss-functions/kl-divergence' },
      { label: 'Contrastive', sub: '对比损失', link: '/knowledge-graph/loss-functions/contrastive' },
      { label: 'Triplet Margin', sub: '三元组损失', link: '/knowledge-graph/loss-functions/triplet' },
    ],
  },
  dataset: {
    name: '数据集',
    shape: 'square' as const,
    color: '#2ECC71',
    bg: 'rgba(46,204,113,0.18)',
    border: '#2ECC71',
    items: [
      { label: 'Cora', sub: '2,708 nodes', link: '/knowledge-graph/datasets/cora' },
      { label: 'CiteSeer', sub: '3,327 nodes', link: '/knowledge-graph/datasets/citeseer' },
      { label: 'PubMed', sub: '19,717 nodes', link: '/knowledge-graph/datasets/pubmed' },
      { label: 'Reddit', sub: 'Large-scale', link: '/knowledge-graph/datasets/reddit' },
      { label: 'ogbn-arxiv', sub: '169K nodes', link: '/knowledge-graph/datasets/ogbn-arxiv' },
    ],
  },
  basics: {
    name: '基础知识',
    shape: 'diamond' as const,
    color: '#9B59B6',
    bg: 'rgba(155,89,182,0.18)',
    border: '#9B59B6',
    items: [
      { label: 'Message Passing', sub: '消息传递', link: '/knowledge-graph/basics/message-passing' },
      { label: 'Aggregation', sub: '聚合函数', link: '/knowledge-graph/basics/aggregation' },
      { label: 'Node Embedding', sub: '节点嵌入', link: '/knowledge-graph/basics/node-embedding' },
      { label: 'Spectral Domain', sub: '谱域', link: '/knowledge-graph/basics/spectral-domain' },
      { label: 'Spatial Domain', sub: '空域', link: '/knowledge-graph/basics/spatial-domain' },
      { label: 'Attention', sub: '注意力机制', link: '/knowledge-graph/basics/attention-mechanism' },
      { label: 'Graph Fourier', sub: '图傅里叶', link: '/knowledge-graph/basics/graph-fourier' },
      { label: 'Over-smoothing', sub: '过平滑', link: '/knowledge-graph/basics/over-smoothing' },
    ],
  },
};

// 所有节点展平（用于渲染和连线）
interface GnnNodeItem {
  id: string;
  label: string;
  sub: string;
  link: string;
  category: string;
  shape: 'hexagon' | 'circle' | 'square' | 'diamond';
  color: string;
  bg: string;
  border: string;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  size: number;
}

const ALL_NODES: GnnNodeItem[] = [];
let nodeIndex = 0;
(Object.keys(GNN_CATEGORIES) as Array<keyof typeof GNN_CATEGORIES>).forEach((catKey) => {
  const cat = GNN_CATEGORIES[catKey];
  cat.items.forEach((item, i) => {
    const orbitRadius = 140 + Math.random() * 80;
    const orbitAngle = (nodeIndex / 24) * Math.PI * 2 + Math.random() * 0.5;
    const orbitSpeed = 0.15 + Math.random() * 0.25;
    const size = catKey === 'dataset' ? 18 + Math.random() * 8 : 14 + Math.random() * 6;
    ALL_NODES.push({
      id: `${catKey}-${i}`,
      label: item.label,
      sub: item.sub,
      link: item.link,
      category: catKey,
      shape: cat.shape,
      color: cat.color,
      bg: cat.bg,
      border: cat.border,
      orbitRadius,
      orbitAngle,
      orbitSpeed,
      size,
    });
    nodeIndex++;
  });
});

// ════════════════════════════════════════════════════════════╗
//  节点形状SVG组件
// ════════════════════════════════════════════════════════════╝

function HexagonShape({ size, color, fill }: { size: number; color: string; fill: string }) {
  const r = size;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
  }).join(' ');
  return <polygon points={points} fill={fill} stroke={color} strokeWidth="1.5" />;
}

function CircleShape({ size, color, fill }: { size: number; color: string; fill: string }) {
  return <circle r={size} fill={fill} stroke={color} strokeWidth="1.5" />;
}

function SquareShape({ size, color, fill }: { size: number; color: string; fill: string }) {
  return <rect x={-size} y={-size} width={size * 2} height={size * 2} rx="3" fill={fill} stroke={color} strokeWidth="1.5" />;
}

function DiamondShape({ size, color, fill }: { size: number; color: string; fill: string }) {
  return <polygon points={`0,-${size} ${size},0 0,${size} -${size},0`} fill={fill} stroke={color} strokeWidth="1.5" />;
}

// ════════════════════════════════════════════════════════════╗
//  Canvas粒子系统
// ════════════════════════════════════════════════════════════╝

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'holy' | 'dark' | 'core';
}

function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnParticle = (type: 'holy' | 'dark' | 'core') => {
      const w = canvas.width;
      const h = canvas.height;
      let p: Particle;
      if (type === 'holy') {
        p = {
          x: w * 0.25 + Math.random() * 80,
          y: h * 0.6 + Math.random() * 100,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.5 - Math.random() * 1,
          life: 0,
          maxLife: 120 + Math.random() * 80,
          size: 1 + Math.random() * 2,
          color: `rgba(255,${215 + Math.random() * 40 | 0},${Math.random() * 100 | 0},`,
          type,
        };
      } else if (type === 'dark') {
        p = {
          x: w * 0.75 + Math.random() * 80,
          y: h * 0.3 + Math.random() * 100,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.3 + Math.random() * 0.8,
          life: 0,
          maxLife: 120 + Math.random() * 80,
          size: 1 + Math.random() * 2.5,
          color: `rgba(${180 + Math.random() * 60 | 0},${Math.random() * 30 | 0},${Math.random() * 50 | 0},`,
          type,
        };
      } else {
        p = {
          x: w * 0.5 + (Math.random() - 0.5) * 60,
          y: h * 0.45 + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          life: 0,
          maxLife: 80 + Math.random() * 60,
          size: 1.5 + Math.random() * 2,
          color: `rgba(${200 + Math.random() * 55 | 0},${200 + Math.random() * 55 | 0},${255},`,
          type,
        };
      }
      particlesRef.current.push(p);
    };

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new particles
      if (frameCount % 3 === 0) spawnParticle('holy');
      if (frameCount % 3 === 0) spawnParticle('dark');
      if (frameCount % 5 === 0) spawnParticle('core');

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) return false;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha.toFixed(2) + ')';
        ctx.fill();

        // Glow for larger particles
        if (p.size > 2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = p.color + (alpha * 0.15).toFixed(2) + ')';
          ctx.fill();
        }
        return true;
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════╗
//  Ruler白贞德 SVG（亚当位置 - 半躺斜卧）
// ════════════════════════════════════════════════════════════╝

function RulerJeanneSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 380" className={className} style={{ overflow: 'visible' }}>
      <defs>
        {/* 金发渐变 */}
        <linearGradient id="rulerHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="50%" stopColor="#FFD43B" />
          <stop offset="100%" stopColor="#E6B800" />
        </linearGradient>
        {/* 蓝眸渐变 */}
        <radialGradient id="rulerEyeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="60%" stopColor="#4A90E2" />
          <stop offset="100%" stopColor="#1E5AA8" />
        </radialGradient>
        {/* 银铠渐变 */}
        <linearGradient id="rulerArmorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F8F9FA" />
          <stop offset="40%" stopColor="#E9ECEF" />
          <stop offset="100%" stopColor="#ADB5BD" />
        </linearGradient>
        {/* 紫披风渐变 */}
        <linearGradient id="rulerCapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9B59B6" />
          <stop offset="50%" stopColor="#8E44AD" />
          <stop offset="100%" stopColor="#6C3483" />
        </linearGradient>
        {/* 圣光光晕 */}
        <radialGradient id="rulerHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,215,0,0.3)" />
          <stop offset="50%" stopColor="rgba(255,215,0,0.1)" />
          <stop offset="100%" stopColor="rgba(255,215,0,0)" />
        </radialGradient>
        {/* 皮肤 */}
        <linearGradient id="rulerSkinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF0E0" />
          <stop offset="100%" stopColor="#F5D0C0" />
        </linearGradient>
      </defs>

      {/* 圣光光晕背景 */}
      <ellipse cx="140" cy="140" rx="120" ry="120" fill="url(#rulerHalo)" className="ruler-halo" />

      {/* 紫色披风（底层，飘动向左） */}
      <g className="ruler-cape">
        <path
          d="M 80 160 Q 20 200 10 280 Q 5 320 30 350 Q 60 370 100 340 Q 130 310 120 250 Q 110 200 80 160"
          fill="url(#rulerCapeGrad)"
          opacity="0.9"
        />
        {/* 披风褶皱 */}
        <path d="M 40 220 Q 60 240 50 280" stroke="#6C3483" strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 60 260 Q 80 280 70 320" stroke="#6C3483" strokeWidth="1" fill="none" opacity="0.5" />
        {/* 白色十字纹章 */}
        <path d="M 45 250 L 55 250 L 55 240 L 65 240 L 65 250 L 75 250 L 75 260 L 65 260 L 65 280 L 55 280 L 55 260 L 45 260 Z" fill="rgba(255,255,255,0.6)" />
      </g>

      {/* 身体/铠甲（半躺姿态） */}
      <g className="ruler-body">
        {/* 躯干铠甲 */}
        <path
          d="M 100 160 Q 130 150 150 165 Q 170 180 165 210 Q 160 240 140 250 Q 110 255 90 240 Q 75 220 80 190 Q 85 170 100 160"
          fill="url(#rulerArmorGrad)"
          stroke="#CED4DA"
          strokeWidth="1"
        />
        {/* 胸甲中央宝石 */}
        <ellipse cx="125" cy="195" rx="6" ry="8" fill="#9B59B6" stroke="#6C3483" strokeWidth="1" />
        <ellipse cx="125" cy="193" rx="3" ry="4" fill="rgba(255,255,255,0.4)" />
        {/* 铠甲边缘装饰 */}
        <path d="M 90 180 Q 125 175 160 185" stroke="#FFD700" strokeWidth="1.5" fill="none" opacity="0.7" />
        {/* 腰部 */}
        <path d="M 95 230 Q 125 235 155 225" stroke="#ADB5BD" strokeWidth="1" fill="none" />
        {/* 右腿（弯曲） */}
        <path d="M 110 245 Q 130 270 125 300 Q 120 330 100 340 Q 80 345 70 325 Q 65 300 80 275 Q 95 255 110 245" fill="url(#rulerArmorGrad)" stroke="#CED4DA" strokeWidth="1" />
        {/* 左腿（伸展） */}
        <path d="M 130 240 Q 160 250 180 270 Q 200 290 195 310 Q 190 325 170 320 Q 150 315 140 290 Q 130 265 130 240" fill="url(#rulerArmorGrad)" stroke="#CED4DA" strokeWidth="1" />
      </g>

      {/* 头部 */}
      <g className="ruler-head">
        {/* 后发（编发） */}
        <path
          d="M 115 85 Q 90 100 85 140 Q 80 170 95 190 Q 105 200 115 185 Q 110 160 115 130 Q 120 100 115 85"
          fill="url(#rulerHairGrad)"
          stroke="#D4A017"
          strokeWidth="0.5"
        />
        {/* 头发丝带 */}
        <path d="M 90 140 Q 75 150 70 170" stroke="#1A1A2E" strokeWidth="3" fill="none" />
        <path d="M 95 155 Q 80 165 78 180" stroke="#1A1A2E" strokeWidth="2.5" fill="none" />
        {/* 脸型 */}
        <ellipse cx="130" cy="115" rx="22" ry="26" fill="url(#rulerSkinGrad)" />
        {/* 下巴 */}
        <path d="M 115 130 Q 130 142 145 130" fill="url(#rulerSkinGrad)" />
        {/* 刘海 */}
        <path d="M 108 95 Q 115 105 118 95 Q 122 108 128 98 Q 132 110 138 100 Q 142 108 148 98 Q 152 100 148 88 Q 140 80 130 82 Q 118 80 108 95" fill="url(#rulerHairGrad)" />
        {/* 眼睛（蓝眸） */}
        <g>
          {/* 左眼 */}
          <ellipse cx="122" cy="112" rx="5" ry="6" fill="url(#rulerEyeGrad)" />
          <circle cx="123" cy="111" r="2" fill="white" />
          <circle cx="121" cy="113" r="1" fill="white" />
          <path d="M 116 108 Q 122 106 128 108" stroke="#5D4E37" strokeWidth="1.2" fill="none" />
          {/* 右眼 */}
          <ellipse cx="140" cy="112" rx="5" ry="6" fill="url(#rulerEyeGrad)" />
          <circle cx="141" cy="111" r="2" fill="white" />
          <circle cx="139" cy="113" r="1" fill="white" />
          <path d="M 134 108 Q 140 106 146 108" stroke="#5D4E37" strokeWidth="1.2" fill="none" />
        </g>
        {/* 眉毛 */}
        <path d="M 116 103 Q 122 101 127 103" stroke="#B8860B" strokeWidth="1" fill="none" />
        <path d="M 135 103 Q 140 101 146 103" stroke="#B8860B" strokeWidth="1" fill="none" />
        {/* 鼻子 */}
        <path d="M 132 116 Q 131 120 133 122" stroke="#D4A574" strokeWidth="0.8" fill="none" />
        {/* 嘴唇 */}
        <path d="M 128 128 Q 131 130 134 128" stroke="#E891A0" strokeWidth="1.2" fill="none" />
        <path d="M 128 128 Q 131 126 134 128" fill="#F4A0B0" opacity="0.5" />
        {/* 腮红 */}
        <ellipse cx="118" cy="125" rx="5" ry="3" fill="#FFB6C1" opacity="0.3" />
        <ellipse cx="144" cy="125" rx="5" ry="3" fill="#FFB6C1" opacity="0.3" />
      </g>

      {/* 左臂（向前伸展，手指微曲向上） */}
      <g className="ruler-arm">
        {/* 上臂 */}
        <path d="M 145 175 Q 170 170 190 160 Q 210 150 220 145" stroke="url(#rulerSkinGrad)" strokeWidth="14" fill="none" strokeLinecap="round" />
        {/* 前臂 */}
        <path d="M 220 145 Q 240 138 255 135" stroke="url(#rulerSkinGrad)" strokeWidth="11" fill="none" strokeLinecap="round" />
        {/* 铠甲肩甲 */}
        <ellipse cx="150" cy="170" rx="12" ry="15" fill="url(#rulerArmorGrad)" stroke="#CED4DA" strokeWidth="1" />
        {/* 手 */}
        <g transform="translate(255, 135)">
          <ellipse cx="0" cy="0" rx="8" ry="6" fill="url(#rulerSkinGrad)" />
          {/* 手指（微曲向上） */}
          <path d="M 5 -2 Q 12 -8 16 -6" stroke="url(#rulerSkinGrad)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 6 0 Q 13 -4 17 -2" stroke="url(#rulerSkinGrad)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 5 2 Q 12 0 15 2" stroke="url(#rulerSkinGrad)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 3 4 Q 8 5 10 6" stroke="url(#rulerSkinGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* 旗帜（放在身旁） */}
      <g className="ruler-flag" transform="translate(60, 200)">
        {/* 旗杆 */}
        <line x1="0" y1="0" x2="0" y2="-80" stroke="#8B7355" strokeWidth="3" />
        <circle cx="0" cy="-80" r="4" fill="#FFD700" />
        {/* 旗帜 */}
        <path d="M 0 -75 Q 25 -70 30 -50 Q 32 -30 25 -15 Q 20 -5 0 -10" fill="#E8E8E8" stroke="#D4D4D4" strokeWidth="0.5" />
        {/* 百合花纹章 */}
        <path d="M 12 -45 Q 15 -50 18 -45 Q 20 -40 15 -38 Q 10 -40 12 -45" fill="#FFD700" />
        <path d="M 15 -42 L 15 -35" stroke="#FFD700" strokeWidth="1" />
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  Avenger黑贞 SVG（上帝位置 - 悬浮伸手）
// ════════════════════════════════════════════════════════════╝

function AvengerJeanneSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 380" className={className} style={{ overflow: 'visible' }}>
      <defs>
        {/* 白发渐变 */}
        <linearGradient id="avengerHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#E8E8E8" />
          <stop offset="100%" stopColor="#C0C0C0" />
        </linearGradient>
        {/* 金瞳渐变 */}
        <radialGradient id="avengerEyeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#8B6914" />
        </radialGradient>
        {/* 黑龙鳞铠甲 */}
        <linearGradient id="avengerArmorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3A3A4E" />
          <stop offset="50%" stopColor="#2A2A3E" />
          <stop offset="100%" stopColor="#1A1A2E" />
        </linearGradient>
        {/* 暗红披风 */}
        <linearGradient id="avengerCapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C0392B" />
          <stop offset="50%" stopColor="#8B0000" />
          <stop offset="100%" stopColor="#4A0000" />
        </linearGradient>
        {/* 暗能量光环 */}
        <radialGradient id="avengerHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(192,57,43,0.2)" />
          <stop offset="40%" stopColor="rgba(108,52,131,0.15)" />
          <stop offset="100%" stopColor="rgba(26,26,46,0)" />
        </radialGradient>
        {/* 暗色皮肤 */}
        <linearGradient id="avengerSkinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF0E8" />
          <stop offset="100%" stopColor="#F0D8D0" />
        </linearGradient>
      </defs>

      {/* 暗能量光环背景 */}
      <ellipse cx="140" cy="140" rx="130" ry="130" fill="url(#avengerHalo)" className="avenger-halo" />

      {/* 暗红披风（火焰般飘动） */}
      <g className="avenger-cape">
        <path
          d="M 200 160 Q 260 140 270 180 Q 280 220 260 260 Q 240 300 210 280 Q 190 260 200 220 Q 210 180 200 160"
          fill="url(#avengerCapeGrad)"
          opacity="0.9"
        />
        {/* 披风火焰纹理 */}
        <path d="M 230 180 Q 250 200 245 230" stroke="#4A0000" strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 245 200 Q 265 220 255 250" stroke="#4A0000" strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 220 220 Q 240 250 230 280" stroke="#8B0000" strokeWidth="0.8" fill="none" opacity="0.4" />
      </g>

      {/* 身体/龙鳞铠甲（悬浮姿态） */}
      <g className="avenger-body">
        {/* 躯干铠甲 */}
        <path
          d="M 110 160 Q 140 150 165 160 Q 185 175 180 205 Q 175 235 155 245 Q 125 250 105 235 Q 90 215 95 185 Q 100 165 110 160"
          fill="url(#avengerArmorGrad)"
          stroke="#1A1A2E"
          strokeWidth="1.5"
        />
        {/* 龙鳞纹理 */}
        <g opacity="0.3">
          <ellipse cx="125" cy="180" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
          <ellipse cx="145" cy="175" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
          <ellipse cx="135" cy="195" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
          <ellipse cx="155" cy="190" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
          <ellipse cx="145" cy="210" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
          <ellipse cx="125" cy="205" rx="8" ry="5" fill="none" stroke="#1A1A2E" strokeWidth="0.5" />
        </g>
        {/* 铠甲金边 */}
        <path d="M 105 175 Q 140 168 175 178" stroke="#DAA520" strokeWidth="1.2" fill="none" opacity="0.8" />
        {/* 腰部 */}
        <path d="M 100 225 Q 140 230 175 220" stroke="#2A2A3E" strokeWidth="1.5" fill="none" />
        {/* 右腿 */}
        <path d="M 125 240 Q 145 260 140 290 Q 135 320 115 325 Q 95 320 90 295 Q 88 270 100 255 Q 115 245 125 240" fill="url(#avengerArmorGrad)" stroke="#1A1A2E" strokeWidth="1" />
        {/* 左腿 */}
        <path d="M 145 235 Q 170 245 185 265 Q 200 285 190 305 Q 180 315 160 310 Q 145 300 140 275 Q 135 255 145 235" fill="url(#avengerArmorGrad)" stroke="#1A1A2E" strokeWidth="1" />
      </g>

      {/* 头部 */}
      <g className="avenger-head">
        {/* 白发（散开，瀑布般） */}
        <path
          d="M 100 100 Q 70 120 65 160 Q 60 200 75 230 Q 85 250 95 235 Q 90 200 100 160 Q 110 120 100 100"
          fill="url(#avengerHairGrad)"
          stroke="#A0A0A0"
          strokeWidth="0.5"
        />
        <path
          d="M 180 100 Q 210 120 215 160 Q 220 200 205 230 Q 195 250 185 235 Q 190 200 180 160 Q 170 120 180 100"
          fill="url(#avengerHairGrad)"
          stroke="#A0A0A0"
          strokeWidth="0.5"
        />
        <path
          d="M 120 85 Q 100 110 105 150 Q 110 180 120 200"
          fill="none"
          stroke="url(#avengerHairGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 160 85 Q 180 110 175 150 Q 170 180 160 200"
          fill="none"
          stroke="url(#avengerHairGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 额头黑饰（三尖王冠状） */}
        <path d="M 130 78 L 135 68 L 140 76 L 145 65 L 150 78" fill="#1A1A2E" stroke="#DAA520" strokeWidth="0.8" />
        {/* 脸型 */}
        <ellipse cx="140" cy="110" rx="20" ry="24" fill="url(#avengerSkinGrad)" />
        {/* 下巴 */}
        <path d="M 125 125 Q 140 136 155 125" fill="url(#avengerSkinGrad)" />
        {/* 刘海 */}
        <path d="M 118 88 Q 125 98 128 88 Q 132 100 138 90 Q 142 100 148 90 Q 152 95 155 88 Q 158 90 152 82 Q 145 78 140 80 Q 128 78 118 88" fill="url(#avengerHairGrad)" />
        {/* 眼睛（金黄色竖瞳） */}
        <g>
          {/* 左眼 */}
          <ellipse cx="132" cy="108" rx="5" ry="6" fill="url(#avengerEyeGrad)" />
          <ellipse cx="132" cy="108" rx="1.5" ry="4" fill="#1A1A2E" />
          <circle cx="133" cy="107" r="1.5" fill="white" />
          <path d="M 126 104 Q 132 102 138 104" stroke="#2A2A2A" strokeWidth="1.3" fill="none" />
          {/* 右眼 */}
          <ellipse cx="150" cy="108" rx="5" ry="6" fill="url(#avengerEyeGrad)" />
          <ellipse cx="150" cy="108" rx="1.5" ry="4" fill="#1A1A2E" />
          <circle cx="151" cy="107" r="1.5" fill="white" />
          <path d="M 144 104 Q 150 102 156 104" stroke="#2A2A2A" strokeWidth="1.3" fill="none" />
        </g>
        {/* 眉毛（锐利） */}
        <path d="M 125 100 Q 132 98 137 101" stroke="#2A2A2A" strokeWidth="1.2" fill="none" />
        <path d="M 143 101 Q 148 98 155 100" stroke="#2A2A2A" strokeWidth="1.2" fill="none" />
        {/* 鼻子 */}
        <path d="M 142 112 Q 141 116 143 118" stroke="#C4A080" strokeWidth="0.8" fill="none" />
        {/* 嘴唇（微扬） */}
        <path d="M 137 124 Q 141 126 145 124" stroke="#C08080" strokeWidth="1.2" fill="none" />
        <path d="M 138 123 Q 141 121 144 123" stroke="#D09090" strokeWidth="0.8" fill="none" />
        {/* 耳边暗色耳坠 */}
        <circle cx="118" cy="118" r="3" fill="#6C3483" stroke="#DAA520" strokeWidth="0.5" />
        <circle cx="118" cy="118" r="1.5" fill="#9B59B6" />
      </g>

      {/* 右臂（伸展，食指直指白贞德） */}
      <g className="avenger-arm">
        {/* 上臂 */}
        <path d="M 110 175 Q 80 170 60 160 Q 40 150 30 145" stroke="url(#avengerArmorGrad)" strokeWidth="14" fill="none" strokeLinecap="round" />
        {/* 前臂 */}
        <path d="M 30 145 Q 10 138 0 135" stroke="url(#avengerSkinGrad)" strokeWidth="11" fill="none" strokeLinecap="round" />
        {/* 铠甲肩甲 */}
        <ellipse cx="105" cy="170" rx="12" ry="15" fill="url(#avengerArmorGrad)" stroke="#1A1A2E" strokeWidth="1.5" />
        {/* 手 */}
        <g transform="translate(0, 135)">
          <ellipse cx="0" cy="0" rx="8" ry="6" fill="url(#avengerSkinGrad)" />
          {/* 食指直指 */}
          <path d="M -5 -2 Q -15 -5 -22 -6" stroke="url(#avengerSkinGrad)" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* 其他手指微收 */}
          <path d="M -5 0 Q -12 0 -16 2" stroke="url(#avengerSkinGrad)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M -4 2 Q -10 3 -13 5" stroke="url(#avengerSkinGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M -3 4 Q -7 6 -9 7" stroke="url(#avengerSkinGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* 腰间佩剑 */}
      <g className="avenger-sword" transform="translate(160, 240)">
        <rect x="-3" y="0" width="6" height="40" fill="#2A2A3E" stroke="#1A1A2E" strokeWidth="0.5" rx="2" />
        <rect x="-6" y="-2" width="12" height="4" fill="#DAA520" rx="1" />
        <rect x="-1" y="-8" width="2" height="6" fill="#8B7355" />
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  中央GNN核心（两指之间）
// ════════════════════════════════════════════════════════════╝

function CentralGnnCore({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="30%" stopColor="rgba(200,200,255,0.6)" />
          <stop offset="70%" stopColor="rgba(150,150,255,0.2)" />
          <stop offset="100%" stopColor="rgba(100,100,255,0)" />
        </radialGradient>
        <linearGradient id="coreLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#C0392B" />
          <stop offset="100%" stopColor="#9B59B6" />
        </linearGradient>
      </defs>

      {/* 核心光晕 */}
      <circle cx="60" cy="60" r="55" fill="url(#coreGlow)" className="core-pulse" />

      {/* 外圈六边形 */}
      <g className="core-rotate-slow">
        <polygon
          points="60,15 99,37.5 99,82.5 60,105 21,82.5 21,37.5"
          fill="none"
          stroke="url(#coreLineGrad)"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </g>

      {/* 内圈六边形 */}
      <g className="core-rotate-fast">
        <polygon
          points="60,35 84,47.5 84,72.5 60,85 36,72.5 36,47.5"
          fill="none"
          stroke="url(#coreLineGrad)"
          strokeWidth="1"
          opacity="0.4"
        />
      </g>

      {/* 中心节点 */}
      <circle cx="60" cy="60" r="8" fill="url(#coreLineGrad)" opacity="0.9" />
      <circle cx="60" cy="60" r="4" fill="white" opacity="0.8" />

      {/* 连接线到顶点 */}
      <g opacity="0.5">
        <line x1="60" y1="60" x2="60" y2="15" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
        <line x1="60" y1="60" x2="99" y2="37.5" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
        <line x1="60" y1="60" x2="99" y2="82.5" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
        <line x1="60" y1="60" x2="60" y2="105" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
        <line x1="60" y1="60" x2="21" y2="82.5" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
        <line x1="60" y1="60" x2="21" y2="37.5" stroke="url(#coreLineGrad)" strokeWidth="0.8" />
      </g>

      {/* 顶点发光点 */}
      <g className="core-vertex-glow">
        <circle cx="60" cy="15" r="3" fill="#FFD700" />
        <circle cx="99" cy="37.5" r="3" fill="#C0392B" />
        <circle cx="99" cy="82.5" r="3" fill="#9B59B6" />
        <circle cx="60" cy="105" r="3" fill="#FFD700" />
        <circle cx="21" cy="82.5" r="3" fill="#C0392B" />
        <circle cx="21" cy="37.5" r="3" fill="#9B59B6" />
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  GNN知识节点组件
// ════════════════════════════════════════════════════════════╝

function GnnNodeSvg({
  node,
  centerX,
  centerY,
  time,
  onHover,
  onLeave,
  onClick,
  isHovered,
}: {
  node: GnnNodeItem;
  centerX: number;
  centerY: number;
  time: number;
  onHover: (id: string) => void;
  onLeave: () => void;
  onClick: (link: string) => void;
  isHovered: boolean;
}) {
  const angle = node.orbitAngle + time * node.orbitSpeed * 0.001;
  const x = centerX + Math.cos(angle) * node.orbitRadius;
  const y = centerY + Math.sin(angle) * node.orbitRadius * 0.6; // 椭圆轨道

  const ShapeComponent =
    node.shape === 'hexagon'
      ? HexagonShape
      : node.shape === 'circle'
        ? CircleShape
        : node.shape === 'square'
          ? SquareShape
          : DiamondShape;

  const scale = isHovered ? 1.3 : 1;
  const pulseScale = 1 + Math.sin(time * 0.003 + nodeIndex) * 0.08;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale * pulseScale})`}
      style={{ cursor: 'pointer', transition: 'transform 0.3s ease' }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(node.link)}
    >
      {/* 发光外圈 */}
      <circle r={node.size + 4} fill={node.bg} opacity={isHovered ? 0.6 : 0.3} className="node-glow" />
      {/* 节点形状 */}
      <ShapeComponent size={node.size} color={node.border} fill={node.bg} />
      {/* 标签 */}
      <text
        y={node.size + 14}
        textAnchor="middle"
        fill={node.color}
        fontSize="8"
        fontWeight="600"
        style={{ pointerEvents: 'none' }}
      >
        {node.label}
      </text>
      {/* Tooltip */}
      {isHovered && (
        <g transform={`translate(0, ${-node.size - 30})`}>
          <rect x="-50" y="-16" width="100" height="22" rx="4" fill="rgba(0,0,0,0.8)" />
          <text y="-2" textAnchor="middle" fill="white" fontSize="8">
            {node.sub}
          </text>
        </g>
      )}
    </g>
  );
}

// ════════════════════════════════════════════════════════════╗
//  连线组件（带动画光点）
// ════════════════════════════════════════════════════════════╝

function ConnectionLines({
  nodes,
  centerX,
  centerY,
  time,
}: {
  nodes: GnnNodeItem[];
  centerX: number;
  centerY: number;
  time: number;
}) {
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string; dashed: boolean }[] = [];

  // 同色节点连线
  const categories = ['gnn', 'loss', 'dataset', 'basics'];
  categories.forEach((cat) => {
    const catNodes = nodes.filter((n) => n.category === cat);
    for (let i = 0; i < catNodes.length; i++) {
      for (let j = i + 1; j < catNodes.length; j++) {
        const angle1 = catNodes[i].orbitAngle + time * catNodes[i].orbitSpeed * 0.001;
        const angle2 = catNodes[j].orbitAngle + time * catNodes[j].orbitSpeed * 0.001;
        lines.push({
          x1: centerX + Math.cos(angle1) * catNodes[i].orbitRadius,
          y1: centerY + Math.sin(angle1) * catNodes[i].orbitRadius * 0.6,
          x2: centerX + Math.cos(angle2) * catNodes[j].orbitRadius,
          y2: centerY + Math.sin(angle2) * catNodes[j].orbitRadius * 0.6,
          color: catNodes[i].color,
          dashed: false,
        });
      }
    }
  });

  // 跨类别虚线（每个节点连到最近的不同类别节点）
  nodes.forEach((node, i) => {
    const angle = node.orbitAngle + time * node.orbitSpeed * 0.001;
    const nx = centerX + Math.cos(angle) * node.orbitRadius;
    const ny = centerY + Math.sin(angle) * node.orbitRadius * 0.6;

    let nearest: GnnNodeItem | null = null;
    let minDist = Infinity;
    nodes.forEach((other, j) => {
      if (i >= j || other.category === node.category) return;
      const otherAngle = other.orbitAngle + time * other.orbitSpeed * 0.001;
      const ox = centerX + Math.cos(otherAngle) * other.orbitRadius;
      const oy = centerY + Math.sin(otherAngle) * other.orbitRadius * 0.6;
      const dist = Math.hypot(nx - ox, ny - oy);
      if (dist < minDist && dist < 150) {
        minDist = dist;
        nearest = other;
      }
    });

    if (nearest) {
      const nearestAngle = nearest.orbitAngle + time * nearest.orbitSpeed * 0.001;
      lines.push({
        x1: nx,
        y1: ny,
        x2: centerX + Math.cos(nearestAngle) * nearest.orbitRadius,
        y2: centerY + Math.sin(nearestAngle) * nearest.orbitRadius * 0.6,
        color: 'rgba(255,255,255,0.3)',
        dashed: true,
      });
    }
  });

  return (
    <g>
      {lines.map((line, i) => (
        <g key={i}>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={line.dashed ? 0.5 : 0.8}
            strokeDasharray={line.dashed ? '3,3' : 'none'}
            opacity={0.4}
          />
          {/* 流动光点 */}
          {!line.dashed && (
            <circle r="2" fill={line.color} opacity="0.8">
              <animateMotion
                dur={`${3 + (i % 3)}s`}
                repeatCount="indefinite"
                path={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
              />
            </circle>
          )}
        </g>
      ))}
    </g>
  );
}

// ════════════════════════════════════════════════════════════╗
//  主组件
// ════════════════════════════════════════════════════════════╝

export default function JoanLearningGNN() {
  const [time, setTime] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredChar, setHoveredChar] = useState<'ruler' | 'avenger' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) return;
    let start = performance.now();
    const animate = (now: number) => {
      setTime(now - start);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [reducedMotion]);

  const handleNodeClick = useCallback((link: string) => {
    window.location.href = link;
  }, []);

  return (
    <div
      ref={containerRef}
      className="joan-learning-gnn"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '700px',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* CSS动画定义 */}
      <style>{`
        @keyframes rulerFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes avengerFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes rulerGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes avengerGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        @keyframes rulerBreath {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.02); }
        }
        @keyframes avengerBreath {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.015); }
        }
        @keyframes hairWave {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-1deg); }
          75% { transform: translateX(2px) rotate(1deg); }
        }
        @keyframes capeWave {
          0%, 100% { transform: skewX(0deg); }
          50% { transform: skewX(-3deg); }
        }
        @keyframes corePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
        @keyframes coreRotateSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes coreRotateFast {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes vertexGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(var(--orbit-r)) rotate(0deg); }
          to { transform: rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); }
        }

        .joan-learning-gnn .ruler-container {
          animation: rulerFloat 6s ease-in-out infinite;
        }
        .joan-learning-gnn .avenger-container {
          animation: avengerFloat 5s ease-in-out infinite;
        }
        .joan-learning-gnn .ruler-halo {
          animation: rulerGlow 4s ease-in-out infinite;
        }
        .joan-learning-gnn .avenger-halo {
          animation: avengerGlow 4s ease-in-out infinite;
        }
        .joan-learning-gnn .ruler-body {
          animation: rulerBreath 3s ease-in-out infinite;
          transform-origin: center 200px;
        }
        .joan-learning-gnn .avenger-body {
          animation: avengerBreath 3s ease-in-out infinite;
          transform-origin: center 200px;
        }
        .joan-learning-gnn .ruler-head {
          animation: hairWave 4s ease-in-out infinite;
          transform-origin: center 100px;
        }
        .joan-learning-gnn .avenger-head {
          animation: hairWave 3.5s ease-in-out infinite reverse;
          transform-origin: center 100px;
        }
        .joan-learning-gnn .ruler-cape {
          animation: capeWave 5s ease-in-out infinite;
          transform-origin: right center;
        }
        .joan-learning-gnn .avenger-cape {
          animation: capeWave 4s ease-in-out infinite reverse;
          transform-origin: left center;
        }
        .joan-learning-gnn .core-pulse {
          animation: corePulse 2s ease-in-out infinite;
          transform-origin: center;
        }
        .joan-learning-gnn .core-rotate-slow {
          animation: coreRotateSlow 10s linear infinite;
          transform-origin: 60px 60px;
        }
        .joan-learning-gnn .core-rotate-fast {
          animation: coreRotateFast 6s linear infinite;
          transform-origin: 60px 60px;
        }
        .joan-learning-gnn .core-vertex-glow circle {
          animation: vertexGlow 1.5s ease-in-out infinite alternate;
        }
        .joan-learning-gnn .node-glow {
          animation: corePulse 2s ease-in-out infinite;
        }

        /* 悬浮交互 */
        .joan-learning-gnn .ruler-container:hover,
        .joan-learning-gnn .avenger-container:hover {
          filter: brightness(1.15) drop-shadow(0 0 20px currentColor);
        }

        /* 角色名称标签 */
        .joan-learning-gnn .char-label {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .joan-learning-gnn .ruler-container:hover ~ .ruler-label,
        .joan-learning-gnn .avenger-container:hover ~ .avenger-label {
          opacity: 1;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .joan-learning-gnn * {
            animation: none !important;
          }
        }
      `}</style>

      {/* Canvas粒子层 */}
      <ParticlesCanvas />

      {/* SVG场景层 */}
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
        }}
      >
        {/* GNN知识节点连线 */}
        <ConnectionLines nodes={ALL_NODES} centerX={500} centerY={320} time={time} />

        {/* GNN知识节点 */}
        {ALL_NODES.map((node) => (
          <GnnNodeSvg
            key={node.id}
            node={node}
            centerX={500}
            centerY={320}
            time={time}
            onHover={setHoveredNode}
            onLeave={() => setHoveredNode(null)}
            onClick={handleNodeClick}
            isHovered={hoveredNode === node.id}
          />
        ))}
      </svg>

      {/* 角色层 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Ruler白贞德 - 左侧亚当位置 */}
        <div
          className="ruler-container"
          onMouseEnter={() => setHoveredChar('ruler')}
          onMouseLeave={() => setHoveredChar(null)}
          style={{
            position: 'absolute',
            left: '5%',
            bottom: '5%',
            width: '320px',
            height: '450px',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
        >
          <RulerJeanneSvg style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Avenger黑贞 - 右侧上帝位置 */}
        <div
          className="avenger-container"
          onMouseEnter={() => setHoveredChar('avenger')}
          onMouseLeave={() => setHoveredChar(null)}
          style={{
            position: 'absolute',
            right: '5%',
            top: '5%',
            width: '320px',
            height: '450px',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
        >
          <AvengerJeanneSvg style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 角色名称标签 */}
        <div
          className="char-label ruler-label"
          style={{
            position: 'absolute',
            left: '8%',
            bottom: '2%',
            color: '#FFD700',
            fontSize: '14px',
            fontWeight: 600,
            textShadow: '0 0 10px rgba(255,215,0,0.5)',
            zIndex: 30,
            opacity: hoveredChar === 'ruler' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          Ruler · 贞德
        </div>
        <div
          className="char-label avenger-label"
          style={{
            position: 'absolute',
            right: '8%',
            top: '2%',
            color: '#C0392B',
            fontSize: '14px',
            fontWeight: 600,
            textShadow: '0 0 10px rgba(192,57,43,0.5)',
            zIndex: 30,
            opacity: hoveredChar === 'avenger' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          Avenger · 贞德Alter
        </div>
      </div>

      {/* 中央GNN核心 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          width: '100px',
          height: '100px',
          zIndex: 25,
        }}
      >
        <CentralGnnCore style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
