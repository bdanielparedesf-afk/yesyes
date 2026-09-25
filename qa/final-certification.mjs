import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { waitForPortFree } from './business-qa-client.mjs';

const runId = process.env.FINAL_RUN_ID || randomUUID();
process.env.FINAL_RUN_ID = runId;
process.env.BUSINESS_QA_E2E = '1';
process.env.FINAL_CERTIFICATION = '1';
const reportPath = path.resolve('qa/final-certification-report.json');
const globalTimeoutMs = Number(process.env.FINAL_CERTIFICATION_TIMEOUT_MS || 45 * 60_000);
const phaseTimeoutMs = Number(process.env.FINAL_PHASE_TIMEOUT_MS || 25 * 60_000);
export const report = { runId, startedAt: new Date().toISOString(), finishedAt: null, status: 'NOT READY', criteria: { preflight: {}, browser: {}, commerce: {}, business: {}, responsive: {}, mercadoPagoSandbox: {}, backendTests: {}, frontendTests: {}, backendBuild: {}, frontendBuild: {}, prisma: {}, gitDiffCheck: {}, cleanup: {} }, phases: {}, warnings: [], errors: [], artifacts: [] };
let forced = false;
const globalTimer = setTimeout(() => { forced = true; report.errors.push({ phase: 'GLOBAL', errorCode: 'GLOBAL_TIMEOUT', message: `Global timeout ${globalTimeoutMs}ms`, timestamp: new Date().toISOString() }); }, globalTimeoutMs);
globalTimer.unref();
export function artifact(relative) { const normalized = relative.replace(/\\/g, '/'); if (!report.artifacts.includes(normalized)) report.artifacts.push(normalized); }
export function criterion(name, status, details = {}) { report.criteria[name] = { status, ...details }; }
export async function phase(name, fn, timeoutMs = phaseTimeoutMs) {
  const startedAt = new Date().toISOString(); const started = Date.now(); console.log(`[FINAL] ${name} START`); report.phases[name] = { startedAt, status: 'RUNNING' };
  try { let timer; const result = await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(`${name} exceeded ${timeoutMs}ms`), { errorCode: 'PHASE_TIMEOUT' })), timeoutMs); })]); clearTimeout(timer); report.phases[name] = { startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: 'PASS', error: null }; console.log(`[FINAL] ${name} PASS`); return result; }
  catch (error) { const details = { phase: name, errorCode: error?.errorCode || 'FAIL', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }; report.phases[name] = { startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: error?.errorCode === 'PHASE_TIMEOUT' ? 'TIMEOUT' : 'FAIL', error: details }; report.errors.push(details); console.error(`[FINAL] ${name} ${report.phases[name].status}: ${details.message}`); return null; }
}
/**
 * En Windows `shell: true` es necesario para resolver npm/npx/git, pero el
 * interprete cmd.exe parte la linea por espacios: un ejecutable con espacio en
 * la ruta (por ejemplo "C:\Program Files\nodejs\node.exe") falla con
 * `"C:\Program" no se reconoce como un comando`. Por eso se citan el comando y
 * los argumentos que contengan espacios.
 */
const needsQuoting = (value) => /[\s"^&|<>]/.test(value);
const quoteForShell = (value) => (needsQuoting(value) ? `"${value.replace(/"/g, '""')}"` : value);
export function run(command, args, cwd, timeoutMs = phaseTimeoutMs) { return new Promise((resolve, reject) => { const shell = process.platform === 'win32'; const child = spawn(shell ? quoteForShell(command) : command, shell ? args.map(quoteForShell) : args, { cwd, shell, env: { ...process.env, CI: '1' }, windowsHide: true }); let stdout = '', stderr = '', timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs); child.stdout?.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); }); child.stderr?.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); }); child.on('error', (error) => { clearTimeout(timer); reject(Object.assign(new Error(error.message), { errorCode: 'COMMAND_START_ERROR' })); }); child.on('close', (code) => { clearTimeout(timer); const result = { ok: !timedOut && code === 0, code, timedOut, stdout, stderr }; if (result.ok) resolve(result); else reject(Object.assign(new Error(`${command} ${args.join(' ')} exited ${code ?? 'with error'}`), { errorCode: timedOut ? 'PHASE_TIMEOUT' : 'COMMAND_FAILED' })); }); }); }
/**
 * Cuenta tests reales del runner, sin valores hardcodeados. Soporta el resumen de
 * `node --test` ("# pass 12" / prefijo con glifo) y el de Jest ("Tests: 24 passed").
 */
