export type BusinessAsset = { src: string; alt: string };
const CATEGORY_GROUPS: Record<string, BusinessAssetGroup> = {
  FLOWERS: 'flowers', BARBER: 'barber', HAIR: 'hair', BEAUTY: 'beauty', CAFE: 'cafe',
  FOOD: 'food', BAKERY: 'bakery', NAILS: 'nails', PET: 'pets', FITNESS: 'fitness',
  MECHANIC: 'auto', DETAILING: 'auto', AUTO: 'auto', REAL_ESTATE: 'real-estate',
  BOUTIQUE: 'boutique', PHOTO: 'photography', PRO: 'pro', CONSTRUCTION: 'pro',
  CLEANING: 'pro', TUTORING: 'pro', FURNITURE: 'pro', PHONE: 'pro',
};
const photo = (id: string, alt: string): BusinessAsset => ({ src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`, alt });
export const BUSINESS_ASSETS = {
  flowers: [photo('photo-1490750967868-88aa4486c946', 'Arreglo floral'), photo('photo-1523438885200-e635ba2c371e', 'Flores naturales')],
  barber: [photo('photo-1503951914875-452162b0f3f1', 'Barbería profesional'), photo('photo-1621605815971-fbc98d665033', 'Cuidado de barba')],
  hair: [photo('photo-1562322140-8baeececf3df', 'Peluquería y cabello'), photo('photo-1522337360788-8b13dee7a37e', 'Estudio de belleza')],
  beauty: [photo('photo-1560750588-73207b1ef5b8', 'Ritual de belleza'), photo('photo-1516975080664-ed2fc6a32937', 'Cuidado facial')],
  cafe: [photo('photo-1501339847302-ac426a4a7cbb', 'Cafetería artesanal'), photo('photo-1495474472287-4d71bcdd2085', 'Café recién preparado')],
  food: [photo('photo-1517248135467-4c7edcad34c4', 'Ambiente de restaurante'), photo('photo-1547592180-85f173990554', 'Plato gastronómico')],
  bakery: [photo('photo-1509440159596-0249088772ff', 'Panadería artesanal'), photo('photo-1578985545062-69928b1d9587', 'Pastelería')],
  nails: [photo('photo-1604654894610-df63bc536371', 'Manicure'), photo('photo-1610992015732-2449b76344bc', 'Diseño de uñas')],
  pets: [photo('photo-1450778869180-41d0601e046e', 'Mascota feliz'), photo('photo-1517849845537-4d257902454a', 'Cuidado de mascotas')],
  fitness: [photo('photo-1534438327276-14e5300c3a48', 'Entrenamiento en gimnasio'), photo('photo-1517836357463-d25dfeac3438', 'Actividad física')],
  auto: [photo('photo-1486262715619-67b85e0b08d3', 'Mantenimiento vehicular'), photo('photo-1504222490345-c075b6008014', 'Automotriz')],
  'real-estate': [photo('photo-1600607687939-ce8a6c25118c', 'Arquitectura de propiedad'), photo('photo-1600566753086-00f18fb6b3ea', 'Interior inmobiliario')],
  boutique: [photo('photo-1441986300917-64674bd600d8', 'Boutique de moda'), photo('photo-1483985988355-763728e1935b', 'Colección de moda')],
  photography: [photo('photo-1452780212940-6f5c0d14d848', 'Fotografía'), photo('photo-1500530855697-b586d89ba3ee', 'Portafolio fotográfico')],
  pro: [photo('photo-1497366754035-f200968a6e72', 'Espacio profesional'), photo('photo-1521737711867-e3b97375f902', 'Equipo profesional')],
} satisfies Record<string, BusinessAsset[]>;
export type BusinessAssetGroup = keyof typeof BUSINESS_ASSETS;
export function thematicAssets(category?: string | null): BusinessAsset[] {
  const group = CATEGORY_GROUPS[String(category || '').toUpperCase()];
  return (group && BUSINESS_ASSETS[group]) || BUSINESS_ASSETS.pro;
}
export function firstBusinessImage(business: any): BusinessAsset | undefined {
  // `cover === ''` significa que el usuario la QUITO a proposito: en ese caso
  // no se cae de vuelta a la foto de ejemplo, se muestra sin imagen. Antes,
  // quitar la portada hacia reaparecer la foto de Unsplash.
  if (business?.cover === '') return undefined;
  if (!business?.cover) return undefined;
  return { src: business.cover, alt: `Imagen principal de ${business?.name || 'el negocio'}` };
}

/**
 * Foto de ejemplo del rubro, o `undefined` si el negocio ya tiene la suya.
 * Sirve para NO pisar una imagen que el usuario ya eligió.
 */
export function exampleAssetFor(business: any, category?: string | null): BusinessAsset | undefined {
  if (firstBusinessImage(business)) return undefined;
  return thematicAssets(category)[0];
}

/**
 * Imagen de portada de la pagina.
 *
 * `cover === ''` significa que el usuario la QUITO: se respeta y no se
 * rellena con una foto de ejemplo. `cover` ausente significa "todavia no
 * eligio": ahi si se muestra la foto de ejemplo del rubro, que es justo lo
 * que el usuario ve antes de subir la suya.
 *
 * Antes se resolvia con `business?.cover || assets[0]?.src`, y como `''` es
 * falsy, quitar la imagen hacia reaparecer la foto de ejemplo: por eso el
 * usuario no podía quitar las imágenes del diseño.
 */
export function heroImage(business: any, category?: string | null): string | undefined {
  return heroAsset(business, category)?.src;
}

/** Igual que `heroImage`, pero devuelve el asset completo (src + alt). */
export function heroAsset(business: any, category?: string | null): BusinessAsset | undefined {
  const cover = business?.cover;
  if (typeof cover === 'string' && cover.length > 0) {
    return { src: cover, alt: `Imagen principal de ${business?.name || 'el negocio'}` };
  }
  if (cover === '') return undefined;
  return thematicAssets(category)[0];
}
