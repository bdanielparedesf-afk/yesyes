import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const TRANSLATE_PROMPT =
  'Eres un traductor profesional especializado en e-commerce. Traduce el texto entre <<INICIO>> y <<FIN>> del inglés al español de Chile, de forma neutral y natural (vocabulario chileno, sin anglicismos innecesarios). REGLAS: conserva INTACTOS los datos técnicos y especificaciones (materiales, tallas, colores, dimensiones, pesos, volúmenes, capacidades, porcentajes, números, URLs, códigos SKU, códigos de producto, precios y unidades de medida); no inventes información ni agregues descripciones extra; no alters los nombres de marca. Devuelve ÚNICAMENTE el texto traducido, sin comillas, sin notas ni etiquetas.';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL_PREFIX = 'https://generativelanguage.googleapis.com/v1beta/models';

const translationCache = new Map<string, string>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string): string | undefined {
  const exp = cacheExpiry.get(key);
  if (!exp || Date.now() > exp) {
    translationCache.delete(key);
    cacheExpiry.delete(key);
    return undefined;
  }
  return translationCache.get(key);
}

function setCached(key: string, value: string): void {
  translationCache.set(key, value);
  cacheExpiry.set(key, Date.now() + CACHE_TTL_MS);
}

export async function translateWithAI(
  text: string,
  prompt: string = TRANSLATE_PROMPT,
): Promise<string | null> {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length < 3) {
    return null;
  }

  const cached = getCached(trimmed);
  if (cached) {
    return cached;
  }

  if (OPENAI_API_KEY) {
    try {
      const res = await axios.post(
        OPENAI_URL,
        {
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `<<INICIO>>${trimmed}<<FIN>>` },
          ],
          temperature: 0.2,
          max_tokens: Math.max(200, trimmed.length * 4),
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
          timeout: 15000,
        },
      );
      const out = res.data?.choices?.[0]?.message?.content;
      const translated = typeof out === 'string' ? out.trim() : '';
      if (translated) {
        setCached(trimmed, translated);
        return translated;
      }
    } catch (error: any) {
      console.warn('[translate] OpenAI falló:', error?.message ?? error);
    }
  }

  if (GEMINI_API_KEY) {
    try {
      const res = await axios.post(
        `${GEMINI_URL_PREFIX}/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: `${prompt}\n\n<<INICIO>>${trimmed}<<FIN>>` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: Math.max(200, trimmed.length * 4) },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      const out = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const translated = typeof out === 'string' ? out.trim() : '';
      if (translated) {
        setCached(trimmed, translated);
        return translated;
      }
    } catch (error: any) {
      console.warn('[translate] Gemini falló:', error?.message ?? error);
    }
  }

  return null;
}

async function translateWithMyMemory(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json: any = await res.json();
    return json.responseData?.translatedText || text;
  } catch { return text; }
}

export { translateWithMyMemory };
