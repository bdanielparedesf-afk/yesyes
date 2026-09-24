import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Eye, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

const BENEFITS = [
  'Página profesional para tu rubro',
  'Diseño adaptable a celulares',
  'Servicios, catálogo y galería',
  'WhatsApp, formularios y ubicación',
  'Estadísticas y vista previa antes de publicar',
];

const STEPS = [
  { title: 'Elige tu negocio', text: 'Cuéntanos a qué te dedicas y elige el diseño más adecuado.' },
  { title: 'Personaliza tu página', text: 'Agrega tus servicios, productos, fotos y formas de contacto.' },
  { title: 'Publica y comparte', text: 'Revisa el resultado, activa tu suscripción y comparte tu página.' },
];

const COMMERCIAL_FLOW = ['Crea tu página', 'Configúrala', 'Elige tu diseño', 'Activa tu suscripción', 'Publica tu página'];
const CATEGORIES = ['Peluquerías', 'Barberías', 'Panaderías', 'Restaurantes', 'Florerías', 'Inmobiliarias', 'Talleres', 'Belleza', 'Fotografía', 'y más'];

function BusinessVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-label="Vista previa de una página web profesional">
      <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur sm:p-4">
        <div className="overflow-hidden rounded-xl bg-white text-neutral-900 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-neutral-100 px-4 py-3" aria-hidden>
            <i className="h-2.5 w-2.5 rounded-full bg-red-300" /><i className="h-2.5 w-2.5 rounded-full bg-amber-300" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <span className="ml-3 hidden flex-1 truncate rounded bg-neutral-100 px-3 py-1 text-[9px] text-neutral-500 sm:block">yesyes.cl/mi-negocio/tu-negocio</span>
          </div>
          <div className="grid min-h-64 grid-cols-[72px_1fr] sm:grid-cols-[110px_1fr]">
            <div className="bg-neutral-950 p-3 text-white sm:p-4">
              <p className="text-[8px] font-bold tracking-[.18em] text-primary-300">TU NEGOCIO</p>
              <p className="mt-2 text-sm font-bold leading-tight sm:text-base">Tu marca aquí</p>
              <div className="mt-5 space-y-2 text-[8px] text-neutral-400"><p>Servicios</p><p>Productos</p><p>Galería</p><p>Contacto</p><p>WhatsApp</p></div>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-white p-4 sm:p-6">
              <Sparkles className="h-6 w-6 text-primary-700" />
              <p className="mt-5 text-base font-black leading-tight sm:text-2xl">Haz que tus clientes te encuentren online</p>
              <p className="mt-2 text-[9px] leading-relaxed text-neutral-500 sm:text-xs">Servicios, ubicación y contacto en una página pensada para tu negocio.</p>
              <div className="mt-4 h-7 w-24 rounded-full bg-neutral-900 sm:h-8 sm:w-32" />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-xl border border-white/20 bg-neutral-900/90 px-3 py-2 text-xs text-white shadow-xl sm:flex">
        <Eye className="h-4 w-4 text-emerald-300" /> Vista previa antes de publicar
      </div>
    </div>
  );
}


export default function BusinessPromotion() {
  const token = useAuthStore((state) => state.token);
  const authStatus = useAuthStore((state) => state.status);
  const target = token || authStatus === 'authenticated' ? '/negocio' : '/login?returnTo=%2Fnegocio';

  return (
    <section id="yesyes-business" className="overflow-hidden bg-neutral-950 py-16 sm:py-20" aria-labelledby="business-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.24em] text-primary-300">YesYes Business</p>
            <h2 id="business-title" className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Crea tu propia página web profesional</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg">Tu negocio merece estar online. Presenta tus servicios, muestra lo que vendes y recibe consultas para que tus clientes te encuentren online.</p>
            <ul className="mt-7 grid gap-3 text-sm text-neutral-200 sm:grid-cols-2" aria-label="Beneficios de YesYes Business">
              {BENEFITS.map((benefit) => <li key={benefit} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />{benefit}</li>)}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to={target} className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 py-3 font-bold text-neutral-950 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950">Crear mi página web</Link>
              <a href="#como-funciona" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-7 py-3 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Ver cómo funciona</a>
            </div>
            <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-white/15 pt-5">
              <div><p className="text-xs text-neutral-400">Desde</p><p className="text-2xl font-black text-white">$11.990 <span className="text-sm font-medium text-neutral-300">CLP / mes</span></p></div>
              <p className="pb-1 text-sm text-emerald-300">Sin pago anual obligatorio</p>
            </div>
            <p className="mt-4 text-sm text-neutral-400">Tu página funciona mediante una suscripción mensual. El pago se procesa de forma segura mediante Mercado Pago.</p>
          </div>
          <BusinessVisual />
        </div>
        <div className="mt-14 border-t border-white/10 pt-8">
          <h3 className="text-sm font-semibold text-neutral-300">Ideal para</h3>
          <div className="mt-3 flex flex-wrap gap-2">{CATEGORIES.map((item) => <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-neutral-200">{item}</span>)}</div>
        </div>
      </div>
      <div id="como-funciona" className="mt-16 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary-700">Fácil de usar</p><h3 className="mt-2 text-3xl font-black text-neutral-950">¿Cómo funciona?</h3></div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">{STEPS.map((step, index) => <li key={step.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 font-black text-white" aria-hidden>{index + 1}</span><h4 className="mt-5 text-lg font-bold text-neutral-950">{step.title}</h4><p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.text}</p></li>)}</ol>
          <ol className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-xs font-semibold text-neutral-600 sm:gap-3" aria-label="Flujo de creación y publicación">{COMMERCIAL_FLOW.map((step, index) => <li key={step} className="flex items-center gap-2 sm:gap-3"><span className="rounded-full bg-primary-100 px-3 py-2 text-primary-900">{step}</span>{index < COMMERCIAL_FLOW.length - 1 && <span aria-hidden>→</span>}</li>)}</ol>
          <p className="mt-7 text-center text-sm text-neutral-500">Después de crearla, podrás revisarla y elegir cuándo publicarla.</p>
        </div>
      </div>
    </section>
  );
}
