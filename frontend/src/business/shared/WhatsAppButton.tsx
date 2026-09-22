import { buildWaLink, trackEvent } from '@/services/business';

export default function WhatsAppButton({ phone, message, slug, label = 'WhatsApp' }: { phone?: string | null; message: string; slug: string; label?: string }) {
  const href = buildWaLink(phone, message);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
      className="fixed bottom-5 right-5 z-50 rounded-full bg-green-500 px-5 py-3 text-white font-semibold shadow-lg hover:bg-green-600"
    >
      {label}
    </a>
  );
}