const TEST_SUMMARY = /^\s*(?:[#\u2139\u2714\u2716\u203a\u00b7]\s*)?(pass|fail|skipped)\s+(\d+)\s*$/i;
export function countTests(output) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const line of String(output).split(/\r?\n/)) {
    const summary = line.match(TEST_SUMMARY);
    if (summary) {
      const value = Number(summary[2]);
      if (/^pass$/i.test(summary[1])) passed += value;
      else if (/^fail$/i.test(summary[1])) failed += value;
      else skipped += value;
      continue;
    }
    const jest = line.match(/^Tests:\s+(.*)$/);
    if (jest) {
      passed += Number((jest[1].match(/(\d+)\s+passed/) || [])[1] || 0);
      failed += Number((jest[1].match(/(\d+)\s+failed/) || [])[1] || 0);
      skipped += Number((jest[1].match(/(\d+)\s+skipped/) || [])[1] || 0);
    }
  }
  return { passed, failed, skipped, parsed: passed + failed + skipped > 0 };
}
export async function readJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }

/**
 * La certificacion es un cliente de carga atypicamente alta: realiza cientos de
 * llamadas /api en pocos minutos. El limitador global del backend (500 por IP
 * cada 15 minutos) es una proteccion de produccion que NO se debe relajar para
 * que la certificacion pase. Lo correcto es arrancar la corrida con presupuesto
 * disponible: si la ventana heredada de una corrida anterior esta agotada, se
 * detiene con un error explicito en vez de producir fallos de producto falsos
 * por HTTP 429.
 */
const RATE_LIMIT_RESERVE = 250;
async function rateLimitBudget() {
  const response = await fetch('http://127.0.0.1:3001/api/categories', { signal: AbortSignal.timeout(10_000) });
  const remaining = Number(response.headers.get('ratelimit-remaining') ?? response.headers.get('x-ratelimit-remaining') ?? NaN);
  const limit = Number(response.headers.get('ratelimit-limit') ?? response.headers.get('x-ratelimit-limit') ?? NaN);
  if (response.status === 429) throw new Error('RATE_LIMITED: la API está limitando este cliente; espera a que expire la ventana de 15 minutos antes de certificar');
  if (Number.isFinite(remaining) && remaining < RATE_LIMIT_RESERVE) throw new Error(`RATE_LIMITED: quedan ${remaining} de ${Number.isFinite(limit) ? limit : '?'} peticiones en la ventana actual; la certificacion necesita al menos ${RATE_LIMIT_RESERVE}. Espera a que expire la ventana de 15 minutos`);
  return { remaining: Number.isFinite(remaining) ? remaining : null, limit: Number.isFinite(limit) ? limit : null, reserve: RATE_LIMIT_RESERVE };
}

