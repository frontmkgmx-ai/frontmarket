import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Maximize } from 'lucide-react';

interface AdvancedVideoPlayerProps {
  url: string;
}

export function AdvancedVideoPlayer({ url }: AdvancedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Autoplay usually requires mute
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Extract YouTube ID if it's a youtube link
  const getYoutubeId = (url: string) => {
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0];
    if (url.includes('youtube.com/watch')) return url.split('v=')[1]?.split('&')[0];
    if (url.includes('youtube.com/embed/')) return url.split('embed/')[1]?.split('?')[0];
    return null;
  };
  
  const youtubeId = getYoutubeId(url);
  
  useEffect(() => {
    if (videoRef.current && !youtubeId) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, youtubeId]);

  if (youtubeId) {
    // Advanced Youtube Iframe with autoplay, mute, high quality (hd1080 usually)
    const ytSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&rel=0&showinfo=0&modestbranding=1&vq=hd1080`;
    
    return (
      <div className="relative w-full h-full bg-black group">
        <iframe
          className="w-full h-full object-cover pointer-events-none" // prevent clicking inside to keep it clean, or allow it
          src={ytSrc}
          title="Product Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {/* Overlay for interaction if needed */}
      </div>
    );
  }

  // Native video fallback
  return (
    <div className="relative w-full h-full bg-black group">
      <video 
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
      />
      <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
          className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
        >
          {isPlaying ? <span className="text-xs font-bold px-1">||</span> : <Play className="w-4 h-4" />}
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
