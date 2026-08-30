import React from 'react';

export function AuraBackground() {
  return (
    <div 
      className="fixed inset-0 w-full h-full -z-10 bg-[#050509] overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes aura-float-1 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 0.65;
          }
          33% {
            transform: translate3d(8vw, 12vh, 0) scale(1.18) rotate(45deg);
            opacity: 0.85;
          }
          66% {
            transform: translate3d(-10vw, 6vh, 0) scale(0.92) rotate(-30deg);
            opacity: 0.6;
          }
        }

        @keyframes aura-float-2 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 0.6;
          }
          33% {
            transform: translate3d(-12vw, -8vh, 0) scale(1.22) rotate(-40deg);
            opacity: 0.8;
          }
          66% {
            transform: translate3d(6vw, -14vh, 0) scale(0.95) rotate(35deg);
            opacity: 0.55;
          }
        }

        @keyframes aura-float-3 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.55;
          }
          50% {
            transform: translate3d(14vw, -10vh, 0) scale(1.25);
            opacity: 0.85;
          }
        }

        @keyframes aura-float-4 {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(0.9) rotate(0deg);
            opacity: 0.45;
          }
          50% {
            transform: translate3d(-10vw, 12vh, 0) scale(1.15) rotate(60deg);
            opacity: 0.7;
          }
        }

        .animate-aura-1 {
          animation: aura-float-1 22s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-aura-2 {
          animation: aura-float-2 28s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-aura-3 {
          animation: aura-float-3 24s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-aura-4 {
          animation: aura-float-4 32s ease-in-out infinite;
          will-change: transform, opacity;
        }
      `}</style>

      {/* Sutil textura de granulado / noise ultra leve */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Camada 1: Cobalt Blue (#1E3A8A / #2563EB) - Topo Esquerda / Centro */}
      <div 
        className="animate-aura-1 absolute -top-[15%] left-[5%] w-[110vw] sm:w-[65vw] h-[65vh] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(30, 58, 138, 0.3) 40%, rgba(5, 5, 9, 0) 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Camada 2: Deep Violet / Purple (#4C1D95 / #7C3AED) - Topo Direita */}
      <div 
        className="animate-aura-2 absolute top-[10%] -right-[15%] sm:right-[5%] w-[100vw] sm:w-[60vw] h-[65vh] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(76, 29, 149, 0.28) 45%, rgba(5, 5, 9, 0) 70%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Camada 3: Vibrant Teal / Cerceta (#0D9488 / #14B8A6) - Base / Centro Mobile */}
      <div 
        className="animate-aura-3 absolute bottom-[-10%] sm:bottom-[5%] left-[10%] sm:left-[25%] w-[90vw] sm:w-[50vw] h-[55vh] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.38) 0%, rgba(13, 148, 136, 0.22) 45%, rgba(5, 5, 9, 0) 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Camada 4: Magenta Rose (#DB2777 / #BE185D) - Acento de Borda */}
      <div 
        className="animate-aura-4 absolute bottom-[15%] -right-[10%] sm:right-[15%] w-[80vw] sm:w-[40vw] h-[45vh] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(219, 39, 119, 0.3) 0%, rgba(190, 24, 93, 0.18) 40%, rgba(5, 5, 9, 0) 70%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Camada Central Suave de Fusão / Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5, 5, 9, 0.75) 100%)',
        }}
      />
    </div>
  );
}
