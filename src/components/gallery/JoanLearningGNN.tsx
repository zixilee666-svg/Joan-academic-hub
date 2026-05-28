import { useEffect, useRef, useState, useCallback } from 'react';
import ArcherJeanneSvg from './ArcherJeanneSvg';
import BerserkerJeanneAlterSvg from './BerserkerJeanneAlterSvg';
import AlterSantaLilySvg from './AlterSantaLilySvg';
import YoungJeanneSantaSvg from './YoungJeanneSantaSvg';

/**
 * 学术贞德画廊 - 《创造亚当》式GNN学习动态场景
 * 零依赖 | 背景透明 | SVG+CSS动画 | 响应式
 *
 * 场景布局：
 *  左侧 - Ruler白贞德（亚当位置，半躺斜卧）
 *  右侧 - Avenger黑贞（上帝位置，悬浮，暗色能量光环）
 *  两指之间 - GNN节点图（知识之火）
 *  环绕 - 4个辅助贞德形象（简化版）
 *  背景 - GNN知识节点系统（四类节点+连线+流动光点）
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
      { label: 'Cora', sub: '2,708 nodes / 7 cls', link: '/knowledge-graph/datasets/cora' },
      { label: 'CiteSeer', sub: '3,327 nodes / 6 cls', link: '/knowledge-graph/datasets/citeseer' },
      { label: 'PubMed', sub: '19,717 nodes / 3 cls', link: '/knowledge-graph/datasets/pubmed' },
      { label: 'Reddit', sub: '大型规模', link: '/knowledge-graph/datasets/reddit' },
      { label: 'ogbn-arxiv', sub: '169K nodes', link: '/knowledge-graph/datasets/ogbn-arxiv' },
    ],
  },
  basic: {
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
      { label: 'Attention Mech', sub: '注意力机制', link: '/knowledge-graph/basics/attention-mechanism' },
      { label: 'Graph Fourier', sub: '图傅里叶', link: '/knowledge-graph/basics/graph-fourier' },
      { label: 'Over-smoothing', sub: '过平滑', link: '/knowledge-graph/basics/over-smoothing' },
    ],
  },
};

type CategoryKey = keyof typeof GNN_CATEGORIES;

// ════════════════════════════════════════════════════════════╗
//  SVG绘制辅助：六边形路径
// ════════════════════════════════════════════════════════════╝

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function diamondPath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx},${cy - ry}L${cx + rx},${cy}L${cx},${cy + ry}L${cx - rx},${cy}Z`;
}

// ════════════════════════════════════════════════════════════╗
//  粒子系统（Canvas 2D）
// ════════════════════════════════════════════════════════════╝

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

function ParticlesCanvas({ side }: { side: 'white' | 'black' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // 初始化粒子
    const count = 30;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: side === 'white' ? 0.2 + Math.random() * 0.5 : -(0.2 + Math.random() * 0.5),
        vy: side === 'white' ? -0.3 - Math.random() * 0.4 : 0.2 + Math.random() * 0.3,
        size: 1.5 + Math.random() * 2.5,
        life: Math.random() * 200,
        maxLife: 150 + Math.random() * 100,
        color: side === 'white'
          ? `hsl(${40 + Math.random() * 20}, 100%, ${70 + Math.random() * 20}%)`
          : `hsl(${350 + Math.random() * 20}, 80%, ${40 + Math.random() * 20}%)`,
      });
    }
    particlesRef.current = particles;

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ps = particlesRef.current;
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
          p.x = side === 'white' ? Math.random() * canvas.width * 0.3 : canvas.width * 0.7 + Math.random() * canvas.width * 0.3;
          p.y = Math.random() * canvas.height;
          p.life = 0;
        }
        const alpha = Math.max(0, 1 - p.life / p.maxLife) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        // 光晕
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.2;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [side]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 15 }}
    />
  );
}

// ════════════════════════════════════════════════════════════╗
//  GNN知识节点（SVG）
// ════════════════════════════════════════════════════════════╝

function GnnNodeSvg({ catKey, idx, total, orbitRx, orbitRy, phase }: {
  catKey: CategoryKey;
  idx: number;
  total: number;
  orbitRx: number;
  orbitRy: number;
  phase: number;
}) {
  const cat = GNN_CATEGORIES[catKey];
  const item = cat.items[idx];
  const angle = (idx / total) * Math.PI * 2 + phase;
  const baseCx = 500 + orbitRx * Math.cos(angle);
  const baseCy = 250 + orbitRy * Math.sin(angle);
  const nodeSize = catKey === 'dataset' ? 22 : 18;

  const shapeSvg = () => {
    const s = nodeSize;
    switch (cat.shape) {
      case 'hexagon':
        return <path d={hexPath(baseCx, baseCy, s)} fill={cat.bg} stroke={cat.border} strokeWidth="1.5" opacity="0.85" />;
      case 'circle':
        return <circle cx={baseCx} cy={baseCy} r={s} fill={cat.bg} stroke={cat.border} strokeWidth="1.5" opacity="0.85" />;
      case 'square':
        return <rect x={baseCx - s} y={baseCy - s} width={s * 2} height={s * 2} rx="3" fill={cat.bg} stroke={cat.border} strokeWidth="1.5" opacity="0.85" />;
      case 'diamond':
        return <path d={diamondPath(baseCx, baseCy, s, s * 0.7)} fill={cat.bg} stroke={cat.border} strokeWidth="1.5" opacity="0.85" />;
    }
  };

  return (
    <g className="gnn-node-group" style={{ cursor: 'pointer' }}>
      {/* 外发光 */}
      <circle cx={baseCx} cy={baseCy} r={nodeSize + 8} fill={cat.color} opacity="0.08">
        <animate attributeName="r" values={`${nodeSize + 4};${nodeSize + 12};${nodeSize + 4}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.08;0.15;0.08" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* 形状 */}
      {shapeSvg()}
      {/* 标签 */}
      <text x={baseCx} y={baseCy + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill={cat.border} pointerEvents="none">
        {item.label}
      </text>
      <title>{`${item.label} - ${item.sub}\n点击查看知识图谱`}</title>
    </g>
  );
}

// ════════════════════════════════════════════════════════════╗
//  Ruler白贞德 SVG（亚当位置 - 左侧半躺）
// ════════════════════════════════════════════════════════════╝

function RulerJeanneSvg() {
  return (
    <svg viewBox="0 0 400 350" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="rHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#F4D03F" />
          <stop offset="100%" stopColor="#D4AC0D" />
        </linearGradient>
        <linearGradient id="rSkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF5E6" />
          <stop offset="100%" stopColor="#FFE4C4" />
        </linearGradient>
        <linearGradient id="rArmor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8E8E8" />
          <stop offset="40%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>
        <linearGradient id="rDress" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4A6FA5" />
          <stop offset="100%" stopColor="#2E4A6F" />
        </linearGradient>
        <linearGradient id="rCape" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8EDF2" />
        </linearGradient>
        <linearGradient id="rFlag" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F4D03F" />
          <stop offset="100%" stopColor="#D4AC0D" />
        </linearGradient>
        <filter id="rGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 底部阴影 */}
      <ellipse cx="200" cy="335" rx="140" ry="10" fill="#000" opacity="0.06" />

      {/* ===== 身体组（呼吸动画）===== */}
      <g className="ruler-body">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0" dur="5s" repeatCount="indefinite" />

        {/* 白披风（底层，飘动） */}
        <path className="r-cape" d="M100 260 Q70 200 110 160 Q150 120 220 115 Q300 120 360 140 Q400 160 390 210 Q380 260 330 275 Q260 285 200 282 Q140 285 100 260Z"
          fill="url(#rCape)" filter="url(#rGlow)" opacity="0.92">
          <animate attributeName="d" values="M100 260 Q70 200 110 160 Q150 120 220 115 Q300 120 360 140 Q400 160 390 210 Q380 260 330 275 Q260 285 200 282 Q140 285 100 260Z;M100 260 Q65 195 105 155 Q145 115 220 110 Q305 115 365 135 Q405 155 395 215 Q385 265 330 280 Q255 290 200 287 Q135 290 100 260Z;M100 260 Q70 200 110 160 Q150 120 220 115 Q300 120 360 140 Q400 160 390 210 Q380 260 330 275 Q260 285 200 282 Q140 285 100 260Z" dur="4s" repeatCount="indefinite" />
        </path>
        {/* 披风十字纹章 */}
        <path d="M190 175 L190 205 M175 190 L205 190" stroke="#C9A04D" strokeWidth="2" fill="none" opacity="0.35" />

        {/* 深蓝裙子 */}
        <path d="M130 200 Q120 240 140 270 Q180 280 240 278 Q300 276 350 265 Q370 250 360 220 Q350 200 310 195 Q260 190 210 195 Q160 198 130 200Z"
          fill="url(#rDress)" />

        {/* 银甲胸甲 */}
        <path d="M150 175 Q170 150 220 145 Q270 150 320 175 Q330 190 320 210 Q270 200 220 197 Q170 200 150 210 Q140 190 150 175Z"
          fill="url(#rArmor)" />
        {/* 铠甲装饰 */}
        <path d="M190 168 Q220 162 250 168" stroke="#A0A0A0" strokeWidth="1.5" fill="none" />
        <path d="M180 185 Q220 180 260 185" stroke="#A0A0A0" strokeWidth="1" fill="none" opacity="0.5" />
        {/* 腰带扣 */}
        <circle cx="220" cy="192" r="5" fill="#C9A04D" />

        {/* 左腿（伸展向前） */}
        <path d="M155 240 Q130 245 100 248 Q80 250 75 252 Q70 255 80 258 Q120 260 165 255Z" fill="url(#rDress)" />
        <ellipse cx="115" cy="249" rx="13" ry="7" fill="url(#rArmor)" transform="rotate(-8 115 249)" />
        {/* 黑袜+鞋 */}
        <path d="M82 250 Q70 252 65 255 Q62 258 68 260 Q85 261 95 258Z" fill="#1a1a2e" />
        <ellipse cx="60" cy="256" rx="9" ry="5" fill="url(#rSkin)" transform="rotate(-12 60 256)" />

        {/* 右腿（弯曲向后） */}
        <path d="M290 240 Q330 235 360 230 Q380 228 385 230 Q390 233 380 237 Q340 242 300 248Z" fill="url(#rDress)" />
        <ellipse cx="340" cy="233" rx="13" ry="7" fill="url(#rArmor)" transform="rotate(8 340 233)" />

        {/* ===== 左臂（向前伸展 - 亚当手势）===== */}
        <g className="r-left-arm">
          <animateTransform attributeName="transform" type="translate" values="0,0;-3,2;0,0" dur="3s" repeatCount="indefinite" />
          {/* 上臂 */}
          <path d="M155 185 Q130 175 110 180 Q90 190 85 200 Q82 210 90 215 L105 210 Q100 202 110 195 Q125 188 140 190Z"
            fill="url(#rSkin)" />
          {/* 前臂 + 手（向前伸展） */}
          <path d="M90 215 Q75 220 60 228 Q48 238 45 248 Q43 255 48 258 Q55 260 62 255 L70 248 Q65 242 68 238 Q75 232 85 230 Q95 228 105 225Z"
            fill="url(#rSkin)" />
          {/* 左手手指（向上微曲，指向黑贞） */}
          <g transform="translate(45, 248)">
            <path d="M0,0 Q-5,-8 -3,-15" stroke="url(#rSkin)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M3,-2 Q0,-10 2,-18" stroke="url(#rSkin)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M7,-3 Q6,-11 9,-16" stroke="url(#rSkin)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* 指尖微光 */}
            <circle cx="-3" cy="-15" r="2" fill="#FFD700" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="2" cy="-18" r="2" fill="#FFD700" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
            </circle>
            <circle cx="9" cy="-16" r="1.5" fill="#FFD700" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.6s" />
            </circle>
          </g>
        </g>

        {/* ===== 右臂（自然放置/微举）===== */}
        <path d="M310 185 Q330 195 325 210 Q315 218 305 212Z" fill="url(#rSkin)" />
        <ellipse cx="328" cy="212" rx="8" ry="5" fill="url(#rSkin)" transform="rotate(15 328 212)" />

        {/* 旗帜（身旁，百合花纹章） */}
        <g transform="translate(300, 155) rotate(-15)">
          <rect x="0" y="0" width="4" height="80" fill="#C0C0C0" />
          <rect x="4" y="5" width="45" height="32" rx="2" fill="url(#rFlag)" />
          {/* 百合花纹 */}
          <path d="M26,15 Q22,12 20,15 Q18,18 22,20 Q26,22 30,20 Q34,18 32,15 Q30,12 26,15Z" fill="white" />
          <path d="M20,24 L26,20 L32,24" stroke="white" strokeWidth="1" fill="none" />
        </g>
      </g>

      {/* ===== 头部组 ===== */}
      <g className="ruler-head">
        <animateTransform attributeName="transform" type="translate" values="0,0;-1,1;0,0" dur="6s" repeatCount="indefinite" />

        {/* 后发（大波浪） */}
        <path d="M170 120 Q150 100 140 75 Q135 55 150 45 Q170 38 195 42 Q220 38 250 45 Q275 55 280 80 Q275 105 260 120Z"
          fill="url(#rHair)" />

        {/* 粗辫子（右侧，飘动） */}
        <path className="r-braid" d="M270 75 Q295 68 315 82 Q335 98 328 120 Q322 138 305 132 Q290 125 280 110 Q272 95 270 75Z"
          fill="url(#rHair)">
          <animate attributeName="d" values="M270 75 Q295 68 315 82 Q335 98 328 120 Q322 138 305 132 Q290 125 280 110 Q272 95 270 75Z;M270 75 Q298 65 320 80 Q342 95 335 122 Q328 140 310 135 Q292 128 278 112 Q270 97 270 75Z;M270 75 Q295 68 315 82 Q335 98 328 120 Q322 138 305 132 Q290 125 280 110 Q272 95 270 75Z" dur="3.5s" repeatCount="indefinite" />
        </path>
        {/* 辫子纹理 */}
        {[0, 1, 2].map(i => (
          <path key={i} d={`M278 ${82 + i * 12} Q292 ${86 + i * 12} Q306 ${92 + i * 10}`} stroke="#D4AC0D" strokeWidth="1.2" fill="none" opacity="0.6" />
        ))}

        {/* 头部 */}
        <ellipse cx="210" cy="95" rx="36" ry="32" fill="url(#rSkin)" />

        {/* 刘海 */}
        <path d="M178 78 Q190 65 210 62 Q230 65 252 78 Q248 75 230 72 Q210 68 190 72 Q178 76 178 78Z"
          fill="url(#rHair)" />

        {/* 银色额冠 */}
        <path d="M185 72 Q210 58 235 72 Q230 66 210 62 Q190 66 185 72Z" fill="#D4D4D4" />
        <ellipse cx="210" cy="64" rx="4" ry="5" fill="#C9A04D" />
        {/* 冠饰纹路 */}
        <path d="M198 67 L198 61 M220 67 L220 61" stroke="#A0A0A0" strokeWidth="1.2" />

        {/* 呆毛 */}
        <path d="M210 58 Q213 44 220 48" stroke="#F4D03F" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <animate attributeName="d" values="M210 58 Q213 44 220 48;M210 58 Q215 42 218 46;M210 58 Q213 44 220 48" dur="3s" repeatCount="indefinite" />
        </path>

        {/* 眼睛（紫罗兰色） */}
        <g>
          {/* 左眼 */}
          <ellipse cx="198" cy="97" rx="7" ry="9" fill="white" />
          <ellipse cx="198" cy="97" rx="5" ry="7" fill="#7B68EE" />
          <circle cx="199" cy="95" r="2.5" fill="white" />
          <path d="M190 91 Q198 87 206 91" stroke="#5B4B8A" strokeWidth="1.5" fill="none" />
          {/* 眼神光：渴望知识的光芒 */}
          <circle cx="197" cy="96" r="1" fill="white" opacity="0.8" />
        </g>
        <g>
          {/* 右眼 */}
          <ellipse cx="222" cy="97" rx="7" ry="9" fill="white" />
          <ellipse cx="222" cy="97" rx="5" ry="7" fill="#7B68EE" />
          <circle cx="223" cy="95" r="2.5" fill="white" />
          <path d="M214 91 Q222 87 230 91" stroke="#5B4B8A" strokeWidth="1.5" fill="none" />
          <circle cx="221" cy="96" r="1" fill="white" opacity="0.8" />
        </g>

        {/* 腮红 */}
        <ellipse cx="186" cy="108" rx="5" ry="3" fill="#FFB6C1" opacity="0.35" />
        <ellipse cx="234" cy="108" rx="5" ry="3" fill="#FFB6C1" opacity="0.35" />

        {/* 嘴巴（樱唇微启 - 渴望知识） */}
        <path d="M202 112 Q210 117 218 112" stroke="#D4846A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* 微张 */}
        <ellipse cx="210" cy="115" rx="3" ry="1.5" fill="#D4846A" opacity="0.3" />
      </g>

      {/* 圣光粒子（头部周围） */}
      {[0, 1, 2, 3, 4].map(i => (
        <circle key={i} r="2" fill="#FFD700" opacity="0">
          <animate attributeName="cx" values={`${195 + i * 8};${200 + i * 8}`} dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
          <animate attributeName="cy" values={`${60 - i * 5};${55 - i * 5}`} dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
          <animate attributeName="opacity" values="0;0.7;0" dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
        </circle>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  Avenger黑贞 SVG（上帝位置 - 右侧悬浮）
// ════════════════════════════════════════════════════════════╝

function AvengerJeanneSvg() {
  return (
    <svg viewBox="0 0 380 360" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="aHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5F5F5" />
          <stop offset="50%" stopColor="#E8E8E8" />
          <stop offset="100%" stopColor="#D0D0D0" />
        </linearGradient>
        <linearGradient id="aArmor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="50%" stopColor="#2a1a2e" />
          <stop offset="100%" stopColor="#0a0a1a" />
        </linearGradient>
        <linearGradient id="aCape" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B0000" />
          <stop offset="100%" stopColor="#C0392B" />
        </linearGradient>
        <radialGradient id="aDarkAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(108,52,131,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="aGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 暗色能量光环背景 */}
      <g className="a-aura">
        <ellipse cx="190" cy="180" rx="180" ry="140" fill="url(#aDarkAura)">
          <animate attributeName="rx" values="180;190;180" dur="5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.7;0.4" dur="5s" repeatCount="indefinite" />
        </ellipse>
        {/* 龙焰粒子 */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <circle key={i} r="3" fill={`hsl(${350 + i * 10}, 80%, 50%)`} opacity="0.5">
            <animate attributeName="cx" values={`${150 + i * 15};${160 + i * 15}`} dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
            <animate attributeName="cy" values={`${120 + i * 20};${115 + i * 20}`} dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
        ))}
      </g>

      {/* ===== 身体组（悬浮呼吸）===== */}
      <g className="avenger-body">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-3;0,0" dur="4s" repeatCount="indefinite" />

        {/* 暗红披风（火焰飘动） */}
        <path className="a-cape" d="M80 200 Q50 150 90 110 Q130 70 190 65 Q250 70 310 100 Q360 140 340 190 Q320 230 270 250 Q210 260 160 250 Q110 240 80 200Z"
          fill="url(#aCape)" filter="url(#aGlow)" opacity="0.9">
          <animate attributeName="d" values="M80 200 Q50 150 90 110 Q130 70 190 65 Q250 70 310 100 Q360 140 340 190 Q320 230 270 250 Q210 260 160 250 Q110 240 80 200Z;M80 200 Q45 145 85 105 Q125 65 190 60 Q255 65 315 95 Q365 135 345 195 Q325 235 270 255 Q205 265 155 255 Q105 245 80 200Z;M80 200 Q50 150 90 110 Q130 70 190 65 Q250 70 310 100 Q360 140 340 190 Q320 230 270 250 Q210 260 160 250 Q110 240 80 200Z" dur="3.5s" repeatCount="indefinite" />
        </path>

        {/* 黑色龙鳞铠甲 */}
        <path d="M120 170 Q140 140 190 135 Q240 140 290 170 Q300 185 290 205 Q240 195 190 192 Q140 195 120 205 Q110 185 120 170Z"
          fill="url(#aArmor)" />
        {/* 龙鳞纹理 */}
        {[0, 1, 2].map(i => (
          <path key={i} d={`M${155 + i * 35} ${158 + i * 5} Q${170 + i * 35} ${152 + i * 5} ${185 + i * 35} ${158 + i * 5}`} stroke="#6C3483" strokeWidth="1" fill="none" opacity="0.4" />
        ))}

        {/* 右臂（伸展，食指指向白贞德 - 上帝手势） */}
        <g className="a-right-arm">
          <animateTransform attributeName="transform" type="translate" values="0,0;2,-1;0,0" dur="3s" repeatCount="indefinite" />
          {/* 上臂 */}
          <path d="M280 180 Q310 170 330 178 Q345 188 340 200 Q335 210 320 212Z" fill="url(#aArmor)" />
          {/* 前臂 + 手 */}
          <path d="M320 212 Q340 218 355 225 Q365 232 362 242 Q358 250 348 248 L338 240 Q342 232 338 228 Q330 222 320 225Z" fill="url(#aHair)" />
          {/* 右手食指（直指白贞德，能量丝线起点） */}
          <g transform="translate(362, 242)">
            <path d="M0,0 L8,-12" stroke="url(#aHair)" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* 指尖暗红+金能量丝线 */}
            <path d="M8,-12 L12,-16" stroke="#C0392B" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" />
            </path>
            <path d="M8,-12 L14,-14" stroke="#FFD700" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.2s" repeatCount="indefinite" />
            </path>
          </g>
        </g>

        {/* 左臂（自然放置） */}
        <path d="M130 180 Q110 190 115 205 Q120 215 135 210Z" fill="url(#aArmor)" />

        {/* 剑（腰间，旗不精叛击） */}
        <g transform="translate(260, 185) rotate(15)">
          <rect x="0" y="0" width="3" height="55" fill="#C0C0C0" />
          <path d="M-3,0 L8,0 L3,-8 L-3,-8Z" fill="#1a1a2e" />
        </g>
      </g>

      {/* ===== 头部组 ===== */}
      <g className="avenger-head">
        <animateTransform attributeName="transform" type="translate" values="0,0;1,-1;0,0" dur="5s" repeatCount="indefinite" />

        {/* 白发（散开，能量场中飞舞） */}
        <g className="a-hair">
          <animateTransform attributeName="transform" type="rotate" values="-1,190,80;1,190,80;-1,190,80" dur="4s" repeatCount="indefinite" />
          <path d="M150 100 Q130 75 135 50 Q145 30 165 25 Q190 20 215 28 Q245 38 260 60 Q270 80 265 105 Q255 125 240 130 Q215 125 190 120 Q165 115 150 100Z"
            fill="url(#aHair)" />
          {/* 发丝飞舞 */}
          <path d="M260 75 Q280 60 300 70 Q310 82 295 95" stroke="#E8E8E8" strokeWidth="2" fill="none" opacity="0.6">
            <animate attributeName="d" values="M260 75 Q280 60 300 70 Q310 82 295 95;M260 75 Q285 55 305 65 Q318 78 300 92;M260 75 Q280 60 300 70 Q310 82 295 95" dur="3s" repeatCount="indefinite" />
          </path>
          <path d="M155 60 Q140 45 130 55 Q125 68 140 78" stroke="#E8E8E8" strokeWidth="2" fill="none" opacity="0.5">
            <animate attributeName="d" values="M155 60 Q140 45 130 55 Q125 68 140 78;M155 60 Q137 42 127 52 Q122 65 138 76;M155 60 Q140 45 130 55 Q125 68 140 78" dur="3.5s" repeatCount="indefinite" begin="0.5s" />
          </path>
        </g>

        {/* 头部 */}
        <ellipse cx="195" cy="90" rx="34" ry="30" fill="#FFF5E6" />

        {/* 刘海（白） */}
        <path d="M165 76 Q175 63 195 60 Q215 63 235 76 Q231 73 215 70 Q195 66 175 70 Q165 74 165 76Z"
          fill="url(#aHair)" />

        {/* 额头黑饰 + 耳坠 */}
        <path d="M175 72 Q195 60 215 72 Q212 67 195 63 Q178 67 175 72Z" fill="#2a1a2e" />
        <ellipse cx="175" cy="80" rx="2" ry="3" fill="#6C3483" />
        <ellipse cx="215" cy="80" rx="2" ry="3" fill="#6C3483" />

        {/* 眼睛（金黄色竖瞳） */}
        <g>
          {/* 左眼 */}
          <ellipse cx="183" cy="92" rx="7" ry="8" fill="white" />
          <ellipse cx="183" cy="92" rx="5" ry="7" fill="#DAA520" />
          {/* 竖瞳 */}
          <rect x="181" y="88" width="3" height="8" rx="1" fill="#8B6914" />
          <circle cx="182" cy="91" r="1.5" fill="white" />
          <path d="M175 86 Q183 82 191 86" stroke="#6C3483" strokeWidth="1.5" fill="none" />
        </g>
        <g>
          {/* 右眼 */}
          <ellipse cx="207" cy="92" rx="7" ry="8" fill="white" />
          <ellipse cx="207" cy="92" rx="5" ry="7" fill="#DAA520" />
          <rect x="205" y="88" width="3" height="8" rx="1" fill="#8B6914" />
          <circle cx="206" cy="91" r="1.5" fill="white" />
          <path d="M199 86 Q207 82 215 86" stroke="#6C3483" strokeWidth="1.5" fill="none" />
        </g>

        {/* 嘴巴（嘴角微扬 - 高傲） */}
        <path d="M190 102 Q198 107 206 102" stroke="#A0522D" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  中央GNN核心（两指之间的知识之火）
// ════════════════════════════════════════════════════════════╝

function CentralGnnCore() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#F4D03F" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F4D03F" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 外光晕 */}
      <circle cx="60" cy="60" r="55" fill="url(#coreGlow)" opacity="0.3">
        <animate attributeName="r" values="50;58;50" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* 六边形核心 */}
      <g>
        <animateTransform attributeName="transform" type="rotate" values="0 60 60;360 60 60" dur="20s" repeatCount="indefinite" />
        <path d={hexPath(60, 60, 28)} fill="rgba(244,208,63,0.15)" stroke="#F4D03F" strokeWidth="1.5" />
        {/* 内部节点 */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (Math.PI / 3) * i;
          const x = 60 + 16 * Math.cos(angle);
          const y = 60 + 16 * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="4" fill="#64b4ff" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>;
        })}
        {/* 中心节点 */}
        <circle cx="60" cy="60" r="6" fill="#FF6B6B" opacity="0.9">
          <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* 连接线 */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (Math.PI / 3) * i;
          const x = 60 + 16 * Math.cos(angle);
          const y = 60 + 16 * Math.sin(angle);
          return <line key={i} x1="60" y1="60" x2={x} y2={y} stroke="#64b4ff" strokeWidth="0.8" opacity="0.4" />;
        })}
      </g>
      {/* 光点沿六边形边流动 */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <circle key={i} r="2" fill="#FFD700">
          <animateMotion path={`M${60 + 28 * Math.cos((Math.PI / 3) * i)} ${60 + 28 * Math.sin((Math.PI / 3) * i)} A28,28 0 0,1 ${60 + 28 * Math.cos((Math.PI / 3) * ((i + 1) % 6))} ${60 + 28 * Math.sin((Math.PI / 3) * ((i + 1) % 6))}`} dur="3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
        </circle>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════╗
//  主组件
// ════════════════════════════════════════════════════════════╝

export default function JoanLearningGNN() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [orbitalPhase, setOrbitalPhase] = useState(0);

  // 轨道动画计时器
  useEffect(() => {
    const timer = setInterval(() => {
      setOrbitalPhase(p => p + 0.005);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // 统计节点总数（用于轨道分布）
  const totalNodes = Object.values(GNN_CATEGORIES).reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="w-full">
      {/* 场景容器 - 2:1 宽屏比例（创造亚当横构图） */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ paddingTop: '50%' /* 2:1 比例 */ }}
      >
        {/* ── 场景内容绝对定位 ── */}
        <div className="absolute inset-0">

          {/* 背景 - 透明（用户要求镂空） */}
          <div className="absolute inset-0" style={{ background: 'transparent' }} />

          {/* 暗色能量场（黑贞侧） */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 75% 50%, rgba(108,52,131,0.08) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* 圣光场（白贞德侧） */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 25% 50%, rgba(255,215,0,0.06) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* ===== 黑贞侧粒子 ===== */}
          <ParticlesCanvas side="black" />

          {/* ===== Ruler白贞德（左侧 - 亚当位置）===== */}
          <div className="absolute" style={{
            left: '2%',
            top: '5%',
            width: '46%',
            height: '90%',
            zIndex: 20,
          }}>
            <RulerJeanneSvg />
          </div>

          {/* ===== 中央GNN核心（两指之间）===== */}
          <div className="absolute" style={{
            left: 'calc(50% - 30px)',
            top: 'calc(50% - 30px)',
            width: '60px',
            height: '60px',
            zIndex: 25,
          }}>
            <CentralGnnCore />
          </div>

          {/* ===== Avenger黑贞（右侧 - 上帝位置）===== */}
          <div className="absolute" style={{
            right: '2%',
            top: '5%',
            width: '46%',
            height: '90%',
            zIndex: 20,
          }}>
            <AvengerJeanneSvg />
          </div>

          {/* ===== 白贞德侧粒子 ===== */}
          <ParticlesCanvas side="white" />

          {/* ===== GNN知识节点（SVG覆盖层）===== */}
          <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="nodeGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* 按类别渲染节点 */}
            {Object.entries(GNN_CATEGORIES).map(([catKey, cat]) => {
              const catIdx = Object.keys(GNN_CATEGORIES).indexOf(catKey);
              // 每类节点分布在不同轨道上
              const orbitRx = 280 + catIdx * 40;
              const orbitRy = 80 + catIdx * 20;
              return cat.items.map((_, itemIdx) => (
                <GnnNodeSvg
                  key={`${catKey}-${itemIdx}`}
                  catKey={catKey as CategoryKey}
                  idx={itemIdx}
                  total={cat.items.length}
                  orbitRx={orbitRx}
                  orbitRy={orbitRy}
                  phase={orbitalPhase + catIdx * 0.5}
                />
              ));
            })}
            {/* 节点间连线（同类实线） */}
            {/* 简化：绘制几根代表性连线 */}
            <line x1="320" y1="140" x2="400" y2="160" stroke="#F4D03F" strokeWidth="0.8" opacity="0.3" strokeDasharray="4,4">
              <animate attributeName="stroke-dashoffset" values="0;8" dur="1s" repeatCount="indefinite" />
            </line>
            <line x1="450" y1="180" x2="520" y2="200" stroke="#3498DB" strokeWidth="0.8" opacity="0.3" strokeDasharray="4,4">
              <animate attributeName="stroke-dashoffset" values="0;8" dur="1.2s" repeatCount="indefinite" />
            </line>
            <line x1="380" y1="240" x2="440" y2="260" stroke="#2ECC71" strokeWidth="0.8" opacity="0.3" strokeDasharray="4,4">
              <animate attributeName="stroke-dashoffset" values="0;8" dur="0.9s" repeatCount="indefinite" />
            </line>
            <line x1="340" y1="220" x2="420" y2="240" stroke="#9B59B6" strokeWidth="0.8" opacity="0.3" strokeDasharray="4,4">
              <animate attributeName="stroke-dashoffset" values="0;8" dur="1.1s" repeatCount="indefinite" />
            </line>
          </svg>

        </div>
      </div>

      {/* CSS动画关键帧 */}
      <style>{`
        /* 知识节点浮动 */
        @keyframes nodeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .gnn-node-group:hover {
          filter: url(#nodeGlow) brightness(1.3) !important;
          transform: scale(1.15) !important;
          z-index: 50;
        }

        /* 减少动画（无障碍） */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
