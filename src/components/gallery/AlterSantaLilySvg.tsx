import React from 'react';

/**
 * Alter Santa Lily - 环绕辅助角色（简化版）
 * 位置：下方中央 | 银发幼女 + 圣诞红绿服装 + 长枪挂铃铛 + 声波光环
 */
export default function AlterSantaLilySvg() {
  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', opacity: 0.4 } as React.CSSProperties}>
      {/* 身体 - 半透明剪影 */}
      <ellipse cx="60" cy="85" rx="18" ry="25" fill="rgba(180,30,30,0.25)" />

      {/* 头部 */}
      <circle cx="60" cy="50" r="13" fill="rgba(210,210,210,0.45)" />

      {/* 银发 */}
      <path d="M48 42 Q52 28 60 25 Q68 28 72 42" fill="#d0d0d0" opacity="0.45" />

      {/* 圣诞帽（红） */}
      <path d="M48 42 Q60 20 72 42 L68 55 L48 55 Z" fill="#c0392b" opacity="0.45" />

      {/* 长枪（简化） */}
      <line x1="74" y1="82" x2="84" y2="62" stroke="#c0c0c0" strokeWidth="2" opacity="0.45" />

      {/* 铃铛 */}
      <circle cx="84" cy="57" r="4" fill="#ffd700" opacity="0.55">
        <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* 声波光环（每2秒扩散） */}
      <circle cx="60" cy="105" r="12" fill="none" stroke="#ffd700" strokeWidth="0.8" opacity="0.25">
        <animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.25;0.08;0.25" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
