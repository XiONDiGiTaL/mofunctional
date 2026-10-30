# Art handoff — fix the character heads

Paste the block below into the model that will do the art pass. Attach the low-poly reference
image (white tee, jeans, beard) and, if you still have it, the 20-portrait sheet.

---

You are taking over a finished, shipped browser game and your job is to **fix the character
heads** — especially the protagonist's face — without breaking anything else.

## Repo

`XiONDiGiTaL/mofunctional` (public), branch `main`, latest commit `8d502d7`.
Live: <https://xiondigital.net/mofunctional/> — served by GitHub Pages from `main`, no CI beyond
Pages. Nothing is built at deploy time; every file is served as written.

**MO: FUNCTIONAL** is a 90s-console-styled dark-comedy life sim: vanilla ES modules, Three.js
vendored at `vendor/three.module.js`, no bundler, no npm runtime dependencies.

```bash
npm start            # python3 -m http.server 8080  (ES modules need http, not file://)
npm run check        # node scripts/check-syntax.mjs — parses every module, must stay all-green
```

## Hard constraints

1. **No new runtime dependencies, no build step.** Everything must run from static files.
2. **Keep every export and the rig contract.** `src/world/characters.js` exports
   `createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC,
   characterMaterials`. `src/world/game3d.js` drives the rig through these fields and nothing else:
   `root, hips, torso, head, legL/legR {pivot,knee,ankle}, armL/armR {pivot,elbow,hand},
   hipY, shoulderY, headH, k`.
3. **The 3D head must stay real geometry.** Do not reintroduce a painted face texture on a plane
   or a box. `src/render/faces.js` is for UI portraits only (`portraitURL`, `portraitCanvas`,
   `npcFaceTexture`) and must keep working for the HUD and phone.
4. **Materials go through the retro shader.** Use `retroMaterial(name, opts)` from
   `src/render/retro.js` (`box`, `taper`, `plane` helpers). It is a custom `ShaderMaterial`:
   affine UVs, vertex snapping, two-light + hemisphere shading, ordered dithering, fog. Custom
   geometry must be `BufferGeometry` with `position`/`normal`/`uv`; build it non-indexed if you
   want hard facets.
5. **Do not touch gameplay**: balance in `src/core/config.js`, systems in `src/systems/`, UI flows
   in `src/ui/`, shops in `src/world/shops.js`, schedules in `src/world/schedules.js`.
6. Do not rename files or reformat unrelated code.

## Where the head lives

`src/world/characters.js`

- `SKULL_RINGS` (line ~76): ten rings `[t, width, depth, zOffset]`, `t` 0 = chin bottom, 1 = crown.
- `SEG = 12` (line ~88): radial sectors.
- `shellGeo(...)` (line ~99): builds ring-to-ring triangle strips, optional caps, `grow` scale.
  `sq(v) = sign(v) * |v|^0.78` squares the ring into a superellipse.
- `buildHead(...)` (line ~153): skull shell + all facial features as separate small boxes +
  hair shells + beard boxes.
- `CAST` (line ~356): per-character appearance spec (height, skin, hair colour, hair style,
  beard style). Mo, Addison, Rae, Dale, Dex, Kev, Nia, Miguel, Habib, homeless, junkie, clerk.
- `createMo` (~371), `createNPC` (~430): assemble the body around `buildHead`.

## What is wrong right now (ranked)

1. **Silhouette.** The cranium is narrower than the jaw and too tall; it reads as an egg with a
   case attached. The skull should be widest at the temples, taper hard through the jaw, and the
   crown should be a rounded dome, not a flat cap.
2. **Hair is a helmet.** `shellGeo({ from: hairStart })` produces a hard horizontal edge across
   the forehead and a uniform thickness all round. It needs a real hairline that dips at the
   temples and sits lower at the sides, thickness that varies (thicker on top, thin at the nape),
   and a crown that follows the skull instead of a ring cap.
3. **Eyes are stickers.** Three stacked boxes (socket plate, `eyeWhite`, `iris`) floating flat on
   the face. They are too high, too close together, too white and read as glowing rectangles at
   game distance. They need sockets carved into the mesh, an upper lid that covers roughly the top
   quarter of the eye, a smaller sclera and a larger iris.
4. **Nose is a block.** A rectangular bridge box, a tip box and two dark dots. It needs a bridge
   that blends into the brow, alar wings, and a shadow under the tip. Nose must break the cheek
   plane.
5. **Mouth is a bar.** Two floating boxes. Needs lips with a philtrum above and a chin crease
   below; corners should sit inside the cheek plane.
6. **Beard is loose cubes.** Five separate boxes around the jaw with visible gaps between them and
   the skin. It must be a continuous jaw-hugging shell (or a shell with a jagged lower edge), and
   the moustache has to join the chin.
7. **Ears** are boxes sticking straight out, placed too high and too far forward.
8. **Neck** is too long and thin; there is a visible step where the head meets it.
9. **No facial planes.** The face front is a smooth barrel, so it has none of the faceted planes
   the reference has: brow shelf, cheekbone, cheek hollow, jaw plane, chin pad.
10. **Head too dark / too small at game distance.** Head materials use `tone(skin, 0.86)`; at 240p
    internal resolution (`CONFIG.render.internalHeight`) features disappear. Mo's tee is also
    blown out (`0xf4f3ec`), which flattens his silhouette.

## Target look

