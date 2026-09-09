import axios from 'axios';

const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_EMAIL = process.env.CJ_EMAIL;
const CJ_API_KEY = process.env.CJ_API_KEY;

let cachedToken: string | null = null;
let tokenExpiry = 0;

const RE_PROD = /\/product\/([A-Za-z0-9-]+)/;
const RE_DETAIL = /\/product-detail\/([A-Za-z0-9-]+)/;
const RE_NUM6 = /(\d{6,})/;

export async function getCJToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await axios.post(`${CJ_API_BASE}/authentication/getAccessToken`, {
    email: CJ_EMAIL,
    apiKey: CJ_API_KEY,
  });

  const token = response.data?.data?.accessToken;
  if (!token) {
    throw new Error('No access token returned from CJ API');
  }

  cachedToken = token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return token;
}

export function extractPID(url: string): string | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  try {
    const full = raw.startsWith('http') ? raw : 'https://' + raw;
    const u = new URL(full);
    const qp =
      u.searchParams.get('pid') ||
      u.searchParams.get('productId') ||
      u.searchParams.get('id') ||
      u.searchParams.get('goodsId');
    if (qp && /^[A-Za-z0-9-]{4,}$/.test(qp)) return qp;
    const hay = u.pathname + ' ' + u.search + ' ' + u.hash + ' ' + raw;
    let m: RegExpMatchArray | null = hay.match(/pid=([A-Za-z0-9-]{4,})/i);
    if (m && m[1]) return m[1];
    m = hay.match(/\/product\/([A-Za-z0-9-]{5,})/i);
    if (m && m[1]) return m[1];
    m = hay.match(/\/product-detail\/([A-Za-z0-9-]{5,})/i);
    if (m && m[1]) return m[1];
    m = hay.match(/p-([A-Za-z0-9-]{6,})/i);
    if (m && m[1]) return m[1];
    m = hay.match(/([A-F0-9]{8}-[A-F0-9-]{4,}-[A-F0-9-]{4,})/i);
    if (m && m[1]) return m[1];
    m = hay.match(/([0-9a-fA-F]{32})/);
    if (m && m[1]) return m[1];
    m = hay.match(/(CJ[0-9]{6,})/i);
    if (m && m[1]) return m[1].toUpperCase();
    m = hay.match(/(VID[0-9]+)/i);
    if (m && m[1]) return m[1].toUpperCase();
  } catch {
    // sigue abajo con regex plana
  }
  let m: RegExpMatchArray | null = raw.match(/pid=([A-Za-z0-9-]{4,})/i);
  if (m && m[1]) return m[1];
  m = raw.match(/p-([A-Za-z0-9-]{6,})/i);
  if (m && m[1]) return m[1];
  m = raw.match(/(\d{6,})/);
  return m && m[1] ? m[1] : null;
}

export async function getCJProduct(pid: string): Promise<any> {
  const token = await getCJToken();
  const cleanPid = String(pid || '').trim();
  const attempts: Array<{ url: string; params: Record<string, any> }> = [
    { url: `${CJ_API_BASE}/product/query`, params: { pid: cleanPid } },
    { url: `${CJ_API_BASE}/product/query`, params: { pid: cleanPid, productId: cleanPid } },
    { url: `${CJ_API_BASE}/product/list`, params: { pid: cleanPid, pageNum: 1, pageSize: 10 } },
  ];
  for (const att of attempts) {
    try {
      const response = await axios.get(att.url, {
        headers: { 'CJ-Access-Token': token },
        params: att.params,
        timeout: 15000,
      });
      const payload = response.data?.data ?? response.data;
      if (Array.isArray(payload) && payload.length > 0) return payload[0];
      if (payload?.list && Array.isArray(payload.list) && payload.list.length > 0) return payload.list[0];
      if (payload?.content && Array.isArray(payload.content) && payload.content.length > 0) return payload.content[0];
      if (payload && (payload.productNameEn || payload.productName || payload.pid || payload.id)) return payload;
      console.warn('[CJ] sin match pid=' + cleanPid + ' resp=' + JSON.stringify(response.data)?.slice(0, 600));
    } catch (err: any) {
      const st = err?.response?.status ?? 'no-status';
      const body = err?.response ? JSON.stringify(err.response.data)?.slice(0, 600) : String(err?.message ?? err);
      console.warn('[CJ] fallo pid=' + cleanPid + ' status=' + st + ' body=' + body);
    }
  }
  return null;
}

export function detectCollection(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/gamer|mouse|keyboard|teclado|audifonos|headset|rgb|monitor|pc|gaming|mouse gamer|teclado mecanico/.test(text)) {
    return 'tech-gamer';
  }
  if (/led|humidifier|humificador|smart|hogar|cocina|luz|lampara|home|despacho/.test(text)) {
    return 'hogar-smart';
  }
  if (/hair|beauty|belleza|makeup|maquillaje|masajeador|massager|pelo|labial/.test(text)) {
    return 'belleza';
  }
  if (/fitness|gym|deporte|sport|ejercicio|yoga|correr|running|pesa|dumbbell/.test(text)) {
    return 'fitness';
  }
  return 'tendencias-viral';
}

export function calculatePrice(cjPrice: number): { price: number; comparePrice: number } {
  const price = Math.round(cjPrice * 2);
  const comparePrice = Math.round(price * 1.35);
  return { price, comparePrice };
}

export function translateToChileanSpanish(title: string): string {
  const dictionary: Record<string, string> = {
    'Wireless': 'Inalámbrico',
    'Bluetooth': 'Bluetooth',
    'Gaming': 'Gamer',
    'Mouse': 'Mouse',
    'Keyboard': 'Teclado',
    'LED': 'LED',
    'Humidifier': 'Humidificador',
    'Aroma': 'Aroma',
    'Essential Oil': 'Aceite Esencial',
    'Massager': 'Masajeador',
    'Fitness': 'Fitness',
    'Smart': 'Smart',
    'Home': 'Hogar',
    'Beauty': 'Belleza',
    'Hair': 'Pelo',
    'Makeup': 'Maquillaje',
    'Gym': 'Gimnasio',
    'Sport': 'Deporte',
    'Running': 'Running',
    'USB': 'USB',
    'Charging': 'Carga',
    'Power Bank': 'Power Bank',
    'Lamp': 'Lámpara',
    'Light': 'Luz',
    'Desk': 'Escritorio',
    'Monitor': 'Monitor',
    'Headset': 'Auriculares',
    'Earphone': 'Audífono',
    'Speaker': ' Parlante',
    'Camera': 'Cámara',
    'Watch': 'Reloj',
    'Band': 'Band',
    'Drone': 'Drone',
    'Toy': 'Juguete',
    'Kids': 'Niños',
    'Men': 'Hombres',
    'Women': 'Mujeres',
    'Unisex': 'Unisex',
    'Summer': 'Verano',
    'Winter': 'Invierno',
    'Waterproof': 'Impermeable',
    'Portable': 'Portátil',
    'Rechargeable': 'Recargable',
    'Automatic': 'Automático',
    'Electric': 'Eléctrico',
    'Digital': 'Digital',
    'Mini': 'Mini',
    'Pro': 'Pro',
    'Max': 'Max',
    'Plus': 'Plus',
    'New': 'Nuevo',
    'Hot': 'Popular',
    'Best Seller': 'Más Vendido',
  };

  let result = title;
  for (const [en, es] of Object.entries(dictionary)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    result = result.replace(regex, es);
  }
  return result;
}