export async function main() {
  await mkdir(path.resolve('qa/final-responsive'), { recursive: true });
  const preflight = await phase('PREFLIGHT', async () => {
    const backend = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5_000) }); if (!backend.ok) throw new Error(`Backend health HTTP ${backend.status}`);
    const frontend = await fetch('http://127.0.0.1:5173/', { signal: AbortSignal.timeout(5_000) }); if (!frontend.ok) throw new Error(`Frontend HTTP ${frontend.status}`);
    const chromeFree = await waitForPortFree(9333, 1_000); if (!chromeFree) throw new Error('CDP port 9333 occupied before run');
    const budget = await rateLimitBudget();
    return { backend: backend.status, frontend: frontend.status, chromePort: 9333, chromePortFree: true, rateLimit: budget };
  }, 30_000);
  criterion('preflight', preflight ? 'PASS' : 'FAIL', preflight || {});
  const browser = preflight ? await phase('BROWSER', () => run(process.execPath, ['qa/business-e2e.mjs'], process.cwd(), phaseTimeoutMs), phaseTimeoutMs) : null;
  const businessReport = await readJson(path.resolve('qa/business-e2e-report.json'));
  const sameRun = businessReport?.runId === runId;
  criterion('commerce', sameRun && businessReport?.commerceBrowserE2E && Object.values(businessReport.commerceBrowserE2E).filter((value) => ['PASS', 'FAIL'].includes(value)).every((value) => value === 'PASS') ? 'PASS' : 'FAIL', sameRun ? businessReport.commerceBrowserE2E : { error: 'Business report missing or runId mismatch' });
  criterion('business', sameRun && businessReport?.status === 'PASS' ? 'PASS' : 'FAIL', sameRun ? { report: 'qa/business-e2e-report.json', businessId: businessReport.businessId, slug: businessReport.slug, results: businessReport.results } : { error: 'Business report missing or runId mismatch' });
  const responsiveReport = await readJson(path.resolve('qa/final-responsive-report.json'));
  criterion('responsive', responsiveReport?.runId === runId && responsiveReport?.status === 'PASS' ? 'PASS' : 'FAIL', responsiveReport?.runId === runId ? responsiveReport : { error: 'Responsive report missing or runId mismatch' });
  const mpReport = await readJson(path.resolve('qa/mercado-pago-sandbox-report.json'));
  criterion('mercadoPagoSandbox', mpReport?.runId === runId && mpReport?.status === 'PASS' && mpReport?.productionPayment === false ? 'PASS' : 'FAIL', mpReport?.runId === runId ? { report: 'qa/mercado-pago-sandbox-report.json', status: mpReport.status, environment: mpReport.environment, productionPayment: mpReport.productionPayment } : { error: 'Mercado Pago report missing or runId mismatch' });

  const backendTypecheck = await phase('BACKEND_TYPECHECK', () => run('npm', ['run', 'typecheck'], path.resolve('backend'), 10 * 60_000), 11 * 60_000);
  criterion('backendTypecheck', backendTypecheck?.ok ? 'PASS' : 'FAIL', { exitCode: backendTypecheck?.code });
  const backendTests = await phase('BACKEND_TESTS', () => run('npm', ['test'], path.resolve('backend'), 15 * 60_000), 16 * 60_000);
  const backendCounts = countTests(`${backendTests?.stdout || ''}\n${backendTests?.stderr || ''}`); criterion('backendTests', backendTests?.ok ? 'PASS' : 'FAIL', { ...backendCounts, exitCode: backendTests?.code });
  const frontendTests = await phase('FRONTEND_TESTS', () => run('npm', ['test'], path.resolve('frontend'), 10 * 60_000), 11 * 60_000);
  const frontendCounts = countTests(`${frontendTests?.stdout || ''}\n${frontendTests?.stderr || ''}`); criterion('frontendTests', frontendTests?.ok ? 'PASS' : 'FAIL', { ...frontendCounts, exitCode: frontendTests?.code });
  const backendBuild = await phase('BACKEND_BUILD', () => run('npm', ['run', 'build'], path.resolve('backend'), 10 * 60_000), 11 * 60_000); criterion('backendBuild', backendBuild?.ok ? 'PASS' : 'FAIL', { exitCode: backendBuild?.code });
  const frontendBuild = await phase('FRONTEND_BUILD', () => run('npm', ['run', 'build'], path.resolve('frontend'), 10 * 60_000), 11 * 60_000); criterion('frontendBuild', frontendBuild?.ok ? 'PASS' : 'FAIL', { exitCode: frontendBuild?.code });
  const prisma = await phase('PRISMA_VALIDATE', () => run('npx', ['prisma', 'validate'], path.resolve('backend'), 5 * 60_000), 6 * 60_000); criterion('prisma', prisma?.ok ? 'PASS' : 'FAIL', { exitCode: prisma?.code });
  const diff = await phase('GIT_DIFF_CHECK', () => run('git', ['diff', '--check'], process.cwd(), 2 * 60_000), 3 * 60_000); criterion('gitDiffCheck', diff?.ok ? 'PASS' : 'FAIL', { exitCode: diff?.code, warnings: /LF|CRLF|warning/i.test(diff?.stderr || '') ? ['Line-ending warning observed'] : [] });
  const chromePortFree = await waitForPortFree(9333, 10_000); criterion('cleanup', sameRun && businessReport?.cleanup?.residual === 0 && chromePortFree ? 'PASS' : 'FAIL', { ...(businessReport?.cleanup || {}), chromePortFree });
  for (const file of ['qa/business-e2e-report.json', 'qa/final-responsive-report.json', 'qa/mercado-pago-sandbox-report.json']) artifact(file);
  for (const screenshot of [...(businessReport?.screenshots || []).map((item) => item.file), ...(responsiveReport?.screenshots || [])]) artifact(screenshot);
}

