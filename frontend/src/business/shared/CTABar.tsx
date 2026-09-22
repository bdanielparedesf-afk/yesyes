import { Phone, MessageCircle } from 'lucide-react';
import { buildWaLink, trackEvent } from '@/services/business';

/** Barra fija inferior con acciones de contacto (WhatsApp + telefono). */
export default function CTABar({
  business,
  slug,
  message,
  waLabel = 'Escribir por WhatsApp',
  callLabel = 'Llamar',
}: {
  business: any;
  slug: string;
  message: string;
  waLabel?: string;
  callLabel?: string;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2">
        {business?.phone && (
          <a
            href={`tel:${business.phone}`}
            onClick={() => trackEvent(slug, 'PHONE_CLICK')}
            className="inline-flex items-center gap-1.5 border border-neutral-300 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Phone size={15} /> {callLabel}
          </a>
        )}
        <a
          href={buildWaLink(business?.whatsapp, message)}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent(slug, 'WHATSAPP_CLICK')}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle size={16} /> {waLabel}
        </a>
      </div>
    </div>
  );
}
