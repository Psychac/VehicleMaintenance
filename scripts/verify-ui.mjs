// DESIGN.md S13 / S11 verifier. Drives headless Edge/Chrome over CDP against a running build.
//   npx vite build && npx vite preview --port 5198      (production build: what perf should measure)
//   node scripts/verify-ui.mjs [baseUrl] [outJson]
// Seeds data through the app's own Restore flow, then audits every screen and sheet.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5198';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'verify-ui.json');
const BROWSERS = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ seed backup */
function seedFile() {
  const id = () => crypto.randomUUID();
  const v = id();
  const d = (back) => { const t = new Date(Date.now() - back * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const fuel = Array.from({ length: 60 }, (_, i) => ({ id: id(), vehicle_id: v, date: d(700 - i * 11), odometer: 30000 + i * 420, litres: 24 + (i % 7), total_cost: 2400 + (i % 9) * 90, full_tank: i % 8 !== 3, remaining_litres: null, station: i % 3 ? 'Shell' : null, notes: null }));
  const cats = ['service', 'repair', 'tyres', 'insurance', 'other'];
  const service = Array.from({ length: 14 }, (_, i) => ({ id: id(), vehicle_id: v, date: d(650 - i * 45), odometer: 30000 + i * 1800, category: cats[i % 5], title: ['10,000 km service', 'Brake pads', 'Tyres', 'Insurance', 'Wipers'][i % 5], cost: 1500 + i * 310, vendor: i % 2 ? 'City garage' : null, notes: null }));
  const reminders = [
    { title: 'Engine oil & filter', interval_km: 5000, interval_months: 6, last_done_date: d(200), last_done_odometer: 51000 },
    { title: 'Insurance renewal', interval_km: null, interval_months: 12, last_done_date: d(340), last_done_odometer: null },
    { title: 'Tyre rotation', interval_km: 10000, interval_months: null, last_done_date: d(60), last_done_odometer: 54000 },
    { title: 'Coolant', interval_km: 40000, interval_months: null, last_done_date: null, last_done_odometer: null },
  ].map((r) => ({ id: id(), vehicle_id: v, notes: null, ...r }));
  const vehicles = [{ id: v, name: 'Family car', make: 'Honda', model: 'City', year: 2019, plate: 'KA01AB1234', fuel_type: 'petrol', start_odometer: 30000, archived: false }];
  const file = path.join(os.tmpdir(), 'verify-seed.json');
  fs.writeFileSync(file, JSON.stringify({ app: 'vehicle-log', version: 1, exported_at: new Date().toISOString(), data: { vehicles, fuel_logs: fuel, service_logs: service, reminders } }));
  return file;
}

/* ------------------------------------------------------------ CDP session */
async function launch(opts) {
  const port = 9800 + Math.floor(Math.random() * 150);
  const exe = BROWSERS.find((b) => fs.existsSync(b));
  const proc = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', `--user-data-dir=${path.join(os.tmpdir(), 'vu' + port)}`, 'about:blank'], { stdio: 'ignore' });
  let t;
  for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch { /* retry */ } await sleep(200); }
  const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0; const pend = new Map();
  const errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 400)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' ').slice(0, 400)); pend.get(d.id)?.(d); pend.delete(d.id); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++n; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result; if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: opts.width, height: opts.height ?? 844, deviceScaleFactor: 2, mobile: opts.width < 600 });
  if (opts.width < 600) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const feats = [{ name: 'prefers-color-scheme', value: opts.dark ? 'dark' : 'light' }];
  if (opts.reduced) feats.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  await send('Emulation.setEmulatedMedia', { features: feats });
  if (opts.cpu) await send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__cls = 0; window.__lcp = 0; window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
    ${opts.fontScale ? `document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '${opts.fontScale}%'; });` : ''}
  ` });
  const close = () => { try { ws.close(); proc.kill(); } catch { /* gone */ } };
  return { send, ev, close, errors };
}

/* ------------------------------------------------------------ in-page audit */
const AUDIT = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const inActiveLayer = (e) => !e.closest('[aria-hidden="true"]');
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.title || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  const where = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ' "' + label(e) + '"';
  const parse = (s) => { const m = s.match(/[\\d.]+/g); if (!m) return null; const [r, g, b, a] = m.map(Number); return { r, g, b, a: a === undefined ? 1 : a }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of stack.reverse()) base = over(c, base); return base; };
  const out = { overflowX: document.documentElement.scrollWidth - innerWidth, small: [], unlabeled: [], contrast: [], fonts: {}, clipped: [], noFocusRing: 0 };
  const targets = document.querySelectorAll('button, a[href], [role=button], [role=menuitem], select, textarea, input:not([type=hidden]):not(.ui-toggle-input), summary');
  for (const e of targets) {
    if (!vis(e) || !inActiveLayer(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) out.small.push(where(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if ((e.tagName === 'BUTTON' || e.tagName === 'A') && !label(e)) out.unlabeled.push(where(e));
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) && !e.getAttribute('aria-label') && !(e.id && document.querySelector('label[for="' + e.id + '"]')) && !e.closest('label')) out.unlabeled.push(where(e));
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; const e = t.parentElement;
    if (!t.textContent.trim() || seen.has(e) || !vis(e) || !inActiveLayer(e) || e.closest('svg,script,style,.ui-sr-only,.ui-roll-strip')) continue;
    seen.add(e);
    const cs = getComputedStyle(e); const px = Math.round(parseFloat(cs.fontSize) * 100) / 100;
    out.fonts[px] = (out.fonts[px] || 0) + 1;
    if (e.closest(':disabled,[aria-disabled]')) continue;
    let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    if (op < 0.99) continue;
    const bg = bgOf(e); const fg = over(parse(cs.color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const ratio = (a + 0.05) / (b + 0.05);
    const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) out.contrast.push(where(e) + ' ' + ratio.toFixed(2));
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && !e.closest('.ui-sheet-body,.ui-toast')) out.clipped.push(where(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  }
  return JSON.stringify(out);
})()`;

