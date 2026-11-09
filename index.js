"use strict";
// One city-builder bot. Start via `npm start` (all 5) or `BOT_NAME=a1 BOT_ROLE=skyline node index.js`.
// The bot NEVER digs or breaks anything: it builds with "/fill ... keep" (only air gets replaced). It needs OP.
const mineflayer = require("mineflayer");
const { Vec3 } = require("vec3");
const fs = require("fs");
const path = require("path");
const shared = require("./shared");
const { ROLES, PLOT, ROAD, PITCH, commandsFor, spiral } = require("./builds");
const { askAI } = require("./ai");

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), "utf8"));
const NAME = process.env.BOT_NAME || "a1";
const ROLE = process.env.BOT_ROLE || "mixed";
const types = ROLES[ROLE] || ROLES.mixed;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const log = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

let bot = null, session = 0, paused = false, status = "starting", opWarned = false;

function connect() {
  const my = ++session;
  status = "connecting";
  bot = mineflayer.createBot({ host: settings.server.ip, port: settings.server.port, version: settings.server.version, username: NAME, auth: "offline", hideErrors: true });
  const alive = () => my === session;

  bot.once("spawn", () => { log(`spawned as ${NAME} (${ROLE})`); work(my).catch((e) => log("work error: " + e.message)); antiAfk(my); });
  bot.on("messagestr", (m) => {
    if (/register/i.test(m) && /\/register/i.test(m)) bot.chat(`/register ${settings.auth.password} ${settings.auth.password}`);
    else if (/\/login/i.test(m)) bot.chat(`/login ${settings.auth.password}`);
    if (/unknown or incomplete command|you do not have permission|no permission/i.test(m) && !opWarned) {
      opWarned = true; log(`!! ${NAME} is not OP. In the Aternos console run:  op ${NAME}`);
    }
  });
  bot.on("chat", (user, msg) => { if (alive() && user !== NAME) onChat(user, msg).catch(() => {}); });
  bot.on("kicked", (r) => log("kicked: " + (typeof r === "string" ? r : JSON.stringify(r)).slice(0, 200)));
  bot.on("error", (e) => log("error: " + e.message));
  bot.on("end", () => {
    if (!alive()) return;
    session++; status = "reconnecting";
    const d = rnd(settings.reconnect.minSec, settings.reconnect.maxSec);
    log(`disconnected - rejoining in ${d}s`);
    setTimeout(connect, d * 1000);
  });
}

function antiAfk(my) {
  const tick = async () => {
    if (my !== session) return;
    try { bot.setControlState("jump", true); await sleep(250); bot.setControlState("jump", false); } catch (_) {}
    setTimeout(tick, rnd(20000, 90000));
  };
  setTimeout(tick, 15000);
}

// ---------------- chat ----------------
async function onChat(user, msg) {
  const low = msg.toLowerCase();
  const names = [NAME.toLowerCase(), NAME.toLowerCase().replace(/(\d)/, " $1")];
  if (!names.some((n) => low.includes(n))) return;
  const rest = low.replace(new RegExp(names.join("|"), "g"), "").trim();
  const owner = !settings.owners.length || settings.owners.map((s) => s.toLowerCase()).includes(user.toLowerCase());
  if (/city here|shohor ekhane|city eikhane/.test(rest)) {
    if (!settings.owners.length) { bot.chat("Owner list khali, settings.json e owners set koro age."); return; }
    if (!owner) return;
    const e = bot.players[user] && bot.players[user].entity;
    if (!e) { bot.chat("Tomake dekhte parchi na, kache aso."); return; }
    await shared.setCity({ x: Math.floor(e.position.x), y: Math.floor(e.position.y), z: Math.floor(e.position.z) }, true);
    bot.chat("Thik ache, ekhan theke notun city shuru hobe!"); return;
  }
  if (/\b(stop|thamo)\b/.test(rest) && owner) { paused = true; bot.chat("Thamlam."); return; }
  if (/\b(go|start|shuru|chalu)\b/.test(rest) && owner) { paused = false; bot.chat("Kaj shuru!"); return; }
  if (/status|ki korcho|what are you doing/.test(rest)) { bot.chat(`${status}`.slice(0, 200)); return; }
  if (settings.ai.enabled) {
    const reply = await askAI(user, msg, Object.assign({}, settings.ai, { botName: NAME, baseName: settings.ai.baseName }), log);
    if (reply) bot.chat(reply);
  }
}

// ---------------- commands (throttled so the server never flags spam) ----------------
async function cmd(c) { bot.chat("/" + c); await sleep(settings.build.commandDelayMs); }

async function ensureCreative() {
  for (let i = 0; i < 6; i++) {
    await cmd("gamemode creative");
    await sleep(1500);
    if (bot.game && bot.game.gameMode === "creative") return true;
  }
  return false;
}

