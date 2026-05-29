import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ========================================
// JoanLearningGNN - Ruler贞德祈祷姿态 + 星球轨道知识系统
// 单人居中构图 · 椭圆轨道环绕 · 透明背景 · FGO原形像精细重绘
// ========================================

const NODE_LINKS: Record<string, string> = {
  GCN: '/knowledge?topic=GCN',
  GAT: '/knowledge?topic=GAT',
  GraphSAGE: '/knowledge?topic=GraphSAGE',
  GIN: '/knowledge?topic=GIN',
  'CrossEntropy': '/knowledge?topic=CrossEntropy',
  Contrastive: '/knowledge?topic=ContrastiveLoss',
  Triplet: '/knowledge?topic=TripletLoss',
  Cora: '/knowledge?topic=CoraDataset',
  PubMed: '/knowledge?topic=PubMedDataset',
  Reddit: '/knowledge?topic=RedditDataset',
  'MessagePassing': '/knowledge?topic=MessagePassing',
  Aggregation: '/knowledge?topic=Aggregation',
  Embedding: '/knowledge?topic=NodeEmbedding',
  Attention: '/knowledge?topic=AttentionMechanism',
  Spectral: '/knowledge?topic=SpectralGraph',
};

interface KnowledgeNode {
  id: string;
  label: string;
  labelCn?: string;
  type: 'gnn' | 'loss' | 'dataset' | 'basic';
  orbitIndex: number;
  angleOffset: number;
  speed: number;
}

const KNOWLEDGE_NODES: KnowledgeNode[] = [
  // 轨道0：内圈（紧贴角色，快速）
  { id: 'gnn1', label: 'GCN', type: 'gnn', orbitIndex: 0, angleOffset: 0, speed: 1.2 },
  { id: 'gnn2', label: 'GAT', type: 'gnn', orbitIndex: 0, angleOffset: 120, speed: 1.0 },
  { id: 'gnn3', label: 'GraphSAGE', type: 'gnn', orbitIndex: 0, angleOffset: 240, speed: 0.9 },

  // 轨道1：中圈
  { id: 'loss1', label: 'CrossEntropy', type: 'loss', orbitIndex: 1, angleOffset: 45, speed: 0.8 },
  { id: 'loss2', label: 'Contrastive', type: 'loss', orbitIndex: 1, angleOffset: 165, speed: 0.75 },
  { id: 'loss3', label: 'Triplet', type: 'loss', orbitIndex: 1, angleOffset: 285, speed: 0.7 },
  { id: 'ds1', label: 'Cora', type: 'dataset', orbitIndex: 1, angleOffset: 105, speed: 0.85 },
  { id: 'ds2', label: 'PubMed', type: 'dataset', orbitIndex: 1, angleOffset: 225, speed: 0.8 },

  // 轨道2：外圈（最远，慢速）
  { id: 'basics1', label: 'MessagePassing', labelCn: '消息传递', type: 'basic', orbitIndex: 2, angleOffset: 15, speed: 0.5 },
  { id: 'basics2', label: 'Aggregation', labelCn: '聚合函数', type: 'basic', orbitIndex: 2, angleOffset: 87, speed: 0.55 },
  { id: 'basics3', label: 'Embedding', labelCn: '节点嵌入', type: 'basic', orbitIndex: 2, angleOffset: 159, speed: 0.5 },
  { id: 'basics4', label: 'Attention', labelCn: '注意力机制', type: 'basic', orbitIndex: 2, angleOffset: 231, speed: 0.45 },
  { id: 'basics5', label: 'Spectral', labelCn: '谱域方法', type: 'basic', orbitIndex: 2, angleOffset: 303, speed: 0.4 },
  { id: 'gnn4', label: 'GIN', type: 'gnn', orbitIndex: 2, angleOffset: 330, speed: 0.48 },
  { id: 'ds3', label: 'Reddit', type: 'dataset', orbitIndex: 2, angleOffset: 195, speed: 0.52 },
];

const TYPE_CONFIG = {
  gnn:    { fill: '#4DA6FF', stroke: '#2178C7', glow: 'rgba(77,166,255,0.5)', text: '#FFFFFF', shape: 'hex' as const },
  loss:   { fill: '#FF7F50', stroke: '#E55B3B', glow: 'rgba(255,127,80,0.5)', text: '#FFFFFF', shape: 'circle' as const },
  dataset:{ fill: '#00C9A7', stroke: '#01A084', glow: 'rgba(0,201,167,0.5)', text: '#FFFFFF', shape: 'rect' as const },
  basic:  { fill: '#A78BFA', stroke: '#8B5CF6', glow: 'rgba(167,139,250,0.5)', text: '#FFFFFF', shape: 'diamond' as const },
};

// 椭圆轨道参数 — 整体上移
const ORBITS = [
  { rx: 200, ry: 120 },   // 内圈
  { rx: 320, ry: 185 },   // 中圈
  { rx: 470, ry: 270 },   // 外圈
];

// 角色中心Y坐标（从370上移到260）
const CHAR_CENTER_Y = 260;
const ORBIT_CENTER_Y = 220;

