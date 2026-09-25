import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CDP, base, launchChrome, pageMetricsExpression, sleep } from './business-qa-client.mjs';

const root = process.cwd();
const outDir = path.join(root, 'qa', 'business-captures');
const scenarios = [
  ['flowers', 'FLOWERS'], ['barber', 'BARBER'], ['hair', 'HAIR'], ['beauty', 'BEAUTY'], ['cafe', 'CAFE'],
  ['food', 'FOOD'], ['bakery', 'BAKERY'], ['nails', 'NAILS'], ['pets', 'PET'], ['fitness', 'FITNESS'],
  ['auto', 'AUTO'], ['real-estate', 'REAL_ESTATE'], ['boutique', 'BOUTIQUE'], ['photo', 'PHOTO'], ['pro', 'PRO'],
];
const viewports = [[390, 844], [768, 900], [1280, 900]];
const menuNames = ['flowers', 'barber', 'cafe', 'real-estate', 'photo'];

let client;

const { chrome, target } = await launchChrome(root);
try {
  client = new CDP(target.webSocketDebuggerUrl);
  await client.open();
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable'), client.send('Log.enable')]);
  await mkdir(outDir, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), scenarios: [], mobileMenu: [] };


  for (const [name, category] of scenarios) {
    for (const [width, height] of viewports) {
      const consoleMessages = []; const exceptions = []; const failedRequests = []; const httpErrors = []; const logEntries = [];
      const onConsole = ({ type, args, stackTrace }) => consoleMessages.push({ type, text: (args || []).map((arg) => arg.value ?? arg.description ?? '').join(' '), stack: stackTrace?.callFrames?.[0]?.url || '' });
      const onException = ({ exceptionDetails }) => exceptions.push(exceptionDetails.text || exceptionDetails.exception?.description || 'Unknown exception');
      const onRequestFailed = ({ requestId, request, errorText, blockedReason }) => failedRequests.push({ url: request?.url || 'unknown', errorText, blockedReason, requestId });
      const onResponse = ({ requestId, response, type }) => { if (response.status >= 400) httpErrors.push({ url: response.url, status: response.status, type, requestId }); };
      const onLog = ({ entry }) => logEntries.push({ level: entry.level, text: entry.text, url: entry.url || '' });
      client.on('Runtime.consoleAPICalled', onConsole); client.on('Runtime.exceptionThrown', onException); client.on('Network.loadingFailed', onRequestFailed); client.on('Network.responseReceived', onResponse); client.on('Log.entryAdded', onLog);
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      await client.send('Page.navigate', { url: `${base}/__qa/business/${name}` });
      await sleep(2600);
      const evaluated = await client.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: pageMetricsExpression });
      const metrics = evaluated.result.value;
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const file = `${name}-${width}.png`;
      const capturePath = path.join(outDir, file);
      const tempPath = `${capturePath}.tmp`;
      await writeFile(tempPath, Buffer.from(screenshot.data, 'base64'));
      for (let attempt = 0; attempt < 5; attempt++) {
        try { await writeFile(capturePath, await import('node:fs/promises').then(({ readFile }) => readFile(tempPath))); break; }
        catch (error) { if (attempt === 4) throw error; await sleep(250); }
      }
      const criticalConsole = consoleMessages.filter((item) => item.type === 'error' || item.type === 'warning');
      const overflowPass = metrics.scrollWidth <= metrics.innerWidth + 1;
      const networkPass = failedRequests.length === 0 && httpErrors.length === 0;
      const visualTechnicalPass = !metrics.notFound && Boolean(metrics.template) && Boolean(metrics.h1) && metrics.brokenImages.length === 0;
      report.scenarios.push({ category, name, viewport: width, file, metrics, console: criticalConsole, exceptions, failedRequests, httpErrors, browserLog: logEntries, overflowPass, networkPass, visualTechnicalPass, pass: visualTechnicalPass && overflowPass && networkPass && exceptions.length === 0 && criticalConsole.length === 0 });
      for (const [event, handler] of [['Runtime.consoleAPICalled', onConsole], ['Runtime.exceptionThrown', onException], ['Network.loadingFailed', onRequestFailed], ['Network.responseReceived', onResponse], ['Log.entryAdded', onLog]]) client.off(event, handler);
    }
  }


  for (const name of menuNames) {
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await client.send('Page.navigate', { url: `${base}/__qa/business/${name}` }); await sleep(1800);
    const result = await client.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(() => {
      const button = document.querySelector('button[aria-controls="business-menu"]');
      button?.click();
      return new Promise((resolve) => setTimeout(() => {
        const menu = document.getElementById('business-menu');
        const state = { opened: Boolean(menu), expanded: button?.getAttribute('aria-expanded'), controls: button?.getAttribute('aria-controls'), focusInside: Boolean(menu?.contains(document.activeElement)), links: menu?.querySelectorAll('a').length || 0, overflow: document.documentElement.scrollWidth <= innerWidth + 1 };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        setTimeout(() => resolve({ ...state, closed: !document.getElementById('business-menu'), focusReturned: document.activeElement === button }), 100);
      }, 250));
    })()` });
    report.mobileMenu.push({ name, ...result.result.value, pass: Boolean(result.result.value.opened && result.result.value.expanded === 'true' && result.result.value.controls === 'business-menu' && result.result.value.focusInside && result.result.value.links > 0 && result.result.value.overflow && result.result.value.closed && result.result.value.focusReturned) });
  }
  report.summary = { total: report.scenarios.length, pass: report.scenarios.filter((item) => item.pass).length, consolePass: report.scenarios.filter((item) => !item.console.length && !item.exceptions.length).length, networkPass: report.scenarios.filter((item) => item.networkPass).length, overflowPass: report.scenarios.filter((item) => item.overflowPass).length, mobileMenuPass: report.mobileMenu.filter((item) => item.pass).length };
  await writeFile(path.join(root, 'qa', 'business-qa-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.total !== 45 || report.summary.pass !== 45 || report.summary.mobileMenuPass !== 5) process.exitCode = 1;
} finally { client?.close(); chrome.kill(); }
