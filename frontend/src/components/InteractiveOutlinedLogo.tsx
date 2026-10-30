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
      // Relative percentage for spotlight
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x: Math.max(0, Math.min(100, rawX)), y: Math.max(0, Math.min(100, rawY)) });

      // Normalized offset -1 to 1 for gentle parallax
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = normX;
      targetY = normY;
    };

    const loop = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
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
      {/* Interactive Cursor Spotlight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle 550px at ${mousePos.x}% ${mousePos.y}%, rgba(251, 191, 36, 0.12) 0%, rgba(242, 97, 156, 0.06) 40%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 0.08s ease-out',
        }}
      />

      {/* Floating Outlined Emblem with 3D Parallax */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '720px',
          height: '720px',
          marginLeft: '-360px',
          marginTop: '-360px',
          transform: `translate3d(${offset.x * 28}px, ${offset.y * 24}px, 0) rotate(${offset.x * 4}deg)`,
          transition: 'transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          opacity: 0.85,
        }}
      >
        <svg
          viewBox="0 0 600 600"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Luminous Brand Gradient for Outlines */}
            <linearGradient id="logoOutlineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#F2619C" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#E7BEF8" stopOpacity="0.50" />
            </linearGradient>

            <linearGradient id="logoSecondaryGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#93ABD9" stopOpacity="0.40" />
              <stop offset="50%" stopColor="#E7BEF8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#EDE986" stopOpacity="0.40" />
            </linearGradient>

            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F2619C" stopOpacity="0.12" />
              <stop offset="60%" stopColor="#FBBF24" stopOpacity="0.04" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Center Glow Ambient Circle */}
          <circle cx="300" cy="300" r="180" fill="url(#centerGlow)" />

          {/* 1. Outer Concentric Orbital Ring (Slow Clockwise Rotation) */}
          <g style={{ transformOrigin: '300px 300px', animation: 'spinSlow 140s linear infinite' }}>
            <circle
              cx="300"
              cy="300"
              r="275"
              stroke="url(#logoOutlineGrad)"
              strokeWidth="1"
              strokeDasharray="6 14"
              opacity="0.35"
            />
            {/* Orbital micro-markers */}
            <circle cx="300" cy="25" r="3" fill="#FBBF24" opacity="0.6" />
            <circle cx="575" cy="300" r="3" fill="#F2619C" opacity="0.6" />
            <circle cx="300" cy="575" r="3" fill="#E7BEF8" opacity="0.6" />
            <circle cx="25" cy="300" r="3" fill="#93ABD9" opacity="0.6" />
          </g>

          {/* 2. Inner Celestial Coordinate Ring (Slow Counter-Clockwise Rotation) */}
          <g style={{ transformOrigin: '300px 300px', animation: 'spinReverseSlow 90s linear infinite' }}>
            <circle
              cx="300"
              cy="300"
              r="200"
              stroke="url(#logoSecondaryGrad)"
              strokeWidth="0.85"
              strokeDasharray="3 8"
              opacity="0.30"
            />
            {/* Cardinal tick lines */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1="300"
                y1="90"
                x2="300"
                y2="104"
                stroke="url(#logoOutlineGrad)"
                strokeWidth="1"
                opacity="0.45"
                transform={`rotate(${angle} 300 300)`}
              />
            ))}
          </g>

          {/* 3. Verification Crosshair Axes */}
          <line x1="300" y1="40" x2="300" y2="560" stroke="url(#logoOutlineGrad)" strokeWidth="0.75" strokeDasharray="3 7" opacity="0.22" />
          <line x1="40" y1="300" x2="560" y2="300" stroke="url(#logoOutlineGrad)" strokeWidth="0.75" strokeDasharray="3 7" opacity="0.22" />

          {/* 4. Outer Diamond Prism Facet Lines */}
          <path
            d="M 300 70 L 530 300 L 300 530 L 70 300 Z"
            stroke="url(#logoSecondaryGrad)"
            strokeWidth="0.8"
            opacity="0.28"
          />

          {/* 5. Primary ViDashboard 4-Point Astroid / Sparkle Star Outlines */}
          <g className="animate-logo-pulse" style={{ transformOrigin: '300px 300px' }}>
            {/* Outer Sparkle Contour */}
            <path
              d="M 300 60 Q 300 300 60 300 Q 300 300 300 540 Q 300 300 540 300 Q 300 300 300 60 Z"
              stroke="url(#logoOutlineGrad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.45"
            />

            {/* Inner Concentric Sparkle Contour */}
            <path
              d="M 300 150 Q 300 300 150 300 Q 300 300 300 450 Q 300 300 450 300 Q 300 300 300 150 Z"
              stroke="url(#logoOutlineGrad)"
              strokeWidth="1.2"
              strokeDasharray="4 5"
              strokeLinecap="round"
              opacity="0.38"
            />

            {/* Secondary Inner Diamond */}
            <path
              d="M 300 190 L 410 300 L 300 410 L 190 300 Z"
              stroke="url(#logoSecondaryGrad)"
              strokeWidth="0.9"
              opacity="0.32"
            />

            {/* Central Stylized 'V' Symbol of ViDashboard */}
            <path
              d="M 272 268 L 300 334 L 328 268"
              stroke="#F2619C"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.70"
            />

            {/* Center Prism Focal Core */}
            <circle cx="300" cy="300" r="6" fill="#FBBF24" opacity="0.65" />
            <circle cx="300" cy="300" r="14" stroke="#FBBF24" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
          </g>
        </svg>
      </div>
    </div>
  );
};
