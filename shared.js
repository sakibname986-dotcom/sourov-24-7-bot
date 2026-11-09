"use strict";
// Shared city state for all bots (a1..e5). Plots are reserved atomically (directory lock),
// so two bots never build on the same spot.
const fs = require("fs");
const path = require("path");

const DIR = process.env.SHARED_DIR || path.join(__dirname, "shared");
const FILE = path.join(DIR, "city.json");
const LOCK = path.join(DIR, "lock");
const STALE_BUILD_MS = 40 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const empty = () => ({ nextId: 1, city: null, structures: [] });

function load() {
  try { return Object.assign(empty(), JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch (_) { return empty(); }
}
const read = () => load();

async function update(mutator) {
  fs.mkdirSync(DIR, { recursive: true });
  let locked = false;
  for (let i = 0; i < 100 && !locked; i++) {
    try { fs.mkdirSync(LOCK); locked = true; }
    catch (_) {
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 10000) fs.rmdirSync(LOCK); } catch (_) {}
      await sleep(60 + Math.random() * 60);
    }
  }
  try {
    const data = load();
    const result = mutator(data);
    const tmp = FILE + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, FILE);
    return result;
  } finally { if (locked) { try { fs.rmdirSync(LOCK); } catch (_) {} } }
}

const overlaps = (a, b) => a.x0 < b.x0 + b.w && a.x0 + a.w > b.x0 && a.z0 < b.z0 + b.d && a.z0 + a.d > b.z0;

// returns structure id or null when the rectangle is already taken
function reserve(s) {
  return update((d) => {
    const now = Date.now();
    for (const o of d.structures) {
      if (o.status === "building" && now - o.at > STALE_BUILD_MS) continue; // dead bot
      if (overlaps(s, o)) return null;
    }
    const id = d.nextId++;
    d.structures.push(Object.assign({}, s, { id, status: "building", at: now }));
    return id;
  });
}
const finish = (id, extra) => update((d) => { const s = d.structures.find((x) => x.id === id); if (s) { s.status = "done"; Object.assign(s, extra || {}); } });
const setCity = (c, force) => update((d) => { if (!d.city || force) d.city = c; return d.city; });

module.exports = { read, update, reserve, finish, setCity, FILE };
