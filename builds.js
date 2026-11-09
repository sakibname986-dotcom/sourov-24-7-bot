"use strict";
// Blueprints. Every command uses "keep": only AIR is replaced, so nothing that already exists is ever destroyed.
// A plot is 24x24 blocks, surrounded by a 3-block road. (x0,z0) = plot corner, y = first air block above the ground.

const PLOT = 24, ROAD = 3, PITCH = PLOT + ROAD * 2;

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function mk() {
  const cmds = [];
  const c = {
    cmds,
    fill: (x1, y1, z1, x2, y2, z2, b) => cmds.push(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${b} keep`),
    set: (x, y, z, b) => cmds.push(`setblock ${x} ${y} ${z} ${b} keep`),
    walls(x1, y1, z1, x2, y2, z2, b) {
      c.fill(x1, y1, z1, x2, y2, z1, b); c.fill(x1, y1, z2, x2, y2, z2, b);
      c.fill(x1, y1, z1, x1, y2, z2, b); c.fill(x2, y1, z1, x2, y2, z2, b);
    },
    disk(cx, cz, r, y1, y2, b) {
      for (let dz = -r; dz <= r; dz++) { const dx = Math.round(Math.sqrt(r * r - dz * dz)); c.fill(cx - dx, y1, cz + dz, cx + dx, y2, cz + dz, b); }
    },
    ring(cx, cz, ro, ri, y1, y2, b) {
      for (let dz = -ro; dz <= ro; dz++) {
        const xo = Math.round(Math.sqrt(ro * ro - dz * dz));
        if (Math.abs(dz) <= ri) {
          const xi = Math.round(Math.sqrt(ri * ri - dz * dz));
          c.fill(cx - xo, y1, cz + dz, cx - xi - 1, y2, cz + dz, b);
          c.fill(cx + xi + 1, y1, cz + dz, cx + xo, y2, cz + dz, b);
        } else c.fill(cx - xo, y1, cz + dz, cx + xo, y2, cz + dz, b);
      }
    },
    door(x, y, z, facing, hinge) {
      c.set(x, y, z, `oak_door[facing=${facing},half=lower,hinge=${hinge || "left"},open=false]`);
      c.set(x, y + 1, z, `oak_door[facing=${facing},half=upper,hinge=${hinge || "left"},open=false]`);
    },
    lamp(x, y, z, h) { c.fill(x, y, z, x, y + h - 1, z, "oak_fence"); c.set(x, y + h, z, "lantern"); },
  };
  return c;
}

function line2d(x1, y1, x2, y2) { // bresenham -> [[x,y]...]
  const pts = []; let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1, err = dx - dy;
  for (;;) { pts.push([x1, y1]); if (x1 === x2 && y1 === y2) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x1 += sx; } if (e2 < dx) { err += dx; y1 += sy; } }
  return pts;
}

// ---------------- common: lamps at the plot corners, apron, roads (always LAST) ----------------
function lamps(c, p) {
  const { x0, z0, y } = p;
  for (const [x, z] of [[x0 - 1, z0 - 1], [x0 + PLOT, z0 - 1], [x0 - 1, z0 + PLOT], [x0 + PLOT, z0 + PLOT]]) c.lamp(x, y, z, 4);
}
function paving(c, p, apron) {
  const { x0, z0, y } = p, R = "polished_blackstone_slab";
  if (apron) c.fill(x0, y, z0, x0 + PLOT - 1, y, z0 + PLOT - 1, "stone_brick_slab");
  c.fill(x0 - ROAD, y, z0 - ROAD, x0 + PLOT + ROAD - 1, y, z0 - 1, R);
  c.fill(x0 - ROAD, y, z0 + PLOT, x0 + PLOT + ROAD - 1, y, z0 + PLOT + ROAD - 1, R);
  c.fill(x0 - ROAD, y, z0, x0 - 1, y, z0 + PLOT - 1, R);
  c.fill(x0 + PLOT, y, z0, x0 + PLOT + ROAD - 1, y, z0 + PLOT - 1, R);
}

// ---------------- modern house (2 storeys, glass front, roof terrace) ----------------
function house(c, p) {
  const { x0, z0, y } = p, x1 = x0 + 6, x2 = x0 + 17, z1 = z0 + 6, z2 = z0 + 15, xd = x0 + 9;
  c.door(xd, y + 1, z2, "south");
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2], [x0 + 12, z2]]) c.fill(x, y + 1, z, x, y + 4, z, "white_concrete");
  c.fill(x1, y + 1, z2, x2, y + 3, z2, "light_blue_stained_glass");
  c.walls(x1, y + 1, z1, x2, y + 3, z2, "white_concrete");
  c.fill(x1, y, z1, x2, y, z2, "smooth_quartz");
  // ladder to the upper floor (leaves a hole in the ceiling plate)
  c.fill(x1 + 1, y + 1, z1 + 1, x1 + 1, y + 5, z1 + 1, "ladder[facing=south]");
  c.fill(x1, y + 4, z1, x2, y + 4, z2, "gray_concrete");
  // upper storey
  const ux2 = x2 - 3;
  c.fill(ux2, y + 5, z2, ux2, y + 8, z2, "black_concrete");
  c.fill(x1, y + 5, z2, ux2, y + 7, z2, "light_blue_stained_glass");
  c.walls(x1, y + 5, z1, ux2, y + 8, z2, "black_concrete");
  c.fill(x1 - 1, y + 9, z1 - 1, ux2 + 1, y + 9, z2 + 1, "black_concrete");
  // furniture
  c.set(x1 + 3, y + 1, z1 + 1, "red_bed[facing=south,part=head]"); c.set(x1 + 3, y + 1, z1 + 2, "red_bed[facing=south,part=foot]");
  c.set(x2 - 1, y + 1, z1 + 1, "crafting_table"); c.set(x2 - 2, y + 1, z1 + 1, "furnace[facing=south]"); c.set(x2, y + 1, z1 + 1, "bookshelf");
  c.set(x0 + 11, y + 3, z0 + 11, "lantern[hanging=true]");
  c.set(x1 + 3, y + 5, z1 + 1, "blue_bed[facing=south,part=head]"); c.set(x1 + 3, y + 5, z1 + 2, "blue_bed[facing=south,part=foot]");
  c.set(ux2 - 1, y + 5, z1 + 1, "bookshelf"); c.set(x1 + 5, y + 8, z0 + 11, "lantern[hanging=true]");
  // roof terrace railing + plants on the free part of the ground roof
  c.fill(ux2 + 1, y + 5, z1, x2, y + 5, z1, "iron_bars"); c.fill(x2, y + 5, z1, x2, y + 5, z2, "iron_bars"); c.fill(ux2 + 1, y + 5, z2, x2, y + 5, z2, "iron_bars");
  c.set(ux2 + 2, y + 5, z1 + 1, "potted_azalea_bush"); c.set(ux2 + 2, y + 5, z2 - 1, "potted_cornflower");
  // front steps + garden
  c.set(xd, y, z2 + 1, "quartz_stairs[facing=north]");
  c.fill(x1, y + 1, z2 + 1, x1 + 2, y + 1, z2 + 1, "oak_leaves[persistent=true]");
  c.fill(x2 - 3, y + 1, z2 + 1, x2, y + 1, z2 + 1, "oak_leaves[persistent=true]");
  lamps(c, p); paving(c, p, true);
}

// ---------------- skyscraper (glass tower with ladder, antenna) ----------------
function skyscraper(c, p) {
  const { x0, z0, y, rnd } = p, x1 = x0 + 5, x2 = x0 + 18, z1 = z0 + 5, z2 = z0 + 18, cx = x0 + 11, cz = z0 + 11;
  const floors = 8 + Math.floor(rnd() * 7), H = floors * 4;
  c.door(cx, y + 1, z2, "south", "left"); c.door(cx + 1, y + 1, z2, "south", "right");
  c.set(cx, y, z2 + 1, "quartz_stairs[facing=north]"); c.set(cx + 1, y, z2 + 1, "quartz_stairs[facing=north]");
  c.fill(x1 + 1, y + 1, z1 + 1, x1 + 1, y + H + 1, z1 + 1, "ladder[facing=south]");
  c.set(x1 + 1, y + H + 1, z1, "white_concrete");
  for (let k = 1; k <= floors; k++) c.set(cx, y + 4 * k, cz, "sea_lantern");
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) c.fill(x, y + 1, z, x, y + H, z, "white_concrete");
  for (const x of [x1 + 4, x1 + 9]) { c.fill(x, y + 1, z2, x, y + H, z2, "white_concrete"); c.fill(x, y + 1, z1, x, y + H, z1, "white_concrete"); }
  c.walls(x1, y + 1, z1, x2, y + 3, z2, "gray_concrete"); // solid lobby base
  c.walls(x1, y + 4, z1, x2, y + H, z2, "light_blue_stained_glass");
  for (let k = 0; k <= floors; k++) c.fill(x1, y + 4 * k, z1, x2, y + 4 * k, z2, k === 0 ? "smooth_quartz" : "gray_concrete");
  c.fill(cx, y + H + 1, cz, cx, y + H + 6, cz, "iron_bars"); c.set(cx, y + H + 7, cz, "lightning_rod[facing=up]");
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) c.set(x, y + H + 1, z, "sea_lantern");
  lamps(c, p); paving(c, p, true);
}

// ---------------- observation tower ----------------
function tower(c, p) {
  const { x0, z0, y } = p, x1 = x0 + 8, x2 = x0 + 16, z1 = z0 + 8, z2 = z0 + 16, cx = x0 + 12, cz = z0 + 12, H = 30;
  c.door(cx, y + 1, z2, "south"); c.set(cx, y, z2 + 1, "quartz_stairs[facing=north]");
  c.fill(x1 + 1, y + 1, z1 + 1, x1 + 1, y + H + 1, z1 + 1, "ladder[facing=south]"); c.set(x1 + 1, y + H + 1, z1, "smooth_quartz");
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2], [cx, z1], [cx, z2], [x1, cz], [x2, cz]]) c.fill(x, y + 1, z, x, y + H, z, "white_concrete");
  c.walls(x1, y + 1, z1, x2, y + H, z2, "gray_concrete");
  for (let yy = y + 5; yy < y + H - 2; yy += 6) for (const [x, z] of [[cx - 2, z2], [cx + 2, z2], [cx - 2, z1], [cx + 2, z1], [x1, cz - 2], [x1, cz + 2], [x2, cz - 2], [x2, cz + 2]]) c.fill(x, yy, z, x, yy + 2, z, "light_blue_stained_glass");
  c.fill(x1, y, z1, x2, y, z2, "smooth_quartz");
  // deck
  const dx1 = x0 + 4, dx2 = x0 + 19, dz1 = z0 + 4, dz2 = z0 + 19;
  c.fill(dx1, y + H, dz1, dx2, y + H, dz2, "smooth_quartz");
  c.walls(dx1, y + H + 1, dz1, dx2, y + H + 1, dz2, "light_blue_stained_glass");
  for (const [x, z] of [[dx1, dz1], [dx2, dz1], [dx1, dz2], [dx2, dz2]]) { c.fill(x, y + H + 1, z, x, y + H + 6, z, "white_concrete"); c.set(x, y + H + 7, z, "sea_lantern"); }
  c.fill(dx1, y + H + 6, dz1, dx2, y + H + 6, dz2, "black_concrete");
  c.fill(cx, y + H + 7, cz, cx, y + H + 11, cz, "iron_bars"); c.set(cx, y + H + 12, cz, "lightning_rod[facing=up]");
  lamps(c, p); paving(c, p, true);
}

// ---------------- park: paths, pond, trees, benches, flowers ----------------
function park(c, p) {
  const { x0, z0, y, rnd } = p, cx = x0 + 12, cz = z0 + 12, S = "stone_brick_slab";
  // pond (water first, then the wall ring)
  c.disk(cx, cz, 4, y, y, "water");
  c.ring(cx, cz, 5, 4, y, y + 1, "stone_bricks");
  c.set(cx, y + 1, cz, "lily_pad");
  // trees
  const trees = [[x0 + 3, z0 + 3], [x0 + 20, z0 + 3], [x0 + 3, z0 + 20], [x0 + 20, z0 + 20], [x0 + 6, z0 + 11], [x0 + 17, z0 + 12]];
  for (const [x, z] of trees) {
    const h = 4 + Math.floor(rnd() * 2);
    c.fill(x, y, z, x, y + h, z, "oak_log");
    c.fill(x - 2, y + h - 1, z - 2, x + 2, y + h, z + 2, "oak_leaves[persistent=true]");
    c.fill(x - 1, y + h + 1, z - 1, x + 1, y + h + 1, z + 1, "oak_leaves[persistent=true]");
  }
  // paths (a cross) - slabs on top of the grass
  c.fill(x0, y, cz - 1, x0 + PLOT - 1, y, cz + 1, S); c.fill(cx - 1, y, z0, cx + 1, y, z0 + PLOT - 1, S);
  // lamps + benches
  for (const [x, z] of [[cx - 3, cz - 3], [cx + 3, cz - 3], [cx - 3, cz + 3], [cx + 3, cz + 3], [x0 + 6, cz + 2], [x0 + 17, cz - 2]]) c.lamp(x, y, z, 3);
  for (const [x, z, f] of [[cx - 7, cz + 2, "east"], [cx + 7, cz - 2, "west"], [cx + 2, cz - 7, "south"], [cx - 2, cz + 7, "north"]]) c.set(x, y, z, `oak_stairs[facing=${f}]`);
  // flowers & bushes
  const fl = ["poppy", "dandelion", "azure_bluet", "cornflower", "red_tulip", "oxeye_daisy", "allium"];
  for (let i = 0; i < 50; i++) { const x = x0 + 1 + Math.floor(rnd() * 22), z = z0 + 1 + Math.floor(rnd() * 22); c.set(x, y, z, fl[Math.floor(rnd() * fl.length)]); }
  for (let i = 0; i < 8; i++) { const x = x0 + 1 + Math.floor(rnd() * 22), z = z0 + 1 + Math.floor(rnd() * 22); c.set(x, y, z, "azalea_leaves[persistent=true]"); }
  lamps(c, p); paving(c, p, false);
}

// ---------------- fountain plaza ----------------
function fountain(c, p) {
  const { x0, z0, y } = p, cx = x0 + 12, cz = z0 + 12;
  c.disk(cx, cz, 6, y, y, "water");
  c.ring(cx, cz, 7, 6, y, y + 1, "quartz_block");
  c.disk(cx, cz, 2, y + 1, y + 1, "quartz_block");
  c.fill(cx, y + 2, cz, cx, y + 5, cz, "chiseled_quartz_block");
  c.set(cx, y + 6, cz, "water");
  for (const [x, z] of [[cx - 4, cz], [cx + 4, cz], [cx, cz - 4], [cx, cz + 4]]) c.set(x, y + 1, z, "sea_lantern");
  for (const [x, z] of [[x0 + 2, z0 + 2], [x0 + 21, z0 + 2], [x0 + 2, z0 + 21], [x0 + 21, z0 + 21]]) { c.fill(x - 1, y, z - 1, x + 1, y, z + 1, "grass_block"); c.set(x, y + 1, z, "red_tulip"); c.set(x - 1, y + 1, z, "pink_tulip"); c.set(x + 1, y + 1, z, "allium"); }
  for (const [x, z, f] of [[cx - 9, cz, "east"], [cx + 9, cz, "west"], [cx, cz - 9, "south"], [cx, cz + 9, "north"]]) c.set(x, y + 1, z, `quartz_stairs[facing=${f}]`);
  lamps(c, p); paving(c, p, true);
}

// ---------------- ferris wheel ----------------
function ferris(c, p) {
  const { x0, z0, y } = p, cx = x0 + 12, zc = z0 + 11, R = 9, cy = y + 11;
  const seen = new Set(), put = (x, yy, b) => { const k = x + "," + yy; if (seen.has(k)) return; seen.add(k); c.set(x, yy, zc, b); c.set(x, yy, zc + 1, b); };
  put(cx, cy, "sea_lantern");
  const rim = [];
  for (let a = 0; a < 360; a += 4) { const x = Math.round(cx + R * Math.cos(a * Math.PI / 180)), yy = Math.round(cy + R * Math.sin(a * Math.PI / 180)); put(x, yy, "white_concrete"); }
  for (let k = 0; k < 8; k++) {
    const a = k * 45 * Math.PI / 180, ex = Math.round(cx + R * Math.cos(a)), ey = Math.round(cy + R * Math.sin(a));
    for (const [x, yy] of line2d(cx, cy, ex, ey)) put(x, yy, "iron_bars");
    rim.push([ex, ey]);
  }
  const col = ["red", "orange", "yellow", "lime", "cyan", "blue", "purple", "pink"];
  rim.forEach(([x, yy], i) => { if (yy - 2 >= y) { for (const z of [zc, zc + 1]) { c.fill(x - 1, yy - 2, z, x + 1, yy - 1, z, `${col[i]}_concrete`); } } });
  for (const lx of [cx - 6, cx + 6]) for (const z of [zc, zc + 1]) for (const [x, yy] of line2d(lx, y, cx, cy)) c.set(x, yy, z, "white_concrete");
  c.fill(cx - 7, y, zc - 3, cx + 7, y, zc + 4, "quartz_slab");
  c.set(cx, y, zc - 3, "quartz_stairs[facing=south]");
  lamps(c, p); paving(c, p, true);
}

// ---------------- carousel ----------------
function carousel(c, p) {
  const { x0, z0, y } = p, cx = x0 + 12, cz = z0 + 12, ring = [[0, 4], [3, 3], [4, 0], [3, -3], [0, -4], [-3, -3], [-4, 0], [-3, 3]];
  const out = [[0, 6], [4, 4], [6, 0], [4, -4], [0, -6], [-4, -4], [-6, 0], [-4, 4]];
  c.fill(cx, y + 1, cz, cx, y + 5, cz, "stripped_oak_log");
  const f = ["north", "east", "south", "west"];
  ring.forEach(([dx, dz], i) => { c.fill(cx + dx, y + 1, cz + dz, cx + dx, y + 4, cz + dz, "oak_fence"); c.set(cx + dx, y + 1, cz + dz, `${["white", "pink", "yellow", "light_blue"][i % 4]}_concrete`); c.set(cx + dx, y + 2, cz + dz, `oak_stairs[facing=${f[i % 4]}]`); });
  out.forEach(([dx, dz]) => c.fill(cx + dx, y + 1, cz + dz, cx + dx, y + 4, cz + dz, "oak_fence"));
  c.disk(cx, cz, 7, y, y, "birch_planks");
  const layers = [[7, "red_wool"], [6, "white_wool"], [5, "red_wool"], [4, "white_wool"], [3, "red_wool"], [2, "white_wool"], [1, "red_wool"]];
  layers.forEach(([r, b], i) => c.disk(cx, cz, r, y + 5 + i, y + 5 + i, b));
  c.set(cx, y + 12, cz, "lightning_rod[facing=up]");
  c.set(cx, y, cz + 8, "quartz_stairs[facing=north]");
  lamps(c, p); paving(c, p, true);
}

const BUILDS = { house, skyscraper, tower, park, fountain, ferris_wheel: ferris, carousel };
const ROLES = {
  skyline:  ["skyscraper", "skyscraper", "house", "tower"],
  gardener: ["park", "park", "fountain", "park"],
  rides:    ["ferris_wheel", "carousel", "ferris_wheel", "carousel"],
  landmark: ["tower", "skyscraper", "fountain", "house"],
  mixed:    ["house", "park", "carousel", "fountain", "ferris_wheel", "tower", "skyscraper"],
};

function commandsFor(type, plot) {
  const c = mk();
  BUILDS[type](c, Object.assign({}, plot, { rnd: rng(plot.seed || 1) }));
  return c.cmds;
}

// spiral order of plot grid cells: (0,0), (1,0), (1,1), (0,1), (-1,1) ...
function spiral(n) {
  const out = []; let x = 0, z = 0, dx = 1, dz = 0, seg = 1, passed = 0, turns = 0;
  for (let i = 0; i < n; i++) {
    out.push([x, z]); x += dx; z += dz; passed++;
    if (passed === seg) { passed = 0; [dx, dz] = [-dz, dx]; turns++; if (turns % 2 === 0) seg++; }
  }
  return out;
}

module.exports = { BUILDS, ROLES, PLOT, ROAD, PITCH, commandsFor, spiral };
