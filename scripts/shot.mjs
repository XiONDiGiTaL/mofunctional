/**
 * Repeatable screenshots of the cast and the game (headless Chromium via Playwright).
 *
 *   npm start   (in another terminal: python3 -m http.server 8080)
 *   node scripts/shot.mjs [outDir]
 *
 * Requires Playwright (npm i -D playwright). Writes: face_front, face_three_quarter,
 * face_profile, mo_character, faces_cast, hud_state_faces, street_life, plus a JSON report
 * of console errors. Exits non-zero on any page error.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] || 'assets/img';
const base = process.env.MOF_URL || 'http://127.0.0.1:8080/';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/menu.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.click('[data-menu="new"]');
await page.waitForTimeout(400);
await page.click('[data-begin]');
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.screen{display:none!important}.modal-wrap{display:none!important}' });
await page.evaluate(() => { window.MOF.openModal = () => {}; });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/gameplay_apartment.png` });

// pin the camera after the play loop runs (or the loop overwrites it)
async function pin(fnSrc) {
  await page.evaluate((src) => {
    const w = window.MOF.world;
    if (!w.__origUpdatePlay) w.__origUpdatePlay = w.updatePlay.bind(w);
    const place = new Function('w', 'THREE', src);
    w.updatePlay = (dt, g) => { w.__origUpdatePlay(dt, g); place(w); w.camera.updateProjectionMatrix(); };
  }, fnSrc);
  await page.waitForTimeout(500);
}
const face = (dx, dz, fov = 34) => `const m = w.mo.root.position; const r = w.mo.root.rotation.y;
  const s = Math.sin(r), c = Math.cos(r);
  w.camera.position.set(m.x + s * ${dz} + c * ${dx}, 1.62, m.z + c * ${dz} - s * ${dx});
  w.camera.lookAt(m.x, 1.6, m.z); w.camera.fov = ${fov};`;
await pin(face(0, 0.9));
await page.screenshot({ path: `${out}/face_front.png` });
await pin(face(0.62, 0.62));
await page.screenshot({ path: `${out}/face_three_quarter.png` });
await pin(face(0.9, 0.0));
await page.screenshot({ path: `${out}/face_profile.png` });
await pin(`const m = w.mo.root.position; const r = w.mo.root.rotation.y;
  w.camera.position.set(m.x + Math.sin(r) * 2.6, 1.15, m.z + Math.cos(r) * 2.6); w.camera.lookAt(m.x, 0.95, m.z); w.camera.fov = 50;`);
await page.screenshot({ path: `${out}/mo_character.png` });

// HUD portraits for every mood, and the cast
const portraits = await page.evaluate(async () => {
  const f = await import('/src/render/faces.js');
  const moods = f.MOODS.map((m) => [m, f.portraitURL('mo', m)]);
  const cast = ['mo', 'addison', 'kev', 'rae', 'dale', 'dex', 'nia', 'miguel', 'habib', 'homeless', 'junkie', 'clerk'].map((k) => [k, f.portraitURL(k, 'content')]);
  return { moods, cast };
});
const html = (rows) => `<body style="margin:0;background:#0b100d;display:flex;flex-wrap:wrap;gap:10px;padding:12px;font:11px monospace;color:#9fb">${rows.map(([n, u]) => `<div style="text-align:center"><img src="${u}" style="width:144px;height:180px;image-rendering:pixelated;display:block;border:1px solid #2c4436">${n}</div>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 980, height: 440 } });
await p2.setContent(html(portraits.moods));
await p2.screenshot({ path: `${out}/hud_state_faces.png` });
await p2.setViewportSize({ width: 980, height: 640 });
await p2.setContent(html(portraits.cast));
await p2.screenshot({ path: `${out}/faces_cast.png` });

// street: go outside, then line the neighbours up in front of the camera
await page.evaluate(() => { const g = window.MOF; g.world.loadArea('street', g); });
await page.waitForTimeout(800);
await pin(`const m = w.mo.root.position; const r = w.mo.root.rotation.y;
  w.camera.position.set(m.x - Math.sin(r) * 3.2, 2.2, m.z - Math.cos(r) * 3.2); w.camera.lookAt(m.x, 1.2, m.z); w.camera.fov = 70;`);
await page.screenshot({ path: `${out}/street_life.png` });
await page.evaluate(() => {
  const w = window.MOF.world;
  const kinds = ['addison', 'kev', 'rae', 'dale', 'dex', 'nia'];
  const m = w.mo.root.position;
  let i = 0;
  w.scene.traverse((o) => {
    if (o.name && kinds.includes(o.name) && o.parent === w.scene || (o.name && kinds.includes(o.name))) {
      const idx = kinds.indexOf(o.name);
      if (o.userData.__placed) return; o.userData.__placed = true;
      o.visible = true; o.position.set(m.x - 2.5 + idx * 1.0, 0, m.z - 3); o.rotation.set(0, 0, 0); i++;
    }
  });
  if (w.addison) { w.addison.root.visible = true; w.addison.root.position.set(m.x - 2.5, 0, m.z - 3); w.addison.root.rotation.set(0, 0, 0); }
});
await pin(`const m = w.mo.root.position; w.camera.position.set(m.x, 1.5, m.z + 0.6); w.camera.lookAt(m.x, 1.25, m.z - 3); w.camera.fov = 62;`);
await page.screenshot({ path: `${out}/cast_lineup.png` });

const state = await page.evaluate(() => ({ mode: window.MOF.mode, area: window.MOF.world.areaId }));
fs.writeFileSync(`${out}/shot_report.json`, JSON.stringify({ state, errors }, null, 2));
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
