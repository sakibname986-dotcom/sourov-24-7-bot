"use strict";
// Starts a1..e5 as separate processes, logins staggered so Aternos does not throttle them.
const { spawn } = require("child_process");
const path = require("path");
const { bots } = require("./bots.json");
const children = new Map();

function start(bot) {
  const child = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: { ...process.env, BOT_NAME: bot.name, BOT_ROLE: bot.role },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(bot.name, child);
  const pipe = (s) => {
    let buf = "";
    s.on("data", (d) => {
      buf += d.toString(); let n;
      while ((n = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, n).trimEnd(); buf = buf.slice(n + 1); if (l) console.log(`[${bot.name}] ${l}`); }
    });
  };
  pipe(child.stdout); pipe(child.stderr);
  child.on("exit", (code) => {
    console.log(`[launcher] ${bot.name} exited (${code}) - restarting in 5s`);
    children.delete(bot.name);
    setTimeout(() => start(bot), 5000);
  });
  console.log(`[launcher] started ${bot.name} (${bot.role})`);
}
bots.forEach((b, i) => setTimeout(() => start(b), (b.startDelaySec != null ? b.startDelaySec : i * 20) * 1000));
const killAll = () => { for (const c of children.values()) { try { c.kill("SIGKILL"); } catch (_) {} } };
process.on("exit", killAll);
process.on("SIGINT", () => { killAll(); process.exit(0); });
process.on("SIGTERM", () => { killAll(); process.exit(0); });
