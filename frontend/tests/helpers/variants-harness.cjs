/**
 * YESYES BUSINESS — FASE A: FIXTURES COMPARTIDAS DE VARIANTES.
 *
 * Un unico lugar con el negocio y su contenido, para que los tests de variantes
 * (realidad visual y conservacion de contenido) comparen siempre la MISMA
 * pagina y las diferencias observadas sean atribuibles solo a la variante.
 */

const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./mount.cjs');

const blocks = mount('business/engine/blocks.tsx', 'vh-blocks');
const { BLOCK_RENDERERS } = blocks;

// El registro vive en el backend: se LEE, no se copia, para que el test no
// pueda pasar mientras el catalogo y el renderer digieran cosas distintas.
// Es TypeScript con imports sin extension, asi que necesita el loader CJS de
// `tsx` para resolverse igual que lo hace el backend en runtime. `tsx` vive en
// las dependencias del backend, no del frontend: se carga por ruta explicita
// para que este test no dependa de instalar nada nuevo en el frontend.
require(path.join(__dirname, '..', '..', '..', 'backend', 'node_modules', 'tsx', 'dist', 'cjs', 'index.cjs'));
const { VARIANT_DEFINITIONS } = require(
  path.join(__dirname, '..', '..', '..', 'backend', 'src', 'template-engine', 'variant-registry.ts'),
);

const BUSINESS = {
  id: 'b1',
  name: 'Clínica Veterinaria Los Robles',
  slug: 'clinica-los-robles',
  category: 'PET',
  status: 'DRAFT',
  description: 'Atención veterinaria a domicilio',
  phone: '+56911111111',
  whatsapp: '+56911111111',
  email: 'hola@losrobles.cl',
  address: 'Av. Siempre Viva 742',
  city: 'Santiago',
  region: 'RM',
  lat: -33.45,
  lng: -70.66,
  cover: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def',
  cta: { label: 'Agendar hora', action: 'whatsapp' },
};

// Contenido deliberadamente RICO: si una variante pierde un dato, se nota.
const CONTENT = {
  services: [
    { id: 's1', name: 'Consulta General', description: 'Revisión completa', price: 25000, image: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97' },
    { id: 's2', name: 'Vacunación', description: 'Vacunas y desparasitación', price: 18000, image: 'https://images.unsplash.com/photo-1583324113626-70df0f4deaab' },
    { id: 's3', name: 'Cirugía', description: 'Procedimientos con anestesia', price: 120000, image: 'https://images.unsplash.com/photo-1628771065518-0d82f19366b0' },
  ],
  products: [
    { id: 'p1', name: 'Alimento Premium', shortDescription: '12 kg de comida', description: 'Alimento balanceado', price: 32000, image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119', active: true },
    { id: 'p2', name: 'Juguete interactivo', shortDescription: 'Para perros activos', price: 8900, image: 'https://images.unsplash.com/photo-1530284600547-801d1b6b0b3f', active: true },
    { id: 'p3', name: 'Cama ortopédica', shortDescription: 'Disponible agotado', price: 24500, image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c', active: false },
  ],
  properties: [
    { id: 'r1', title: 'Casa en Las Condes', operation: 'Venta', type: 'Casa', city: 'Las Condes', address: 'Av. Apoquindo 4500', price: 320000000, bedrooms: 4, bathrooms: 3, areaTotal: 210, images: [{ url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750' }] },
    { id: 'r2', title: 'Depto en Providencia', operation: 'Arriendo', type: 'Departamento', city: 'Providencia', price: 450000, bedrooms: 2, bathrooms: 2, areaTotal: 78, images: [{ url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688' }] },
  ],
  gallery: [
    { id: 'g1', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d', alt: 'Consulta' },
    { id: 'g2', url: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97', alt: 'Examen' },
    { id: 'g3', url: 'https://images.unsplash.com/photo-1583324113626-70df0f4deaab', alt: 'Cuidado' },
    { id: 'g4', url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee', alt: 'Paseo' },
  ],
  testimonials: [
    { id: 't1', name: 'María González', content: 'Mi perro volvió como nuevo.' },
    { id: 't2', name: 'Juan Pérez', content: 'Atención rápida y muy cuidadosa.' },
    { id: 't3', name: 'Ana López', content: 'Me explicaron todo con paciencia.' },
  ],
  faqs: [
    { id: 'f1', question: '¿Atienden a domicilio?', answer: 'Sí, en todo Santiago centro.' },
    { id: 'f2', question: '¿Qué medios de pago aceptan?', answer: 'Aceptamos todas las tarjetas.' },
  ],
  promotions: [
    { id: 'o1', title: '2x1 en vacunas', description: 'Durante todo agosto', discount: '50% OFF' },
    { id: 'o2', title: 'Examen gratis', description: 'Con la compra de alimento', discount: 'GRATIS' },
  ],
  team: [
    { id: 'm1', name: 'Dra. Camila Rojas', role: 'Médica veterinaria', bio: '10 años de experiencia', photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f' },
    { id: 'm2', name: 'Dr. Sebastián Soto', role: 'Cirujano', bio: 'Especialista en traumatología', photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d' },
  ],
  bookingSlots: [
    { id: 'k1', weekday: 1, startTime: '09:00', endTime: '13:00' },
    { id: 'k2', weekday: 1, startTime: '15:00', endTime: '19:00' },
    { id: 'k3', weekday: 3, startTime: '10:00', endTime: '14:00' },
  ],
  media: [
    { id: 'v1', kind: 'video', url: 'https://cdn.coverr.co/videos/coverr-dog-playing.mp4', posterUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d', title: 'Nuestra consulta', alt: 'Video de la clinica' },
    { id: 'v2', kind: 'video', url: 'https://cdn.coverr.co/videos/coverr-vet-exam.mp4', posterUrl: '', title: 'Examen', alt: 'Examen veterinario' },
  ],
};

const render = (element) => renderToStaticMarkup(React.createElement(React.Fragment, null, element));

/** Renderiza un bloque real con una configuración de variante concreta. */
function renderBlock(block, config) {
  const Render = BLOCK_RENDERERS[block];
  if (!Render) throw new Error(`El bloque ${block} no tiene renderer`);
  return render(React.createElement(Render, {
    business: BUSINESS,
    ...CONTENT,
    mobile: 'stack',
    preview: false,
    instanceId: `${block}-1`,
    config: config || {},
    anchor: 'ancla',
  }));
}

module.exports = { BUSINESS, CONTENT, VARIANT_DEFINITIONS, render, renderBlock, BLOCK_RENDERERS };
