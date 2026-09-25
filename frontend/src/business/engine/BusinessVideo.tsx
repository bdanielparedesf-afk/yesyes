import { useEffect, useRef, useState } from 'react';

/**
 * YESYES BUSINESS · TEMPLATE ENGINE V2 — Reproducción de video (Fase 3).
 *
 * El motor soporta video desde el inicio. El ALMACENAMIENTO de video se
 * implementa en Fase 5; aquí el bloque consume `BusinessMedia` (url, poster)
 * cuando existe y, cuando no, cae a su fallback real. Nunca se muestra un
 * reproductor vacío ni un botón que no hace nada.
 *
 * Reglas de reproducción:
 *  - autoplay SOLO con muted (los navegadores lo bloquean y es mala práctica);
 *  - `prefers-reduced-motion` desactiva autoplay y el loop;
 *  - en mobile se puede sustituir por el poster (ahorra datos);
 *  - el poster se muestra siempre hasta que el video carga;
 *  - `controls` quedan a decisión del template, no por defecto.
 */

export interface BusinessVideoProps {
  src?: string | null;
  poster?: string | null;
  /** Texto alternativo: obligatorio para accesibilidad. */
  alt: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
  /** En mobile, mostrar solo el poster sin reproducir. */
  posterOnlyOnMobile?: boolean;
  /** Callback de QA: avisa cuando el video no se pudo reproducir. */
  onUnavailable?: (reason: string) => void;
}

/** ¿El usuario pidió menos movimiento? Se lee en vivo, no solo al montar. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return reduced;
}

/** ¿La pantalla es mobile? Se usa para aplicar el fallback de datos. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 767px)');
    setMobile(query.matches);
    const listener = (event: MediaQueryListEvent) => setMobile(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return mobile;
}

/**
 * Reproductor único del sistema. Todos los bloques de video (HeroVideo,
 * Video, VideoGallery) usan ESTE componente: no hay un segundo reproductor.
 */
export function BusinessVideo({
  src,
  poster,
  alt,
  autoplay = false,
  muted = true,
  loop = false,
  controls = false,
  className = '',
  posterOnlyOnMobile = false,
  onUnavailable,
}: BusinessVideoProps) {
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);

  // Sin medio no hay reproductor: se informa y se queda el poster (o nada).
  useEffect(() => {
    if (src) return;
    setFailed(true);
    onUnavailable?.('sin-video');
  }, [src, onUnavailable]);

  // Autoplay: exige muted, no se dispara con reduced-motion y en mobile
  // depende de la política del layout.
  const shouldAutoplay = Boolean(autoplay && muted && !reducedMotion && !(posterOnlyOnMobile && isMobile));
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !shouldAutoplay) return;
    const attempt = element.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        // Fallo de autoplay (política del navegador o datos): NO es un error
        // visible para el usuario, solo el poster con controles.
        setStarted(false);
      });
    }
  }, [shouldAutoplay, src]);

  if (!src || failed) {
    if (poster) {
      return (
        <img
          src={poster}
          alt={alt}
          loading="lazy"
          decoding="async"
          data-video-fallback="poster"
          className={`h-full w-full object-cover ${className}`}
        />
      );
    }
    return null;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      aria-label={alt}
      data-video-started={started ? 'true' : 'false'}
      data-video-reduced-motion={reducedMotion ? 'true' : 'false'}
      className={`h-full w-full object-cover ${className}`}
      autoPlay={shouldAutoplay}
      muted={muted}
      loop={Boolean(loop) && !reducedMotion}
      controls={controls}
      playsInline
      preload={shouldAutoplay ? 'auto' : 'metadata'}
      onCanPlay={() => setStarted(true)}
      onError={() => {
        setFailed(true);
        onUnavailable?.('error-de-carga');
      }}
    />
  );
}

/** Hook reutilizable para exponer si hay movimiento reducido. */
export function useReducedMotion(): boolean {
  return usePrefersReducedMotion();
}
