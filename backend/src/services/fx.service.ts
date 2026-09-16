import axios from 'axios';
import { z } from 'zod';

export interface FxRate {
  base: 'USD'; quote: 'CLP'; value: number; source: 'mindicador.cl' | 'manual';
  observedAt: string; fetchedAt: string;
}
const observation = z.object({ valor: z.number().finite().positive(), fecha: z.string().datetime({ offset: true }) });
const responseSchema = z.object({ serie: z.array(observation).min(1) });
export function manualFxRate(value: number, observedAt: string, now = new Date()): FxRate {
  const data = observation.safeParse({ valor: value, fecha: observedAt });
  if (!data.success || Date.parse(observedAt) > now.getTime()) throw new Error('Tasa manual o fecha inválida.');
  return { base: 'USD', quote: 'CLP', value, source: 'manual', observedAt, fetchedAt: now.toISOString() };
}

/** Independent of CJ. No silent fixed rate or assumed timestamp. */
export async function getUsdClpRate(): Promise<FxRate> {
  if (process.env.FX_SOURCE === 'manual') {
    return manualFxRate(Number(process.env.FX_USD_CLP_RATE), process.env.FX_OBSERVED_AT || '');
  }
  if (process.env.FX_SOURCE && process.env.FX_SOURCE !== 'mindicador') throw new Error('Fuente de cambio no configurada.');
  try {
    const result = await axios.get<unknown>('https://mindicador.cl/api/dolar', {
      timeout: 8000, maxRedirects: 0, maxContentLength: 262144,
    });
    const observations = responseSchema.parse(result.data).serie;
    const latest = observations.reduce((a, b) => Date.parse(a.fecha) > Date.parse(b.fecha) ? a : b);
    const now = new Date();
    const age = now.getTime() - Date.parse(latest.fecha);
    if (age < 0 || age > 7 * 86400000) throw new Error();
    return { base: 'USD', quote: 'CLP', value: latest.valor, source: 'mindicador.cl', observedAt: latest.fecha, fetchedAt: now.toISOString() };
  } catch { throw new Error('Tasa USD/CLP no disponible. Configura una tasa manual con fecha en backend.'); }
}
