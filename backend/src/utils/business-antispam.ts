/**
 * YESYES BUSINESS — Anti-spam para formularios publicos.
 *
 * Estrategia de primera version (sin CAPTCHA externo):
 *  1. honeypot invisible (`website`/`_gotcha`): si viene con valor -> bot;
 *  2. limites de longitud y saneo previo por Zod;
 *  3. heuristica de contenido (exceso de enlaces, repeticion, palabras clave);
 *  4. cooldown por negocio + rate limit por IP (express-rate-limit en la ruta).
 * Nada de esto reemplaza la validacion: se aplica DESPUES de Zod.
 */

export interface SpamCheckInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  /** Campos trampa: si el bot los completa, se descarta el envio. */
  honeypot?: string | null;
}

export interface SpamVerdict {
  spam: boolean;
  /** Motivo interno (nunca se devuelve al cliente con detalle explotable). */
  reason?: string;
}

const HONEYPOT_FIELDS = ['website', 'url', 'hp', '_gotcha', 'company_website'];

const SPAM_KEYWORDS = [
  'viagra', 'casino', 'crypto pump', 'seo services', 'backlinks', 'loan offer',
  'bitcoin doubler', 'free money', 'click here to win', 'xxx', 'escort',
];

const MAX_LINKS = 3;
const MAX_REPEATED_RUN = 12;

export function honeypotTripped(body: Record<string, unknown> | null | undefined): boolean {
  if (!body || typeof body !== 'object') return false;
  for (const field of HONEYPOT_FIELDS) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.trim().length > 0) return true;
    if (typeof value === 'number' && value !== 0) return true;
  }
  return false;
}

function countLinks(text: string): number {
  return (text.match(/https?:\/\/|www\./gi) || []).length;
}

function hasLongRepetition(text: string): boolean {
  return new RegExp(`(.)\\1{${MAX_REPEATED_RUN},}`, 'i').test(text);
}

function hasSpamKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SPAM_KEYWORDS.some((k) => lower.includes(k));
}

/** Heuristica de contenido sobre los campos utiles del lead. */
export function checkLeadContent(input: SpamCheckInput): SpamVerdict {
  const parts = [input.name, input.email, input.phone, input.message]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .trim();

  if (!parts) return { spam: false }; // vacio no es spam: es "sin contenido"
  if (hasSpamKeyword(parts)) return { spam: true, reason: 'keyword' };
  if (hasLongRepetition(parts)) return { spam: true, reason: 'repetition' };
  if (countLinks(parts) > MAX_LINKS) return { spam: true, reason: 'links' };
  return { spam: false };
}

/** Verdicto completo (honeypot + contenido). */
export function checkSpam(
  body: Record<string, unknown> | null | undefined,
  input: SpamCheckInput,
): SpamVerdict {
  if (honeypotTripped(body)) return { spam: true, reason: 'honeypot' };
  return checkLeadContent(input);
}

/**
 * Cooldown por negocio: evita que un mismo visitante dispare decenas de leads
 * en segundos. Devuelve true si todavia esta dentro del cooldown.
 */
export function withinCooldown(lastAt: Date | null | undefined, now: Date, cooldownMs: number): boolean {
  if (!lastAt) return false;
  const delta = now.getTime() - new Date(lastAt).getTime();
  return delta >= 0 && delta < cooldownMs;
}

export const LEAD_COOLDOWN_MS = 15_000;
export const BOOKING_COOLDOWN_MS = 30_000;
