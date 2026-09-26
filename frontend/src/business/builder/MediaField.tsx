/**
 * YESYES BUSINESS · FASE 6 — PICKER DE MEDIOS DEL EDITOR.
 *
 * Este es el control que hace REAL el campo `media-ref` del BlockRegistry: sube
 * un archivo de verdad, elige uno ya subido, o lo suelta. Antes el bloque
 * declaraba `cfg('video','media-ref')` pero no habia ningun control que lo
 * llenara, es decir, un boton de media que no hacia nada.
 *
 * Reglas que este control respeta:
 *  - Lo que se guarda es `media:<id>`, NUNCA una URL (6.1).
 *  - Antes de subir se valida tamaño y tipo en el cliente para dar un mensaje
 *    claro; el servidor vuelve a validarlo por magic bytes, porque la
 *    comprobacion del cliente no es una barrera de seguridad (6.11).
 *  - Un upload NO es un paso de undo: el archivo ya esta en el storage cuando
 *    se elige. Undo/redo gobierna la ASIGNACION al bloque, que es lo que el
 *    manifest guarda.
 */

import { useRef, useState } from 'react';
import {
  uploadBusinessMedia, replaceBusinessMedia,
  type BusinessMediaItem, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_MIME_ALLOWLIST,
} from '@/services/business';
import { encodeMediaRef, mediaRefIs, parseMediaRef } from '@/business/engine/media-ref';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export interface MediaFieldProps {
  businessId: string;
  /** Catálogo de medios del negocio (imágenes y videos ya subidos). */
  media: BusinessMediaItem[];
  label: string;
  /** Valor actual del campo del manifest. */
  value: unknown;
  kind: 'image' | 'video';
  required?: boolean;
  hint?: string;
  onChange: (reference: string | null) => void;
  onLibraryChange?: (media: BusinessMediaItem[]) => void;
  /** Solo para un video: elegir su poster. */
  posterOf?: string | null;
  onPosterChange?: (reference: string | null) => void;
}

function readableSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validación de cortesía antes de gastar un upload. No es seguridad. */
function validateFile(file: File, kind: 'image' | 'video'): string {
  if (kind === 'video') {
    if (!VIDEO_MIME_ALLOWLIST.includes(file.type)) return 'Usa un video MP4, WEBM o MOV.';
    if (file.size > MAX_VIDEO_BYTES) return 'El video supera el máximo de 60MB.';
    return '';
  }
  if (!IMAGE_TYPES.includes(file.type)) return 'Usa una imagen JPG, PNG, WEBP, GIF o AVIF.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen supera el máximo de 5MB.';
  return '';
}