export default function JoanLearningGNN() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  // JS驱动轨道运动
  useEffect(() => {
    if (reducedMotion) return;
    const svg = svgRef.current;
    if (!svg) return;

    const nodeGroups = svg.querySelectorAll('[data-orbit-node]');
    const startTime = Date.now();

    let animId: number;
    function tick() {
      const elapsed = (Date.now() - startTime) / 1000;

      nodeGroups.forEach((g) => {
        const el = g as SVGGElement;
        const orbitIdx = parseInt(el.dataset.orbitIndex || '0');
        const offset = parseFloat(el.dataset.angleOffset || '0');
        const spd = parseFloat(el.dataset.speed || '1');

        const orbit = ORBITS[orbitIdx] || ORBITS[0];
        const angle = ((offset + elapsed * spd * 15) % 360) * (Math.PI / 180);

        const cx = 600 + orbit.rx * Math.cos(angle);
        const cy = ORBIT_CENTER_Y + orbit.ry * Math.sin(angle);

        el.setAttribute('transform', `translate(${cx}, ${cy})`);
      });

      animId = requestAnimationFrame(tick);
    }
    tick();

    return () => cancelAnimationFrame(animId);
  }, [reducedMotion]);

  const renderNodeShape = (type: KnowledgeNode['type'], size: number) => {
    const config = TYPE_CONFIG[type];
    switch (config.shape) {
      case 'hex':
        return <polygon points={`0,-${size} ${size*0.866},-${size*0.5} ${size*0.866},${size*0.5} 0,${size} -${size*0.866},${size*0.5} -${size*0.866},-${size*0.5}`} />;
      case 'circle':
        return <circle r={size} />;
      case 'rect':
        return <rect x={-size} y={-size * 0.65} width={size * 2} height={size * 1.3} rx={5} />;
      case 'diamond':
        return <polygon points={`0,-${size} ${size},0 0,${size} -${size},0`} />;
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 560,
      background: 'transparent',
      overflow: 'visible',
    }}>
      <svg
        ref={svgRef}
        viewBox="0 0 1200 560"
        style={{ width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 发光滤镜 */}
          <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="holy-glow-filter" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="16" result="b" />
            <feFlood floodColor="#FFD700" floodOpacity="0.15" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* ===== 渐变定义 ===== */}
          <linearGradient id="hair-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE570" />
            <stop offset="30%" stopColor="#FFDD38" />
            <stop offset="65%" stopColor="#E8B81A" />
            <stop offset="100%" stopColor="#C9960C" />
          </linearGradient>
          <linearGradient id="hair-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFF3B8" />
            <stop offset="50%" stopColor="#FFE066" />
            <stop offset="100%" stopColor="#DAA520" />
          </linearGradient>

          <linearGradient id="armor-main" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAFAFA" />
            <stop offset="25%" stopColor="#F0F0F0" />
            <stop offset="60%" stopColor="#E2E2E2" />
            <stop offset="100%" stopColor="#C8C8C8" />
          </linearGradient>
          <linearGradient id="armor-dark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D8D8D8" />
            <stop offset="100%" stopColor="#A8A8A8" />
          </linearGradient>
          <linearGradient id="armor-gold-trim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE55E" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B8962E" />
          </linearGradient>

          <linearGradient id="cape-purple" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8E44AD" />
            <stop offset="40%" stopColor="#71368A" />
            <stop offset="100%" stopColor="#4A235A" />
          </linearGradient>
          <linearGradient id="cape-inner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A569BD" />
            <stop offset="100%" stopColor="#6C3483" />
          </linearGradient>

          <linearGradient id="skin-tone" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFECD8" />
            <stop offset="60%" stopColor="#F5DEC0" />
            <stop offset="100%" stopColor="#EDCBA8" />
          </linearGradient>
          <linearGradient id="skin-shadow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0D5BE" />
            <stop offset="100%" stopColor="#E0BCA0" />
          </linearGradient>

          <radialGradient id="holy-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(255,223,100,0.22)" />
            <stop offset="40%" stopColor="rgba(255,215,0,0.10)" />
            <stop offset="100%" stopColor="rgba(255,215,0,0)" />
          </radialGradient>

          <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%">
              <animate attributeName="stop-color" values="#FFD700;#FFECB3;#FFD700" dur="4s" repeatCount="indefinite" />
              <animate attributeName="stop-opacity" values="0.28;0.14;0.28" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="cross-white" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E8E0F0" />
          </linearGradient>

          <linearGradient id="crown-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE566" />
            <stop offset="40%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#DAA520" />
          </linearGradient>
          <linearGradient id="gem-purple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9B59B6" />
            <stop offset="50%" stopColor="#7D3C98" />
            <stop offset="100%" stopColor="#5B2C6F" />
          </linearGradient>

          {/* 节点发光滤镜 */}
          <filter id="node-glow-gnn" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feFlood floodColor="#4DA6FF" floodOpacity="0.5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="node-glow-loss" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feFlood floodColor="#FF7F50" floodOpacity="0.5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="node-glow-dataset" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feFlood floodColor="#00C9A7" floodOpacity="0.5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="node-glow-basic" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feFlood floodColor="#A78BFA" floodOpacity="0.5" result="c" />
            <feComposite in="c" in2="b" operator="in" result="d" />
            <feMerge><feMergeNode in="d" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ════════ 第1层：圣光光晕背景 ════════ */}
        <ellipse cx="600" cy={CHAR_CENTER_Y - 20} rx="200" ry="240" fill="url(#aura-glow)" />

        {/* ════════ 第2层：椭圆轨道线 ════════ */}
        {ORBITS.map((orbit, i) => (
          <ellipse
            key={`orbit-${i}`}
            cx="600" cy={ORBIT_CENTER_Y}
            rx={orbit.rx}
            ry={orbit.ry}
            fill="none"
            stroke={['rgba(77,166,255,0.25)', 'rgba(255,127,80,0.18)', 'rgba(167,139,250,0.15)'][i]}
            strokeWidth={[1.5, 1, 0.8][i]}
            strokeDasharray={[null, '8 4', '4 6'][i] as unknown as undefined}
          />
        ))}

        {/* ════════ 第3层：Ruler贞德 精细SVG角色 ════════ */}
        <g id="ruler-jeanne-prayer" transform={`translate(600, ${CHAR_CENTER_Y})`}>
          {/* 呼吸动画组 */}
          <g style={{ transformOrigin: 'center bottom' }}>
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1,1; 1.01,1.015; 1,1"
              dur="3.5s"
              repeatCount="indefinite"
            />

            {/* ========== 披风（后层）========== */}
            <g opacity="0.92">
              {/* 主披风体 — 大幅飘动 */}
              <path d="
                M-88,-10
                Q-145,60 -130,140
                Q-115,210 -60,215
                Q-10,205 25,145
                Q55,75 88,-10
                Q105,-42 90,-72
                Q55,-108 0,-102
                Q-58,-108 -90,-72Z
              " fill="url(#cape-purple)">
                <animateTransform
                  attributeName="transform" type="rotate"
                  values="-2 0 100; 2.5 0 100; -2 0 100"
                  dur="5.5s" repeatCount="indefinite"
                />
              </path>
              {/* 折叠阴影线 */}
              <path d="M-70,30 Q-40,90 -15,140 Q10,90 35,30"
                fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" opacity="0.6"/>
              <path d="M-50,50 Q-25,100 0,150 Q25,100 50,50"
                fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>

              {/* === 披风内侧：洛林十字（白底紫边）=== */}
              <g transform="translate(0, 55)" opacity="0.85">
                {/* 十字白底光晕 */}
                <rect x="-18" y="-28" width="36" height="70" rx="3" fill="white" opacity="0.15"/>
                {/* 十字主体 — 横条 */}
                <rect x="-14" y="-4" width="28" height="14" rx="2" fill="url(#cross-white)"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="1"/>
                {/* 十字主体 — 竖条（长）*/}
                <rect x="-4" y="-26" width="8" height="62" rx="2" fill="url(#cross-white)"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="1"/>
                {/* 金色描边强调 */}
                <rect x="-14" y="-4" width="28" height="14" rx="2" fill="none" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5"/>
                <rect x="-4" y="-26" width="8" height="62" rx="2" fill="none" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5"/>
              </g>
            </g>

            {/* ========== 铠甲身体 ========== */}
            <g id="armor-body">
              {/* 铠甲主体轮廓 */}
              <path d="
                M-54,-58 L54,-58
                Q66,-30 68,10
                Q70,55 52,118
                L42,125
                Q20,132 0,132
                Q-20,132 -42,125
                L-52,118
                Q-70,55 -68,10
                Q-66,-30 -54,-58Z
              " fill="url(#armor-main)" stroke="#B0B0B0" strokeWidth="0.8"/>

              {/* 铠甲中线分割 */}
              <line x1="0" y1="-56" x2="0" y2="128" stroke="#CCC" strokeWidth="1.2" opacity="0.5"/>
              {/* 铠甲横向分割线 — 胸部 */}
              <line x1="-46" y1="-20" x2="46" y2="-20" stroke="#BBB" strokeWidth="0.8" opacity="0.3"/>
              <line x1="-50" y1="25" x2="50" y2="25" stroke="#BBB" strokeWidth="0.8" opacity="0.3"/>
              <line x1="-48" y1="70" x2="48" y2="70" stroke="#BBB" strokeWidth="0.8" opacity="0.3"/>

              {/* 胸甲高光区域 */}
              <path d="M-40,-40 Q0,-26 40,-40 L36,15 Q0,32 -36,15Z"
                fill="white" opacity="0.35"/>
              <path d="M-38,30 Q0,42 38,30 L34,65 Q0,78 -34,65Z"
                fill="white" opacity="0.18"/>

              {/* === 胸前白色洛林十字（FGO标志性）=== */}
              <g transform="translate(0, -5)">
                {/* 十字底座（微凸） */}
                <rect x="-11" y="-18" width="22" height="40" rx="2" fill="white"
                  stroke="#E0D8F0" strokeWidth="0.8"/>
                {/* 十字横臂 */}
                <rect x="-18" y="-7" width="36" height="14" rx="2" fill="white"
                  stroke="#E8E0F8" strokeWidth="0.8"/>
                {/* 紫色内核 */}
                <rect x="-7" y="-14" width="14" height="32" rx="1.5" fill="#F0EBFA"
                  stroke="#9B59B6" strokeWidth="0.6"/>
                <rect x="-14" y="-4" width="28" height="10" rx="1.5" fill="#F0EBFA"
                  stroke="#9B59B6" strokeWidth="0.6"/>
                {/* 中央宝石 */}
                <circle cx="0" cy="0" r="5" fill="url(#gem-purple)"
                  stroke="#D4AF37" strokeWidth="1">
                  <animate attributeName="opacity" values="0.9;1;0.9" dur="2.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="-1" cy="-1.5" r="1.8" fill="#E8D4F0" opacity="0.8"/>
              </g>

              {/* 肩甲（左）— 多层结构 */}
              <g id="pauldron-L">
                <path d="M-54,-54 Q-76,-42 -74,-18 Q-70,-2 -54,-8 Z"
                  fill="url(#armor-main)" stroke="#AAA" strokeWidth="1"/>
                <path d="M-54,-50 Q-68,-40 -66,-22 Q-64,-10 -54,-14 Z"
                  fill="white" opacity="0.2"/>
                {/* 金色镶边 */}
                <path d="M-54,-54 Q-76,-42 -74,-18" fill="none"
                  stroke="url(#armor-gold-trim)" strokeWidth="1.5"/>
                {/* 铆钉 */}
                <circle cx="-62" cy="-32" r="1.5" fill="#D4AF37"/>
                <circle cx="-60" cy="-16" r="1.5" fill="#D4AF37"/>
              </g>
              {/* 肩甲（右）— 镜像 */}
              <g id="pauldron-R">
                <path d="M54,-54 Q76,-42 74,-18 Q70,-2 54,-8 Z"
                  fill="url(#armor-main)" stroke="#AAA" strokeWidth="1"/>
                <path d="M54,-50 Q68,-40 66,-22 Q64,-10 54,-14 Z"
                  fill="white" opacity="0.2"/>
                <path d="M54,-54 Q76,-42 74,-18" fill="none"
                  stroke="url(#armor-gold-trim)" strokeWidth="1.5"/>
                <circle cx="62" cy="-32" r="1.5" fill="#D4AF37"/>
                <circle cx="60" cy="-16" r="1.5" fill="#D4AF37"/>
              </g>

              {/* 腰带 */}
              <rect x="-46" y="95" width="92" height="14" rx="3"
                fill="#4A2863" stroke="#6B3FA0" strokeWidth="1"/>
              {/* 腰扣 */}
              <rect x="-8" y="93" width="16" height="18" rx="2"
                fill="url(#armor-gold-trim)" stroke="#B8962E" strokeWidth="0.8"/>
              <circle cx="0" cy="102" r="3" fill="#9B59B6"/>

              {/* 腹甲纹理 */}
              <path d="M-30,78 L30,78" stroke="#AAA" strokeWidth="0.5" opacity="0.4"/>
              <path d="M-28,84 L28,84" stroke="#AAA" strokeWidth="0.5" opacity="0.3"/>
            </g>

            {/* ========== 头部（FGO Ruler贞德风格） ========== */}
            <g transform="translate(0, -115)">
              {/* 脖子 */}
              <path d="M-14,24 L-12,50 L12,50 L14,24Z" fill="url(#skin-tone)"/>
              <ellipse cx="0" cy="37" rx="12" ry="14" fill="url(#skin-shadow)" opacity="0.4"/>

              {/* 脸型 — FGO稍长鹅蛋脸 */}
              <ellipse cx="0" cy="-8" rx="38" ry="48" fill="url(#skin-tone)"/>

              {/* 下颌线柔和阴影 */}
              <path d="M-32,18 Q-20,32 0,34 Q20,32 32,18"
                fill="none" stroke="url(#skin-shadow)" strokeWidth="2" opacity="0.3"/>

              {/* 耳朵（左） */}
              <ellipse cx="-38" cy="-2" rx="6" ry="10" fill="url(#skin-tone)"
                stroke="#E8C4A8" strokeWidth="0.5"/>
              {/* 耳朵（右） */}
              <ellipse cx="38" cy="-2" rx="6" ry="10" fill="url(#skin-tone)"
                stroke="#E8C4A8" strokeWidth="0.5"/>

              {/* === 刘海（FGO标志性的层次刘海）=== */}
              <g id="bangs">
                {/* 刘海主块 */}
                <path d="
                  M-40,-42
                  Q-22,-62 0,-57
                  Q22,-62 40,-42
                  Q34,-32 24,-37
                  Q12,-43 0,-40
                  Q-12,-43 -24,-37
                  Q-34,-32 -40,-42Z
                " fill="url(#hair-gold)"/>
                {/* 刘海高光 */}
                <path d="
                  M-28,-48 Q-14,-56 0,-53
                  Q-8,-46 -18,-44
                  Q-26,-48 -28,-48Z
                " fill="url(#hair-highlight)" opacity="0.6"/>
                {/* 中分缝隙 */}
                <path d="M0,-57 Q1,-45 2,-39" fill="none"
                  stroke="#C9960C" strokeWidth="0.8" opacity="0.4"/>
                {/* 刘海发丝细节 */}
                <path d="M-22,-46 Q-14,-55 -5,-49" fill="none"
                  stroke="#DAA520" strokeWidth="0.7" opacity="0.5"/>
                <path d="M5,-49 Q14,-55 22,-46" fill="none"
                  stroke="#DAA520" strokeWidth="0.7" opacity="0.5"/>
                {/* 侧发缕 */}
                <path d="M-38,-38 Q-44,-28 -40,-18" fill="none"
                  stroke="url(#hair-gold)" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
                <path d="M38,-38 Q44,-28 40,-18" fill="none"
                  stroke="url(#hair-gold)" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
              </g>

              {/* === 圣冠/头环（Ruler职阶标志）=== */}
              <g id="ruler-crown">
                {/* 冠环基底 */}
                <ellipse cx="0" cy="-58" rx="30" ry="8" fill="none"
                  stroke="url(#crown-gold)" strokeWidth="2"/>
                {/* 冠顶装饰 — V形尖刺 */}
                <polygon points="0,-76 -4,-64 4,-64" fill="url(#crown-gold)"
                  stroke="#DAA520" strokeWidth="0.5"/>
                <polygon points="-14,-70 -17,-61 -11,-61" fill="url(#crown-gold)"
                  stroke="#DAA520" strokeWidth="0.5"/>
                <polygon points="14,-70 17,-61 11,-61" fill="url(#crown-gold)"
                  stroke="#DAA520" strokeWidth="0.5"/>
                {/* 冠侧宝石 */}
                <circle cx="-22" cy="-60" r="2.5" fill="#9B59B6"
                  stroke="#D4AF37" strokeWidth="0.5"/>
                <circle cx="22" cy="-60" r="2.5" fill="#9B59B6"
                  stroke="#D4AF37" strokeWidth="0.5"/>
                {/* 中央大宝石 */}
                <circle cx="0" cy="-67" r="3.5" fill="#E8D4FF"
                  stroke="#9B59B6" strokeWidth="1">
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite"/>
                </circle>
                {/* 光芒 */}
                <g opacity="0.5">
                  <line x1="0" y1="-73" x2="0" y2="-80" stroke="#FFD700" strokeWidth="0.8">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
                  </line>
                  <line x1="-6" y1="-69" x2="-10" y2="-74" stroke="#FFD700" strokeWidth="0.6">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="0.3s" repeatCount="indefinite"/>
                  </line>
                  <line x1="6" y1="-69" x2="10" y2="-74" stroke="#FFD700" strokeWidth="0.6">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="0.6s" repeatCount="indefinite"/>
                  </line>
                </g>
              </g>

              {/* === 表情：闭眼祈祷 === */}

              {/* 左眼 — 优雅闭眼弧线 + 睫毛 */}
              <path d="M-24,-6 Q-16,-2 -7,-7" stroke="#3D2B1F" strokeWidth="2.5"
                fill="none" strokeLinecap="round"/>
              {/* 右眼 */}
              <path d="M7,-6 Q16,-2 24,-7" stroke="#3D2B1F" strokeWidth="2.5"
                fill="none" strokeLinecap="round"/>
              {/* 上睫毛（更明显） */}
              <path d="M-23,-7 Q-16,-11 -8,-7.5" stroke="#3D2B1F" strokeWidth="1.2"
                fill="none" opacity="0.45"/>
              <path d="M8,-7.5 Q16,-11 23,-7" stroke="#3D2B1F" strokeWidth="1.2"
                fill="none" opacity="0.45"/>
              {/* 下睫毛暗示 */}
              <path d="M-21,-5 Q-15,-3 -9,-5.5" stroke="#3D2B1F" strokeWidth="0.6"
                fill="none" opacity="0.25"/>
              <path d="M9,-5.5 Q15,-3 21,-5" stroke="#3D2B1F" strokeWidth="0.6"
                fill="none" opacity="0.25"/>

              {/* 眉毛 — 放松自然弯度 */}
              <path d="M-27,-20 Q-17,-27 -7,-22" stroke="#A08060" strokeWidth="1.8"
                fill="none" strokeLinecap="round"/>
              <path d="M7,-22 Q17,-27 27,-20" stroke="#A08060" strokeWidth="1.8"
                fill="none" strokeLinecap="round"/>

              {/* 鼻子 — 侧面光影 */}
              <path d="M0,-2 L1.5,12" stroke="#DDBBA8" strokeWidth="1.5"
                strokeLinecap="round" opacity="0.55"/>
              <path d="M0.5,4 Q3,7 4,11" stroke="#DDBBA8" strokeWidth="0.8"
                fill="none" strokeLinecap="round" opacity="0.3"/>
              {/* 鼻尖 */}
              <ellipse cx="2" cy="13" rx="2.5" ry="1.8" fill="#F0D5BE" opacity="0.5"/>

              {/* 嘴唇 — 温柔微笑（祈祷时的安详表情） */}
              <path d="M-9,22 Q0,29 10,21" stroke="#D4867A" strokeWidth="2.3"
                fill="none" strokeLinecap="round"/>
              {/* 下唇线 */}
              <path d="M-6,25.5 Q0,29.5 6,24.5" stroke="#C47868" strokeWidth="1"
                fill="none" opacity="0.35" strokeLinecap="round"/>
              {/* 唇彩高光 */}
              <path d="M-3,23 Q0,25 3,23" stroke="#F0A090" strokeWidth="0.6"
                fill="none" opacity="0.4" strokeLinecap="round"/>

              {/* 腮红 */}
              <ellipse cx="-20" cy="13" rx="9" ry="5.5" fill="#FFB6A3" opacity="0.28"/>
              <ellipse cx="20" cy="13" rx="9" ry="5.5" fill="#FFB6A3" opacity="0.28"/>

              {/* 额头圣光反射 */}
              <ellipse cx="0" cy="-32" rx="8" ry="4" fill="white" opacity="0.12"/>
            </g>

            {/* ========== 金色长发（FGO标志性超长编辫） ========== */}
            <g id="ruler-hair-main">
              {/* 后方长发背层 */}
              <path d="M0,-155
                Q-18,-135 -22,-95
                Q-25,-55 -14,-5
                Q-3,25 -8,55
                Q-13,85 -3,110"
                fill="none" stroke="url(#hair-gold)" strokeWidth="16"
                opacity="0.35" strokeLinecap="round"/>
              <path d="M0,-153
                Q18,-133 22,-93
                Q25,-53 14,-5
                Q3,25 8,55
                Q13,85 3,108"
                fill="none" stroke="url(#hair-gold)" strokeWidth="16"
                opacity="0.35" strokeLinecap="round"/>

              {/* === 左主辫（粗辫子+丝带）=== */}
              <g id="left-braid">
                {/* 辫子主体 — 从头侧垂落至腰部以下 */}
                <path d="
                  M-36,-148
                  Q-68,-122 -78,-72
                  Q-86,-22 -76,28
                  Q-68,68 -52,108
                  Q-42,136 -28,160
                  Q-18,170 -10,158
                  Q-16,132 -24,100
                  Q-36,58 -44,18
                  Q-50,-26 -40,-72
                  Q-34,-114 -36,-148Z
                " fill="url(#hair-gold)" stroke="#C9960C" strokeWidth="0.8">
                  <animateTransform attributeName="transform" type="rotate"
                    values="0 -42 0; 3 -42 0; 0 -42 0"
                    dur="4.5s" repeatCount="indefinite"/>
                </path>

                {/* 编辫纹理线条 */}
                <path d="M-52,-10 Q-46,35 -36,82 M-62,-30 Q-54,18 -44,65
                  M-70,-55 Q-60,-5 -50,45"
                  stroke="#D4AF37" strokeWidth="0.6" fill="none" opacity="0.35"/>

                {/* 边缘高光 */}
                <path d="M-38,-140 Q-64,-116 -74,-68 Q-80,-20 -72,24"
                  fill="none" stroke="url(#hair-highlight)" strokeWidth="3"
                  opacity="0.3" strokeLinecap="round"/>

                {/* 黑色蝴蝶结/丝带（辫尾） */}
                <g transform="translate(-18, 162)">
                  <ellipse cx="-10" cy="0" rx="10" ry="5" fill="#1A1A2E"
                    transform="rotate(-20)">
                    <animateTransform attributeName="transform" type="rotate"
                      values="-20; -8; -20" dur="3s" repeatCount="indefinite"/>
                  </ellipse>
                  <ellipse cx="10" cy="0" rx="10" ry="5" fill="#1A1A2E"
                    transform="rotate(20)">
                    <animateTransform attributeName="transform" type="rotate"
                      values="20; 32; 20" dur="3s" repeatCount="indefinite"/>
                  </ellipse>
                  <circle cx="0" cy="0" r="3" fill="#1A1A2E"/>
                  {/* 丝带尾部 */}
                  <path d="M0,3 Q2,14 -1,22" fill="none" stroke="#1A1A2E"
                    strokeWidth="3" strokeLinecap="round" opacity="0.8">
                    <animateTransform attributeName="transform" type="rotate"
                      values="0; 5; 0" dur="2.5s" repeatCount="indefinite"/>
                  </path>
                </g>
              </g>

              {/* === 右主辫（镜像）=== */}
              <g id="right-braid">
                <path d="
                  M36,-148
                  Q68,-122 78,-72
                  Q86,-22 76,28
                  Q68,68 52,108
                  Q42,136 28,160
                  Q18,170 10,158
                  Q16,132 24,100
                  Q36,58 44,18
                  Q50,-26 40,-72
                  Q34,114 36,-148Z
                " fill="url(#hair-gold)" stroke="#C9960C" strokeWidth="0.8">
                  <animateTransform attributeName="transform" type="rotate"
                    values="0 42 0; -3 42 0; 0 42 0"
                    dur="4.5s" repeatCount="indefinite"/>
                </path>

                {/* 编辫纹理 */}
                <path d="M52,-10 Q46,35 36,82 M62,-30 Q54,18 44,65
                  M70,-55 Q60,-5 50,45"
                  stroke="#D4AF37" strokeWidth="0.6" fill="none" opacity="0.35"/>

                {/* 高光 */}
                <path d="M38,-140 Q64,-116 74,-68 Q80,-20 72,24"
                  fill="none" stroke="url(#hair-highlight)" strokeWidth="3"
                  opacity="0.3" strokeLinecap="round"/>

                {/* 丝带（右） */}
                <g transform="translate(18, 162)">
                  <ellipse cx="-10" cy="0" rx="10" ry="5" fill="#1A1A2E"
                    transform="rotate(-20)">
                    <animateTransform attributeName="transform" type="rotate"
                      values="-20; -28; -20" dur="3s" repeatCount="indefinite"/>
                  </ellipse>
                  <ellipse cx="10" cy="0" rx="10" ry="5" fill="#1A1A2E"
                    transform="rotate(20)">
                    <animateTransform attributeName="transform" type="rotate"
                      values="20; 8; 20" dur="3s" repeatCount="indefinite"/>
                  </ellipse>
                  <circle cx="0" cy="0" r="3" fill="#1A1A2E"/>
                  <path d="M0,3 Q-2,14 1,22" fill="none" stroke="#1A1A2E"
                    strokeWidth="3" strokeLinecap="round" opacity="0.8">
                    <animateTransform attributeName="transform" type="rotate"
                      values="0; -5; 0" dur="2.5s" repeatCount="indefinite"/>
                  </path>
                </g>
              </g>

              {/* 头后方的散发补充 */}
              <path d="M-8,-150 Q-20,-120 -16,-80 Q-12,-40 -18,0"
                fill="none" stroke="url(#hair-gold)" strokeWidth="10"
                opacity="0.25" strokeLinecap="round"/>
              <path d="M8,-150 Q20,-120 16,-80 Q12,-40 18,0"
                fill="none" stroke="url(#hair-gold)" strokeWidth="10"
                opacity="0.25" strokeLinecap="round"/>
            </g>

            {/* ========== 两手合十祈祷姿态 ========== */}
            <g id="prayer-hands" transform="translate(0, 42)">
              {/* 小臂（左）— 银色铠甲袖 */}
              <path d="
                M-40,-2
                Q-55,-18 -50,-48
                Q-44,-75 -30,-98
                Q-20,-112 -7,-116
              " fill="none" stroke="url(#armor-main)" strokeWidth="20"
                strokeLinecap="round"/>
              {/* 内侧高光 */}
              <path d="
                M-40,-2
                Q-55,-18 -50,-48
                Q-44,-75 -30,-98
                Q-20,-112 -7,-116
              " fill="none" stroke="#EEE" strokeWidth="14"
                strokeLinecap="round" opacity="0.25"/>

              {/* 小臂（右） */}
              <path d="
                M40,-2
                Q55,-18 50,-48
                Q44,-75 30,-98
                Q20,-112 7,-116
              " fill="none" stroke="url(#armor-main)" strokeWidth="20"
                strokeLinecap="round"/>
              <path d="
                M40,-2
                Q55,-18 50,-48
                Q44,-75 30,-98
                Q20,-112 7,-116
              " fill="none" stroke="#EEE" strokeWidth="14"
                strokeLinecap="round" opacity="0.25"/>

              {/* 袖口金色饰边（左） */}
              <ellipse cx="-42" cy="0" rx="10" ry="6" fill="none"
                stroke="url(#armor-gold-trim)" strokeWidth="2"
                transform="rotate(-15 -42 0)"/>
              {/* 袖口（右） */}
              <ellipse cx="42" cy="0" rx="10" ry="6" fill="none"
                stroke="url(#armor-gold-trim)" strokeWidth="2"
                transform="rotate(15 42 0)"/>

              {/* 手掌合十主体 */}
              <ellipse cx="0" cy="-113" rx="17" ry="26"
                fill="url(#skin-tone)" stroke="#E8C4A8" strokeWidth="1.2"/>

              {/* 手指合十缝线 */}
              <line x1="0" y1="-137" x2="0" y2="-89"
                stroke="#E0B89A" strokeWidth="1.3" opacity="0.45"/>
              {/* 左手指纹暗示 */}
              <line x1="-7.5" y1="-134" x2="-6.5" y2="-91"
                stroke="#E0B89A" strokeWidth="0.8" opacity="0.3"/>
              {/* 右手指纹暗示 */}
              <line x1="7.5" y1="-134" x2="6.5" y2="-91"
                stroke="#E0B89A" strokeWidth="0.8" opacity="0.3"/>

              {/* 指尖汇聚的圣光 */}
              <g transform="translate(0, -138)">
                {/* 核心光点 */}
                <circle r="4" fill="#FFD700" opacity="0.7" filter="url(#glow-gold)">
                  <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s"
                    repeatCount="indefinite"/>
                  <animate attributeName="r" values="3;5.5;3" dur="2s"
                    repeatCount="indefinite"/>
                </circle>
                {/* 外环 */}
                <circle r="8" fill="none" stroke="#FFD700" strokeWidth="0.8"
                  opacity="0.4">
                  <animate attributeName="r" values="6;11;6" dur="2s"
                    repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s"
                    repeatCount="indefinite"/>
                </circle>
                {/* 向上的光芒射线 */}
                <line x1="0" y1="-5" x2="0" y2="-18" stroke="#FFD700"
                  strokeWidth="1" opacity="0.5">
                  <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2s"
                    repeatCount="indefinite"/>
                </line>
                <line x1="-4" y1="-6" x2="-8" y2="-15" stroke="#FFD700"
                  strokeWidth="0.6" opacity="0.3">
                  <animate attributeName="opacity" values="0.1;0.5;0.1" dur="2s"
                    begin="0.3s" repeatCount="indefinite"/>
                </line>
                <line x1="4" y1="-6" x2="8" y2="-15" stroke="#FFD700"
                  strokeWidth="0.6" opacity="0.3">
                  <animate attributeName="opacity" values="0.1;0.5;0.1" dur="2s"
                    begin="0.6s" repeatCount="indefinite"/>
                </line>
              </g>
            </g>
          </g>
        </g>

        {/* ════════ 第4层：知识节点（轨道运动） ════════ */}
        {KNOWLEDGE_NODES.map((node) => {
          const cfg = TYPE_CONFIG[node.type];
          const size = [34, 28, 24][node.orbitIndex];
          const fontSize = [15, 13, 12][node.orbitIndex];
          const filterId = `node-glow-${node.type}`;

          const orbit = ORBITS[node.orbitIndex];
          const rad = (node.angleOffset * Math.PI) / 180;
          const staticX = 600 + orbit.rx * Math.cos(rad);
          const staticY = ORBIT_CENTER_Y + orbit.ry * Math.sin(rad);

          return (
            <g
              key={node.id}
              data-orbit-node
              data-orbit-index={node.orbitIndex}
              data-angle-offset={node.angleOffset}
              data-speed={node.speed}
              transform={`translate(${staticX}, ${staticY})`}
              className="knowledge-node-group"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                const link = NODE_LINKS[node.label];
                if (link) navigate(link);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* 发光底层 */}
              <g filter={`url(#${filterId})`}>
                {renderNodeShape(node.type, size)}
              </g>
              {/* 本体 */}
              <g>{renderNodeShape(node.type, size)}</g>
              {/* 描边 */}
              <g fill="none" stroke={cfg.stroke} strokeWidth="1.8">
                {renderNodeShape(node.type, size)}
              </g>

              {/* 文字标签 */}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill={cfg.text}
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="'Inter', 'Noto Sans SC', sans-serif"
                pointerEvents="none"
                y={node.type === 'rect' ? 1 : 0}
              >
                {node.label.length > 10 ? node.labelCn || node.label : node.label}
              </text>

              {/* Tooltip */}
              {hoveredNode === node.id && (
                <g transform={`translate(0, ${-size - 22})`}>
                  <rect x={-65} y="-19" width={130} height="26" rx="5"
                    fill="rgba(20,20,30,0.93)" stroke={cfg.fill} strokeWidth="1.2"/>
                  <text textAnchor="middle" y="2" fill="white" fontSize="12"
                    fontFamily="'Inter', sans-serif" fontWeight="500">
                    {node.labelCn ? `${node.labelCn} (${node.label})` : node.label}
                  </text>
                  <polygon points="-5,8 5,8 0,15" fill="rgba(20,20,30,0.93)"/>
                </g>
              )}
            </g>
          );
        })}

        {/* ════════ 第5层：粒子效果 ════════ */}
        {!reducedMotion && (
          <>
            {[...Array(10)].map((_, i) => {
              const sx = 360 + Math.random() * 180;
              const sy = 340 + Math.random() * 120;
              const dur = 3 + Math.random() * 3;
              const delay = Math.random() * 4;
              return (
                <circle key={`gp-${i}`} cx={sx} cy={sy}
                  r={1.5 + Math.random() * 1.8}
                  fill="#FFD700" opacity={0.4 + Math.random() * 0.4}>
                  <animate attributeName="cy" from={sy} to={sy - 90 - Math.random() * 70}
                    dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0;0.7;0" dur={`${dur}s`}
                    begin={`${delay}s`} repeatCount="indefinite"/>
                  <animate attributeName="cx" from={sx} to={sx + 25 + Math.random() * 25}
                    dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
                </circle>
              );
            })}
            {[...Array(10)].map((_, i) => {
              const sx = 660 + Math.random() * 180;
              const sy = 340 + Math.random() * 120;
              const dur = 3 + Math.random() * 3;
              const delay = Math.random() * 4;
              return (
                <circle key={`gp-r-${i}`} cx={sx} cy={sy}
                  r={1.5 + Math.random() * 1.8}
                  fill="#FFD700" opacity={0.4 + Math.random() * 0.4}>
                  <animate attributeName="cy" from={sy} to={sy - 90 - Math.random() * 70}
                    dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0;0.7;0" dur={`${dur}s`}
                    begin={`${delay}s`} repeatCount="indefinite"/>
                  <animate attributeName="cx" from={sx} to={sx - 25 - Math.random() * 25}
                    dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
                </circle>
              );
            })}
          </>
        )}

        {/* ════════ 第6层：指尖上方汇聚光环 ════════ */}
        <g transform={`translate(600, ${CHAR_CENTER_Y - 100})`}>
          <circle r="8" fill="#FFD700" opacity="0.4" filter="url(#holy-glow-filter)">
            <animate attributeName="r" values="5;14;5" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite"/>
          </circle>
          {/* 汇聚光线 */}
          {[0, 40, 80, 120, 160, 200, 240, 280, 320].map(angle => (
            <line key={`ray-${angle}`}
              x1="0" y1="0"
              x2={Math.cos(angle * Math.PI / 180) * 40}
              y2={Math.sin(angle * Math.PI / 180) * 40}
              stroke="rgba(255,215,0,0.3)" strokeWidth="1" opacity="0">
              <animate attributeName="opacity" values="0;0.55;0" dur="2.5s"
                begin={`${angle * 0.006}s`} repeatCount="indefinite"/>
            </line>
          ))}
        </g>

        {/* 底部名称标签 */}
        <g transform="translate(600, 520)" opacity="0.7">
          <text textAnchor="middle" y="0" fill="#7D3C98" fontSize="13"
            fontWeight="bold" fontFamily="'Inter','Noto Sans SC',sans-serif"
            letterSpacing="4" opacity="0.7">
            RULER JEANNE D'ARC
          </text>
          <text textAnchor="middle" y="17" fill="#999" fontSize="10"
            fontFamily="'Noto Sans SC',sans-serif" opacity="0.5">
            圣女贞德 · 学术守护者
          </text>
        </g>
      </svg>

      {/* CSS样式注入 */}
      <style>{`
        .knowledge-node-group {
          transition: transform 0.25s ease, filter 0.3s ease;
        }
        .knowledge-node-group:hover {
          transform: scale(1.15);
          filter: brightness(1.2) drop-shadow(0 0 12px rgba(255,215,0,0.5));
        }
        @media (prefers-reduced-motion: reduce) {
          .knowledge-node-group,
          [data-orbit-node] {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
