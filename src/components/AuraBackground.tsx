import React from 'react';
import { motion } from 'motion/react';

export function AuraBackground() {
  return (
    <div className="fixed top-0 left-0 w-[100vw] h-[100vh] z-[-1] bg-[#050509] overflow-hidden pointer-events-none">
      
      {/* Noise Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Aura Orbs */}
      <div className="absolute inset-0 w-full h-full">
        {/* Cobalt Blue Orb */}
        <motion.div
          animate={{
            x: ["-10%", "20%", "-10%"],
            y: ["-10%", "20%", "-10%"],
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[20%] w-[50vw] h-[50vh] md:w-[40vw] md:h-[40vw] bg-[#1E3A8A] rounded-full blur-[100px] md:blur-[140px] mix-blend-screen"
        />

        {/* Deep Purple Orb */}
        <motion.div
          animate={{
            x: ["20%", "-20%", "20%"],
            y: ["20%", "-10%", "20%"],
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.7, 0.5],
          }}
          transition={{ duration: 45, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[30%] right-[10%] w-[60vw] h-[60vh] md:w-[45vw] md:h-[45vw] bg-[#4C1D95] rounded-full blur-[100px] md:blur-[140px] mix-blend-screen"
        />

        {/* Teal Orb - Concentrated near bottom/inputs on mobile */}
        <motion.div
          animate={{
            x: ["0%", "-30%", "0%"],
            y: ["0%", "30%", "0%"],
            scale: [0.9, 1.1, 0.9],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute bottom-[20%] left-[10%] w-[45vw] h-[45vh] md:w-[35vw] md:h-[35vw] bg-[#14B8A6] rounded-full blur-[90px] md:blur-[130px] mix-blend-screen"
        />

        {/* Magenta Orb - Edge glow */}
        <motion.div
          animate={{
            x: ["-10%", "10%", "-10%"],
            y: ["10%", "-10%", "10%"],
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut", delay: 10 }}
          className="absolute bottom-[10%] right-[20%] w-[40vw] h-[40vh] md:w-[30vw] md:h-[30vw] bg-[#DB2777] rounded-full blur-[100px] md:blur-[120px] mix-blend-screen"
        />
      </div>
    </div>
  );
}
