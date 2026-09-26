/**
 * CERTIFICACION E2E AUTONOMA — YesYes Business.
 * Utilidades compartidas: Chrome real via CDP + helpers de pagina.
 *
 * NO usa SQL, Prisma, seed ni endpoints internos para MODIFICAR el estado.
 * Solo navega y hace clic como un usuario. Las lecturas por API (GET) se usan
 * unicamente para verificar resultados.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

export function resolveBrowser() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  throw new Error('BLOCKED_EXTERNAL_DEPENDENCY: no se encontro Chrome ni Edge para la UI real');
}

export const APP = 'http://127.0.0.1:5173';
export const API = 'http://127.0.0.1:3001';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CDP {
  constructor(url, { defaultTimeoutMs = 20_000 } = {}) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.closed = false;
  }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP open timeout')), this.defaultTimeoutMs);
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = () => { clearTimeout(timer); reject(new Error('CDP websocket error')); };
    });
    this.ws.onmessage = ({ data }) => {
      let message; try { message = JSON.parse(data); } catch { return; }
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id); clearTimeout(pending.timer);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) || []) handler(message.params);
    };
  }
  send(method, params = {}, options = {}) {
    const { timeoutMs = this.defaultTimeoutMs, description = method } = options;
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error(`CDP cerrado: ${description}`));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${description} excedio ${timeoutMs}ms`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.ws.send(JSON.stringify({ id, method, params })); }
      catch (e) { this.pending.delete(id); clearTimeout(timer); reject(e); }
    });
  }
  on(method, handler) {
    const list = this.handlers.get(method) || [];
    list.push(handler);
    this.handlers.set(method, list);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('CDP cerrado')); }
    this.pending.clear();
    try { this.ws.close(); } catch { /* noop */ }
  }
}

export async function launchBrowser({ runId = randomUUID(), port = 9711, width = 1440, height = 1000 } = {}) {
  const profile = join(process.cwd(), 'logs', 'cert-chrome', runId);
  const bin = resolveBrowser();
  const child = spawn(bin, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1_000) });
      const targets = await response.json();
      const target = targets.find((t) => t.type === 'page');
      if (target) return { child, target, port, profile, bin };
    } catch { /* aun no responde */ }
    await sleep(300);
  }
  child.kill();
  throw new Error('El navegador no entrego target CDP');
}

/** Driver de una pagina: navigate, evaluate, click por texto/testid, escribir. */
export class Page {
  constructor(cdp) {
    this.cdp = cdp;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.failedRequests = [];
  }
  static async create(target) {
    const cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    const page = new Page(cdp);
    await page.init();
    return page;
  }
  async init() {
    await this.cdp.send('Page.enable');
    await this.cdp.send('Runtime.enable');
    await this.cdp.send('DOM.enable');
    await this.cdp.send('Log.enable');
    await this.cdp.send('Network.enable');
    this.cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') this.consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    });
    this.cdp.on('Runtime.exceptionThrown', (p) => {
      this.pageErrors.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 400));
    });
    this.cdp.on('Network.responseReceived', (p) => {
      if (p.response.status >= 400) this.failedRequests.push({ url: p.response.url.slice(0, 200), status: p.response.status });
    });
  }
  async goto(url, { waitMs = 1200 } = {}) {
    await this.cdp.send('Page.navigate', { url }, { description: 'navigate' });
    await sleep(waitMs);
    await this.waitForLoad();
  }
  async waitForLoad(timeoutMs = 25_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ready = await this.eval('document.readyState');
      if (ready === 'complete') { await sleep(400); return true; }
      await sleep(250);
    }
    return false;
  }
  async eval(expression, { awaitPromise = true } = {}) {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise, userGesture: true,
    }, { description: 'evaluate', timeoutMs: 30_000 });
    if (result.exceptionDetails) {
      throw new Error(`eval error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    }
    return result.result?.value;
  }
  async url() { return this.eval('location.href'); }
  async text(selector = 'body') { return this.eval(`(document.querySelector(${JSON.stringify(selector)})?.innerText || '')`); }
  async exists(selector) { return this.eval(`Boolean(document.querySelector(${JSON.stringify(selector)}))`); }
  async count(selector) { return this.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`); }
  async waitFor(selector, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.exists(selector)) return true;
      await sleep(250);
    }
    return false;
  }
  async clickText(text, { selector = 'button, a, [role="button"]', exact = false, timeoutMs = 12_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ok = await this.eval(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
        const target = nodes.find((n) => {
          const t = (n.innerText || n.textContent || '').trim();
          return ${exact} ? t === ${JSON.stringify(text)} : t.toLowerCase().includes(${JSON.stringify(text.toLowerCase())});
        });
        if (!target) return false;
        target.scrollIntoView({ block: 'center' });
        target.click();
        return true;
      })()`);
      if (ok) { await sleep(450); return true; }
      await sleep(300);
    }
    return false;
  }
  async click(selector, { timeoutMs = 12_000 } = {}) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const ok = await this.eval(`(() => {
        const n = document.querySelector(${JSON.stringify(selector)});
        if (!n) return false;
        n.scrollIntoView({ block: 'center' });
        n.click(); return true;
      })()`);
      if (ok) { await sleep(400); return true; }
      await sleep(250);
    }
    return false;
  }
  async fill(selector, value) {
    return this.eval(`(() => {
      const n = document.querySelector(${JSON.stringify(selector)});
      if (!n) return false;
      const proto = n instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(n, ${JSON.stringify(value)});
      n.dispatchEvent(new Event('input', { bubbles: true }));
      n.dispatchEvent(new Event('change', { bubbles: true }));
      n.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    })()`);
  }
  async setViewport(width, height) {
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
    }, { description: 'viewport' });
    await sleep(800);
  }
  /**
   * Restaura una sesión REAL creada antes por la UI (localStorage).
   * Se usa solo para no perder tiempo re-registrando entre fases: la sesión no se
   * fabrica, se reutiliza la que creó el propio usuario en /register.
   */
  async restoreSession(storage) {
    await this.goto(APP, { waitMs: 1500 });
    await this.eval(`(() => {
      for (const [key, value] of Object.entries(${JSON.stringify(storage || {})})) {
        localStorage.setItem(key, value);
        sessionStorage.setItem(key, value);
      }
      return true;
    })()`);
  }
  async screenshot(dir, name) {
    const result = await this.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, { description: 'screenshot', timeoutMs: 40_000 });
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${name}.png`);
    await writeFile(file, Buffer.from(result.data, 'base64'));
    return file;
  }
  async clearErrors() { this.consoleErrors = []; this.pageErrors = []; this.failedRequests = []; }
  close() { this.cdp.close(); }
}

/** GET de solo lectura para VERIFICAR (nunca para modificar). */
export async function apiGet(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

