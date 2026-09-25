import { useEffect, useState } from 'react';

/**
 * Imagenes de producto remotas (AliExpress/CDN de terceros) pueden responder
 * 403/429 o caerse. Cuando eso ocurre el <img> queda roto y el usuario ve el
 * icono de imagen rota del navegador. Este componente degrada a un placeholder
 * local conservando el alt y el layout.
 */
export const IMAGE_FALLBACK_SRC = '/logo-icon.svg';

interface RemoteImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
}

export default function RemoteImage({ src, alt, className, loading, decoding, onLoad, onError }: RemoteImageProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);

  const resolved = !src || broken ? IMAGE_FALLBACK_SRC : src;
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      data-fallback={!src || broken ? 'true' : undefined}
      onLoad={onLoad}
      onError={() => { setBroken(true); onError?.(); }}
    />
  );
}