// ---------------- terrain checks (read only) ----------------
const SKIP = (n) => /leaves|_log$|_wood$|vine|snow$|grass$|fern|flower|poppy|dandelion|bush|mushroom|sugar_cane|kelp|seagrass/.test(n);
function surfaceY(x, z, fromY) {
  for (let y = fromY + 10; y >= fromY - 12; y--) {
    const b = bot.blockAt(new Vec3(x, y, z));
    if (b && b.boundingBox === "block" && !SKIP(b.name)) return y;
  }
  return null;
}
async function waitChunk(x, y, z) {
  for (let i = 0; i < 20; i++) { if (bot.blockAt(new Vec3(x, y, z))) return true; await sleep(500); }
  return false;
}

// returns {y} or {skip:"reason"}
function inspectPlot(x0, z0, baseY) {
  const pts = [[12, 12], [0, 0], [23, 0], [0, 23], [23, 23]];
  const ys = pts.map(([dx, dz]) => surfaceY(x0 + dx, z0 + dz, baseY));
  if (ys.some((v) => v === null)) return { skip: "no ground / not loaded" };
  const lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo > 2) return { skip: `uneven terrain (${hi - lo} blocks)` };
  const y = ys[0] + 1;
  let hits = 0;
  for (let dx = 0; dx < PLOT; dx += 3) for (let dz = 0; dz < PLOT; dz += 3) for (let dy = 0; dy < 3; dy++) {
    const b = bot.blockAt(new Vec3(x0 + dx, y + dy, z0 + dz));
    if (!b) continue;
    if (b.name === "water" || b.name === "lava" || (b.boundingBox === "block" && b.name !== "air")) hits++;
  }
  if (hits > 4) return { skip: `something already built here (${hits} blocks)` };
  return { y };
}

// ---------------- main work loop ----------------
async function work(my) {
  const alive = () => my === session;
  await sleep(4000);
  if (!(await ensureCreative())) {
    log(`!! ${NAME} could not switch to creative. Make it OP (console: op ${NAME}) - retrying in 60s`);
    status = "waiting for OP";
    await sleep(60000);
    if (alive()) return work(my);
    return;
  }
  const e = bot.entity.position;
  const city = await shared.setCity(settings.city.x != null ? { x: settings.city.x, y: settings.city.y, z: settings.city.z } : { x: Math.floor(e.x), y: Math.floor(e.y), z: Math.floor(e.z) });
  log(`city center: ${city.x},${city.y},${city.z}`);
  const cells = spiral(settings.city.maxPlots);

  while (alive()) {
    if (paused) { status = "paused"; await sleep(3000); continue; }
    const type = types[rnd(0, types.length - 1)];
    let plot = null, id = null;
    for (const [i, j] of cells) {
      const x0 = city.x - PLOT / 2 + i * PITCH, z0 = city.z - PLOT / 2 + j * PITCH;
      id = await shared.reserve({ x0: x0 - ROAD, z0: z0 - ROAD, w: PITCH, d: PITCH, type, by: NAME, y: city.y });
      if (id) { plot = { x0, z0 }; break; }
    }
    if (!plot) { status = "city is full"; log("no free plots left - raise city.maxPlots"); await sleep(60000); continue; }

    status = `going to plot (${plot.x0},${plot.z0}) to build ${type}`;
    log(status);
    await cmd(`tp @s ${plot.x0 + 12} ${city.y + 12} ${plot.z0 + 12}`);
    await sleep(1500);
    await waitChunk(plot.x0 + 12, city.y, plot.z0 + 12);
    await sleep(1500);

    const info = inspectPlot(plot.x0, plot.z0, city.y);
    if (info.skip) { log(`skipping plot: ${info.skip}`); await shared.finish(id, { blocked: info.skip }); continue; }

    const cmds = commandsFor(type, { x0: plot.x0, z0: plot.z0, y: info.y, seed: id * 7919 + 13 });
    log(`building ${type} (${cmds.length} commands) at ${plot.x0},${info.y},${plot.z0}`);
    let n = 0;
    for (const c of cmds) {
      if (!alive()) return;
      while (paused && alive()) await sleep(2000);
      status = `building ${type} ${Math.round((++n / cmds.length) * 100)}%`;
      await cmd(c);
    }
    await shared.finish(id, { y: info.y, builtType: type, doneBy: NAME });
    log(`finished ${type}`);
    bot.chat(`${type.replace("_", " ")} ready! Enderlord city ta shundor hocche.`.slice(0, 100));
    status = "resting";
    await sleep(rnd(settings.build.restSecondsMin, settings.build.restSecondsMax) * 1000);
  }
}

connect();
process.on("uncaughtException", (e) => log("uncaught: " + e.message));
process.on("unhandledRejection", (e) => log("unhandled: " + (e && e.message)));
