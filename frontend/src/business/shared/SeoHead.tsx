import { useEffect } from 'react';

interface SeoProps { title?: string | null; description?: string | null; image?: string | null; canonical?: string | null; }

export default function SeoHead({ title, description, image, canonical }: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;
    const set = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        if (sel.startsWith('link')) { el = document.createElement('link') as HTMLLinkElement; (el as HTMLLinkElement).rel = 'canonical'; document.head.appendChild(el); }
        else { el = document.createElement('meta') as HTMLMetaElement; const key = sel.includes('name=') ? 'name' : 'property'; el.setAttribute(key, sel.split(/["']/)[1]); document.head.appendChild(el); }
      }
      el.setAttribute(attr, val);
    };
    if (description) set('meta[name="description"]', 'content', description);
    if (title) { set('meta[property="og:title"]', 'content', title); set('meta[name="twitter:title"]', 'content', title); }
    if (description) { set('meta[property="og:description"]', 'content', description); set('meta[name="twitter:description"]', 'content', description); }
    if (image) { set('meta[property="og:image"]', 'content', image); set('meta[name="twitter:image"]', 'content', image); }
    set('link[rel="canonical"]', 'href', canonical || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''));
  }, [title, description, image, canonical]);
  return null;
}
