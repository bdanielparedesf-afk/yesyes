/**
 * YESYES BUSINESS — MEDIOS DE EJEMPLO (FOTO Y VIDEO DE STOCK).
 *
 * El problema que resuelve: la pagina se veía basica porque el contenido de
 * ejemplo creaba servicios y productos, pero NINGUN medio. El manifest tiene
 * bloques `media-ref` (Hero, ImageGallery, Video) y todos quedaban vacios, asi
 * que no habia nada que ver ni que reemplazar.
 *
 * Aqui se declara, por rubro, que archivo de stock va en cada ranura. Son
 * archivos REALES registrados en `BusinessMedia`, exactamente igual que los que
 * sube el dueño. No hay una "capa de ejemplo" escondida: si el dueño borra la
 * foto, desaparece; si la reemplaza, el `id` se conserva y el sitio se actualiza
 * solo.
 *
 * Licencia: todo proviene de Unsplash / Pexels, de licencia libre de uso
 * comercial. Son material de partida: el panel indica que deben reemplazarse.
 *
 * NOTA DE ALMACENAMIENTO: estas filas nacen con `url` publica de origen y SIN
 * `storagePath`, porque no son un upload del dueño sino material de partida. El
 * endpoint de reemplazo (`PUT /media/:id/file`) funciona igual, y a partir del
 * primer reemplazo el archivo pasa a vivir en el bucket del negocio.
 */

