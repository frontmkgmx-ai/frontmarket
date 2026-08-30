import React, { useEffect, useRef } from 'react';

export function AuraBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactiveLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isRunning = true;

    // 1. Reatividade ao Mouse (Desktop)
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const normX = (e.clientX / innerWidth - 0.5) * 2; // -1 a 1
      const normY = (e.clientY / innerHeight - 0.5) * 2; // -1 a 1
      targetX = normX * 45; // Deslocamento de até 45px
      targetY = normY * 45;
    };

    // 2. Reatividade ao Scroll da Página
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const scrollFactor = Math.min(scrollY / 1000, 1);
      targetY += (scrollFactor - 0.5) * 30;
    };

    // 3. Reatividade ao Giroscópio / Inclinação (Mobile & Tablet)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // gamma: -90 (esquerda) a 90 (direita)
        // beta: -180 (topo) a 180 (baixo)
        const tiltX = Math.max(-45, Math.min(45, e.gamma));
        const tiltY = Math.max(-45, Math.min(45, e.beta - 45)); // centraliza posição natural de segurar
        targetX = (tiltX / 45) * 35;
        targetY = (tiltY / 45) * 35;
      }
    };

    // Loop de interpolação suave (Lerp) para 60-120 FPS
    const updateMotion = () => {
      if (!isRunning) return;

      // Interpolação suave para efeito elástico/orgânico
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      if (interactiveLayerRef.current) {
        interactiveLayerRef.current.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(updateMotion);
    };

    // Pausa animação quando a aba não estiver visível (economia de bateria/GPU)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          animationFrameId = requestAnimationFrame(updateMotion);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    animationFrameId = requestAnimationFrame(updateMotion);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full -z-10 bg-[#06060c] overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes aura-drift-mesh {
          0% {
            transform: translate3d(0%, 0%, 0) scale(1) rotate(0deg);
          }
          33% {
            transform: translate3d(4%, 6%, 0) scale(1.08) rotate(12deg);
          }
          66% {
            transform: translate3d(-5%, 3%, 0) scale(0.95) rotate(-8deg);
          }
          100% {
            transform: translate3d(0%, 0%, 0) scale(1) rotate(0deg);
          }
        }

        .aura-animated-mesh {
          animation: aura-drift-mesh 24s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>

      {/* Camada interativa que responde ao mouse, scroll e giroscópio com aceleração por GPU */}
      <div 
        ref={interactiveLayerRef} 
        className="absolute inset-[-15%] w-[130%] h-[130%] will-change-transform"
      >
        {/* Malha de Iluminação Aura Gemini Única e Leve */}
        <div 
          className="aura-animated-mesh absolute inset-0 w-full h-full"
          style={{
            background: `
              radial-gradient(ellipse 55% 45% at 20% 25%, rgba(37, 99, 235, 0.45), transparent 70%),
              radial-gradient(ellipse 50% 40% at 80% 30%, rgba(139, 92, 246, 0.40), transparent 70%),
              radial-gradient(ellipse 60% 50% at 50% 85%, rgba(20, 184, 166, 0.38), transparent 70%),
              radial-gradient(ellipse 45% 35% at 85% 80%, rgba(236, 72, 153, 0.28), transparent 65%)
            `,
            filter: 'blur(28px)',
          }}
        />

        {/* Halo luminoso central pulsante de profundidade */}
        <div 
          className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full pointer-events-none opacity-40 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(6, 6, 12, 0) 70%)',
          }}
        />
      </div>

      {/* Grade sutil de textura ultra-leve */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Vinheta periférica para contraste nítido com textos e botões */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(6, 6, 12, 0.7) 100%)',
        }}
      />
    </div>
  );
}
