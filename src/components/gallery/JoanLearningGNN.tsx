import { useEffect, useRef } from 'react';

// ========================================
// JoanLearningGNN - 《创造亚当》式SVG组件
// 纯SVG内联绘制，零<img>标签，背景透明
// ========================================

const NODE_LINKS: Record<string, string> = {
  GCN: '/knowledge-graph/gnn-types/gcn',
  GAT: '/knowledge-graph/gnn-types/gat',
  GraphSAGE: '/knowledge-graph/gnn-types/graphsage',
  GIN: '/knowledge-graph/gnn-types/gin',
  'Cross Entropy': '/knowledge-graph/loss-functions/cross-entropy',
  Contrastive: '/knowledge-graph/loss-functions/contrastive',
  'Triplet Margin': '/knowledge-graph/loss-functions/triplet',
  Cora: '/knowledge-graph/datasets/cora',
  CiteSeer: '/knowledge-graph/datasets/citeseer',
  PubMed: '/knowledge-graph/datasets/pubmed',
  Reddit: '/knowledge-graph/datasets/reddit',
  'Message Passing': '/knowledge-graph/basics/message-passing',
  Aggregation: '/knowledge-graph/basics/aggregation',
  Embedding: '/knowledge-graph/basics/node-embedding',
  Spectral: '/knowledge-graph/basics/spectral-domain',
  Spatial: '/knowledge-graph/basics/spatial-domain',
};