/** Una ranura de medio de ejemplo. */
export interface ExampleMedia {
  /** Rol de la ranura: la usa el seeder para colocarla en el bloque correcto. */
  slot: 'cover' | 'gallery' | 'team' | 'products' | 'video';
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  /** Imagen de vista previa. Obligatoria para VIDEO. */
  posterUrl?: string;
  alt: string;
  title: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

/** Imagen de Unsplash via su CDN. Se pide el ancho justo para no bajar el original. */
const img = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Video de Pexels con un frame de portada, para no mostrar un rectangulo negro. */
const vid = (
  file: string,
  poster: string,
  seconds: number,
): Pick<ExampleMedia, 'url' | 'posterUrl' | 'mimeType' | 'durationSec'> => ({
  url: `https://videos.pexels.com/video-files/${file}`,
  posterUrl: img(poster, 1200),
  mimeType: 'video/mp4',
  durationSec: seconds,
});

/** Medios de ejemplo por rubro. */
const MEDIA_BY_CATEGORY: Record<string, ExampleMedia[]> = {
  FOOD: [
    { slot: 'cover', kind: 'IMAGE', url: img('1414235077428-338989a2e8c0', 1920), alt: 'Plato de temporada servido en mesa', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1546069901-ba9599a7e63c', 1200), alt: 'Ingredientes frescos de la carta', title: 'Ingredientes', mimeType: 'image/jpeg' },
    { slot: 'gallery', kind: 'IMAGE', url: img('1565299624946-b28f40a0ae38', 1200), alt: 'Plato principal de la casa', title: 'Plato de la casa', mimeType: 'image/jpeg' },
    { slot: 'gallery', kind: 'IMAGE', url: img('1414235077428-338989a2e8c0', 1200), alt: 'Mesa lista para compartir', title: 'Ambiente', mimeType: 'image/jpeg' },
    { slot: 'video', kind: 'VIDEO', ...vid('3195394/3195394-hd_1920_1080_25fps.mp4', '1414235077428-338989a2e8c0', 12), alt: 'Preparación de un plato en la cocina', title: 'Video de la casa' },
  ],
  CAFE: [
    { slot: 'cover', kind: 'IMAGE', url: img('1501339847302-ac426a4a7cbb', 1920), alt: 'Café de especialidad servido', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1495474472287-4d71bcdd2085', 1200), alt: 'Granos de café tostados', title: 'Origen', mimeType: 'image/jpeg' },
    { slot: 'gallery', kind: 'IMAGE', url: img('1509042239860-f550ce710b93', 1200), alt: 'Taza sobre la barra', title: 'Barra', mimeType: 'image/jpeg' },
    { slot: 'video', kind: 'VIDEO', ...vid('4114798/4114798-hd_1920_1080_25fps.mp4', '1501339847302-ac426a4a7cbb', 10), alt: 'Barista preparando un espresso', title: 'En la barra' },
  ],
  BAKERY: [
    { slot: 'cover', kind: 'IMAGE', url: img('1509440159596-0249088772ff', 1920), alt: 'Pan artesanal recién horneado', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1558961363-fa8fdf82db35', 1200), alt: 'Torta de celebración', title: 'Tortas', mimeType: 'image/jpeg' },
  ],
  HAIR: [
    { slot: 'cover', kind: 'IMAGE', url: img('1560066984-138dadb4c035', 1920), alt: 'Trabajo de corte y peinado', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1522337360788-8b13dee7a37e', 1200), alt: 'Corte de cabello', title: 'Corte', mimeType: 'image/jpeg' },
    { slot: 'gallery', kind: 'IMAGE', url: img('1487412720507-e7ab37603c6f', 1200), alt: 'Coloración aplicada', title: 'Color', mimeType: 'image/jpeg' },
    { slot: 'team', kind: 'IMAGE', url: img('1599351431202-1e0f0137899a', 400), alt: 'Retrato del equipo', title: 'Equipo', mimeType: 'image/jpeg' },
  ],
  BARBER: [
    { slot: 'cover', kind: 'IMAGE', url: img('1585747860715-2ba37e788b70', 1920), alt: 'Barbería con sillón y espejo', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1503951914875-452162b0f3f1', 1200), alt: 'Arreglo de barba', title: 'Barba', mimeType: 'image/jpeg' },
    { slot: 'team', kind: 'IMAGE', url: img('1507003211169-0a1dd7228f2d', 400), alt: 'Retrato del barbero', title: 'Equipo', mimeType: 'image/jpeg' },
  ],
  NAILS: [
    { slot: 'cover', kind: 'IMAGE', url: img('1604654894610-df633bc86741', 1920), alt: 'Manicure con diseño', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1610992015732-2449b76344bc', 1200), alt: 'Uñas con semipermanente', title: 'Semipermanente', mimeType: 'image/jpeg' },
  ],
  BEAUTY: [
    { slot: 'cover', kind: 'IMAGE', url: img('1570172619644-dfd03ed5d881', 1920), alt: 'Tratamiento facial', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1512496015851-a90fb38ba796', 1200), alt: 'Productos de cuidado', title: 'Productos', mimeType: 'image/jpeg' },
  ],
  BOUTIQUE: [
    { slot: 'cover', kind: 'IMAGE', url: img('1441986300917-64674bd600d8', 1920), alt: 'Interior de la tienda', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1521572163474-6864f9cf17ab', 1200), alt: 'Prenda de temporada', title: 'Colección', mimeType: 'image/jpeg' },
  ],
  FLOWERS: [
    { slot: 'cover', kind: 'IMAGE', url: img('1490750967868-88aa4486c946', 1920), alt: 'Ramo de flores frescas', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1518709779341-56cf4535d9a9', 1200), alt: 'Arreglo floral', title: 'Arreglos', mimeType: 'image/jpeg' },
  ],
  FURNITURE: [
    { slot: 'cover', kind: 'IMAGE', url: img('1586023492125-27b2c045efd7', 1920), alt: 'Sala de estar amueblada', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1567016432779-094069958ea5', 1200), alt: 'Mesa de comedor', title: 'Muebles', mimeType: 'image/jpeg' },
  ],
  PET: [
    { slot: 'cover', kind: 'IMAGE', url: img('1450778869180-41d0601e046e', 1920), alt: 'Mascota feliz', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1583337130417-3346a1be7dee', 1200), alt: 'Baño y peluquería canina', title: 'Servicio', mimeType: 'image/jpeg' },
  ],
  MECHANIC: [
    { slot: 'cover', kind: 'IMAGE', url: img('1486262715619-67b85e0b08d3', 1920), alt: 'Taller mecánico', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1625047509248-ec889cbff17f', 1200), alt: 'Mecánico trabajando', title: 'Taller', mimeType: 'image/jpeg' },
  ],
  REAL_ESTATE: [
    { slot: 'cover', kind: 'IMAGE', url: img('1560518883-ce09059eeffa', 1920), alt: 'Casa iluminada en interior', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1600596542815-ffad4c1539a9', 1200), alt: 'Fachada de propiedad', title: 'Propiedad', mimeType: 'image/jpeg' },
  ],
  FITNESS: [
    { slot: 'cover', kind: 'IMAGE', url: img('1534438327276-14e5300c3a48', 1920), alt: 'Sala de entrenamiento', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1517836357463-d25dfeac3438', 1200), alt: 'Entrenamiento guiado', title: 'Entrenamiento', mimeType: 'image/jpeg' },
  ],
  PHOTO: [
    { slot: 'cover', kind: 'IMAGE', url: img('1452587925148-ce544e77e70d', 1920), alt: 'Sesión de fotografía', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
    { slot: 'gallery', kind: 'IMAGE', url: img('1471341971476-ae15ff5dd4ea', 1200), alt: 'Retrato de estudio', title: 'Retrato', mimeType: 'image/jpeg' },
  ],
  TUTORING: [
    { slot: 'cover', kind: 'IMAGE', url: img('1509062522246-3755977927d7', 1920), alt: 'Aula de estudio', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  ],
  CLEANING: [
    { slot: 'cover', kind: 'IMAGE', url: img('1581578731548-c64695cc6952', 1920), alt: 'Interior limpio y ordenado', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  ],
  CONSTRUCTION: [
    { slot: 'cover', kind: 'IMAGE', url: img('1503387762-592deb58ef4e', 1920), alt: 'Obra en construcción', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  ],
  PRO: [
    { slot: 'cover', kind: 'IMAGE', url: img('1521737604893-d14cc237f11d', 1920), alt: 'Equipo de trabajo', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  ],
  PHONE: [
    { slot: 'cover', kind: 'IMAGE', url: img('1511707171634-5f897ff02aa9', 1920), alt: 'Teléfono en reparación', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  ],
};

/** Rubros sin set propio: usan un set generico de trabajo. */
const GENERIC: ExampleMedia[] = [
  { slot: 'cover', kind: 'IMAGE', url: img('1497366216548-37526070297c', 1920), alt: 'Espacio de trabajo', title: 'Portada', mimeType: 'image/jpeg', width: 1920, height: 1080 },
  { slot: 'gallery', kind: 'IMAGE', url: img('1524758631624-e2822e304c36', 1200), alt: 'Detalle del local', title: 'Local', mimeType: 'image/jpeg' },
];

/** Medios de ejemplo del rubro. La categoria debe venir ya canonizada. */
export function exampleMediaFor(category: string): ExampleMedia[] {
  return MEDIA_BY_CATEGORY[category] || GENERIC;
}

/** Separa los medios por la ranura donde deben colocarse. */
export function groupMediaBySlot(media: ExampleMedia[]): Record<string, ExampleMedia[]> {
  const grouped: Record<string, ExampleMedia[]> = {};
  for (const item of media) {
    (grouped[item.slot] ||= []).push(item);
  }
  return grouped;
}

