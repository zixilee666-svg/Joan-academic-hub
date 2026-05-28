import React from 'react';

/**
 * Archer泳装贞德 - 环绕辅助角色（简化版）
 * 位置：上方偏左 | 金发高马尾 + 白蓝泳装 + 海豚水枪 + 数据流曲线
 */
export default function ArcherJeanneSvg() {
  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', opacity: 0.45 } as React.CSSProperties}>
      <defs>
        <linearGradient id="archHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#F4D03F" />
        </linearGradient>
      </defs>

      {/* 身体 - 半透明剪影 */}
      <ellipse cx="60" cy="80" rx="22" ry="30" fill="rgba(255,245,230,0.35)" />

      {/* 头部 */}
      <circle cx="60" cy="45" r="16" fill="rgba(255,245,230,0.45)" />

      {/* 金发高马尾 */}
      <path d="M45 35 Q50 15 60 10 Q70 15 75 35" fill="url(#archHair)" opacity="0.55" />

      {/* 泳装外套（白蓝边） */}
      <path d="M42 70 L78 70 L74 108 L46 108 Z" fill="rgba(255,255,255,0.35)" stroke="#3b82f6" strokeWidth="1" />

      {/* 海豚水枪（简化） */}
      <path d="M78 84 Q92 78 97 88 Q99 93 95 98" stroke="#60a5fa" strokeWidth="2" fill="none" opacity="0.55" />

      {/* 数据流曲线（水流→数据流） */}
      <path d="M97 90 Q108 84 118 90" stroke="#64b4ff" strokeWidth="1" fill="none" opacity="0.35" strokeDasharray="2,2">
        <animate attributeName="stroke-dashoffset" values="0;4" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
