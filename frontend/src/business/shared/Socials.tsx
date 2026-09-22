import { Instagram, Facebook, Globe } from 'lucide-react';

const LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  twitter: 'X',
  youtube: 'YouTube',
  web: 'Sitio web',
};

function normalizeHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('@')) return `https://instagram.com/${url.slice(1)}`;
  return `https://${url}`;
}

/** Redes sociales desde Business.socials (Json: { instagram?, facebook?, ... }). */
export default function Socials({ socials }: { socials: any }) {
  if (!socials || typeof socials !== 'object') return null;
  const entries = Object.entries(socials).filter(([, v]) => typeof v === 'string' && v.trim());
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([key, value]) => {
        const label = LABELS[key.toLowerCase()] || key;
        const href = normalizeHref(String(value));
        const Icon = key.toLowerCase() === 'instagram' ? Instagram : key.toLowerCase() === 'facebook' ? Facebook : Globe;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-black underline-offset-4 hover:underline"
          >
            <Icon size={15} /> {label}
          </a>
        );
      })}
    </div>
  );
}