export default function JoanLearningGNN() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 生成SVG粒子
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const particleLayer = svg.querySelector('#particles-layer');
    if (!particleLayer) return;

    // 清空旧粒子
    while (particleLayer.firstChild) {
      particleLayer.removeChild(particleLayer.firstChild);
    }

    const ns = 'http://www.w3.org/2000/svg';

    // 白贞侧金色粒子（向上飘散）
    for (let i = 0; i < 10; i++) {
      const p = document.createElementNS(ns, 'circle');
      const r = Math.random() * 2 + 1;
      p.setAttribute('r', String(r));
      p.setAttribute('fill', '#FFD700');
      p.setAttribute('opacity', String(Math.random() * 0.5 + 0.3));
      const startX = 80 + Math.random() * 180;
      const startY = 320 + Math.random() * 150;
      p.setAttribute('cx', String(startX));
      p.setAttribute('cy', String(startY));

      const anim = document.createElementNS(ns, 'animate');
      anim.setAttribute('attributeName', 'cy');
      anim.setAttribute('values', `${startY};${startY - 80}`);
      anim.setAttribute('dur', `${3 + Math.random() * 2}s`);
      anim.setAttribute('repeatCount', 'indefinite');
      p.appendChild(anim);

      const animOp = document.createElementNS(ns, 'animate');
      animOp.setAttribute('attributeName', 'opacity');
      animOp.setAttribute('values', '0.6;0;0.6');
      animOp.setAttribute('dur', `${3 + Math.random() * 2}s`);
      animOp.setAttribute('repeatCount', 'indefinite');
      p.appendChild(animOp);

      particleLayer.appendChild(p);
    }

    // 黑贞侧暗红粒子（向下飘落）
    for (let i = 0; i < 10; i++) {
      const p = document.createElementNS(ns, 'circle');
      const r = Math.random() * 2 + 1;
      p.setAttribute('r', String(r));
      p.setAttribute('fill', '#C0392B');
      p.setAttribute('opacity', String(Math.random() * 0.5 + 0.3));
      const startX = 900 + Math.random() * 180;
      const startY = 250 + Math.random() * 100;
      p.setAttribute('cx', String(startX));
      p.setAttribute('cy', String(startY));

      const anim = document.createElementNS(ns, 'animate');
      anim.setAttribute('attributeName', 'cy');
      anim.setAttribute('values', `${startY};${startY + 80}`);
      anim.setAttribute('dur', `${3 + Math.random() * 2}s`);
      anim.setAttribute('repeatCount', 'indefinite');
      p.appendChild(anim);

      const animOp = document.createElementNS(ns, 'animate');
      animOp.setAttribute('attributeName', 'opacity');
      animOp.setAttribute('values', '0.6;0;0.6');
      animOp.setAttribute('dur', `${3 + Math.random() * 2}s`);
      animOp.setAttribute('repeatCount', 'indefinite');
      p.appendChild(animOp);

      particleLayer.appendChild(p);
    }
  }, []);

  // 节点交互
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const nodes = svg.querySelectorAll('.knode');
    const tooltipGroup = svg.querySelector('#tooltip-layer');
    const ns = 'http://www.w3.org/2000/svg';

    const handleEnter = (e: Event) => {
      const node = e.currentTarget as SVGGElement;
      const textEl = node.querySelector('text');
      if (!textEl || !tooltipGroup) return;

      const label = textEl.textContent || '';
      const bbox = node.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const tx = bbox.left - svgRect.left + bbox.width / 2;
      const ty = bbox.top - svgRect.top - 10;

      // 创建tooltip
      const tipG = document.createElementNS(ns, 'g');
      tipG.id = 'active-knode-tooltip';
      tipG.setAttribute('transform', `translate(${tx}, ${ty})`);

      const bg = document.createElementNS(ns, 'rect');
      bg.setAttribute('x', '-60');
      bg.setAttribute('y', '-28');
      bg.setAttribute('width', '120');
      bg.setAttribute('height', '24');
      bg.setAttribute('rx', '4');
      bg.setAttribute('fill', 'rgba(0,0,0,0.8)');
      tipG.appendChild(bg);

      const tipText = document.createElementNS(ns, 'text');
      tipText.setAttribute('text-anchor', 'middle');
      tipText.setAttribute('y', '-10');
      tipText.setAttribute('fill', '#FFD700');
      tipText.setAttribute('font-size', '11');
      tipText.setAttribute('font-weight', 'bold');
      tipText.textContent = label;
      tipG.appendChild(tipText);

      tooltipGroup.appendChild(tipG);

      // 高亮节点
      const shape = node.querySelector('polygon, circle, rect');
      if (shape) {
        shape.setAttribute('filter', 'url(#glow-bright)');
      }
    };

    const handleLeave = (e: Event) => {
      const node = e.currentTarget as SVGGElement;
      const tip = svg.querySelector('#active-knode-tooltip');
      if (tip) tip.remove();

      const shape = node.querySelector('polygon, circle, rect');
      if (shape) {
        const originalFilter = shape.getAttribute('data-filter');
        shape.setAttribute('filter', originalFilter || '');
      }
    };

    const handleClick = (e: Event) => {
      const node = e.currentTarget as SVGGElement;
      const textEl = node.querySelector('text');
      if (!textEl) return;
      const label = textEl.textContent || '';
      const link = NODE_LINKS[label];
      if (link) {
        window.location.href = link;
      }
    };

    nodes.forEach((node) => {
      node.addEventListener('mouseenter', handleEnter);
      node.addEventListener('mouseleave', handleLeave);
      node.addEventListener('click', handleClick);
    });

    return () => {
      nodes.forEach((node) => {
        node.removeEventListener('mouseenter', handleEnter);
        node.removeEventListener('mouseleave', handleLeave);
        node.removeEventListener('click', handleClick);
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="jeanne-gnn-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '700px',
        background: 'transparent',
        overflow: 'visible',
      }}
    >
      <svg
        ref={svgRef}
        id="main-svg"
        viewBox="0 0 1200 700"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* ======================================== */}
        {/* 1. 定义滤镜和渐变 */}
        {/* ======================================== */}
        <defs>
          {/* 发光滤镜 */}
          <filter id="glow-gold">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-blue">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-purple">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-bright">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 银色盔甲渐变 */}
          <linearGradient id="silver-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5F5F5" />
            <stop offset="50%" stopColor="#C0C0C8" />
            <stop offset="100%" stopColor="#8A8A95" />
          </linearGradient>

          {/* 核心渐变 */}
          <radialGradient id="core-gradient">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FF8C00" />
            <stop offset="100%" stopColor="#C0392B" />
          </radialGradient>

          {/* 圣光背景 */}
          <radialGradient id="holy-aura">
            <stop offset="0%" stopColor="rgba(255,215,0,0.25)" />
            <stop offset="50%" stopColor="rgba(255,215,0,0.08)" />
            <stop offset="100%" stopColor="rgba(255,215,0,0)" />
          </radialGradient>

          {/* 暗能量背景 */}
          <radialGradient id="dark-aura">
            <stop offset="0%" stopColor="rgba(192,57,43,0.2)" />
            <stop offset="50%" stopColor="rgba(108,52,131,0.08)" />
            <stop offset="100%" stopColor="rgba(26,26,46,0)" />
          </radialGradient>
        </defs>

        {/* ======================================== */}
        {/* 2. 背景层：完全透明，不画任何东西 */}
        {/* ======================================== */}

        {/* ======================================== */}
        {/* 3. 粒子层（最底层） */}
        {/* ======================================== */}
        <g id="particles-layer" />

        {/* ======================================== */}
        {/* 4. 连线层 */}
        {/* ======================================== */}
        <g id="connections-layer">
          {/* 左侧节点连接到白贞德 */}
          <line x1="80" y1="200" x2="250" y2="350" stroke="rgba(244,208,63,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="300" y1="180" x2="280" y2="320" stroke="rgba(244,208,63,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2.5s" repeatCount="indefinite" />
          </line>
          <line x1="100" y1="450" x2="220" y2="400" stroke="rgba(244,208,63,0.4)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2.2s" repeatCount="indefinite" />
          </line>
          <line x1="280" y1="500" x2="260" y2="420" stroke="rgba(244,208,63,0.4)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2.8s" repeatCount="indefinite" />
          </line>
          <line x1="120" y1="580" x2="200" y2="450" stroke="rgba(52,152,219,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="320" y1="580" x2="280" y2="440" stroke="rgba(52,152,219,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="2.3s" repeatCount="indefinite" />
          </line>

          {/* 右侧节点连接到黑贞德 */}
          <line x1="900" y1="200" x2="780" y2="340" stroke="rgba(46,204,113,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;20" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="1100" y1="180" x2="880" y2="320" stroke="rgba(46,204,113,0.5)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;20" dur="2.5s" repeatCount="indefinite" />
          </line>
          <line x1="920" y1="480" x2="800" y2="400" stroke="rgba(46,204,113,0.4)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;20" dur="2.2s" repeatCount="indefinite" />
          </line>
          <line x1="1100" y1="500" x2="860" y2="420" stroke="rgba(46,204,113,0.4)" strokeWidth="1.5" strokeDasharray="5,5">
            <animate attributeName="stroke-dashoffset" values="0;20" dur="2.8s" repeatCount="indefinite" />
          </line>

          {/* 中央GNN核心连接两主角 */}
          <line x1="520" y1="340" x2="600" y2="350" stroke="rgba(255,215,0,0.6)" strokeWidth="2">
            <animate attributeName="stroke-width" values="2;3;2" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="680" y1="340" x2="600" y2="350" stroke="rgba(192,57,43,0.6)" strokeWidth="2">
            <animate attributeName="stroke-width" values="2;3;2" dur="2s" repeatCount="indefinite" />
          </line>

          {/* 节点间交叉连接 */}
          <line x1="80" y1="200" x2="450" y2="120" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,7" />
          <line x1="900" y1="200" x2="750" y2="120" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,7" />
          <line x1="100" y1="450" x2="500" y2="600" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,7" />
          <line x1="920" y1="480" x2="700" y2="600" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,7" />
        </g>

        {/* ======================================== */}
        {/* 5. 白贞德(Ruler) - SVG绘制 */}
        {/* ======================================== */}
        <g id="ruler-jeanne-group" transform="translate(150, 350)">
          {/* 圣光光晕背景 */}
          <ellipse cx="0" cy="0" rx="140" ry="160" fill="url(#holy-aura)">
            <animate attributeName="opacity" values="0.6;0.9;0.6" dur="4s" repeatCount="indefinite" />
          </ellipse>

          {/* 披风（底层） */}
          <path
            id="ruler-cape"
            d="M-80,-60 Q-120,0 -100,80 Q-60,120 0,100 Q40,80 20,0 Q0,-80 -80,-60Z"
            fill="#6B3FA0"
            stroke="#4A2D70"
            strokeWidth="2"
          >
            <animateTransform attributeName="transform" type="rotate" values="-2 0 20; 2 0 20; -2 0 20" dur="4s" repeatCount="indefinite" />
          </path>
          {/* 披风白色十字纹章 */}
          <path d="M-60,20 L-40,20 L-40,10 L-30,10 L-30,30 L-50,30 L-50,40 L-70,40 L-70,20Z" fill="#FFFFFF" opacity="0.8" />

          {/* 身体/盔甲 */}
          <path id="ruler-body" d="M-40,-50 L40,-50 L50,60 L30,100 L-30,100 L-50,60Z" fill="url(#silver-gradient)" />
          {/* 胸甲高光 */}
          <path d="M-30,-30 Q0,-20 30,-30 L25,30 Q0,40 -25,30Z" fill="#E8E8F0" opacity="0.6" />
          {/* 胸甲中央紫宝石 */}
          <ellipse cx="0" cy="-5" rx="8" ry="10" fill="#9B59B6" stroke="#6B3FA0" strokeWidth="1.5" />

          {/* 头部 */}
          <g id="ruler-head" transform="translate(0, -90)">
            {/* 脸型 */}
            <ellipse cx="0" cy="0" rx="35" ry="40" fill="#FFE4D0" />
            {/* 眼睛（蓝） */}
            <ellipse cx="-12" cy="-5" rx="8" ry="10" fill="#3A7BD5" />
            <circle cx="-10" cy="-5" r="3" fill="white" />
            <ellipse cx="12" cy="-5" rx="8" ry="10" fill="#3A7BD5" />
            <circle cx="14" cy="-5" r="3" fill="white" />
            {/* 眉毛 */}
            <path d="M-22,-20 Q-12,-25 -2,-20" stroke="#D4A574" strokeWidth="2" fill="none" />
            <path d="M2,-20 Q12,-25 22,-20" stroke="#D4A574" strokeWidth="2" fill="none" />
            {/* 嘴巴（微张） */}
            <path d="M-8,15 Q0,20 8,15" stroke="#D4786E" strokeWidth="2" fill="none" />
          </g>

          {/* 头发（金色三股辫） */}
          <path
            id="ruler-hair"
            d="M-30,-120 Q-50,-100 -40,-70 Q-60,-40 -80,0 Q-90,40 -70,80 L-65,120 L-60,80 Q-40,40 -20,0 Q0,-40 0,-70 Q0,-100 -30,-120Z"
            fill="#FFD700"
            stroke="#DAA520"
            strokeWidth="1"
          >
            <animateTransform attributeName="transform" type="rotate" values="0 -30 -80; 3 -30 -80; 0 -30 -80" dur="3s" repeatCount="indefinite" />
          </path>
          {/* 发尾丝带 */}
          <rect x="-70" y="115" width="15" height="8" fill="#1A1A2E" rx="2">
            <animateTransform attributeName="transform" type="rotate" values="0 -65 119; 10 -65 119; 0 -65 119" dur="2.5s" repeatCount="indefinite" />
          </rect>

          {/* 右臂（伸向中央 - 亚当姿势） */}
          <g id="ruler-right-arm" transform="translate(45, -10)">
            {/* 上臂 */}
            <path d="M0,0 L60,-10 L65,15 L5,20Z" fill="url(#silver-gradient)" />
            {/* 前臂 */}
            <path d="M60,-10 L130,-25 L135,-5 L65,15Z" fill="url(#silver-gradient)" />
            {/* 手掌（手指微曲向上） */}
            <g transform="translate(130, -25)">
              <ellipse cx="0" cy="0" rx="12" ry="10" fill="#FFE4D0" />
              {/* 食指伸直指向中央 */}
              <path d="M5,-5 L35,-15 L37,-10 L7,0Z" fill="#FFE4D0" stroke="#E8C4A8" strokeWidth="1" />
              {/* 其他手指微曲 */}
              <path d="M5,0 L25,5 L24,10 L6,8Z" fill="#FFE4D0" />
              <path d="M5,8 L22,15 L21,20 L6,16Z" fill="#FFE4D0" />
              <path d="M0,12 L18,22 L16,26 L0,20Z" fill="#FFE4D0" />
            </g>
          </g>

          {/* 左臂（放松） */}
          <g transform="translate(-45, -5)">
            <path d="M0,0 L-40,20 L-35,40 L5,20Z" fill="url(#silver-gradient)" />
            <path d="M-40,20 L-70,50 L-65,65 L-35,40Z" fill="url(#silver-gradient)" />
            <ellipse cx="-70" cy="55" rx="10" ry="8" fill="#FFE4D0" />
          </g>

          {/* 呼吸动画 */}
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1.015 1.02;1 1"
            dur="3s"
            repeatCount="indefinite"
            additive="sum"
          />
        </g>

        {/* ======================================== */}
        {/* 6. 黑贞(Avenger Alter) - SVG绘制 */}
        {/* ======================================== */}
        <g id="alter-jeanne-group" transform="translate(950, 350)">
          {/* 暗能量光晕背景 */}
          <ellipse cx="0" cy="0" rx="140" ry="160" fill="url(#dark-aura)">
            <animate attributeName="opacity" values="0.5;0.85;0.5" dur="4s" repeatCount="indefinite" />
          </ellipse>

          {/* 暗红披风（底层，火焰般飘动） */}
          <path
            id="alter-cape"
            d="M-60,-80 Q-100,-20 -80,60 Q-40,140 20,100 Q60,60 40,-20 Q20,-80 -60,-80Z"
            fill="#8B0000"
            opacity="0.9"
          >
            <animateTransform attributeName="transform" type="rotate" values="2 0 20; -2 0 20; 2 0 20" dur="3.5s" repeatCount="indefinite" />
          </path>

          {/* 身体/黑色龙鳞甲 */}
          <path id="alter-body" d="M-35,-55 L35,-55 L45,55 L25,95 L-25,95 L-45,55Z" fill="#1A1A2E" stroke="#C0392B" strokeWidth="2" />
          {/* 龙鳞纹理 */}
          <path d="M-25,-35 L-15,-25 L-5,-35 L5,-25 L15,-35 L25,-25" stroke="#333" strokeWidth="1" fill="none" />
          <path d="M-25,-15 L-15,-5 L-5,-15 L5,-5 L15,-15 L25,-5" stroke="#333" strokeWidth="1" fill="none" />

          {/* 头部 */}
          <g id="alter-head" transform="translate(0, -95)">
            {/* 脸型（更锐利） */}
            <ellipse cx="0" cy="0" rx="33" ry="38" fill="#FFF0E8" />
            {/* 眼睛（金黄竖瞳） */}
            <ellipse cx="-11" cy="-5" rx="9" ry="11" fill="#FFD700" />
            <ellipse cx="-11" cy="-5" rx="3" ry="8" fill="#000" />
            <circle cx="-10" cy="-6" r="2" fill="white" />
            <ellipse cx="11" cy="-5" rx="9" ry="11" fill="#FFD700" />
            <ellipse cx="11" cy="-5" rx="3" ry="8" fill="#000" />
            <circle cx="12" cy="-6" r="2" fill="white" />
            {/* 眉毛（凌厉） */}
            <path d="M-24,-22 Q-12,-28 0,-24" stroke="#AAA" strokeWidth="2.5" fill="none" />
            <path d="M0,-24 Q12,-28 24,-22" stroke="#AAA" strokeWidth="2.5" fill="none" />
            {/* 嘴角微扬 */}
            <path d="M-10,18 Q0,24 10,15" stroke="#B85850" strokeWidth="2" fill="none" />
            {/* 黑色头饰 */}
            <path d="M-25,-35 L0,-55 L25,-35 L20,-25 L-20,-25Z" fill="#1A1A2E" />
            {/* 耳边耳坠 */}
            <circle cx="-33" cy="5" r="4" fill="#6C3483" />
            <circle cx="33" cy="5" r="4" fill="#6C3483" />
          </g>

          {/* 头发（银白色长发散开） */}
          <path
            id="alter-hair"
            d="M-25,-125 Q-70,-100 -60,-50 Q-80,0 -70,60 Q-50,100 -30,80 Q-10,60 0,0 Q10,60 30,80 Q50,100 70,60 Q80,0 60,-50 Q70,-100 25,-125Z"
            fill="#F0F0F0"
            stroke="#D0D0D0"
            strokeWidth="1"
          >
            <animateTransform attributeName="transform" type="skewX" values="0; 3; 0" dur="4s" repeatCount="indefinite" />
          </path>

          {/* 左臂（伸向中央 - 上帝姿势） */}
          <g id="alter-left-arm" transform="translate(-45, -10)">
            {/* 上臂 */}
            <path d="M0,0 L-50,-15 L-48,5 L2,15Z" fill="#1A1A2E" />
            {/* 前臂 */}
            <path d="M-50,-15 L-120,-30 L-118,-10 L-48,5Z" fill="#1A1A2E" />
            {/* 手掌（食指直指） */}
            <g transform="translate(-120, -30)">
              <ellipse cx="0" cy="0" rx="11" ry="9" fill="#FFF0E8" />
              {/* 食指直指白贞 */}
              <path d="M-5,-5 L-38,-15 L-40,-10 L-7,0Z" fill="#FFF0E8" stroke="#E8C4A8" strokeWidth="1" />
              {/* 其他手指收拢 */}
              <path d="M-5,2 L-28,0 L-27,6 L-5,8Z" fill="#FFF0E8" />
              <path d="M-2,10 L-22,12 L-21,18 L-2,16Z" fill="#FFF0E8" />
            </g>
          </g>

          {/* 右臂（放松） */}
          <g transform="translate(40, -5)">
            <path d="M0,0 L40,15 L35,35 L-5,20Z" fill="#1A1A2E" />
            <path d="M40,15 L65,40 L60,55 L35,35Z" fill="#1A1A2E" />
            <ellipse cx="65" cy="45" rx="9" ry="7" fill="#FFF0E8" />
          </g>

          {/* 呼吸动画 */}
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1.015 1.02;1 1"
            dur="3s"
            repeatCount="indefinite"
            additive="sum"
          />
        </g>

        {/* ======================================== */}
        {/* 7. 知识节点层 - 均匀分布在左右两侧 */}
        {/* ======================================== */}
        <g id="knowledge-nodes-layer">
          {/* --- 左侧知识节点群（围绕白贞德） --- */}

          {/* GNN类别节点 - 金色六边形，左侧上方 */}
          <g className="knode" transform="translate(80, 200)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-25 22,-12 22,13 0,25 -22,13 -22,-12" fill="#F4D03F" filter="url(#glow-gold)" data-filter="url(#glow-gold)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="5" fill="#333" fontSize="12" fontWeight="bold">GCN</text>
          </g>
          <g className="knode" transform="translate(300, 180)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-25 22,-12 22,13 0,25 -22,13 -22,-12" fill="#F4D03F" filter="url(#glow-gold)" data-filter="url(#glow-gold)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.3s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="5" fill="#333" fontSize="12" fontWeight="bold">GAT</text>
          </g>
          <g className="knode" transform="translate(100, 450)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-25 22,-12 22,13 0,25 -22,13 -22,-12" fill="#F4D03F" filter="url(#glow-gold)" data-filter="url(#glow-gold)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.6s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="5" fill="#333" fontSize="11" fontWeight="bold">GraphSAGE</text>
          </g>
          <g className="knode" transform="translate(280, 500)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-25 22,-12 22,13 0,25 -22,13 -22,-12" fill="#F4D03F" filter="url(#glow-gold)" data-filter="url(#glow-gold)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.9s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="5" fill="#333" fontSize="11" fontWeight="bold">GIN</text>
          </g>

          {/* 损失函数节点 - 蓝色圆形，左下方 */}
          <g className="knode" transform="translate(120, 580)" style={{ cursor: 'pointer' }}>
            <circle r="22" fill="#3498DB" filter="url(#glow-blue)" data-filter="url(#glow-blue)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.2s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" y="4" fill="white" fontSize="9" fontWeight="bold">Cross Entropy</text>
          </g>
          <g className="knode" transform="translate(320, 580)" style={{ cursor: 'pointer' }}>
            <circle r="22" fill="#3498DB" filter="url(#glow-blue)" data-filter="url(#glow-blue)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.5s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" y="4" fill="white" fontSize="9" fontWeight="bold">KL Divergence</text>
          </g>

          {/* --- 右侧知识节点群（围绕黑贞德） --- */}

          {/* 数据集节点 - 绿色方形，右侧上方 */}
          <g className="knode" transform="translate(900, 200)" style={{ cursor: 'pointer' }}>
            <rect x="-25" y="-18" width="50" height="36" rx="4" fill="#2ECC71" filter="url(#glow-green)" data-filter="url(#glow-green)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite" />
            </rect>
            <text textAnchor="middle" y="4" fill="white" fontSize="12" fontWeight="bold">Cora</text>
          </g>
          <g className="knode" transform="translate(1100, 180)" style={{ cursor: 'pointer' }}>
            <rect x="-28" y="-18" width="56" height="36" rx="4" fill="#2ECC71" filter="url(#glow-green)" data-filter="url(#glow-green)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.3s" repeatCount="indefinite" />
            </rect>
            <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="bold">CiteSeer</text>
          </g>
          <g className="knode" transform="translate(920, 480)" style={{ cursor: 'pointer' }}>
            <rect x="-28" y="-18" width="56" height="36" rx="4" fill="#2ECC71" filter="url(#glow-green)" data-filter="url(#glow-green)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.6s" repeatCount="indefinite" />
            </rect>
            <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="bold">PubMed</text>
          </g>
          <g className="knode" transform="translate(1100, 500)" style={{ cursor: 'pointer' }}>
            <rect x="-25" y="-18" width="50" height="36" rx="4" fill="#2ECC71" filter="url(#glow-green)" data-filter="url(#glow-green)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.9s" repeatCount="indefinite" />
            </rect>
            <text textAnchor="middle" y="4" fill="white" fontSize="12" fontWeight="bold">Reddit</text>
          </g>

          {/* 基础知识节点 - 紫色菱形，上方和下方 */}
          <g className="knode" transform="translate(450, 120)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-22 22,0 0,22 -22,0" fill="#9B59B6" filter="url(#glow-purple)" data-filter="url(#glow-purple)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.1s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="4" fill="white" fontSize="9" fontWeight="bold">Message Passing</text>
          </g>
          <g className="knode" transform="translate(600, 80)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-22 22,0 0,22 -22,0" fill="#9B59B6" filter="url(#glow-purple)" data-filter="url(#glow-purple)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.4s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="bold">Aggregation</text>
          </g>
          <g className="knode" transform="translate(750, 120)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-22 22,0 0,22 -22,0" fill="#9B59B6" filter="url(#glow-purple)" data-filter="url(#glow-purple)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="0.7s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="4" fill="white" fontSize="9" fontWeight="bold">Node Embedding</text>
          </g>
          <g className="knode" transform="translate(500, 600)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-22 22,0 0,22 -22,0" fill="#9B59B6" filter="url(#glow-purple)" data-filter="url(#glow-purple)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="1s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="bold">Spectral</text>
          </g>
          <g className="knode" transform="translate(700, 600)" style={{ cursor: 'pointer' }}>
            <polygon points="0,-22 22,0 0,22 -22,0" fill="#9B59B6" filter="url(#glow-purple)" data-filter="url(#glow-purple)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" begin="1.3s" repeatCount="indefinite" />
            </polygon>
            <text textAnchor="middle" y="4" fill="white" fontSize="11" fontWeight="bold">Spatial</text>
          </g>
        </g>

        {/* ======================================== */}
        {/* 8. 中央GNN核心 - 六边形网络图 */}
        {/* ======================================== */}
        <g id="gnn-core" transform="translate(600, 350)">
          {/* 外环六边形 */}
          <polygon
            points="0,-50 43,-25 43,25 0,50 -43,25 -43,-25"
            fill="none"
            stroke="#FFD700"
            strokeWidth="2"
            opacity="0.8"
          >
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
          </polygon>
          {/* 内环六边形（反向旋转） */}
          <polygon
            points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15"
            fill="none"
            stroke="#C0392B"
            strokeWidth="1.5"
            opacity="0.6"
          >
            <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="15s" repeatCount="indefinite" />
          </polygon>
          {/* 中心发光圆 */}
          <circle r="12" fill="url(#core-gradient)" filter="url(#glow-gold)">
            <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* 6个顶点发光点 */}
          <g>
            <circle cx="0" cy="-50" r="5" fill="#FFD700">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="43" cy="-25" r="5" fill="#FFD700">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" begin="0.25s" repeatCount="indefinite" />
            </circle>
            <circle cx="43" cy="25" r="5" fill="#FFD700">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="50" r="5" fill="#FFD700">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" begin="0.75s" repeatCount="indefinite" />
            </circle>
            <circle cx="-43" cy="25" r="5" fill="#C0392B">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" begin="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="-43" cy="-25" r="5" fill="#C0392B">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" begin="1.25s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>

        {/* ======================================== */}
        {/* 9. Tooltip层 */}
        {/* ======================================== */}
        <g id="tooltip-layer" />
      </svg>

      {/* CSS动画补充 */}
      <style>{`
        @keyframes ruler-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes alter-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        #ruler-jeanne-group {
          animation: ruler-float 6s ease-in-out infinite;
        }
        #alter-jeanne-group {
          animation: alter-float 5s ease-in-out infinite;
        }
        .knode {
          transition: transform 0.3s ease;
        }
        .knode:hover {
          transform: scale(1.15);
        }
        @media (prefers-reduced-motion: reduce) {
          #ruler-jeanne-group,
          #alter-jeanne-group,
          .knode {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
