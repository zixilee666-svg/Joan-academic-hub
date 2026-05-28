import React from 'react';

/**
 * Berserker泳装黑贞 - 环绕辅助角色（简化版）
 * 位置：上方偏右 | 银灰短发 + 黑色皮衣 + 双刀（梯度下降箭头）
 */
export default function BerserkerJeanneAlterSvg() {
  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', opacity: 0.45 } as React.CSSProperties}>
      <defs>
        <linearGradient id="bHair2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#808080" />
        </linearGradient>
      </defs>

      {/* 身体 - 半透明剪影 */}
      <ellipse cx="60" cy="80" rx="22" ry="30" fill="rgba(30,30,30,0.35)" />

      {/* 头部 */}
      <circle cx="60" cy="45" r="16" fill="rgba(210,210,210,0.45)" />

      {/* 银灰短发 */}
      <path d="M45 35 Q50 20 60 18 Q70 20 75 35" fill="url(#bHair2)" opacity="0.55" />

      {/* 黑色皮衣 */}
      <path d="M42 70 L78 70 L74 108 L46 108 Z" fill="rgba(30,30,30,0.45)" />

      {/* 双刀（简化） */}
      <path d="M78 86 L93 76" stroke="#c0c0c0" strokeWidth="2" opacity="0.55" />
      <path d="M80 90 L95 80" stroke="#c0c0c0" strokeWidth="2" opacity="0.55" />

      {/* 梯度下降箭头 */}
      <path d="M90 98 L96 92" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M96 92 L102 86" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity="0.5" />
    </svg>
  );
}