const ALLOWED_PX = new Set([11, 12, 13, 15, 16, 17, 20, 22, 28, 34]);

/* ------------------------------------------------------------ run helpers */
async function waitFor(ev, expr, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr).catch(() => false)) return true; await sleep(100); } return false; }
const clickText = (ev, text, scope = 'document') => ev(`(()=>{const b=[...${scope}.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)}&&!x.disabled&&x.offsetParent!==null);if(!b)return false;b.click();return true})()`);

async function seed(s) {
  await s.send('Page.navigate', { url: BASE + '/#more/backup' });
  await waitFor(s.ev, `!!document.querySelector('input[type=file]')`);
  const { root } = (await s.send('DOM.getDocument')).result;
  const { nodeId } = (await s.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })).result;
  await s.send('DOM.setFileInputFiles', { nodeId, files: [seedFile()] });
  await waitFor(s.ev, `!!document.querySelector('[role=dialog]')`);
  await sleep(500);
  const clicked = await clickText(s.ev, 'Restore backup', "document.querySelector('[role=dialog]')");
  const closed = await waitFor(s.ev, `!document.querySelector('[role=dialog]')`);
  await sleep(800);
  if (process.env.DEBUG) console.log('seed: restore clicked', clicked, 'dialog closed', closed, '| vehicles visible:', await s.ev('document.body.innerText.slice(0,80)'));
}

async function audit(s, name) {
  const r = JSON.parse(await s.ev(AUDIT));
  r.name = name;
  r.badFonts = Object.keys(r.fonts).filter((k) => !ALLOWED_PX.has(Number(k)));
  r.cls = await s.ev('window.__cls');
  return r;
}

const SCREENS = [
  ['home', '#home'], ['log/fuel', '#log'], ['log/service', '#log', 'Service'], ['reminders', '#reminders'],
  ['more', '#more'], ['reports', '#more/reports'], ['vehicles', '#more/vehicles'], ['backup', '#more/backup'], ['storage', '#more/storage'],
];

async function go(s, hash, then) {
  await s.ev(`location.hash=${JSON.stringify(hash)}`);
  await sleep(1000);
  if (then) { await clickText(s.ev, then); await sleep(700); }
}

async function auditAll(s, label) {
  const res = [];
  for (const [name, hash, then] of SCREENS) { await go(s, hash, then); res.push(await audit(s, `${label} ${name}`)); }
  // Sheets
  await go(s, '#home');
  await clickText(s.ev, 'Add fill-up'); await sleep(900); res.push(await audit(s, `${label} sheet:add-fill-up`));
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700);
  await go(s, '#reminders');
  await s.ev(`document.querySelector('button.ui-row').click()`); await sleep(900); res.push(await audit(s, `${label} sheet:reminder-detail`));
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700);
  await go(s, '#home');
  await s.ev(`[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Switch vehicle')&&b.getBoundingClientRect().width>0).click()`); await sleep(900); res.push(await audit(s, `${label} sheet:vehicle-picker`));
  return res;
}