let reportWritten = false;
export async function writeFinal() {
  if (reportWritten) return; reportWritten = true; report.finishedAt = new Date().toISOString();
  const required = ['commerce', 'business', 'responsive', 'mercadoPagoSandbox', 'backendTypecheck', 'backendTests', 'frontendTests', 'backendBuild', 'frontendBuild', 'prisma', 'gitDiffCheck', 'cleanup'];
  // Cada criterio no PASS queda registrado como blocker explícito: el reporte y
  // la salida por consola deben nombrar la falla, nunca mostrarla vacía.
  for (const name of required) {
    const status = report.criteria[name]?.status;
    if (status === 'PASS') continue;
    if (report.errors.some((error) => error.phase === name)) continue;
    report.errors.push({ phase: name, errorCode: status || 'NOT_RUN', message: `criterio ${name} = ${status || 'NOT RUN'}`, timestamp: new Date().toISOString(), details: report.criteria[name] || null });
  }
  report.status = !forced && required.every((name) => report.criteria[name]?.status === 'PASS') ? 'READY' : 'NOT READY';
  artifact('qa/final-certification-report.json'); await writeFile(reportPath, JSON.stringify(report, null, 2));
}
try { await main(); }
catch (error) { report.errors.push({ phase: 'REPORT', errorCode: 'UNHANDLED_CERTIFICATION_ERROR', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }); }
finally {
  clearTimeout(globalTimer); await writeFinal().catch((error) => console.error('Final report write failed', error));
  const labels = [['commerce','Commerce'],['business','Business'],['responsive','Responsive'],['mercadoPagoSandbox','Mercado Pago Sandbox'],['backendTests','Backend Tests'],['frontendTests','Frontend Tests'],['backendBuild','Backend Build'],['frontendBuild','Frontend Build'],['prisma','Prisma'],['gitDiffCheck','Git Diff Check'],['cleanup','Cleanup']];
  console.log('\n========================================\nYESYES FINAL CERTIFICATION\n========================================'); for (const [key,label] of labels) console.log(`${label.padEnd(28)} ${report.criteria[key]?.status || 'NOT RUN'}`); console.log(`\nFINAL STATUS: ${report.status}`); if (report.status !== 'READY') { console.log('BLOCKERS:'); for (const error of report.errors) console.log(`- ${error.phase}: ${error.message}`); } console.log('========================================'); process.exitCode = report.status === 'READY' ? 0 : 1;
}
process.on('unhandledRejection', (error) => report.errors.push({ phase: 'GLOBAL', errorCode: 'UNHANDLED_REJECTION', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }));


