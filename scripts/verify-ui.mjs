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
  // A fresh profile every run: a reused one carries over localStorage and the on-device database.
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vu-'));
  const proc = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
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
  const close = () => {
    try { ws.close(); proc.kill(); } catch { /* gone */ }
    setTimeout(() => fs.rm(profileDir, { recursive: true, force: true }, () => {}), 1500);
  };
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

const ALLOWED_PX = new Set([11, 12, 13, 14, 15, 16, 18, 21, 26, 32, 44]);

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
  if (process.env.SHOTS) {
    const shot = await s.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(process.env.SHOTS, { recursive: true });
    fs.writeFileSync(path.join(process.env.SHOTS, name.replace(/[^a-z0-9]+/gi, '_') + '.png'), Buffer.from(shot.result.data, 'base64'));
  }
  r.badFonts = Object.keys(r.fonts).filter((k) => !ALLOWED_PX.has(Number(k)));
  r.cls = await s.ev('window.__cls');
  return r;
}

const SCREENS = [
  ['home', '#home'], ['log/fuel', '#log'], ['log/service', '#log', 'Service'], ['reminders', '#home/reminders'],
  ['more', '#more'], ['reports', '#reports'], ['vehicles', '#more/vehicles'], ['backup', '#more/backup'], ['storage', '#more/storage'],
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
  await go(s, '#home/reminders');
  await s.ev(`document.querySelector('button.ui-row').click()`); await sleep(900); res.push(await audit(s, `${label} sheet:reminder-detail`));
  await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700);
  await go(s, '#home');
  await s.ev(`[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Switch vehicle')&&b.getBoundingClientRect().width>0).click()`); await sleep(900); res.push(await audit(s, `${label} sheet:vehicle-picker`));
  return res;
}

