const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { mount } = require('./helpers/mount.cjs');

/**
 * YESYES BUSINESS — SMOKE V3 (compatibilidad que C NO puede romper).
 *
 * Estos tests solían leer el código como texto. Ahora EJERCITAN la registry y el
 * renderer reales: entrada -> resolución -> markup. Un PASS significa que la
 * página se compone, no que exista una cadena en un archivo (§22).
 */

const registry = mount('business/registry.tsx', 'v3-registry');
const renderer = mount('business/BusinessPageRenderer.tsx', 'v3-renderer');

const BUSINESS = { id: 'b1', name: 'Negocio', slug: 'negocio', status: 'DRAFT', description: 'Descripcion', whatsapp: '+56911111111' };
const CONTENT = {
  services: [{ id: 's1', name: 'Servicio Uno', price: 10000 }],
  products: [{ id: 'p1', name: 'Producto Uno', price: 20000, salePrice: 20000 }],
  properties: [], gallery: [], testimonials: [], faqs: [], promotions: [], team: [], bookingSlots: [],
};

const render = (element) => renderToStaticMarkup(React.createElement(React.Fragment, null, element));

test('la registry resuelve los templates dedicados a un componente real', () => {
  for (const code of ['FOOD_01', 'BOUTIQUE_01', 'PHOTO_01', 'BEAUTY_01', 'CLEANING_01', 'TUTORING_01', 'CONSTRUCTION_01']) {
    const component = registry.resolveTemplate(code);
    assert.ok(component, `${code} debe resolver a un componente`);
  }
  assert.equal(registry.hasDedicatedTemplate('FOOD_01'), true);
  assert.equal(registry.hasDedicatedTemplate('DESCONOCIDO_99'), false);
});

test('un template desconocido cae en el template genérico sin romperse', () => {
  assert.equal(registry.getNormalizedTemplateCode('DESCONOCIDO_99'), 'DESCONOCIDO_99');
  assert.equal(registry.getNormalizedTemplateCode('  food_01 '), 'FOOD_01');
  assert.equal(registry.getNormalizedTemplateCode('FLORES_01'), 'FLOWERS_01', 'el alias legacy se normaliza');
  assert.ok(registry.resolveTemplate('DESCONOCIDO_99'), 'debe devolver el fallback');
});

test('el renderer compone una página de industria sin manifest V2', () => {
  const html = render(React.createElement(renderer.Subject, {
    business: { ...BUSINESS, category: 'PET', template: { code: 'PET_01', category: 'PET' }, siteInstance: null },
    ...CONTENT, preview: true,
  }));
  assert.ok(html.length > 200, 'produce markup');
  assert.ok(html.includes('Servicio Uno'), 'y muestra el contenido real del negocio');
});

test('el renderer filtra el contenido por las secciones habilitadas', () => {
  const base = { ...BUSINESS, category: 'PET', template: { code: 'PET_01', category: 'PET' }, siteInstance: null };
  const conServicios = render(React.createElement(renderer.Subject, {
    business: { ...base, visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }, { id: 'SERVICES', enabled: true, order: 20 }] } },
    ...CONTENT, preview: true,
  }));
  assert.ok(conServicios.includes('Servicio Uno'), 'SERVICES habilitada muestra el servicio');

  const sinServicios = render(React.createElement(renderer.Subject, {
    business: { ...base, visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }, { id: 'SERVICES', enabled: false, order: 20 }] } },
    ...CONTENT, preview: true,
  }));
  assert.ok(!sinServicios.includes('Servicio Uno'), 'SERVICES deshabilitada lo oculta');
});

test('el renderer marca en el DOM qué sección y qué vía está usando', () => {
  const html = render(React.createElement(renderer.Subject, {
    business: {
      ...BUSINESS, category: 'PET', template: { code: 'PET_01', category: 'PET' }, siteInstance: null,
      visual: { sections: [{ id: 'HERO', enabled: true, order: 10 }, { id: 'SERVICES', enabled: true, order: 20 }] },
    },
    ...CONTENT, preview: true,
  }));
  assert.ok(html.includes('data-business-sections="HERO,SERVICES"'), 'expone las secciones compuestas para QA');
  assert.ok(html.includes('Servicio Uno'), 'con el contenido real de esa sección');
});