Flat-shaded, faceted low-poly — think a 1998 console survival-horror NPC, not a smooth modern
character. Visible planes, hard normal breaks, no smoothing groups. The reference image (white
tee, jeans, short dark hair, beard, medium-dark skin) is the style anchor. Everyone in `CAST`
uses the same construction, differing only by spec.

## Anatomy anchors (use these numbers)

Let `H` = head height (`hh` in `buildHead`), `W` = head width, `D` = head depth.
Skull proportions: `W ≈ 0.72 H`, `D ≈ 0.88 H`.

Vertical landmarks, chin bottom at `y = 0`, crown at `y = H`:

| Landmark | y |
|---|---|
| Chin bottom | 0.00 H |
| Mouth line | 0.30 H |
| Nose base | 0.42 H |
| Eye line | 0.55 H |
| Brow line | 0.62 H |
| Widest cranium | 0.74 H |
| Crown | 1.00 H |

Horizontal landmarks (centre at `x = 0`):

- Eye width `0.22 H`; gap between eyes = one eye width; outer corners at `x ≈ ±0.20 H`.
- Nose width at wings `0.24 H`, tip protrudes `0.10 H` past the face plane.
- Mouth width `0.30 H`.
- Jaw width at `y = 0.20 H` is `0.72 W`; chin `0.34 W`; temples `1.0 W`.
- Ears: top at brow line, bottom at nose base, outer face at `x ≈ ±0.50 W`, `z ≈ -0.05 D`.

## Suggested implementation

Replace the ring-stack barrel with an explicit low-poly head mesh:

1. Build a vertex grid: ~12 columns around the head (front centre seam at `z = +D/2`) × ~9 rows
   matching the landmarks above, plus a chin pad and a crown cap. Non-indexed triangles,
   `computeVertexNormals()` for flat facets.
2. Push the nose out of the front-centre columns between the eye line and nose base rather than
   adding a box; give it a bridge, a tip and two alar wings.
3. Raise a brow shelf band at `0.60–0.66 H` so the eyes sit in shadow, and cut shallow eye sockets
   at `0.52–0.58 H` with a dark inset quad, a small sclera and a lid slab over the top.
4. Add cheekbone and jaw plane breaks by moving vertices, not by adding meshes.
5. Build hair as a second shell over the same grid starting from a *per-column* hairline height
   (higher at the forehead centre, lower at the temples and nape), plus style volumes
   (`short`, `crop`, `swept`, `bob`, `receding`, `dread`, `braids` already exist in `CAST`).
6. Beard as a jaw shell following the jaw ring, from ear to ear, with a mouth cut-out.
7. Raise head material ambient to roughly `1.0` and drop the tee to about `0xd9d6c9` so the face
   and shirt still read in the game's dark interiors.

## Verification you must do

1. `npm run check` → every module parses.
2. Screenshot harness. The previous pass used throwaway Playwright scripts; add a real
   `scripts/shot.mjs` so this is repeatable (Chromium headless, `--no-sandbox
   --disable-dev-shm-usage --enable-unsafe-swiftshader --disable-gpu`):

```js
// boot
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
await page.keyboard.press('Enter');
await page.click('[data-menu="new"]');
await page.click('[data-begin]');
// pin the camera AFTER the play loop runs, or the loop overwrites it
await page.evaluate(() => {
  const w = window.MOF.world;
  const orig = w.updatePlay.bind(w);
  w.updatePlay = (dt, g) => {
    orig(dt, g);
    const m = w.mo.root.position;
    w.camera.position.set(m.x + 0.95, 1.58, m.z + 0.95);
    w.camera.lookAt(m.x, 1.50, m.z);
    w.camera.fov = 46; w.camera.updateProjectionMatrix();
  };
});
await page.screenshot({ path: 'assets/img/face_check.png' });
```

   Suppress interruptions before shooting: inject
   `<style>.screen{display:none!important}.modal-wrap{display:none!important}</style>` and set
   `window.MOF.openModal = () => {}`.
3. Capture at least: front, three-quarter, profile, full body, and the six-character lineup
   (`addison, kev, rae, dale, dex, nia` via `world.createNPC`-style spawns or a dedicated page).
4. Confirm **zero console errors** and that the game still boots to `mode: play` with NPCs moving.
5. Regenerate the README plates that show faces: `assets/img/mo_character.png`,
   `assets/img/faces_cast.png`, `assets/img/street_life.png`, `assets/img/hud_state_faces.png`.

## Acceptance criteria

- Three-quarter view: brow shadow over the eyes, a clear nose plane break, cheek plane, jaw plane
  and chin pad are all readable.
- No gaps between skin, beard and hair; no floating feature boxes visible at any angle.
- Eyes are not white rectangles — small sclera, large iris, upper lid.
- Hairline is not a straight helmet edge.
- At gameplay camera distance (FOV 68–78, 2.5–4 m, 240p internal), the face still reads as a face.
- All NPCs share the construction; only `CAST` values differ.
- `npm run check` green, no console errors, gameplay untouched.

## Notes

- The user's reference sheet is not in the repo (it was pasted into chat). Ask the user to attach
  it again before you start; do not invent a different art direction.
- Mo is the protagonist: medium-dark skin, short black hair, goatee, plain white tee, plain blue
  jeans. No stains, patches or logos on the shirt.
- Deploy is just `git push` to `main`; Pages rebuilds in roughly five to ten minutes. Do not change
  repository settings, and do not push until the checks and screenshots are done.
