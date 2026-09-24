import { useEffect, useRef, useState } from 'react';
import { getBusinessCapabilities, getTemplates, saveBusinessCapabilities, updateBusiness } from '@/services/business';

const COLORS = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'] as const;
const FONTS = ['system', 'inter', 'geometric', 'rounded', 'serif', 'display', 'mono'];
type Status = 'idle' | 'saving' | 'saved' | 'error';
const defaults = { theme: 'light', primaryColor: '#111827', secondaryColor: '#6b7280', accentColor: '#f59e0b', backgroundColor: '#ffffff', textColor: '#111827', headingFont: 'system', bodyFont: 'system', borderRadius: 12, buttonStyle: 'solid', cardStyle: 'elevated', sectionSpacing: 'normal', containerWidth: 'default', headerStyle: 'minimal', footerStyle: 'simple' };

export default function DesignSection({ businessId, detail, onSaved }: { businessId: string; detail: any; onSaved: (value: any) => void }) {
  const [visual, setVisual] = useState<any>(defaults);
  const [sections, setSections] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState(detail?.templateId || '');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    setVisual({ ...defaults, ...(detail?.visual || {}) }); setTemplateId(detail?.templateId || '');
    getTemplates(detail?.category).then(setTemplates).catch(() => setTemplates([]));
    getBusinessCapabilities(businessId).then((data) => setSections(data.sections || [])).catch(() => setMessage('No se pudieron cargar las secciones.'));
  }, [businessId, detail]);
  const persist = async (next: any) => {
    setStatus('saving'); setMessage('Guardando…');
    try { const business = await updateBusiness(businessId, { visual: next }); onSaved(business); setStatus('saved'); setMessage('Cambios guardados'); }
    catch { setStatus('error'); setMessage('No se pudo guardar. Puedes reintentar.'); }
  };
  const change = (key: string, value: any) => { const next = { ...visual, [key]: value }; setVisual(next); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => persist(next), 800); };
  const changeTemplate = async (id: string) => {
    if (id === templateId) return;
    if (!window.confirm('Cambiar la plantilla no borra productos, servicios, fotos ni textos. ¿Continuar?')) return;
    setTemplateId(id); setStatus('saving');
    try { const business = await updateBusiness(businessId, { templateId: id }); onSaved(business); setStatus('saved'); setMessage('Plantilla actualizada. Tus contenidos se conservaron.'); }
    catch { setTemplateId(templateId); setStatus('error'); setMessage('No se pudo cambiar la plantilla.'); }
  };
  const move = (index: number, delta: number) => setSections((items) => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next.map((item, i) => ({ ...item, order: (i + 1) * 10 })); });
  const saveSections = async () => { setStatus('saving'); try { await saveBusinessCapabilities(businessId, sections); setStatus('saved'); setMessage('Secciones guardadas.'); } catch { setStatus('error'); setMessage('No se pudieron guardar las secciones.'); } };


  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Diseño y secciones</h2><p className="text-sm text-neutral-500">Valores controlados para mantener una jerarquía visual segura.</p></div><span role="status" aria-live="polite" className="text-sm text-neutral-600">{message}</span></div>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Plantilla</h3><label className="mt-3 block text-sm">Diseño del negocio<select className="mt-1 w-full rounded-lg border p-2" value={templateId} onChange={(e) => changeTemplate(e.target.value)}><option value="">Selecciona una plantilla</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><p className="mt-2 text-xs text-neutral-500">El cambio sólo modifica la presentación.</p></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Identidad visual</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{COLORS.map((key) => <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm">{key.replace('Color', '')}<input type="color" value={visual[key]} onChange={(e) => change(key, e.target.value)} className="h-9 w-12" /></label>)}<Select label="Tipografía de títulos" value={visual.headingFont} options={FONTS} onChange={(v: string) => change('headingFont', v)} /><Select label="Tipografía de texto" value={visual.bodyFont} options={FONTS} onChange={(v: string) => change('bodyFont', v)} /><Select label="Estilo de botones" value={visual.buttonStyle} options={['solid','outline','soft']} onChange={(v: string) => change('buttonStyle', v)} /><Select label="Estilo de cards" value={visual.cardStyle} options={['flat','elevated','bordered']} onChange={(v: string) => change('cardStyle', v)} /><Select label="Espaciado" value={visual.sectionSpacing} options={['compact','normal','spacious']} onChange={(v: string) => change('sectionSpacing', v)} /></div><label className="mt-4 block text-sm">Redondeo: {visual.borderRadius}px<input className="w-full" type="range" min="0" max="32" value={visual.borderRadius} onChange={(e) => change('borderRadius', Number(e.target.value))} /></label>{status === 'error' && <button className="mt-3 underline" onClick={() => persist(visual)}>Reintentar guardado</button>}</section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Secciones y orden</h3><div className="mt-3 space-y-2">{sections.map((section, index) => <div key={section.id} className="flex items-center gap-3 rounded-xl border p-3"><label className="flex items-center gap-2"><input type="checkbox" checked={section.enabled !== false} onChange={() => setSections((items) => items.map((item) => item.id === section.id ? { ...item, enabled: !item.enabled } : item))} /> {section.id}</label><button type="button" className="ml-auto" aria-label={`Subir ${section.id}`} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Bajar ${section.id}`} onClick={() => move(index, 1)}>↓</button></div>)}</div><button className="mt-4 rounded-lg bg-neutral-950 px-4 py-2 font-semibold text-white" onClick={saveSections}>{status === 'saving' ? 'Guardando…' : 'Guardar secciones'}</button></section>
  </div>;
}
function Select({ label, value, options, onChange }: any) { return <label className="text-sm">{label}<select className="mt-1 w-full rounded-lg border p-2" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option: string) => <option key={option} value={option}>{option}</option>)}</select></label>; }
