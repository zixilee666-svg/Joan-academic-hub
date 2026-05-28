import { useEffect, useRef, useState } from 'react';

/**
 * FGO Q版贞德(Ruler) 躺卧学习GNN 动态场景组件
 * 7:3 横版比例 | 知识标签环绕 | 呼吸动画 | 粒子光效 | SVG连接线
 */

// ── GNN知识图谱数据 ──
const KNOWLEDGE_DATA = {
  gnn: {
    name: 'GNN模型',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    items: ['GCN', 'GAT', 'GraphSAGE', 'GIN', 'R-GCN', 'GAE'],
  },
  dataset: {
    name: '数据集',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.15)',
    items: ['Cora', 'Citeseer', 'PubMed', 'ogbn-arxiv', 'PPI', 'Reddit'],
  },
  loss: {
    name: '损失函数',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.15)',
    items: ['CrossEntropy', 'NLLLoss', 'Contrastive', 'InfoNCE'],
  },
  basic: {
    name: '基础知识',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.15)',
    items: ['Message Passing', 'Node Embedding', 'Graph Convolution', 'Attention', 'Aggregation'],
  },
};

// 标签位置配置（相对于场景容器的百分比）
const TAG_POSITIONS: Record<string, { top: string; left: string }[]> = {
  gnn: [
    { top: '6%', left: '4%' },
    { top: '2%', left: '22%' },
    { top: '0%', left: '42%' },
    { top: '3%', left: '60%' },
    { top: '8%', left: '76%' },
    { top: '14%', left: '88%' },
  ],
  dataset: [
    { top: '78%', left: '2%' },
    { top: '86%', left: '14%' },
    { top: '90%', left: '32%' },
    { top: '88%', left: '52%' },
    { top: '82%', left: '70%' },
    { top: '76%', left: '86%' },
  ],
  loss: [
    { top: '32%', left: '1%' },
    { top: '52%', left: '3%' },
    { top: '68%', left: '8%' },
    { top: '44%', left: '90%' },
  ],
  basic: [
    { top: '22%', left: '12%' },
    { top: '72%', left: '20%' },
    { top: '28%', left: '80%' },
    { top: '62%', left: '82%' },
    { top: '48%', left: '48%' },
  ],
};

// 标签动画参数
const TAG_ANIMS = [
  { dur: '3.5s', delay: '0s' },
  { dur: '4.0s', delay: '0.3s' },
  { dur: '3.8s', delay: '0.6s' },
  { dur: '4.2s', delay: '0.9s' },
  { dur: '3.6s', delay: '1.2s' },
  { dur: '4.0s', delay: '1.5s' },
];

