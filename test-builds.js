const { BUILDS, commandsFor, spiral } = require("./builds");
let bad = 0;
for (const t of Object.keys(BUILDS)) {
  const cmds = commandsFor(t, { x0: 100, z0: 200, y: 64, seed: 7 });
  const nan = cmds.filter((c) => /NaN|undefined/.test(c) || c.length > 250);
  const vol = cmds.filter((c) => { const m = c.match(/^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/); return m && (Math.abs(m[4]-m[1])+1)*(Math.abs(m[5]-m[2])+1)*(Math.abs(m[6]-m[3])+1) > 32768; });
  console.log(t.padEnd(14), cmds.length, "commands", nan.length || vol.length ? "PROBLEM" : "ok");
  if (nan.length || vol.length) bad++;
}
console.log("spiral", JSON.stringify(spiral(6)));
process.exit(bad ? 1 : 0);
