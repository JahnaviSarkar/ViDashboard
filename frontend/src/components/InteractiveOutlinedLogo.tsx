import React, { useEffect, useState, useRef } from 'react';

export const InteractiveOutlinedLogo: React.FC = () => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Relative percentage for cursor spotlight
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x: Math.max(0, Math.min(100, rawX)), y: Math.max(0, Math.min(100, rawY)) });

      // Normalized offset -1 to 1 for subtle parallax
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = normX;
      targetY = normY;
    };

    const loop = () => {
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;
      setOffset({ x: currentX, y: currentY });
      animId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
      }}
    >
      {/* 1. Subtle Precision Dot Grid — Architectural & Clean */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.35,
          maskImage: `radial-gradient(circle 520px at ${mousePos.x}% ${mousePos.y}%, black 25%, rgba(0,0,0,0.12) 70%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(circle 520px at ${mousePos.x}% ${mousePos.y}%, black 25%, rgba(0,0,0,0.12) 70%, transparent 100%)`,
        }}
      >
        <defs>
          <pattern id="archGrid" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="18" r="1" fill="rgba(254, 243, 199, 0.45)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#archGrid)" />
      </svg>

      {/* 2. Interactive Ambient Cursor Spotlight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle 600px at ${mousePos.x}% ${mousePos.y}%, rgba(245, 158, 11, 0.12) 0%, rgba(242, 97, 156, 0.05) 45%, transparent 75%)`,
          transition: 'background 0.08s ease-out',
        }}
      />

      {/* 3. Floating Serene Glow Orbs (Soft, Ambient, No Line Clutter) */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '15%',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.04) 50%, transparent 75%)',
          filter: 'blur(60px)',
          transform: `translate3d(${offset.x * -18}px, ${offset.y * -14}px, 0)`,
          animation: 'orbFloat1 22s ease-in-out infinite',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '10%',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242, 97, 156, 0.15) 0%, rgba(231, 190, 248, 0.04) 50%, transparent 75%)',
          filter: 'blur(60px)',
          transform: `translate3d(${offset.x * -14}px, ${offset.y * -18}px, 0)`,
          animation: 'orbFloat2 26s ease-in-out infinite',
        }}
      />

      {/* 4. Single Calm Watermark Logo Emblem (Off-Center Upper-Right, Non-Intrusive) */}
      <div
        style={{
          position: 'absolute',
          top: '30px',
          right: '50px',
          width: '260px',
          height: '260px',
          transform: `translate3d(${offset.x * 12}px, ${offset.y * 10}px, 0)`,
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'subtleWatermarkBreathe 9s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      >
        <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
          <defs>
            <linearGradient id="calmWatermarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#F2619C" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#E7BEF8" stopOpacity="0.40" />
            </linearGradient>
          </defs>

          {/* Clean 4-Point Astroid Contour */}
          <path
            d="M 100 20 Q 100 100 20 100 Q 100 100 100 180 Q 100 100 180 100 Q 100 100 100 20 Z"
            stroke="url(#calmWatermarkGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Faint Inner Diamond */}
          <path
            d="M 100 48 L 152 100 L 100 152 L 48 100 Z"
            stroke="url(#calmWatermarkGrad)"
            strokeWidth="0.8"
            strokeDasharray="3 4"
            opacity="0.5"
          />

          {/* Central Nucleus */}
          <circle cx="100" cy="100" r="3" fill="#FBBF24" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
};