// ── 粒子组件 ──
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    top: `${8 + Math.random() * 84}%`,
    size: 2 + Math.random() * 3,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 10,
    color: ['#64b4ff', '#ffb4dc', '#ffe066', '#7dd3c0', '#c8a8ff'][Math.floor(Math.random() * 5)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle-drift"
          style={{
            position: 'absolute',
            left: '-10px',
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── 知识标签组件 ──
function KnowledgeTag({
  text,
  color,
  bg,
  top,
  left,
  dur,
  delay,
  idx,
}: {
  text: string;
  color: string;
  bg: string;
  top: string;
  left: string;
  dur: string;
  delay: string;
  idx: number;
}) {
  return (
    <div
      className="knowledge-tag"
      style={{
        position: 'absolute',
        top,
        left,
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '11px',
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${color}30`,
        backdropFilter: 'blur(4px)',
        cursor: 'pointer',
        zIndex: 30,
        whiteSpace: 'nowrap',
        animationDuration: dur,
        animationDelay: delay,
        animationName: 'tagFloat',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'linear',
      }}
      data-idx={idx}
    >
      {text}
    </div>
  );
}

// ── SVG连接线层 ──
function ConnectionLines({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [lines, setLines] = useState<string>('');

  useEffect(() => {
    const draw = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const tags = container.querySelectorAll<HTMLElement>('.knowledge-tag');
      const centers: { x: number; y: number; cat: string }[] = [];

      tags.forEach((tag) => {
        const r = tag.getBoundingClientRect();
        const cat = Object.entries(KNOWLEDGE_DATA).find(([_, data]) =>
          data.items.includes(tag.textContent?.trim() || '')
        )?.[0] || '';
        centers.push({
          x: r.left - rect.left + r.width / 2,
          y: r.top - rect.top + r.height / 2,
          cat,
        });
      });

      const catColors: Record<string, string> = {
        gnn: '#3b82f6',
        dataset: '#10b981',
        loss: '#f97316',
        basic: '#8b5cf6',
      };

      let paths = '';
      Object.keys(KNOWLEDGE_DATA).forEach((cat) => {
        const catCenters = centers.filter((c) => c.cat === cat);
        for (let i = 0; i < catCenters.length - 1; i++) {
          const c1 = catCenters[i];
          const c2 = catCenters[i + 1];
          paths += `<line x1="${c1.x}" y1="${c1.y}" x2="${c2.x}" y2="${c2.y}" stroke="${catColors[cat]}" stroke-width="1" opacity="0.25" stroke-dasharray="3,3"/>`;
        }
      });

      setLines(paths);
    };

    const timer = setTimeout(draw, 600);
    window.addEventListener('resize', draw);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', draw);
    };
  }, [containerRef]);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-25"
      style={{ zIndex: 25 }}
      dangerouslySetInnerHTML={{ __html: lines }}
    />
  );
}

// ── Q版贞德 SVG ──
function ChibiJeanne() {
  return (
    <svg
      viewBox="0 0 520 240"
      className="w-full h-full"
      preserveAspectRatio="xMidYMax meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 头发渐变 */}
        <linearGradient id="hairG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F7DC6F" />
          <stop offset="50%" stopColor="#F4D03F" />
          <stop offset="100%" stopColor="#D4AC0D" />
        </linearGradient>
        {/* 皮肤 */}
        <linearGradient id="skinG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF5E6" />
          <stop offset="100%" stopColor="#FFE4C4" />
        </linearGradient>
        {/* 铠甲银 */}
        <linearGradient id="armorG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8E8E8" />
          <stop offset="40%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>
        {/* 深蓝裙 */}
        <linearGradient id="dressG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4A6FA5" />
          <stop offset="100%" stopColor="#2E4A6F" />
        </linearGradient>
        {/* 白披风 */}
        <linearGradient id="capeG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8EDF2" />
        </linearGradient>
        {/* 光晕 */}
        <radialGradient id="holyGlow">
          <stop offset="0%" stopColor="rgba(100,160,255,0.2)" />
          <stop offset="50%" stopColor="rgba(160,120,255,0.1)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* 平板屏幕 */}
        <linearGradient id="screenG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#16213e" />
        </linearGradient>
        {/* 平板发光 */}
        <filter id="tabletGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 柔和阴影 */}
        <filter id="softShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* 底部阴影 */}
      <ellipse cx="260" cy="225" rx="180" ry="12" fill="#000" opacity="0.08" />

      {/* 光晕背景 */}
      <ellipse cx="260" cy="120" rx="200" ry="100" fill="url(#holyGlow)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="6s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="6s" repeatCount="indefinite" additive="sum" />
      </ellipse>

      {/* ===== 身体组（呼吸动画） ===== */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-1.5; 0,0"
          dur="5s"
          repeatCount="indefinite"
        />

        {/* 白披风（底层） */}
        <path
          d="M120 180 Q100 120 140 90 Q180 60 260 65 Q340 60 400 80 Q450 100 440 150 Q430 200 380 210 Q320 220 260 215 Q200 220 140 210 Q110 205 120 180Z"
          fill="url(#capeG)"
          filter="url(#softShadow)"
          opacity="0.95"
        />
        {/* 披风上的十字纹章 */}
        <path d="M250 100 L250 130 M235 115 L265 115" stroke="#C9A04D" strokeWidth="2.5" fill="none" opacity="0.4" />

        {/* 深蓝裙子 */}
        <path
          d="M160 140 Q150 180 170 200 Q220 210 280 208 Q340 206 380 195 Q400 180 390 150 Q380 130 340 125 Q280 120 220 125 Q170 130 160 140Z"
          fill="url(#dressG)"
        />

        {/* 银甲胸甲 */}
        <path
          d="M180 125 Q200 105 260 100 Q320 105 360 125 Q370 140 360 155 Q320 145 260 142 Q200 145 170 155 Q160 140 180 125Z"
          fill="url(#armorG)"
          filter="url(#softShadow)"
        />
        {/* 铠甲装饰线 */}
        <path d="M220 118 Q260 112 300 118" stroke="#A0A0A0" strokeWidth="1.5" fill="none" />
        <path d="M210 135 Q260 130 310 135" stroke="#A0A0A0" strokeWidth="1" fill="none" opacity="0.6" />

        {/* 腰带 */}
        <path d="M175 150 Q260 142 375 150" stroke="#2E4A6F" strokeWidth="4" fill="none" />
        <circle cx="260" cy="146" r="5" fill="#C9A04D" />

        {/* 左腿（伸展） */}
        <path d="M170 185 Q140 190 100 192 Q80 193 75 195 Q70 198 80 200 Q120 202 180 198Z" fill="url(#dressG)" />
        {/* 左膝甲 */}
        <ellipse cx="130" cy="193" rx="14" ry="8" fill="url(#armorG)" transform="rotate(-5 130 193)" />
        {/* 左黑袜 */}
        <path d="M85 193 Q70 195 65 198 Q62 202 68 204 Q85 205 95 202Z" fill="#1a1a2e" />
        {/* 左脚 */}
        <ellipse cx="62" cy="200" rx="10" ry="6" fill="url(#skinG)" transform="rotate(-10 62 200)" />

        {/* 右腿（弯曲） */}
        <path d="M340 185 Q380 180 410 175 Q430 172 435 175 Q440 178 430 182 Q390 188 350 192Z" fill="url(#dressG)" />
        {/* 右膝甲 */}
        <ellipse cx="390" cy="178" rx="14" ry="8" fill="url(#armorG)" transform="rotate(5 390 178)" />
        {/* 右黑袜 */}
        <path d="M425 175 Q440 173 445 176 Q448 180 442 182 Q428 183 420 180Z" fill="#1a1a2e" />
        {/* 右脚 */}
        <ellipse cx="448" cy="178" rx="10" ry="6" fill="url(#skinG)" transform="rotate(10 448 178)" />

        {/* ===== 头部 ===== */}
        {/* 后发（大波浪） */}
        <path
          d="M220 95 Q200 80 190 60 Q185 40 200 35 Q220 30 240 40 Q260 30 280 35 Q300 40 295 60 Q290 80 270 95Z"
          fill="url(#hairG)"
        />
        {/* 粗辫子（右侧） */}
        <path
          d="M285 55 Q310 50 325 65 Q340 80 335 100 Q330 115 310 110 Q300 105 295 90 Q290 75 285 55Z"
          fill="url(#hairG)"
        />
        {/* 辫子纹理 */}
        <path d="M295 65 Q310 70 320 80" stroke="#D4AC0D" strokeWidth="1.5" fill="none" />
        <path d="M298 78 Q312 82 322 92" stroke="#D4AC0D" strokeWidth="1.5" fill="none" />
        <path d="M300 92 Q310 95 318 102" stroke="#D4AC0D" strokeWidth="1.5" fill="none" />

        {/* 头部轮廓 */}
        <ellipse cx="245" cy="72" rx="38" ry="34" fill="url(#skinG)" />

        {/* 刘海 */}
        <path
          d="M210 50 Q220 38 245 36 Q270 38 280 50 Q275 48 265 46 Q245 42 225 46 Q215 48 210 50Z"
          fill="url(#hairG)"
        />

        {/* 银色额冠 */}
        <path
          d="M215 48 Q245 35 275 48 Q270 42 245 38 Q220 42 215 48Z"
          fill="#D4D4D4"
        />
        <ellipse cx="245" cy="41" rx="4" ry="5" fill="#C9A04D" />
        <path d="M232 44 L232 38 M258 44 L258 38" stroke="#A0A0A0" strokeWidth="1.5" />

        {/* 呆毛 */}
        <path d="M245 36 Q248 22 255 26" stroke="#F4D03F" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <animate attributeName="d" values="M245 36 Q248 22 255 26;M245 36 Q250 20 257 24;M245 36 Q248 22 255 26" dur="3s" repeatCount="indefinite" />
        </path>

        {/* 眼睛（紫罗兰色） */}
        {/* 左眼 */}
        <g>
          <ellipse cx="232" cy="74" rx="8" ry="10" fill="white" />
          <ellipse cx="232" cy="74" rx="6" ry="8" fill="#7B68EE" />
          <circle cx="233" cy="72" r="3" fill="white" />
          <path d="M223 68 Q232 64 241 68" stroke="#5B4B8A" strokeWidth="1.5" fill="none" />
        </g>
        {/* 右眼 */}
        <g>
          <ellipse cx="258" cy="74" rx="8" ry="10" fill="white" />
          <ellipse cx="258" cy="74" rx="6" ry="8" fill="#7B68EE" />
          <circle cx="259" cy="72" r="3" fill="white" />
          <path d="M249 68 Q258 64 267 68" stroke="#5B4B8A" strokeWidth="1.5" fill="none" />
        </g>

        {/* 腮红 */}
        <ellipse cx="220" cy="86" rx="5" ry="3" fill="#FFB6C1" opacity="0.4" />
        <ellipse cx="270" cy="86" rx="5" ry="3" fill="#FFB6C1" opacity="0.4" />

        {/* 嘴巴（微笑） */}
        <path d="M240 90 Q245 94 250 90" stroke="#D4846A" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* ===== 手臂 ===== */}
        {/* 右臂（自然放腹部） */}
        <path d="M320 135 Q340 150 330 165 Q310 170 300 158Z" fill="url(#skinG)" />
        {/* 右手 */}
        <ellipse cx="328" cy="162" rx="8" ry="6" fill="url(#skinG)" transform="rotate(20 328 162)" />

        {/* 左臂（举平板） */}
        <path d="M175 130 Q150 115 140 100 Q135 90 145 88 Q155 86 165 95 Q180 108 190 125Z" fill="url(#skinG)" />
        {/* 左手 */}
        <ellipse cx="142" cy="90" rx="8" ry="6" fill="url(#skinG)" transform="rotate(-30 142 90)" />

        {/* ===== 发光平板 ===== */}
        <g transform="translate(85, 58) rotate(-8)">
          {/* 平板边框 */}
          <rect x="0" y="0" width="58" height="42" rx="4" fill="#2a2a3a" filter="url(#tabletGlow)" />
          {/* 屏幕 */}
          <rect x="3" y="3" width="52" height="36" rx="2" fill="url(#screenG)" />
          {/* 屏幕上的神经网络节点 */}
          <circle cx="15" cy="12" r="4" fill="#FF6B6B" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="35" cy="10" r="4" fill="#4ECDC4" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" begin="0.5s" />
          </circle>
          <circle cx="25" cy="25" r="4" fill="#45B7D1" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" begin="1s" />
          </circle>
          <circle cx="42" cy="28" r="3" fill="#96CEB4" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" begin="1.5s" />
          </circle>
          {/* 连接线 */}
          <line x1="15" y1="12" x2="35" y2="10" stroke="#64b4ff" strokeWidth="1" opacity="0.6" />
          <line x1="15" y1="12" x2="25" y2="25" stroke="#64b4ff" strokeWidth="1" opacity="0.6" />
          <line x1="35" y1="10" x2="25" y2="25" stroke="#64b4ff" strokeWidth="1" opacity="0.6" />
          <line x1="35" y1="10" x2="42" y2="28" stroke="#64b4ff" strokeWidth="1" opacity="0.6" />
          <line x1="25" y1="25" x2="42" y2="28" stroke="#64b4ff" strokeWidth="1" opacity="0.6" />
          {/* 消息传递光点 */}
          <circle r="1.5" fill="#FFD700">
            <animateMotion path="M15,12 L35,10" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle r="1.5" fill="#FFD700">
            <animateMotion path="M35,10 L25,25" dur="1.8s" repeatCount="indefinite" begin="0.4s" />
          </circle>
          <circle r="1.5" fill="#FFD700">
            <animateMotion path="M25,25 L42,28" dur="1.6s" repeatCount="indefinite" begin="0.8s" />
          </circle>
        </g>
      </g>

      {/* 底部文字 */}
      <text x="260" y="235" textAnchor="middle" fontSize="10" fill="#8FA3B8" fontWeight="500">
        贞德正在学习图神经网络...
      </text>
    </svg>
  );
}

// ── 主组件 ──
export default function JoanLearningGNN() {
  const sceneRef = useRef<HTMLDivElement>(null);

  // 生成所有标签
  const allTags: {
    text: string;
    color: string;
    bg: string;
    top: string;
    left: string;
    dur: string;
    delay: string;
    cat: string;
  }[] = [];

  let globalIdx = 0;
  Object.entries(KNOWLEDGE_DATA).forEach(([cat, data]) => {
    const positions = TAG_POSITIONS[cat] || [];
    data.items.forEach((item, i) => {
      const pos = positions[i] || { top: '50%', left: '50%' };
      const anim = TAG_ANIMS[globalIdx % TAG_ANIMS.length];
      allTags.push({
        text: item,
        color: data.color,
        bg: data.bg,
        top: pos.top,
        left: pos.left,
        dur: anim.dur,
        delay: anim.delay,
        cat,
      });
      globalIdx++;
    });
  });

  return (
    <div className="w-full">
      {/* 7:3 比例场景容器 */}
      <div
        ref={sceneRef}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ paddingTop: '42.857%' }}
      >
        {/* 场景内容绝对定位 */}
        <div className="absolute inset-0">
          {/* 背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f8faff] to-[#f0f4ff] dark:from-[#1a1f2e] dark:via-[#1e2335] dark:to-[#1a1f2e]" />

          {/* 光晕脉动 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[120%]"
            style={{
              background: `radial-gradient(ellipse at center,
                rgba(100,160,255,0.12) 0%,
                rgba(160,120,255,0.08) 25%,
                rgba(255,200,100,0.05) 50%,
                transparent 70%)`,
              animation: 'glowPulse 6s ease-in-out infinite',
            }}
          />

          {/* 贞德主体层 */}
          <div
            className="absolute bottom-[-2%] left-1/2 -translate-x-1/2 w-[85%] h-[85%]"
            style={{
              animation: 'breatheLie 5s ease-in-out infinite',
              filter: 'drop-shadow(0 6px 24px rgba(74,111,165,0.2))',
            }}
          >
            <ChibiJeanne />
          </div>

          {/* 粒子层 */}
          <Particles />

          {/* SVG连接线层 */}
          <ConnectionLines containerRef={sceneRef} />

          {/* 知识标签层 */}
          {allTags.map((tag, i) => (
            <KnowledgeTag
              key={`${tag.cat}-${i}`}
              text={tag.text}
              color={tag.color}
              bg={tag.bg}
              top={tag.top}
              left={tag.left}
              dur={tag.dur}
              delay={tag.delay}
              idx={i}
            />
          ))}
        </div>
      </div>

      {/* CSS动画关键帧 */}
      <style>{`
        @keyframes tagFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes breatheLie {
          0%, 100% { transform: translateX(-50%) scaleY(1) scaleX(1); }
          50% { transform: translateX(-50%) scaleY(1.006) scaleX(1.001); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%,-50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%,-50%) scale(1.1); }
        }
        @keyframes particleDrift {
          0%   { transform: translateX(-20px) translateY(0) scale(0); opacity: 0; }
          10%  { opacity: 0.8; }
          90%  { opacity: 0.8; }
          100% { transform: translateX(calc(100vw)) translateY(-30px) scale(1); opacity: 0; }
        }
        .particle-drift {
          animation-name: particleDrift;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .knowledge-tag:hover {
          transform: scale(1.15) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          z-index: 50;
        }
      `}</style>
    </div>
  );
}
