import React from 'react';

export const PixelMonkeyIcon: React.FC<{ className?: string }> = ({
  className = 'h-8 w-8',
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    shapeRendering="crispEdges"
    className={className}
  >
    {/* Outer Ears & Head Silhouette (Deep Emerald) */}
    <rect x="4" y="1" width="8" height="1" fill="#10B981" />
    <rect x="3" y="2" width="10" height="2" fill="#059669" />
    <rect x="1" y="4" width="2" height="4" fill="#10B981" />
    <rect x="13" y="4" width="2" height="4" fill="#10B981" />
    <rect x="2" y="5" width="1" height="2" fill="#34D399" />
    <rect x="13" y="5" width="1" height="2" fill="#34D399" />
    <rect x="3" y="4" width="10" height="8" fill="#047857" />

    {/* Face Mask (Light Cyber Green) */}
    <rect x="4" y="5" width="8" height="4" fill="#6EE7B7" />
    <rect x="5" y="9" width="6" height="5" fill="#A7F3D0" />
    <rect x="4" y="10" width="8" height="3" fill="#6EE7B7" />

    {/* Pixel Cyber Shades / Eyes (Black + Neon Matrix Glow) */}
    <rect x="4" y="6" width="3" height="2" fill="#022C22" />
    <rect x="9" y="6" width="3" height="2" fill="#022C22" />
    <rect x="7" y="6" width="2" height="1" fill="#022C22" />
    <rect x="5" y="6" width="1" height="1" fill="#00FF66" />
    <rect x="10" y="6" width="1" height="1" fill="#00FF66" />

    {/* Nose & Grin */}
    <rect x="7" y="9" width="2" height="1" fill="#064E3B" />
    <rect x="5" y="11" width="6" height="1" fill="#022C22" />
    <rect x="6" y="12" width="4" height="1" fill="#00FF66" />
  </svg>
);

