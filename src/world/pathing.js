/**
 * Walking around furniture. Each interior gets a coarse walkability grid (25 cm cells) built from
 * its bounds and solids, padded by a body's width. An NPC who wants to wander picks a reachable
 * free cell near home and follows a breadth-first path to it, smoothed down to the few corners that
 * matter, so the live-in girlfriend goes round the bed instead of standing against it.
 *
 * Plain data and functions; the world calls buildGrid on load and findPath when a wanderer picks
 * a new spot.
 */
const CELL = 0.25;

export function buildGrid(area, pad = 0.26) {
  const b = area?.bounds;
  if (!b) return null;
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / CELL));
  const rows = Math.max(1, Math.ceil((b.maxZ - b.minZ) / CELL));
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = b.minX + (c + 0.5) * CELL, z = b.minZ + (r + 0.5) * CELL;
      let ok = x > b.minX + pad && x < b.maxX - pad && z > b.minZ + pad && z < b.maxZ - pad;
      if (ok) {
        for (const s of area.solids || []) {
          if (s.moving) continue;
          if (Math.abs(x - s.x) < s.w / 2 + pad && Math.abs(z - s.z) < s.d / 2 + pad) { ok = false; break; }
        }
      }
      free[r * cols + c] = ok ? 1 : 0;
    }
  }
  return { minX: b.minX, minZ: b.minZ, cols, rows, free };
}

const cellOf = (g, x, z) => [Math.floor((x - g.minX) / CELL), Math.floor((z - g.minZ) / CELL)];
const centre = (g, c, r) => [g.minX + (c + 0.5) * CELL, g.minZ + (r + 0.5) * CELL];
const isFree = (g, c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.free[r * g.cols + c] === 1;

/** The nearest free cell to a point (a body standing at the edge of a solid still has a cell). */
function nearestFree(g, c0, r0) {
  if (isFree(g, c0, r0)) return [c0, r0];
  for (let rad = 1; rad < 8; rad++) {
    for (let dc = -rad; dc <= rad; dc++) for (let dr = -rad; dr <= rad; dr++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
      if (isFree(g, c0 + dc, r0 + dr)) return [c0 + dc, r0 + dr];
    }
  }
  return null;
}

/** Can you walk straight from cell a to cell b without crossing a blocked cell? */
function lineFree(g, a, b) {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!isFree(g, Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t))) return false;
  }
  return true;
}

/**
 * A path from (x0, z0) to (x1, z1) as world waypoints, or null if there is none. Breadth-first
 * over 8 neighbours (no corner cutting), then smoothed to line-of-sight corners.
 */
export function findPath(g, x0, z0, x1, z1) {
  if (!g) return null;
  const a = nearestFree(g, ...cellOf(g, x0, z0));
  const b = nearestFree(g, ...cellOf(g, x1, z1));
  if (!a || !b) return null;
  const idx = (c, r) => r * g.cols + c;
  const prev = new Int32Array(g.cols * g.rows).fill(-1);
  const seen = new Uint8Array(g.cols * g.rows);
  const q = [idx(a[0], a[1])];
  seen[q[0]] = 1;
  const goal = idx(b[0], b[1]);
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) break;
    const c = cur % g.cols, r = (cur / g.cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!isFree(g, nc, nr)) continue;
      if (dc && dr && (!isFree(g, c + dc, r) || !isFree(g, c, r + dr))) continue; // no squeezing past a corner
      const n = idx(nc, nr);
      if (seen[n]) continue;
      seen[n] = 1;
      prev[n] = cur;
      q.push(n);
    }
  }
  if (!seen[goal]) return null;
  const cells = [];
  for (let cur = goal; cur !== -1; cur = prev[cur]) cells.push([cur % g.cols, (cur / g.cols) | 0]);
  cells.reverse();
  // keep only the corners: from each kept cell, jump to the farthest one still in straight sight
  const kept = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !lineFree(g, cells[i], cells[j])) j--;
    kept.push(cells[j]);
    i = j;
  }
  return kept.slice(1).map(([c, r]) => centre(g, c, r));
}

/** A random free, reachable spot within `radius` of home, or null. */
export function wanderSpot(g, hx, hz, radius) {
  if (!g) return null;
  for (let k = 0; k < 14; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * radius;
    const [c, row] = cellOf(g, hx + Math.cos(a) * r, hz + Math.sin(a) * r);
    if (isFree(g, c, row)) return centre(g, c, row);
  }
  return null;
}
