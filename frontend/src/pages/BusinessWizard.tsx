import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { createBusiness, getPublicTemplates } from '@/services/business';
import { BUSINESS_CATEGORY_CODES, groupedCategories } from '@/business/taxonomy';
import { categoryLabel, ctaLabel } from '@/business/businessLabels';
import { DesignFullPreview, DesignGallery, toDesignOptions, type DesignOption } from '@/business/templates/DesignGallery';

/**
 * YESYES BUSINESS — Asistente de creación (flujo ÚNICO de onboarding).
 *
 * Orden deliberado: primero el rubro, después los diseños y la vista previa, y
 * solo al final los datos del negocio. Antes se pedía toda la información antes de
 * mostrar un solo diseño; ahora se avanza rápido y el resto se completa desde el
 * editor y el panel.
 */
type Form = { name: string; description: string; phone: string; whatsapp: string; email: string; address: string; city: string; socials: string; cta: string };
const initial: Form = { name: '', description: '', phone: '', whatsapp: '', email: '', address: '', city: '', socials: '', cta: '' };
const steps = ['Tipo de negocio', 'Diseño', 'Vista previa', 'Información básica', 'Revisión'];

export default function BusinessWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(initial);
  const [category, setCategory] = useState<string>(String(params.get('categoria') || '').toUpperCase() || BUSINESS_CATEGORY_CODES[0]);
  const [designs, setDesigns] = useState<DesignOption[]>([]);
  const [designId, setDesignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // Los diseños se piden al elegir el rubro: es lo primero que el usuario ve.
  useEffect(() => {
    if (!category) return;
    let active = true;
    setLoading(true);
    setError('');
    getPublicTemplates(category)
      .then((templates) => {
        if (!active) return;
        const options = toDesignOptions(templates, category);
        setDesigns(options);
        setDesignId((current) => (options.some((option) => option.id === current) ? current : options[0]?.id || ''));
      })
      .catch(() => active && setError('No se pudieron cargar los diseños. Puedes reintentar o continuar.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [category]);

  const selectedDesign = useMemo(() => designs.find((design) => design.id === designId) || null, [designId, designs]);
  const canContinue = step === 0 ? Boolean(category) : step === 1 ? Boolean(designId) : step === 3 ? form.name.trim().length > 1 : true;
  const next = () => { setError(''); if (canContinue) setStep((value) => Math.min(steps.length - 1, value + 1)); };

  const submit = async () => {
    if (!form.name.trim() || !designId) { setError('Completa el nombre del negocio y elige un diseño.'); return; }
    setSaving(true);
    setError('');
    try {
      const business = await createBusiness({
        name: form.name.trim(),
        category,
        templateId: designId,
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        socials: form.socials ? Object.fromEntries(form.socials.split(',').map((value) => value.trim().split(/\s+/).slice(0, 2))) : null,
        cta: form.cta.trim() || ctaLabel(category),
      });
      navigate(`/negocio/editor?id=${business.id}`);
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'No se pudo crear la página.');
    } finally { setSaving(false); }
  };


  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-500">YesYes Business</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Crea tu página web</h1>
          </div>
          <span className="text-sm text-stone-500">Paso {step + 1} de {steps.length}</span>
        </div>
        <div className="mb-8 grid grid-cols-5 gap-2" aria-label="Progreso">
          {steps.map((label, index) => (
            <div key={label} className="h-1.5 rounded-full bg-stone-200">
              <div className={`h-full rounded-full bg-stone-900 transition-all ${index <= step ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">{steps[step]}</h2>

          {step === 0 && (
            <div className="mt-6 space-y-7" data-testid="wizard-categories">
              <p className="text-stone-500">Elige el rubro que mejor describe tu negocio. Verás solo los diseños de ese rubro.</p>
              {groupedCategories().map(({ group, categories }) => (
                <div key={group.key}>
                  <h3 className="text-sm font-bold uppercase tracking-[.15em] text-stone-500">{group.label}</h3>
                  <p className="mb-3 mt-1 text-sm text-stone-500">{group.description}</p>
                  <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <legend className="sr-only">{group.label}</legend>
                    {categories.map((item) => (
                      <button key={item.code} type="button" onClick={() => setCategory(item.code)} aria-pressed={category === item.code}
                        className={`rounded-2xl border p-4 text-left transition ${category === item.code ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:border-stone-400'}`}>
                        <b className="block">{item.label}</b>
                        <span className={`mt-1 block text-sm ${category === item.code ? 'text-stone-200' : 'text-stone-500'}`}>{item.description}</span>
                      </button>
                    ))}
                  </fieldset>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="mt-6">
              <p className="mb-4 text-stone-500">Estos son los diseños para <b>{categoryLabel(category)}</b>. Cada vista previa es tu página real: con imágenes, botones y secciones.</p>
              {loading ? <p className="text-stone-500"><Loader2 className="mr-2 inline animate-spin" />Cargando diseños…</p> : (
                <DesignGallery designs={designs} category={category} selectedId={designId} onSelect={(design) => setDesignId(design.id)} />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="mt-6">
              {/* La vista previa ocupa la pantalla: es la página real, scrolleable y responsive. */}
              {selectedDesign
                ? <DesignFullPreview design={selectedDesign} category={category} onClose={() => setStep(1)} onSelect={() => setStep(3)} />
                : <p className="text-stone-500">Vuelve al paso anterior y elige un diseño para ver la vista previa completa.</p>}
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del negocio" value={form.name} onChange={(v) => set('name', v)} placeholder="Ej. Barbería Daniel" autoFocus />
              <Field label="Descripción" value={form.description} onChange={(v) => set('description', v)} placeholder="Qué ofreces en una línea" textarea />
              <Field label="Teléfono" value={form.phone} onChange={(v) => set('phone', v)} placeholder="Opcional" />
              <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="Opcional" />
              <Field label="Email" value={form.email} onChange={(v) => set('email', v)} placeholder="Opcional" type="email" />
              <Field label="Dirección" value={form.address} onChange={(v) => set('address', v)} placeholder="Opcional" />
              <Field label="Ciudad" value={form.city} onChange={(v) => set('city', v)} placeholder="Opcional" />
              <Field label="Redes (Instagram, Facebook)" value={form.socials} onChange={(v) => set('socials', v)} placeholder="@usuario, https://facebook.com/..." />
              <Field label="Botón principal" value={form.cta} onChange={(v) => set('cta', v)} placeholder={ctaLabel(category)} />
              <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600 sm:col-span-2">
                Logo, portada, fotos, servicios, productos y reservas los agregas después desde el editor. Tu página ya queda creada con este diseño.
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-stone-950 p-6 text-white">
                <p className="text-sm text-stone-400">{categoryLabel(category)}</p>
                <h3 className="mt-2 text-3xl font-bold">{form.name || 'Tu negocio'}</h3>
                <p className="mt-2 text-stone-300">{form.description || 'Agregaremos una descripción desde el editor.'}</p>
                <span className="mt-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-950">{selectedDesign?.label || 'Diseño seleccionado'}</span>
              </div>
              <p className="text-sm text-stone-500">Al crear la página entrarás al editor. Podrás personalizarla y publicarla cuando el backend confirme los requisitos.</p>
            </div>
          )}

          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-5 font-semibold disabled:opacity-40" disabled={step === 0 || saving} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={17} /> Volver</button>
            {step < steps.length - 1 ? (
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-40" disabled={!canContinue} onClick={next}>Continuar <ArrowRight size={17} /></button>
            ) : (
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-50" disabled={saving || !form.name.trim()} onClick={() => void submit()}>
                {saving ? 'Creando…' : <><Check size={17} /> Crear página</>}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type FieldProps = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; textarea?: boolean; autoFocus?: boolean };
function Field({ label, value, onChange, placeholder, type = 'text', textarea = false, autoFocus = false }: FieldProps) {
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <label className="text-sm font-semibold text-stone-700">
      {label}
      <Tag className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10" value={value} placeholder={placeholder} type={textarea ? undefined : type} autoFocus={autoFocus} onChange={(e: any) => onChange(e.target.value)} />
    </label>
  );
}

