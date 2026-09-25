import { useEffect, useRef, useState } from 'react';
import { getBusinessCapabilities, getTemplates, saveBusinessCapabilities, updateBusiness } from '@/services/business';
import { categoryLabel, sectionLabel, templateLabel } from '../businessLabels';
import { presetsForCategory } from '../visual/visualTokens';
import { backgroundsForCategory } from '../visual/backgrounds';
import { TYPOGRAPHIES } from '../visual/typography';
import { createLatestTemplatesRequest, reconcileTemplateId } from './templateSync';

const COLORS = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'] as const;
type Status = 'idle' | 'saving' | 'saved' | 'error';
const defaults = { theme: 'light', primaryColor: '#111827', secondaryColor: '#6b7280', accentColor: '#f59e0b', backgroundColor: '#ffffff', textColor: '#111827', headingFont: 'system', bodyFont: 'system', borderRadius: 12, buttonStyle: 'solid', cardStyle: 'elevated', sectionSpacing: 'normal', containerWidth: 'default', headerStyle: 'minimal', footerStyle: 'simple', background: 'clean', typography: 'moderna', shadow: 'soft', preset: 'moderno' };
type TemplatesState = { category: string; options: Awaited<ReturnType<typeof getTemplates>> };

export default function DesignSection({ businessId, detail, onSaved }: { businessId: string; detail: any; onSaved: (value: any) => void }) {
  const [visual, setVisual] = useState<any>(defaults);
  const [sections, setSections] = useState<any[]>([]);
  const [templatesState, setTemplatesState] = useState<TemplatesState>({ category: '', options: [] });
  const [templatesStatus, setTemplatesStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const templatesRequest = useRef<{ invalidate: () => void } | null>(null);
  const [templateId, setTemplateId] = useState(detail?.templateId || '');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [mobile, setMobile] = useState(false);
  const presets = presetsForCategory(detail?.category);
  const backgrounds = backgroundsForCategory(detail?.category);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const previewFrame = useRef<HTMLIFrameElement | null>(null);
  const publishPreview = (nextVisual: any, nextSections: any[] = sections) => {
    previewFrame.current?.contentWindow?.postMessage({ type: 'YESYES_BUSINESS_PREVIEW', visual: nextVisual, sections: nextSections }, window.location.origin);
  };
  useEffect(() => {
    setVisual({ ...defaults, ...(detail?.visual || {}) }); setTemplateId(detail?.templateId || '');
  }, [businessId, detail]);

  // La lista queda ligada a la categoría que la generó y descarta respuestas obsoletas.
  useEffect(() => {
    const category = detail?.category || '';
    if (!category) {
      templatesRequest.current?.invalidate();
      setTemplatesState({ category: '', options: [] });
      setTemplatesStatus('idle');
      return;
    }
    const request = createLatestTemplatesRequest(getTemplates, {
      onStart: (requestedCategory) => {
        setTemplatesState({ category: requestedCategory, options: [] });
        setTemplatesStatus('loading');
      },
      onSuccess: (requestedCategory, options) => {
        setTemplatesState({ category: requestedCategory, options });
        setTemplateId((current: string) => reconcileTemplateId(current, options));
        setTemplatesStatus('idle');
      },
      onError: (requestedCategory) => {
        setTemplatesState({ category: requestedCategory, options: [] });
        setTemplateId('');
        setTemplatesStatus('error');
      },
    });
    templatesRequest.current = request;
    void request.load(category);
    return () => request.invalidate();
  }, [businessId, detail?.category]);

  useEffect(() => {
    getBusinessCapabilities(businessId).then((data) => setSections(data.sections || [])).catch(() => setMessage('No se pudieron cargar las secciones.'));
  }, [businessId]);
  const persist = async (next: any) => {
    setStatus('saving'); setMessage('Guardando…');
    try { const business = await updateBusiness(businessId, { visual: next }); onSaved(business); setStatus('saved'); setMessage('Cambios guardados'); setPreviewKey((value) => value + 1); }
    catch { setStatus('error'); setMessage('No se pudo guardar. Puedes reintentar.'); }
  };
  const change = (key: string, value: any) => { const next = { ...visual, [key]: value }; setVisual(next); publishPreview(next); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => persist(next), 800); };
  const changeTemplate = async (id: string) => {
    if (id === templateId) return;
    if (!window.confirm('Cambiar la plantilla no borra productos, servicios, fotos ni textos. ¿Continuar?')) return;
    setTemplateId(id); setStatus('saving');
    try { const business = await updateBusiness(businessId, { templateId: id }); onSaved(business); setStatus('saved'); setMessage('Plantilla actualizada. Tus contenidos se conservaron.'); }
    catch { setTemplateId(templateId); setStatus('error'); setMessage('No se pudo cambiar la plantilla.'); }
  };
  const move = (index: number, delta: number) => setSections((items) => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next.map((item, i) => ({ ...item, order: (i + 1) * 10 })); });
  const saveSections = async () => { setStatus('saving'); try { await saveBusinessCapabilities(businessId, sections); publishPreview(visual, sections); setStatus('saved'); setMessage('Secciones guardadas.'); setPreviewKey((value) => value + 1); } catch { setStatus('error'); setMessage('No se pudieron guardar las secciones.'); } };
  const templates = templatesState.category === (detail?.category || '') ? templatesState.options : [];

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,42%)]"><div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Personaliza tu página</h2><p className="text-sm text-stone-500">Elige una identidad coherente con {categoryLabel(detail?.category).toLowerCase()}.</p></div><span role="status" aria-live="polite" className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">{message || 'Los cambios se guardan automáticamente'}</span></header>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Diseños recomendados para tu rubro</h3><p className="mt-1 text-sm text-stone-500">Combinaciones completas: color, fondo, tipografía, profundidad y ritmo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{presets.map((preset) => <button type="button" key={preset.name} onClick={() => { const next = { ...visual, ...preset, preset: preset.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }; setVisual(next); publishPreview(next); void persist(next); }} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${visual.preset === preset.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ? 'ring-2 ring-stone-900' : ''}`}><b>{preset.name}</b><span className="mt-3 flex gap-1">{[preset.primaryColor, preset.secondaryColor, preset.accentColor, preset.backgroundColor].map((color) => <i key={color} className="h-7 w-7 rounded-full border" style={{ background: color }} />)}</span></button>)}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Diseño de tu página</h3>{templatesStatus === 'loading' ? <p className="mt-3 text-sm text-stone-500" role="status" aria-live="polite">Cargando diseños…</p> : templatesStatus === 'error' ? <p className="mt-3 text-sm text-red-600" role="alert">No pudimos cargar los diseños. Intenta nuevamente.</p> : <label className="mt-3 block text-sm font-semibold">Diseño elegido<select className="mt-1 w-full rounded-xl border p-3" value={templateId} onChange={(e) => changeTemplate(e.target.value)}><option value="">Selecciona un diseño</option>{templates.map((template) => <option key={template.id} value={template.id}>{templateLabel(template.code, template.name)}</option>)}</select></label>}<p className="mt-2 text-xs text-stone-500">Cada diseño tiene una composición propia, no solo colores distintos.</p></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Personalizar colores</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{COLORS.map((key) => { const label = ({ primaryColor: 'Principal', secondaryColor: 'Secundario', accentColor: 'Acento', backgroundColor: 'Fondo', textColor: 'Texto' } as Record<string, string>)[key]; return <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold"><span>{label}</span><input aria-label={label} type="color" value={visual[key]} onChange={(e) => change(key, e.target.value)} className="h-9 w-12 cursor-pointer" /></label>; })}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Ambiente y tipografía</h3><p className="mt-4 text-sm font-semibold">Fondo</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{backgrounds.map((item) => <button type="button" key={item.id} onClick={() => change('background', item.id)} className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left text-sm ${visual.background === item.id ? 'ring-2 ring-stone-900' : ''}`}><i className="h-8 w-8 rounded-lg border" style={{ background: item.css }} />{item.name}</button>)}</div><p className="mt-5 text-sm font-semibold">Tipografía</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{TYPOGRAPHIES.map((item) => <button type="button" key={item.id} onClick={() => change('typography', item.id)} className={`rounded-xl border p-4 text-left ${visual.typography === item.id ? 'ring-2 ring-stone-900' : ''}`} style={{ fontFamily: item.heading }}><b className="text-lg">{item.label}</b><span className="block text-sm opacity-60">{item.sample}</span></button>)}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Detalles de estilo</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Select label="Estilo de botones" value={visual.buttonStyle} options={['solid','outline','soft']} labels={{ solid: 'Sólido', outline: 'Contorno', soft: 'Suave' }} onChange={(v: string) => change('buttonStyle', v)} /><Select label="Estilo de tarjetas" value={visual.cardStyle} options={['flat','elevated','bordered']} labels={{ flat: 'Planas', elevated: 'Con sombra', bordered: 'Con borde' }} onChange={(v: string) => change('cardStyle', v)} /><Select label="Espaciado" value={visual.sectionSpacing} options={['compact','normal','spacious']} labels={{ compact: 'Compacto', normal: 'Equilibrado', spacious: 'Amplio' }} onChange={(v: string) => change('sectionSpacing', v)} /><Select label="Sombras" value={visual.shadow} options={['none','soft','elevated','dramatic']} labels={{ none: 'Sin sombra', soft: 'Suave', elevated: 'Marcada', dramatic: 'Dramática' }} onChange={(v: string) => change('shadow', v)} /></div><label className="mt-5 block text-sm font-semibold">Redondeo: {visual.borderRadius} px<input className="mt-2 w-full" type="range" min="0" max="32" value={visual.borderRadius} onChange={(e) => change('borderRadius', Number(e.target.value))} /></label>{status === 'error' && <button className="mt-4 underline" onClick={() => persist(visual)}>Reintentar guardado</button>}</section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Secciones y orden</h3><p className="mt-1 text-sm text-stone-500">Activa, desactiva y ordena cómo verá el contenido tu cliente.</p><div className="mt-4 space-y-2">{sections.map((section, index) => <div key={section.id} className="flex min-h-12 items-center gap-3 rounded-xl border p-3"><label className="flex flex-1 items-center gap-3 font-semibold"><input type="checkbox" checked={section.enabled !== false} onChange={() => setSections((items) => items.map((item) => item.id === section.id ? { ...item, enabled: !item.enabled } : item))} />{sectionLabel(section.id)}</label><button type="button" className="min-h-11 min-w-11 rounded-lg border" aria-label={`Subir ${sectionLabel(section.id)}`} onClick={() => move(index, -1)}>↑</button><button type="button" className="min-h-11 min-w-11 rounded-lg border" aria-label={`Bajar ${sectionLabel(section.id)}`} onClick={() => move(index, 1)}>↓</button></div>)}</div><button className="mt-4 min-h-11 rounded-xl bg-stone-900 px-5 font-semibold text-white" onClick={saveSections}>{status === 'saving' ? 'Guardando…' : 'Guardar orden de secciones'}</button></section>
  </div><aside className="xl:sticky xl:top-4 xl:h-fit"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Vista previa</h3><div className="flex rounded-lg border bg-white p-1"><button type="button" onClick={() => setMobile(false)} className={`rounded-md px-3 py-2 text-xs font-semibold ${!mobile ? 'bg-stone-900 text-white' : ''}`}>Escritorio</button><button type="button" onClick={() => setMobile(true)} className={`rounded-md px-3 py-2 text-xs font-semibold ${mobile ? 'bg-stone-900 text-white' : ''}`}>Móvil</button></div></div><iframe ref={previewFrame} onLoad={() => publishPreview(visual, sections)} key={previewKey} title="Vista previa de tu página" src={`/mi-negocio/${detail?.slug}?preview=true`} className={`h-[70vh] w-full rounded-2xl border bg-white shadow-xl transition-all ${mobile ? 'mx-auto max-w-[390px]' : ''}`} /></aside></div>;
}
function Select({ label, value, options, labels = {}, onChange }: any) { return <label className="text-sm font-semibold">{label}<select className="mt-1 w-full rounded-xl border p-3 font-normal" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option: string) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>; }