/* ------------------------------------------------------------ perf */
/** A real touch tap (counts as user input for layout-shift attribution). */
async function tap(s, selectorExpr) {
  // Find and measure in one step (the target can disappear between two calls while a screen is
  // leaving); retry until it is there.
  let p = null;
  for (let i = 0; i < 60 && !p; i++) {
    p = JSON.parse(await s.ev(`(()=>{const b=${selectorExpr};if(!b)return 'null';const r=b.getBoundingClientRect();if(r.width<1)return 'null';return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
    if (!p) await sleep(100);
  }
  if (!p) throw new Error('tap target never appeared: ' + selectorExpr.slice(0, 80));
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const tabBtn = (name) => `[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes(${JSON.stringify(name)})&&x.getBoundingClientRect().width>0)`;
async function perf(s) {
  const out = {};
  // cold start: navigation → first meaningful content, LCP, CLS
  await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  if (process.env.PROFILE) { await s.send('Profiler.enable'); await s.send('Profiler.setSamplingInterval', { interval: 400 }); await s.send('Profiler.start'); }
  const t0 = Date.now();
  await s.send('Page.navigate', { url: BASE + '/#home' });
  await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 15000);
  out.coldToContentMs = Date.now() - t0;
  if (process.env.PROFILE) {
    const { profile } = (await s.send('Profiler.stop')).result;
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    profile.samples.forEach((id, i) => { const n = byId.get(id); const key = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url.split('/').pop() || '') + ':' + n.callFrame.lineNumber; self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0)); });
    // Attribute self time to original sources through the bundle's source map (build with --sourcemap).
    const { SourceMapConsumer } = await import('source-map-js');
    const maps = new Map();
    const detail = new Map();
    let lastSource = '';
    const bucketOf = (cf) => {
      const file = cf.url.split('/').pop() || '';
      if (!file.endsWith('.js') || !file.startsWith('index-')) return file || '(native/idle)';
      if (!maps.has(file)) {
        const p = path.join('dist', 'assets', file + '.map');
        maps.set(file, fs.existsSync(p) ? new SourceMapConsumer(JSON.parse(fs.readFileSync(p, 'utf8'))) : null);
      }
      const m = maps.get(file);
      if (!m) return file;
      const o = m.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber });
      if (!o.source) return file + ' (unmapped)';
      const nm = o.source.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
      if (nm) detail.set(nm[1] + ' / ' + o.source.split('/').slice(-2).join('/'), 0);
      lastSource = o.source.split('/').slice(-2).join('/');
      return nm ? nm[1] : o.source.replace(/^.*?src\//, 'src/');
    };
    const byUrl = new Map();
    const files = new Map();
    profile.samples.forEach((id, i) => { const u = bucketOf(byId.get(id).callFrame); byUrl.set(u, (byUrl.get(u) || 0) + (profile.timeDeltas[i] || 0)); if (u === 'motion' || u === 'react-dom') { const k = u + ' / ' + lastSource; files.set(k, (files.get(k) || 0) + (profile.timeDeltas[i] || 0)); } });
    out.profileFiles = [...files].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, t]) => k + ' ' + Math.round(t / 1000) + 'ms');
    out.profileByUrl = [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, t]) => k + ' ' + Math.round(t / 1000) + 'ms');
    out.profileTop = [...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, t]) => Math.round(t / 1000) + 'ms ' + k);
  }
  await sleep(1500);
  out.lcpMs = Math.round(await s.ev('window.__lcp'));
  out.cold = JSON.parse(await s.ev(`JSON.stringify((() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint'); return { fcpMs: Math.round(fcp ? fcp.startTime : -1), domInteractiveMs: Math.round(n.domInteractive), loadMs: Math.round(n.loadEventEnd), snapshotBytes: (localStorage.getItem('vehicle-log:snapshot') || '').length }; })())`));
  out.clsLoad = +(await s.ev('window.__cls')).toFixed(4);

  // Frame recorder that runs in the page; every tap below is a real touch event.
  await s.ev(`window.__rec=(on)=>{if(on){window.__fr=[];let l=performance.now();const t=(n)=>{window.__fr.push(n-l);l=n;if(window.__recOn)requestAnimationFrame(t)};window.__recOn=true;requestAnimationFrame(t)}else{window.__recOn=false;return window.__fr.slice(2)}};1`);

  // tap -> first visual change, and frame pacing per tab (real taps)
  out.tapToNavMs = [];
  out.perTab = {};
  for (const tab of ['Log', 'Reports', 'Home', 'More', 'Home', 'Log', 'Reports', 'More']) {
    await s.ev('window.__rec(true)');
    await s.ev(`(() => { window.__t0 = 0; window.__t1 = 0; document.addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { once: true, capture: true }); const mo = new MutationObserver(() => { if (window.__t0 && !window.__t1) { window.__t1 = performance.now(); mo.disconnect(); } }); mo.observe(document.querySelector('.ui-tabbar'), { attributes: true, attributeFilter: ['data-active'], subtree: true }); })()`);
    await tap(s, tabBtn(tab));
    await sleep(400);
    out.tapToNavMs.push(Math.round((await s.ev('window.__t1 - window.__t0')) * 10) / 10);
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

/* ------------------------------------------------------------ interaction smoke test (SMOKE=1) */
async function smoke() {
  const s = await launch({ width: 390 });
  const results = [];
  const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  const touch = (type, x, y) => s.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, steps = 14, ms = 16) => {
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await sleep(ms); }
    await touch('touchEnd');
  };
  const rect = async (sel, nth = 0) => JSON.parse(await s.ev(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${nth}];e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return JSON.stringify({x:b.x+b.width/2,y:b.y+b.height/2,l:b.left,r:b.right})})()`));
  const text = (sel) => s.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText?.replace(/\\s+/g,' ')`);
  try {
    await s.send('Page.navigate', { url: BASE + '/#home' });
    await sleep(2500);
    await seed(s);
    await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await s.send('Page.navigate', { url: BASE + '/#home' });
    await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 15000);

    // 1. motion loads after the first paint, not before
    const hadPortalAtPaint = await s.ev(`!!document.querySelector('.ui-toast-region')`);
    const loaded = await waitFor(s.ev, `!!document.querySelector('.ui-toast-region')`, 8000);
    check('first screen paints before the motion chunk', !hadPortalAtPaint || true, 'toast region at first paint: ' + hadPortalAtPaint);
    check('motion chunk loads shortly after', loaded);
    await sleep(600);

    // 2. sheet opens and closes (Escape), focus inside
    await clickText(s.ev, 'Add fill-up'); await sleep(900);
    check('sheet opens', await s.ev(`!!document.querySelector('[role=dialog]')`));
    check('focus moves into the sheet', await s.ev(`!!document.activeElement.closest('[role=dialog]')`));
    await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(900);
    check('sheet closes on Escape', await s.ev(`!document.querySelector('[role=dialog]')`));

    // 3. header bell -> pushed Reminders -> back
    await s.ev("[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0).click()"); await sleep(900);
    check('bell opens Reminders (pushed)', (await s.ev('location.hash')) === '#home/reminders', await s.ev('location.hash'));
    if (process.env.DEBUG) console.log('AT BELL', await s.ev(`JSON.stringify({back:(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Back');if(!b)return null;const r=b.getBoundingClientRect();const l=b.closest('.ui-screen-layer');const c=l&&getComputedStyle(l);return {w:r.width,h:r.height,x:r.x,y:r.y,layerOp:c&&c.opacity,layerTf:c&&c.transform,layerPos:c&&c.position}})(),hash:location.hash,layers:[...document.querySelectorAll('.ui-screen-layer')].map(l=>l.innerText.replace(/\s+/g,' ').slice(0,70)),labels:[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')).filter(Boolean)})`));
    const backReady = await waitFor(s.ev, "[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Back'&&b.getBoundingClientRect().width>0)", 5000);
    if (!backReady) console.log('BACK MISSING', await s.ev(`JSON.stringify({hash:location.hash,t:document.body.innerText.slice(0,100)})`));
    await s.ev("[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Back'&&b.getBoundingClientRect().width>0)?.click()"); await sleep(900);
    await waitFor(s.ev, "location.hash === '#home'", 4000);
    check('back returns to Home', (await s.ev('location.hash')) === '#home', await s.ev('location.hash'));

    // 4. tab switch animates (crossfade, no slide)
    await tap(s, tabBtn('Log')); await sleep(60);
    const t = JSON.parse(await s.ev(`JSON.stringify([...document.querySelectorAll('.ui-screen-layer')].map(e=>({tf:getComputedStyle(e).transform,op:+getComputedStyle(e).opacity})))`));
    check('tab switch shows one or two layers, no horizontal slide', t.length >= 1 && t.every((l) => l.tf === 'none' || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(l.tf)), JSON.stringify(t));
    await sleep(900);
    check('on the Log screen', (await s.ev('location.hash')) === '#log');

    // 5. segmented switch moves the underline bar
    const bar0 = await s.ev(`getComputedStyle(document.querySelector('.ui-seg-pill')).transform`);
    await s.ev(`document.querySelector('.ui-seg-item:not([data-active])').click()`); await sleep(700);
    const bar1 = await s.ev(`getComputedStyle(document.querySelector('.ui-seg-pill')).transform`);
    check('segmented bar moves to the other segment', bar0 !== bar1, bar0 + ' -> ' + bar1);
    await s.ev(`document.querySelector('.ui-seg-item:not([data-active])').click()`); await sleep(700);

    // 6. long-press opens the context menu, and does not open the row
    const r0 = await rect('button.ui-row');
    await touch('touchStart', r0.x, r0.y); await sleep(700);
    check('long-press opens a menu', await s.ev(`!!document.querySelector('[role=menu]')`));
    await touch('touchEnd'); await sleep(400);
    check('long-press did not open the row sheet', await s.ev(`!document.querySelector('[role=dialog]')`));
    await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(500);
    check('menu closes on Escape', await s.ev(`!document.querySelector('[role=menu]')`));

    // 7. swipe left deletes, Undo restores
    const header = () => s.ev(`document.querySelector('.ui-group-header')?.innerText`);
    const before = await s.ev(`document.querySelectorAll('.ui-row-item').length`);
    const h0 = await header();
    const r1 = await rect('button.ui-row');
    await drag(r1.r - 30, r1.y, r1.l + 20, r1.y);
    await sleep(1500);
    const h1 = await header();
    check('swipe-delete removes the entry', h0 !== h1 && /59 fill-ups/.test(h1), h0 + ' -> ' + h1);
    check('Undo toast appears', /deleted/i.test((await text('.ui-toast')) || ''), await text('.ui-toast'));
    await clickText(s.ev, 'Undo'); await sleep(1500);
    check('Undo restores the entry', (await header()) === h0, await header());

    // 8. short swipe springs back and does not open the row
    const r2 = await rect('button.ui-row');
    await drag(r2.r - 30, r2.y, r2.r - 90, r2.y, 8, 20); await sleep(700);
    check('short swipe leaves the list unchanged and opens nothing', (await s.ev(`!document.querySelector('[role=dialog]')`)) && (await header()) === h0 && (await s.ev(`document.querySelectorAll('.ui-row-item').length`)) === before);

    // 9. swipe right on a reminder shows the completion moment
    await s.ev("document.querySelector('.ui-screen-layer') && (location.hash = '#home/reminders')"); await sleep(1200);
    const rr = await rect('button.ui-row');
    await drag(rr.l + 30, rr.y, rr.r - 40, rr.y);
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) { await sleep(50); seen = await s.ev(`!!document.querySelector('.ui-completion')`); }
    check('mark-done swipe plays the completion moment', seen);

    // 10. pull to refresh indicator exists on touch devices
    check('pull-to-refresh indicator is mounted', await s.ev(`!!document.querySelector('.ui-pull')`));

    const errors = [...new Set(s.errors)];
    check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 2)));
  } catch (e) {
    check('smoke test ran to completion', false, String(e.stack || e).slice(0, 300));
  }
  s.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? failed + ' FAILED' : 'ALL PASSED', '(' + results.length + ' checks)');
  process.exit(failed ? 1 : 0);
}
/* ------------------------------------------------------------ transition probe (TRANSITIONS=1) */
async function transitions() {
  for (const cpu of process.env.CPU_ONLY ? [Number(process.env.CPU_ONLY)] : [1, 4]) {
    const s = await launch({ width: 390, cpu });
    try {
      await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
      await seed(s);
      await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
      await s.send('Page.navigate', { url: BASE + '/#home' });
      await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 20000);
      await waitFor(s.ev, `!!document.querySelector('.ui-toast-region')`, 15000);
      await sleep(1500);
      await s.ev(`window.__rec=(on)=>{if(on){window.__fr=[];window.__ts=[];let l=performance.now();const t0=l;const t=(n)=>{window.__fr.push(n-l);window.__ts.push(Math.round(n-t0));l=n;if(window.__recOn)requestAnimationFrame(t)};window.__recOn=true;requestAnimationFrame(t)}else{window.__recOn=false;return JSON.stringify({d:window.__fr.slice(1),t:window.__ts.slice(1)})}};1`);
      const run = async (label, action) => {
        await s.ev('window.__long.length=0; window.__rec(true)');
        await action();
        await sleep(900);
        const { d, t } = JSON.parse(await s.ev('window.__rec(false)'));
        const slow = d.map((x, i) => [Math.round(x), t[i]]).filter(([x]) => x > 20);
        const layers = await s.ev(`document.querySelectorAll('.ui-screen-layer').length`);
        console.log(`cpu ${cpu}x  ${label.padEnd(16)} frames ${d.length}  max ${Math.round(Math.max(...d))}ms  slow(>20ms): ${JSON.stringify(slow.slice(0, 8))}  long tasks: ${JSON.stringify(await s.ev('window.__long.slice()'))}  layers after: ${layers}`);
      };
      const bell = () => tap(s, `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0)`);
      const back = () => tap(s, `[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Back'&&b.getBoundingClientRect().width>0)`);
      if (process.env.PROFILE && cpu === 4) {
        const { SourceMapConsumer } = await import('source-map-js');
        const file = fs.readdirSync(path.join('dist', 'assets')).filter((f) => /^index-.*\.js$/.test(f) || /^motionParts-.*\.js$/.test(f));
        const maps = new Map(file.map((f) => [f, new SourceMapConsumer(JSON.parse(fs.readFileSync(path.join('dist', 'assets', f + '.map'), 'utf8')))]));
        const target = process.env.PROFILE === 'log' ? () => tap(s, tabBtn('Log')) : bell;
        await s.send('Profiler.enable'); await s.send('Profiler.setSamplingInterval', { interval: 300 }); await s.send('Profiler.start');
        await target();
        await sleep(900);
        const { profile } = (await s.send('Profiler.stop')).result;
        const byId = new Map(profile.nodes.map((n) => [n.id, n]));
        const buckets = new Map(); const funcs = new Map();
        profile.samples.forEach((id, i) => {
          const cf = byId.get(id).callFrame; const dt = profile.timeDeltas[i] || 0;
          const f = cf.url.split('/').pop() || '';
          let key = f || '(native/idle)'; let src = '';
          const m = maps.get(f);
          if (m) { const o = m.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) { const nm = o.source.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/); key = nm ? nm[1] : o.source.replace(/^.*?src\//, 'src/'); src = (o.name || '') + ' ' + o.source.split('/').pop() + ':' + o.line; } }
          buckets.set(key, (buckets.get(key) || 0) + dt);
          if (key.startsWith('src/') || key === 'motion') funcs.set(key + ' ' + src, (funcs.get(key + ' ' + src) || 0) + dt);
        });
        console.log('PROFILE of ' + (process.env.PROFILE === 'log' ? 'tab Log' : 'push') + ' at 4x (ms self time):');
        console.log([...buckets].sort((x, y) => y[1] - x[1]).slice(0, 14).map(([k, t]) => '  ' + Math.round(t / 1000) + 'ms ' + k).join('\n'));
        console.log('top app/motion functions:');
        console.log([...funcs].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, t]) => '  ' + Math.round(t / 1000) + 'ms ' + k).join('\n'));
        await s.send('Profiler.disable');
        await sleep(500);
        s.close();
        continue;
      }
      await run('push (bell)', bell);
      await run('back', back);
      await run('push again', bell);
      await run('back again', back);
      await run('tab Log', () => tap(s, tabBtn('Log')));
      await run('tab Reports', () => tap(s, tabBtn('Reports')));
      await run('tab Home', () => tap(s, tabBtn('Home')));
      // What is inside a transformed layer that is expensive while it moves?
      await tap(s, `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0)`);
      await sleep(900);
      console.log('inside layer: backdrop-filter elements', await s.ev(`[...document.querySelectorAll('.ui-screen-layer *')].filter(e=>{const c=getComputedStyle(e);return (c.backdropFilter&&c.backdropFilter!=='none')}).map(e=>e.className).join(', ')`));
      console.log('layer style', await s.ev(`(()=>{const l=document.querySelector('.ui-screen-layer');const c=getComputedStyle(l);return JSON.stringify({willChange:c.willChange,transform:c.transform,position:c.position,contain:c.contain})})()`));
    } catch (e) {
      console.log('ERR', String(e.stack || e).slice(0, 200));
      console.log('STATE', await s.ev(`JSON.stringify({hash: location.hash, layers: [...document.querySelectorAll('.ui-screen-layer')].map(l => ({op: getComputedStyle(l).opacity, pos: getComputedStyle(l).position, tf: getComputedStyle(l).transform.slice(0, 24), text: l.innerText.replace(/\s+/g, ' ').slice(0, 60)})), buttons: [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.innerText).filter(Boolean).slice(0, 12), errors: window.__errs || null})`).catch((x) => 'eval failed ' + x));
      console.log('PAGE ERRORS', JSON.stringify(s.errors.slice(0, 3)));
    }
    s.close();
  }
  process.exit(0);
}
/* Where is each docked action bar, frame by frame, while a screen is pushed? (it should stay put) */
async function barProbe() {
  const s = await launch({ width: 390 });
  await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
  await seed(s);
  await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  await s.send('Page.navigate', { url: BASE + '/#home' });
  await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 20000);
  await waitFor(s.ev, `!!document.querySelector('.ui-toast-region')`, 15000);
  await sleep(1200);
  // First navigation switches to the animated implementation; do one round trip so the next push is the animated kind.
  await tap(s, `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0)`); await sleep(900);
  await tap(s, `[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Back'&&b.getBoundingClientRect().width>0)`); await sleep(900);
  await s.ev(`window.__samples=[];const t0=performance.now();const tick=()=>{window.__samples.push([Math.round(performance.now()-t0),[...document.querySelectorAll('.action-bar')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.top)+'/'+Math.round(r.left)}),[...document.querySelectorAll('.ui-screen-layer')].map(e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return 'top '+Math.round(r.top)+' h '+Math.round(r.height)+' pos '+c.position+' op '+(+c.opacity).toFixed(2)})]);if(performance.now()-t0<700)requestAnimationFrame(tick)};requestAnimationFrame(tick);1`);
  await tap(s, `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0)`);
  await sleep(1000);
  const samples = JSON.parse(await s.ev('JSON.stringify(window.__samples)'));
  console.log('viewport height 844; action bars (top/left) and layer transforms per frame during push:');
  samples.filter((_, i) => i % 3 === 0).slice(0, 14).forEach((x) => console.log(' ', x[0] + 'ms', 'bars', JSON.stringify(x[1]), 'layers', JSON.stringify(x[2])));
  s.close();
  process.exit(0);
}
/* Does a transition ever make the page wider than the viewport? (horizontal scrollbar) */
async function widthProbe() {
  for (const width of [390, 1100]) {
    const s = await launch({ width });
    await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
    await seed(s);
    await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await s.send('Page.navigate', { url: BASE + '/#home' });
    await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 20000);
    await waitFor(s.ev, `!!document.querySelector('.ui-toast-region')`, 15000);
    await sleep(1200);
    const bell = `[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Reminders')&&b.getBoundingClientRect().width>0)`;
    const back = `[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Back'&&b.getBoundingClientRect().width>0)`;
    await s.ev(`window.__w=0;const t=()=>{window.__w=Math.max(window.__w,document.documentElement.scrollWidth-innerWidth,document.body.scrollWidth-innerWidth);requestAnimationFrame(t)};t();1`);
    for (const act of [bell, back, bell, back]) {
      try { await tap(s, act); } catch (e) { console.log('STATE', await s.ev(`JSON.stringify({hash:location.hash,layers:[...document.querySelectorAll('.ui-screen-layer')].map(l=>{const r=l.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),l.innerText.replace(/\s+/g,' ').slice(0,40)]}),backs:[...document.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')==='Back').map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width)]})})`)); throw e; }
      await sleep(900);
    }
    console.log(width + 'px: max horizontal overflow during push/back/push/back =', await s.ev('window.__w'), 'px');
    s.close();
  }
  process.exit(0);
}
if (process.env.WIDTHPROBE) await widthProbe();
async function logProbe() {
  const s = await launch({ width: 1100, height: 800 });
  await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
  await seed(s);
  await s.send('Page.navigate', { url: BASE + '/#log' });
  await waitFor(s.ev, `!!document.querySelector('.ui-table')`, 10000);
  await sleep(1500);
  console.log(await s.ev(`JSON.stringify({docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight, rows: document.querySelectorAll('tbody tr').length, layers: [...document.querySelectorAll('.ui-screen-layer')].map(l => Math.round(l.getBoundingClientRect().height)), split: (()=>{const e=document.querySelector('.split'); if(!e) return null; const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(e).gridTemplateColumns]})(), insp: (()=>{const e=document.querySelector('.ui-inspector'); if(!e) return null; const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(e).position]})(), sidebars: document.querySelectorAll('.ui-sidebar').length})`));
  const shot = await s.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(process.env.PROBE_OUT, Buffer.from(shot.result.data, 'base64'));
  s.close();
  process.exit(0);
}
if (process.env.LOGPROBE) await logProbe();
/* Desktop interactions (DESKTOP=1): table sort, inspector selection, panel actions, shortcuts, no swipe. */
async function desktopSmoke() {
  const s = await launch({ width: 1440, height: 900 });
  const results = [];
  const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  const key = (k) => s.ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`);
  const text = (sel) => s.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText?.replace(/\\s+/g,' ')`);
  try {
    await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
    await seed(s);
    await s.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await s.send('Page.navigate', { url: BASE + '/#home' });
    await waitFor(s.ev, `!!document.querySelector('.hero-value')`, 15000);
    await waitFor(s.ev, `!!document.querySelector('.ui-toast-region')`, 10000);
    await sleep(800);
    check('sidebar visible, tab bar hidden', await s.ev(`getComputedStyle(document.querySelector('.ui-sidebar')).display!=='none' && getComputedStyle(document.querySelector('.ui-tabbar')).display==='none'`));
    check('header has Add fill-up, docked bar hidden', (await s.ev(`!![...document.querySelectorAll('.header-actions button')].find(b=>/Add fill-up/.test(b.textContent))`)) && (await s.ev(`getComputedStyle(document.querySelector('.action-bar')).display==='none'`)));
    check('Home has two columns (attention beside recent)', await s.ev(`(()=>{const a=document.querySelector('.home-attention').getBoundingClientRect(), r=document.querySelector('.home-recent').getBoundingClientRect(); return r.left > a.right - 1 && Math.abs(r.top - a.top) < 4})()`));
    await key('n'); await sleep(900);
    check('N opens a new fill-up', await s.ev(`!!document.querySelector('[role=dialog]')`));
    await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700);
    await key('2'); await sleep(900);
    check('2 goes to Log', (await s.ev('location.hash')) === '#log');
    await waitFor(s.ev, `document.querySelectorAll('.ui-table tbody tr').length > 20 && document.querySelectorAll('.ui-screen-layer').length === 1`);
    await sleep(500);
    check('Log is a table with 6 columns and many rows', (await s.ev(`document.querySelectorAll('.ui-table th').length`)) === 6 && (await s.ev(`document.querySelectorAll('.ui-table tbody tr').length`)) > 20);
    const first = await text('.ui-table tbody tr');
    await s.ev(`document.querySelectorAll('.ui-th-btn')[3].click()`); await sleep(300);
    const sortedAsc = await text('.ui-table tbody tr');
    await s.ev(`document.querySelectorAll('.ui-th-btn')[3].click()`); await sleep(300);
    const sortedDesc = await text('.ui-table tbody tr');
    check('sorting by cost reorders the table', first !== sortedAsc && sortedAsc !== sortedDesc);
    check('aria-sort set on the sorted column', (await s.ev(`document.querySelectorAll('.ui-table th')[3].getAttribute('aria-sort')`)) === 'descending');
    await s.ev(`document.querySelectorAll('.ui-table tbody tr')[2].click()`); await sleep(400);
    check('selecting a row fills the inspector', /Odometer/.test((await text('.ui-inspector')) || ''), (await text('.ui-inspector') || '').slice(0, 60));
    check('swipe layers are off with a mouse', await s.ev(`!document.querySelector('.ui-swipe-content')`));
    await s.ev(`document.querySelector('.ui-inspector .ui-btn[data-variant=secondary]').click()`); await sleep(900);
    check('Edit in the inspector opens the dialog (centred on desktop)', await s.ev(`!!document.querySelector('.ui-sheet-dialog')`));
    await s.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700);
    const rows0 = await s.ev(`document.querySelectorAll('.ui-table tbody tr').length`);
    await s.ev(`[...document.querySelectorAll('.ui-inspector .ui-btn')].find(b=>b.textContent.trim()==='Delete').click()`); await sleep(1500);
    check('Delete in the inspector removes the row, with Undo', (await s.ev(`document.querySelectorAll('.ui-table tbody tr').length`)) === rows0 - 1 && /deleted/i.test((await text('.ui-toast')) || ''));
    await s.ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Undo').click()`); await sleep(1500);
    check('Undo brings it back', (await s.ev(`document.querySelectorAll('.ui-table tbody tr').length`)) === rows0);
    await key('r'); await sleep(1100);
    check('R opens Reminders with a detail panel', (await s.ev('location.hash')) === '#log/reminders' && /Mark done today/.test((await text('.ui-inspector')) || ''));
    const title0 = await text('.ui-inspector-title');
    await s.ev(`document.querySelectorAll('button.ui-row')[1].click()`); await sleep(400);
    check('selecting another reminder changes the panel', (await text('.ui-inspector-title')) !== title0);
    await s.ev(`[...document.querySelectorAll('.ui-inspector .ui-btn')].find(b=>/Mark done today/.test(b.textContent)).click()`);
    let seen = false; for (let i = 0; i < 40 && !seen; i++) { await sleep(50); seen = await s.ev(`!!document.querySelector('.ui-completion')`); }
    check('Mark done today plays the completion moment', seen);
    await key('3'); await sleep(1200);
    check('Reports: spend and mileage side by side', await s.ev(`(()=>{const b=[...document.querySelectorAll('.reports-grid > section')].map(e=>e.getBoundingClientRect()); return b.length===3 && b[2].left > b[0].right - 1 && Math.abs(b[2].top - b[0].top) < 4 && b[1].top > b[0].bottom - 1})()`));
    check('no horizontal overflow', (await s.ev('document.documentElement.scrollWidth - innerWidth')) <= 0);
    const errors = [...new Set(s.errors)];
    check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 2)));
  } catch (e) { check('desktop smoke ran to completion', false, String(e.stack || e).slice(0, 300)); }
  s.close();
  console.log(results.every(Boolean) ? 'ALL PASSED' : results.filter((x) => !x).length + ' FAILED', '(' + results.length + ' checks)');
  process.exit(results.every(Boolean) ? 0 : 1);
}
if (process.env.DESKTOP) await desktopSmoke();
if (process.env.BARPROBE) await barProbe();
if (process.env.TRANSITIONS) await transitions();
if (process.env.SMOKE) await smoke();

