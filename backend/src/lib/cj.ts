import axios from 'axios';

const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_EMAIL = process.env.CJ_EMAIL;
const CJ_API_KEY = process.env.CJ_API_KEY;

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

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
  try {
    const u = new URL(url);
    if (u.hostname.includes('cjdropshipping.com')) {
      const match = u.pathname.match(/\/product\/(\d+)/);
      if (match && match[1]) return match[1];
      const pMatch = u.pathname.match(/p-([A-Za-z0-9-]+)/);
      if (pMatch && pMatch[1]) return pMatch[1];
    }
    const num = url.match(/(\d{6,})/);
    return num?.[1] ?? null;
  } catch {
    const num = url.match(/(\d{6,})/);
    return num?.[1] ?? null;
  }
}

export async function getCJProduct(pid: string): Promise<any> {
  const token = await getCJToken();
  const response = await axios.get(`${CJ_API_BASE}/product/query`, {
    headers: { 'CJ-Access-Token': token },
    params: { pid },
  });
  return response.data?.data || response.data;
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