/* ------------------------------------------------------------ perf */
/** A real touch tap (counts as user input for layout-shift attribution). */
async function tap(s, selectorExpr) {
  const p = JSON.parse(await s.ev(`(()=>{const b=${selectorExpr};const r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const tabBtn = (name) => `[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes(${JSON.stringify(name)})&&x.getBoundingClientRect().width>0)`;
async function perf(s) {
  const out = {};
  // cold start: navigation → first meaningful content, LCP, CLS
  await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  const t0 = Date.now();
  await s.send('Page.navigate', { url: BASE + '/#home' });
  await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 15000);
  out.coldToContentMs = Date.now() - t0;
  await sleep(1500);
  out.lcpMs = Math.round(await s.ev('window.__lcp'));
  out.clsLoad = +(await s.ev('window.__cls')).toFixed(4);

  // Frame recorder that runs in the page; every tap below is a real touch event.
  await s.ev(`window.__rec=(on)=>{if(on){window.__fr=[];let l=performance.now();const t=(n)=>{window.__fr.push(n-l);l=n;if(window.__recOn)requestAnimationFrame(t)};window.__recOn=true;requestAnimationFrame(t)}else{window.__recOn=false;return window.__fr.slice(2)}};1`);

  // tap -> first visual change, and frame pacing per tab (real taps)
  out.tapToNavMs = [];
  out.perTab = {};
  for (const tab of ['Log', 'Reminders', 'Home', 'More', 'Home', 'Log', 'Reminders', 'More']) {
    await s.ev('window.__rec(true)');
    const before = await s.ev('location.hash');
    const t = Date.now();
    await tap(s, tabBtn(tab));
    await waitFor(s.ev, `location.hash!==${JSON.stringify(before)}`, 3000);
    out.tapToNavMs.push(Date.now() - t);
    await sleep(700);
    const d = await s.ev('window.__rec(false)');
    const key = tab + (out.perTab[tab] ? ' (2nd)' : '');
    out.perTab[key] = { maxFrameMs: Math.round(Math.max(...d)), over33: d.filter((x) => x > 33.4).length };
    await sleep(200);
  }

  // touch-down -> visual: press state is set synchronously in the pointerdown handler
  await go(s, '#log');
  await waitFor(s.ev, `!!document.querySelector('.action-bar .ui-btn')`);
  const p = JSON.parse(await s.ev(`(()=>{const b=document.querySelector('.action-bar .ui-btn');const r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  out.pressedOnTouchDown = await s.ev(`document.querySelector('.action-bar .ui-btn').hasAttribute('data-pressed')`);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900);
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(600);

  // scroll a 60-row list
  await go(s, '#log');
  await waitFor(s.ev, `document.querySelectorAll('.ui-row-item').length>20`);
  await s.ev('window.__rec(true)');
  await s.ev(`new Promise((resolve)=>{const max=document.documentElement.scrollHeight-innerHeight;const t0=performance.now();const tick=(n)=>{const k=Math.min(1,(n-t0)/1800);scrollTo(0,max*(k<.5?k*2:2-k*2));if(n-t0<2400)requestAnimationFrame(tick);else resolve(1)};requestAnimationFrame(tick)})`);
  const nums = await s.ev('window.__rec(false)');
  const sorted = [...nums].sort((x, y) => x - y);
  out.scroll = { rows: await s.ev(`document.querySelectorAll('.ui-row-item').length`), frames: nums.length, p50: +sorted[Math.floor(sorted.length * 0.5)].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), max: +sorted[sorted.length - 1].toFixed(1), over33: nums.filter((x) => x > 33.4).length };
  out.longTasks = await s.ev('window.__long');
  out.clsTotal = +(await s.ev('window.__cls')).toFixed(4);
  return out;
}

/* ------------------------------------------------------------ main */
const report = { base: BASE, runs: {} };
const configs = process.env.PERF_ONLY ? {} : {
  'phone-390-light': { width: 390 },
  'phone-390-dark': { width: 390, dark: true },
  'phone-320-light': { width: 320 },
  'desktop-1100-light': { width: 1100, height: 800 },
  'phone-390-textx2': { width: 390, fontScale: 200 },
};
for (const [name, cfg] of Object.entries(configs)) {
  const s = await launch(cfg);
  try {
    await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
    const emptyAudit = name === 'phone-390-light' ? [await audit(s, 'empty:no-vehicle home')] : [];
    await seed(s);
    report.runs[name] = { empty: emptyAudit, screens: await auditAll(s, name) };
  } catch (e) { report.runs[name] = { error: String(e) }; }
  s.close();
}
// Perf on a throttled CPU (4x ≈ mid-range phone), seeded, production build.
{
  const s = await launch({ width: 390, cpu: 4 });
  try { await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500); await seed(s); report.perf4x = await perf(s); } catch (e) { report.perf4x = { error: String(e) }; }
  s.close();
}
{
  const s = await launch({ width: 390 });
  try { await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500); await seed(s); report.perf1x = await perf(s); } catch (e) { report.perf1x = { error: String(e.stack || e), pageErrors: s.errors }; }
  s.close();
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log('wrote', OUT);