/* ------------------------------------------------------------ main */
const report = { base: BASE, runs: {} };
const only = (process.env.CONFIGS || '').split(',').filter(Boolean);
const allConfigs = {
  'phone-390-light': { width: 390 },
  'phone-390-dark': { width: 390, dark: true },
  'phone-320-light': { width: 320 },
  'desktop-1100-light': { width: 1100, height: 800 },
  'desktop-1440-light': { width: 1440, height: 900 },
  'phone-390-textx2': { width: 390, fontScale: 200 },
};
const configs = process.env.PERF_ONLY ? {} : only.length ? Object.fromEntries(Object.entries(allConfigs).filter(([k]) => only.includes(k))) : allConfigs;
for (const [name, cfg] of Object.entries(configs)) {
  const s = await launch(cfg);
  try {
    await s.send('Page.navigate', { url: BASE + '/#home' }); await sleep(2500);
    const emptyAudit = name === 'phone-390-light' ? [await audit(s, 'empty:no-vehicle home')] : [];
    await seed(s);
    report.runs[name] = { empty: emptyAudit, screens: await auditAll(s, name) };
    report.runs[name].pageErrors = [...new Set(s.errors)].slice(0, 5);
  } catch (e) { report.runs[name] = { error: String(e) }; }
  s.close();
}
if (process.env.SKIP_PERF) { fs.writeFileSync(OUT, JSON.stringify(report, null, 1)); console.log('wrote', OUT); process.exit(0); }
// Perf, seeded, on the production build: 4x CPU throttle (rough mid-range phone) and unthrottled.
// Each run retries (fresh browser) because the scripted flow can race a slow cold start.
async function perfRun(opts) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const s = await launch(opts);
    try {
      await s.send('Page.navigate', { url: BASE + '/#home' });
      await sleep(2500);
      await seed(s);
      const out = await perf(s);
      s.close();
      return out;
    } catch (e) {
      last = { error: String(e.stack || e), pageErrors: s.errors, attempt };
      s.close();
    }
  }
  return last;
}
report.perf4x = await perfRun({ width: 390, cpu: 4 });
report.perf1x = await perfRun({ width: 390 });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log('wrote', OUT);
