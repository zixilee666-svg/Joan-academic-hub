import React from 'react';

/**
 * 幼贞德Santa Lily - 环绕辅助角色（简化版）
 * 位置：左下方 | 金发幼女 + 红色圣诞连衣裙 + 礼物袋（论文卷轴飘出）
 */
export default function YoungJeanneSantaSvg() {
  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', opacity: 0.4 } as React.CSSProperties}>
      {/* 身体 - 半透明剪影 */}
      <ellipse cx="60" cy="85" rx="18" ry="25" fill="rgba(180,30,30,0.25)" />

      {/* 头部 */}
      <circle cx="60" cy="50" r="13" fill="rgba(255,245,230,0.45)" />

      {/* 金发 */}
      <path d="M48 42 Q52 28 60 25 Q68 28 72 42" fill="#FFD700" opacity="0.45" />

      {/* 红色圣诞裙 */}
      <path d="M44 72 L76 72 L74 112 L46 112 Z" fill="#c0392b" opacity="0.35" />

      {/* 礼物袋 */}
      <rect x="74" y="82" width="22" height="22" rx="3" fill="rgba(180,30,30,0.35)" />

      {/* 论文卷轴（从袋口飘出） */}
      <path d="M93 88 Q100 84 98 90" stroke="#8b5cf6" strokeWidth="1" fill="none" opacity="0.35">
        <animate attributeName="d" values="M93 88 Q100 84 98 90;M93 88 Q105 82 103 87;M93 88 Q100 84 98 90" dur="3s" repeatCount="indefinite" />
      </path>
      <path d="M94 93 Q101 89 99 95" stroke="#8b5cf6" strokeWidth="1" fill="none" opacity="0.3">
        <animate attributeName="d" values="M94 93 Q101 89 99 95;M94 93 Q106 87 104 92;M94 93 Q101 89 99 95" dur="3.5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
