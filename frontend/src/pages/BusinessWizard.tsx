import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBusiness, getTemplates } from '@/services/business';
import { BUSINESS_CATEGORY_CODES } from '@/business/categoryRegistry';
import { categoryDescription, categoryLabel, ctaLabel } from '@/business/businessLabels';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';

type Form = { name: string; description: string; phone: string; whatsapp: string; email: string; address: string; city: string; socials: string; cta: string };
const initial: Form = { name: '', description: '', phone: '', whatsapp: '', email: '', address: '', city: '', socials: '', cta: '' };
const steps = ['Información básica', 'Tipo de negocio', 'Diseño', 'Contenido mínimo', 'Revisión'];

export default function BusinessWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [category, setCategory] = useState('HAIR');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => { void getTemplates().then((items) => { setTemplates(items); setTemplateId(items[0]?.id || ''); }).catch(() => setError('No se pudieron cargar los diseños.')).finally(() => setLoading(false)); }, []);
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === templateId), [templateId, templates]);
  const canContinue = step !== 0 || form.name.trim().length > 1;
  const next = () => { setError(''); if (canContinue) setStep((value) => Math.min(steps.length - 1, value + 1)); };
  const submit = async () => {
    if (!form.name.trim() || !templateId) { setError('Completa el nombre y selecciona un diseño.'); return; }
    setSaving(true); setError('');
    try {
      const business = await createBusiness({ name: form.name.trim(), description: form.description.trim() || null, category, templateId, phone: form.phone.trim() || null, whatsapp: form.whatsapp.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, city: form.city.trim() || null, socials: form.socials ? Object.fromEntries(form.socials.split(',').map((value) => value.trim().split(/\s+/).slice(0, 2))) : null, cta: form.cta.trim() || ctaLabel(category) });
      navigate(`/negocio/editor?id=${business.id}`);
    } catch (cause: any) { setError(cause?.response?.data?.message || 'No se pudo crear la página.'); } finally { setSaving(false); }
  };
  return <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900"><div className="mx-auto max-w-5xl"><div className="mb-8 flex items-center justify-between"><div><p className="text-sm font-semibold text-stone-500">YesYes Business</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Crea tu página web</h1></div><span className="text-sm text-stone-500">Paso {step + 1} de {steps.length}</span></div><div className="mb-8 grid grid-cols-5 gap-2" aria-label="Progreso">{steps.map((label, index) => <div key={label} className="h-1.5 rounded-full bg-stone-200"><div className={`h-full rounded-full bg-stone-900 transition-all ${index <= step ? 'w-full' : 'w-0'}`} /></div>)}</div><section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8"><h2 className="text-2xl font-bold">{steps[step]}</h2>

    {step === 0 && <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Nombre del negocio" value={form.name} onChange={(v) => set('name', v)} placeholder="Ej. Barbería Daniel" autoFocus /><Field label="Descripción" value={form.description} onChange={(v) => set('description', v)} placeholder="Cuenta brevemente qué haces" textarea /><Field label="Teléfono" value={form.phone} onChange={(v) => set('phone', v)} placeholder="Opcional" /><Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="+56 9..." /><Field label="Email" value={form.email} onChange={(v) => set('email', v)} placeholder="Opcional" type="email" /><Field label="Ciudad" value={form.city} onChange={(v) => set('city', v)} placeholder="Opcional" /></div>}
    {step === 1 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{BUSINESS_CATEGORY_CODES.map((code) => <button type="button" key={code} onClick={() => setCategory(code)} className={`rounded-2xl border p-4 text-left transition ${category === code ? 'border-stone-900 ring-2 ring-stone-900' : 'hover:border-stone-400'}`}><b>{categoryLabel(code)}</b><span className="mt-1 block text-sm text-stone-500">{categoryDescription(code)}</span></button>)}</div>}
    {step === 2 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{loading ? <p className="text-stone-500"><Loader2 className="mr-2 inline animate-spin" />Cargando diseños…</p> : templates.map((template) => <button type="button" key={template.id} onClick={() => setTemplateId(template.id)} className={`overflow-hidden rounded-2xl border text-left ${templateId === template.id ? 'border-stone-900 ring-2 ring-stone-900' : 'hover:border-stone-400'}`}><div className="h-28 bg-gradient-to-br from-stone-200 to-stone-400 p-4"><Sparkles className="text-white" /></div><div className="p-4"><b>{template.name}</b><p className="mt-1 text-sm text-stone-500">{categoryLabel(template.category)} · {template.capabilities?.slice(0, 3).join(' · ')}</p></div></button>)}</div>}
    {step === 3 && <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Dirección" value={form.address} onChange={(v) => set('address', v)} placeholder="Opcional" /><Field label="Redes (Instagram, Facebook)" value={form.socials} onChange={(v) => set('socials', v)} placeholder="@usuario, https://facebook.com/..." /><Field label="CTA principal" value={form.cta} onChange={(v) => set('cta', v)} placeholder={ctaLabel(category)} /><div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Podrás agregar productos, servicios, galería, equipo y más desde el editor.</div></div>}
    {step === 4 && <div className="mt-6 space-y-4"><div className="rounded-2xl bg-stone-950 p-6 text-white"><p className="text-sm text-stone-400">{categoryLabel(category)}</p><h3 className="mt-2 text-3xl font-bold">{form.name || 'Tu negocio'}</h3><p className="mt-2 text-stone-300">{form.description || 'Una página profesional creada con YesYes.'}</p><span className="mt-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-950">{selectedTemplate?.name || 'Diseño seleccionado'}</span></div><p className="text-sm text-stone-500">Después de crear la página entrarás directamente al editor. Podrás publicar cuando el backend confirme los requisitos.</p></div>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-8 flex flex-wrap justify-between gap-3"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-5 font-semibold disabled:opacity-40" disabled={step === 0 || saving} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={17} /> Volver</button>{step < steps.length - 1 ? <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-40" disabled={!canContinue} onClick={next}>Continuar <ArrowRight size={17} /></button> : <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void submit()}>{saving ? 'Creando…' : <><Check size={17} /> Crear página</>}</button>}</div></section></div></main>;
}
type FieldProps = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; textarea?: boolean; autoFocus?: boolean };
function Field({ label, value, onChange, placeholder, type = 'text', textarea = false, autoFocus = false }: FieldProps) { const Tag = textarea ? 'textarea' : 'input'; return <label className="text-sm font-semibold text-stone-700">{label}<Tag className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10" value={value} placeholder={placeholder} type={textarea ? undefined : type} autoFocus={autoFocus} onChange={(e: any) => onChange(e.target.value)} /></label>; }
