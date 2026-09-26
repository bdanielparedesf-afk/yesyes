import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { createService, updateService, deleteService, createBusinessProduct, updateBusinessProduct, deleteBusinessProduct, createBusinessContent, updateBusinessContent, deleteBusinessContent, type BusinessMediaItem } from '@/services/business';

/**
 * FASE 6.5 - EDITOR DE LISTAS REALES (servicios, productos, equipo, FAQ, etc).
 *
 * POR QUE EXISTE: el inspector mostraba para estas secciones unicamente el
 * parrafo "Usa unicamente el contenido real de tu negocio. No agregaremos
 * informacion automaticamente". No era un permiso ni un problema de guardado:
 * no existia ningun formulario. El backend y el cliente YA tenian el CRUD
 * completo (`/services`, `/products`, `/content/:section`); faltaba conectarlo.
 *
 * DECISION: cada item se guarda en su propia peticion, no en el manifest. Son
 * filas reales de `BusinessService` / `BusinessProduct` / `BusinessContent`, asi
 * que un error de red NO puede dejar la lista a medias con la preview
 * desincronizada, que es lo que habria pasado guardando la lista entera en el
 * documento del editor.
 *
 * El alta/baja es optimista: la UI refleja el cambio al instante y revierte si
 * el servidor rechaza, avisando en vez de dejar la preview mintiendo.
 */

export type ContentKind = 'services' | 'products' | 'team' | 'faqs' | 'testimonials' | 'promotions';

interface FieldSpec {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'url' | 'image';
  hint?: string;
}

const input = 'mt-1 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-stone-900';
const label = 'block text-sm font-semibold';

/** Texto de la nota: el ejemplo es de partida, el dueño lo reemplaza. */
const INTRO: Record<ContentKind, string> = {
  services: 'Edita, agrega o quita lo que ofreces. Si no tienes servicios reales, borra los de ejemplo: es preferible una página acotada a una con información inventada.',
  products: 'Edita, agrega o quita productos. Este listado es el catálogo propio del negocio, distinto de los productos de la tienda.',
  team: 'Edita, agrega o quita integrantes del equipo.',
  faqs: 'Edita, agrega o quita preguntas frecuentes con sus respuestas.',
  testimonials: 'Edita, agrega o quita opiniones de clientes.',
  promotions: 'Edita, agrega o quita promociones.',
};

const EMPTY_LABEL: Record<ContentKind, string> = {
  services: 'Todavía no hay servicios.',
  products: 'Todavía no hay productos.',
  team: 'Todavía no hay integrantes.',
  faqs: 'Todavía no hay preguntas.',
  testimonials: 'Todavía no hay opiniones.',
  promotions: 'Todavía no hay promociones.',
};

/** Lee el texto de un campo de foto, resolviendo una referencia `media:<id>`. */
function imageUrlOf(item: any, media: BusinessMediaItem[]): string {
  const value = item?.image || item?.photo || '';
  if (!value) return '';
  if (!String(value).startsWith('media:')) return String(value);
  const id = String(value).slice(6);
  return media.find((m) => m.id === id)?.url || '';
}

/**
 * Campos por tipo, contra los schemas REALES del backend
 * (`serviceSchema`, `catalogItemSchema`, `teamMemberSchema`, `faqSchema`,
 * `promotionSchema`, `testimonialSchema` en `backend/src/utils/business.ts`).
 *
 * OJO: los nombres importan y son `.strict()`. Un campo mal nombrado no se
 * ignora, se RECHAZA con 400. Por eso `testimonials` usa `name`/`content` y no
 * `author`/`quote`, y por eso `products` NO manda `description` de ejemplo sino
 * el par `shortDescription`/`description` que el schema realmente acepta.
 */
const FIELDS: Record<ContentKind, FieldSpec[]> = {
  services: [
    { key: 'name', label: 'Nombre' },
    { key: 'description', label: 'Descripción', type: 'textarea' },
    { key: 'price', label: 'Precio', type: 'number', hint: 'CLP. Deja 0 si no tiene.' },
    { key: 'image', label: 'Foto', type: 'image' },
  ],
  products: [
    { key: 'name', label: 'Nombre' },
    { key: 'shortDescription', label: 'Descripción breve', type: 'textarea' },
    { key: 'description', label: 'Descripción completa', type: 'textarea' },
    { key: 'price', label: 'Precio', type: 'number' },
    { key: 'image', label: 'Foto', type: 'image' },
  ],
  team: [
    { key: 'name', label: 'Nombre' },
    { key: 'role', label: 'Cargo' },
    { key: 'bio', label: 'Reseña', type: 'textarea' },
    { key: 'photo', label: 'Foto', type: 'image' },
  ],
  faqs: [
    { key: 'question', label: 'Pregunta' },
    { key: 'answer', label: 'Respuesta', type: 'textarea' },
  ],
  testimonials: [
    { key: 'name', label: 'Autor' },
    { key: 'role', label: 'Cargo o referencia', hint: 'Opcional.' },
    { key: 'content', label: 'Opinión', type: 'textarea' },
    { key: 'rating', label: 'Puntaje', type: 'number', hint: '1 a 5.' },
    { key: 'photo', label: 'Foto', type: 'image' },
  ],
  promotions: [
    { key: 'title', label: 'Título' },
    { key: 'description', label: 'Descripción', type: 'textarea' },
    { key: 'image', label: 'Foto', type: 'image' },
  ],
};

const toNum = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v));

