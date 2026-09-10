import React, { useState, useEffect } from 'react';
import { resolveStreamxImageUrl } from '../lib/streamx';

interface StreamxImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function StreamxImage({ src, alt, className, ...props }: StreamxImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!src) return;

    const url = resolveStreamxImageUrl(src);
    
    // Se for uma URL do proxy local, usamos fetch para trazer como blob
    // Isso resolve bloqueios de SSO e problemas de cache
    if (url.startsWith('/api/')) {
      fetch(url)
        .then(async res => {
          if (!res.ok) throw new Error('Failed to load image');
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
             throw new Error('Received HTML instead of image (backend might be missing)');
          }
          const blob = await res.blob();
          if (active) setBlobUrl(URL.createObjectURL(blob));
        })
        .catch(err => {
          console.error('Failed to load image via proxy', err);
          if (active) setError(true);
        });
    } else {
      setBlobUrl(url);
    }
    
    return () => {
      active = false;
    };
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs ${className}`}>
        Sem imagem
      </div>
    );
  }

  if (!blobUrl) {
    return <div className={`bg-slate-100 animate-pulse ${className}`}></div>;
  }

  return <img src={blobUrl} alt={alt} className={className} {...props} />;
}
