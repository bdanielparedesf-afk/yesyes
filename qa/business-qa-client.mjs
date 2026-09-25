import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const debugPort = 9333;
export const base = 'http://127.0.0.1:5173';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class CDPError extends Error {
  constructor(errorCode, message, details = {}) {
    super(message);
    this.name = 'CDPError';
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class CDP {
  constructor(url, { defaultTimeoutMs = 15_000, runId = 'unknown' } = {}) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.handlers = new Map(); this.defaultTimeoutMs = defaultTimeoutMs; this.runId = runId; this.closed = false;
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new CDPError('CDP_OPEN_TIMEOUT', `CDP no abrió en ${this.defaultTimeoutMs}ms`, { phase: 'PREFLIGHT' })), this.defaultTimeoutMs);
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = (event) => { clearTimeout(timer); reject(new CDPError('CDP_OPEN_ERROR', 'Error de WebSocket CDP', { phase: 'PREFLIGHT', event: String(event?.type || '') })); };
    });
    this.ws.onmessage = ({ data }) => {
      let message; try { message = JSON.parse(data); } catch { return; }
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); clearTimeout(pending.timer);
        message.error ? pending.reject(new CDPError('CDP_ERROR', message.error.message, { phase: pending.phase, operation: pending.method })) : pending.resolve(message.result); return;
      }
      for (const handler of this.handlers.get(message.method) || []) handler(message.params);
    };
  }
  send(method, params = {}, options = {}) {
    const { timeoutMs = this.defaultTimeoutMs, phase = 'UNKNOWN', description = method } = options;
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new CDPError('CDP_CLOSED', `CDP no está abierto: ${description}`, { phase, operation: method }));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new CDPError('CDP_TIMEOUT', `${description} excedió ${timeoutMs}ms`, { phase, operation: method, timeoutMs })); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method, phase, description });
      try { this.ws.send(JSON.stringify({ id, method, params })); }
      catch (error) { this.pending.delete(id); clearTimeout(timer); reject(new CDPError('CDP_SEND_ERROR', error instanceof Error ? error.message : String(error), { phase, operation: method })); }
    });
  }
  on(method, handler) { const list = this.handlers.get(method) || []; list.push(handler); this.handlers.set(method, list); }
  off(method, handler) { this.handlers.set(method, (this.handlers.get(method) || []).filter((item) => item !== handler)); }
  close() {
    if (this.closed) return; this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new CDPError('CDP_CLOSED', `Cerrado durante ${pending.description}`, { phase: pending.phase, operation: pending.method })); }
    this.pending.clear(); try { this.ws.close(); } catch { /* already closed */ }
  }
}

export async function launchChrome(root, { runId = randomUUID(), timeoutMs = 15_000 } = {}) {
  const profile = join(root, '.qa-chrome-profile', runId);
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1_000) });
      const targets = await response.json();
      const target = targets.find((item) => item.type === 'page');
      if (target) return { chrome, target, profile, runId };
    } catch { /* Chrome aún no está listo */ }
    await sleep(250);
  }
  chrome.kill();
  throw new CDPError('CHROME_START_TIMEOUT', `Chrome no entregó target CDP en ${timeoutMs}ms`, { phase: 'PREFLIGHT', operation: 'launchChrome', profile });
}

export const waitForPortFree = async (port = debugPort, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) }); }
    catch { return true; }
    await sleep(200);
  }
  return false;
};

export const pageMetricsExpression = `(() => {
  const root = document.querySelector('[data-business-template]');
  const images = [...document.images];
  const menuButton = document.querySelector('button[aria-controls="business-menu"]');
  return {
    title: document.title, template: root?.getAttribute('data-business-template') || '', renderer: root?.getAttribute('data-business-renderer') || '',
    h1: document.querySelector('h1')?.textContent?.trim() || '', scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight, brokenImages: images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
    main: Boolean(document.querySelector('main')), header: Boolean(document.querySelector('header')), footer: Boolean(document.querySelector('footer')),
    headings: document.querySelectorAll('h1,h2,h3').length,
    ctaCount: [...document.querySelectorAll('a,button')].filter((node) => /reserv|pedir|menú|consulta|turno|cuidado|empezar|cotización|colección|presupuesto/i.test(node.textContent || '')).length,
    mobileButton: Boolean(menuButton), ariaExpanded: menuButton?.getAttribute('aria-expanded') || null, ariaControls: menuButton?.getAttribute('aria-controls') || null,
    notFound: document.body.textContent?.includes('Página no encontrada') || false,
  };
})()`;