export default function ContentListEditor({ kind, businessId, items, media, onChanged }: {
  kind: ContentKind;
  businessId: string;
  items: any[];
  media: BusinessMediaItem[];
  onChanged: () => void;
}) {
  const [list, setList] = useState<any[]>(items || []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const fields = FIELDS[kind];

  // La lista del servidor es la verdad: si cambia (autosave, otra pestaña) el
  // panel se realinea. Se compara por referencia para no pisar lo que se escribe.
  const [syncedFrom, setSyncedFrom] = useState(items);
  if (items !== syncedFrom) {
    setSyncedFrom(items);
    setList(items || []);
  }

  const fail = (e: any) => setError(e?.response?.data?.message || 'No se pudo guardar. Revisa tu conexión.');
  const ok = () => { setError(''); onChanged(); };

  const add = () => {
    setAdding(true); setError('');
    const isRow = kind === 'services' || kind === 'products';
    // Los schemas son `.strict()` y varios campos tienen minimo (nombre >=1,
    // respuesta >=2). Mandar un objeto vacio lo rechaza con 400, asi que el
    // alta nace con un valor por defecto valido y el dueño lo edita al tiro.
    const empty: Record<string, unknown> = kind === 'faqs'
      ? { question: 'Nueva pregunta', answer: 'Escribe la respuesta.' }
      : kind === 'testimonials'
        ? { name: 'Cliente', content: 'Escribe la opinión.' }
        : kind === 'products'
          ? { name: 'Nuevo producto', shortDescription: '', description: '', price: 0 }
          : kind === 'promotions'
            ? { title: 'Nueva promoción', description: '' }
            : { name: kind === 'team' ? 'Nuevo integrante' : 'Nuevo servicio' };
    const create = isRow ? (kind === 'services' ? createService : createBusinessProduct) : createBusinessContent;
    const args: any[] = isRow ? [businessId, empty] : [businessId, kind as any, empty];
    (create as any)(...args)
      .then((created: any) => {
        const id = created?.id || created?.service?.id || created?.product?.id || `tmp-${Date.now()}`;
        setList((prev) => [...prev, { ...empty, id }]);
        setExpanded(id);
      })
      .then(ok)
      .catch((e: any) => fail(e))
      .finally(() => setAdding(false));
  };

  const patch = (id: string, key: string, value: unknown) => {
    setList((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const isRow = kind === 'services' || kind === 'products';
    const update = isRow ? (kind === 'services' ? updateService : updateBusinessProduct) : updateBusinessContent;
    const args: any[] = isRow ? [businessId, id, { [key]: value }] : [businessId, kind as any, id, { [key]: value }];
    (update as any)(...args).then(ok).catch(fail);
  };

  const remove = (id: string) => {
    const previous = list;
    setList((prev) => prev.filter((row) => row.id !== id));
    const isRow = kind === 'services' || kind === 'products';
    const del = isRow ? (kind === 'services' ? deleteService : deleteBusinessProduct) : deleteBusinessContent;
    const args: any[] = isRow ? [businessId, id] : [businessId, kind as any, id];
    (del as any)(...args).then(ok).catch((e: any) => { setList(previous); fail(e); });
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    onChanged();
  };

  return (
    <section className="border-b" data-testid={`content-editor-${kind}`}>
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-6 text-stone-600">{INTRO[kind]}</p>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <ul className="space-y-2">
          {list.map((row, index) => {
            const open = expanded === row.id;
            const title = String(row.name || row.title || row.question || 'Sin título');
            return (
              <li key={row.id} className="overflow-hidden rounded-2xl border border-stone-200">
                <div className="flex items-center gap-1 bg-stone-50 p-2">
                  <button type="button" data-testid={`row-${row.id}`} aria-expanded={open} className="min-w-0 flex-1 px-1 text-left" onClick={() => setExpanded(open ? null : row.id)}>
                    <span className="block truncate text-sm font-semibold">{title}</span>
                    {row.role && <span className="block truncate text-xs text-stone-500">{row.role}</span>}
                  </button>
                  <button type="button" aria-label={`Subir ${title}`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Bajar ${title}`} disabled={index === list.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Eliminar ${title}`} onClick={() => remove(row.id)} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                {open && (
                  <div className="space-y-4 border-t p-4">
                    {fields.map((field) => {
                      const value = row[field.key] ?? (field.type === 'number' ? 0 : '');
                      if (field.type === 'textarea') {
                        return (
                          <label key={field.key} className={label}>{field.label}
                            <textarea data-testid={`field-${field.key}`} className={input} rows={3} value={value} onChange={(e) => patch(row.id, field.key, e.target.value)} />
                          </label>
                        );
                      }
                      if (field.type === 'image') {
                        const url = imageUrlOf(row, media);
                        return (
                          <div key={field.key} className={label}>{field.label}
                            {url && <img src={url} alt="" className="mt-1 h-24 w-full rounded-xl object-cover" />}
                            <input data-testid={`field-${field.key}`} className={input} type="url" placeholder="URL de la foto" value={url} onChange={(e) => patch(row.id, field.key, e.target.value)} />
                            <span className="mt-1 block text-xs font-normal text-stone-500">Pega la URL de tu foto. Sube el archivo en "Imágenes y video" y se elige desde la biblioteca.</span>
                          </div>
                        );
                      }
                      return (
                        <label key={field.key} className={label}>{field.label}
                          <input data-testid={`field-${field.key}`} className={input} type={field.type || 'text'} value={value} onChange={(e) => patch(row.id, field.key, field.type === 'number' ? toNum(e.target.value) : e.target.value)} />
                          {field.hint && <span className="mt-1 block text-xs font-normal text-stone-500">{field.hint}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!list.length && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{EMPTY_LABEL[kind]}</p>}
        <button type="button" data-testid="add-item" onClick={add} disabled={adding} className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-900 p-3 text-sm font-semibold disabled:opacity-50">
          <Plus className="h-4 w-4" /> {adding ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </section>
  );
}