export function MediaField({
  businessId, media, label, value, kind, required, hint, onChange, onLibraryChange,
  posterOf, onPosterChange,
}: MediaFieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const parsed = parseMediaRef(value);
  const current = parsed.kind === 'id'
    ? media.find((item) => item.id === parsed.mediaId) || null
    : parsed.kind === 'url'
      ? media.find((item) => item.url === parsed.url) || null
      : null;
  const posterParsed = parseMediaRef(posterOf);
  const currentPoster = posterParsed.kind === 'id' ? media.find((item) => item.id === posterParsed.mediaId) || null : null;
  const options = media.filter((item) => (kind === 'video' ? item.kind === 'VIDEO' : item.kind === 'IMAGE'));
  const accept = kind === 'video' ? VIDEO_MIME_ALLOWLIST.join(',') : IMAGE_TYPES.join(',');

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite resubir el mismo archivo
    if (!file) return;
    const problem = validateFile(file, kind);
    if (problem) { setError(problem); return; }
    setError('');
    setBusy(true);
    try {
      const created = await uploadBusinessMedia(businessId, file, {
        kind: kind === 'video' ? 'VIDEO' : 'IMAGE',
        title: file.name,
        // Al subir se elige de una: es lo que la persona quiere hacer.
        alt: kind === 'image' ? file.name.replace(/\.[a-z0-9]+$/i, '') : null,
      });
      onChange(encodeMediaRef(created.id));
      onLibraryChange?.([created, ...media]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo subir el archivo.');
    } finally {
      setBusy(false);
    }
  }

  /** Reemplaza el archivo del medio actual conservando su id. */
  async function onReplaceFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !current) return;
    const problem = validateFile(file, kind);
    if (problem) { setError(problem); return; }
    setError('');
    setBusy(true);
    try {
      const updated = await replaceBusinessMedia(businessId, current.id, file);
      // El id NO cambia: las otras secciones que usan este medio ya muestran
      // el archivo nuevo sin que nadie vuelva a elegirlo.
      onLibraryChange?.(media.map((item) => (item.id === updated.id ? updated : item)));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo reemplazar el archivo.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="space-y-2" data-testid={`media-field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-sm font-semibold">
        {label}{required && <span className="text-rose-600"> *</span>}
      </p>

      {current ? (
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 p-2">
          {current.kind === 'VIDEO' ? (
            <video
              src={current.url}
              poster={current.posterUrl || undefined}
              className="h-14 w-24 rounded-lg bg-neutral-900 object-cover"
              muted
              playsInline
              preload="metadata"
              aria-label={`Vista previa de ${current.title || 'el video'}`}
            />
          ) : (
            <img src={current.url} alt={current.alt || label} className="h-14 w-24 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{current.title || current.alt || 'Medio sin título'}</p>
            <p className="text-xs text-stone-500">
              {current.kind === 'VIDEO' ? 'Video' : 'Imagen'}
              {readableSize(current.sizeBytes) ? ` · ${readableSize(current.sizeBytes)}` : ''}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-3 text-xs text-stone-500">
          Sin {kind === 'video' ? 'video' : 'imagen'} elegido.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => uploadRef.current?.click()}
          className="rounded-xl border border-stone-900 px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          {busy ? 'Subiendo…' : current ? 'Subir otro' : `Subir ${kind === 'video' ? 'video' : 'imagen'}`}
        </button>
        {current && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept;
                input.onchange = onReplaceFile;
                input.click();
              }}
              className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Reemplazar archivo
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold"
            >
              Quitar
            </button>
          </>
        )}
      </div>


      {kind === 'video' && current && onPosterChange && (
        <div className="rounded-xl border border-stone-200 p-2">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Poster (imagen previa)</p>
          <p className="mb-2 text-xs text-stone-500">Se muestra mientras carga el video y si no se puede reproducir.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPosterChange(null)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${currentPoster ? 'border border-stone-300' : 'bg-stone-900 text-white'}`}
            >
              Del video
            </button>
            {media.filter((item) => item.kind === 'IMAGE').slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPosterChange(encodeMediaRef(item.id))}
                className={`overflow-hidden rounded-lg border-2 ${mediaRefIs(posterOf, item.id) ? 'border-stone-900' : 'border-transparent'}`}
                title={item.alt || item.title || 'Poster'}
              >
                <img src={item.url} alt={item.alt || 'Poster'} loading="lazy" className="h-10 w-16 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {options.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Ya subidos</p>
          <div className="flex flex-wrap gap-2">
            {options.slice(0, 24).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(encodeMediaRef(item.id))}
                aria-pressed={current?.id === item.id}
                className={`overflow-hidden rounded-lg border-2 ${current?.id === item.id ? 'border-stone-900' : 'border-transparent'}`}
                title={item.alt || item.title || 'Medio'}
              >
                {item.kind === 'VIDEO' ? (
                  <video src={item.url} poster={item.posterUrl || undefined} className="h-12 w-20 bg-neutral-900 object-cover" muted playsInline preload="metadata" aria-label="Video" />
                ) : (
                  <img src={item.url} alt={item.alt || 'Imagen'} loading="lazy" className="h-12 w-20 object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {hint && <p className="text-xs font-normal text-stone-500">{hint}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}

      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={onPickFile}
      />
    </div>
  );
}

