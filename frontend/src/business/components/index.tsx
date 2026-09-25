import { useEffect, useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';

export function BusinessContainer({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>; }
export function BusinessSection({ children, id, className = '', label }: { children: ReactNode; id?: string; className?: string; label?: string }) { return <section id={id} aria-label={label} className={`py-14 sm:py-20 ${className}`}>{children}</section>; }
export function BusinessHeading({ eyebrow, title, text, align = 'left' }: { eyebrow?: string; title: string; text?: string; align?: 'left' | 'center' }) { return <header className={`mb-8 max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.24em] text-current opacity-65">{eyebrow}</p>}<h2 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>{text && <p className="mt-3 opacity-75">{text}</p>}</header>; }
export function BusinessButton({ href, children, variant = 'primary', className = '', onClick }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary'; className?: string; onClick?: () => void }) { return <a href={href} onClick={onClick} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className={`inline-flex min-h-11 items-center justify-center rounded-[var(--biz-radius)] px-6 py-3 font-bold transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 ${variant === 'secondary' ? 'border border-current' : 'bg-[var(--biz-primary)] text-white'} ${className}`}>{children}</a>; }
export function BusinessCard({ children, className = '' }: { children: ReactNode; className?: string }) { return <article className={`rounded-[var(--biz-radius)] border border-black/10 bg-white p-5 shadow-[var(--biz-shadow)] ${className}`}>{children}</article>; }
export function BusinessImage({ src, alt, className = '', eager = false, objectPosition }: { src?: string | null; alt: string; className?: string; eager?: boolean; objectPosition?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div role="img" aria-label={alt} className={`grid place-items-center bg-stone-200 text-stone-500 ${className}`}><ImageOff className="h-7 w-7" aria-hidden /></div>;
  const responsiveSet = src.includes('images.unsplash.com/')
    ? [640, 960, 1280].map((width) => `${src}${src.includes('?') ? '&' : '?'}w=${width}`).join(', ')
    : undefined;
  return <img src={src} srcSet={responsiveSet} sizes={responsiveSet ? '(min-width: 768px) 50vw, 100vw' : undefined} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} style={objectPosition ? { objectPosition } : undefined} />;
}
export function ResponsiveImage(props: Parameters<typeof BusinessImage>[0]) { return <BusinessImage {...props} />; }
export function BusinessGallery({ images, className = '' }: { images: Array<{ id?: string; url: string; alt?: string | null }>; className?: string }) { if (!images.length) return null; return <div className={`grid grid-cols-2 gap-2 md:grid-cols-3 ${className}`}>{images.map((image, index) => <BusinessImage key={image.id || `${image.url}-${index}`} src={image.url} alt={image.alt || 'Imagen de la galería'} className="aspect-[4/3] h-full w-full rounded-[calc(var(--biz-radius)*.7)] object-cover" />)}</div>; }
export function BusinessCTA({ action, secondary, message }: { action: string; secondary?: string; message: string }) { return <div className="flex flex-wrap justify-center gap-3"><BusinessButton href={message}>{action}</BusinessButton>{secondary && <BusinessButton href="#contacto" variant="secondary">{secondary}</BusinessButton>}</div>; }
