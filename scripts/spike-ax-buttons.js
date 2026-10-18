#!/usr/bin/env node
/**
 * SPIKE (A1): can the macOS Accessibility API locate Cursor's Run / Always Run / Allow buttons
 * without screenshots? Walks Cursor's AX tree via System Events (JXA). Dry-run by default.
 *
 *   node scripts/spike-ax-buttons.js            # enable AXEnhancedUserInterface, walk, report
 *   node scripts/spike-ax-buttons.js --no-enable  # walk without touching AX attributes
 *   node scripts/spike-ax-buttons.js --press    # press if exactly one "Run" match
 */
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const PRESS = args.includes('--press');
const ENABLE = !args.includes('--no-enable');

const jxa = `
function run() {
  var cfg = ${JSON.stringify({ PRESS, ENABLE })};
  var MAX_DEPTH = 25, MAX_NODES = 20000, BUDGET_MS = 8000;
  var re = /^(Run|Always Run|Allow|Approve|Accept|Run command)/i;
  var se = Application('System Events');
  var out = { running: false };
  var procs = se.processes.whose({ name: 'Cursor' });
  if (procs.length === 0) return JSON.stringify(out);
  var p = procs[0];
  out.running = true;
  if (cfg.ENABLE) {
    out.enable = {};
    ['AXEnhancedUserInterface', 'AXManualAccessibility'].forEach(function (a) {
      try { p.attributes[a].value = true; out.enable[a] = 'ok'; }
      catch (e) { out.enable[a] = 'fail: ' + String(e).slice(0, 80); }
    });
  }
  var t0 = Date.now(), visited = 0, roles = {}, matches = [], truncated = '';
  function s(f) { try { var v = f(); return v == null ? '' : String(v); } catch (e) { return ''; } }
  function walk(el, depth, win) {
    if (truncated) return;
    if (visited >= MAX_NODES) { truncated = 'node limit'; return; }
    if (Date.now() - t0 > BUDGET_MS) { truncated = 'time budget'; return; }
    if (depth > MAX_DEPTH) { truncated = truncated || 'depth limit'; return; }
    visited++;
    var role = s(function () { return el.role(); });
    roles[role || '?'] = (roles[role || '?'] || 0) + 1;
    var rd = s(function () { return el.roleDescription(); });
    if (role === 'AXButton' || /button/i.test(rd)) {
      var name = s(function () { return el.name(); }), title = s(function () { return el.title(); }),
          desc = s(function () { return el.description(); }), val = s(function () { return el.value(); });
      var hit = [name, title, desc, val].filter(function (x) { return re.test(x.trim()); })[0];
      if (hit !== undefined) {
        matches.push({ role: role, name: hit, position: s(function () { return el.position(); }),
          size: s(function () { return el.size(); }), window: win, _el: el });
      }
    }
    var kids = [];
    try { kids = el.uiElements(); } catch (e) {}
    for (var i = 0; i < kids.length; i++) walk(kids[i], depth + 1, win);
  }
  var wins = p.windows();
  out.windowCount = wins.length;
  for (var w = 0; w < wins.length; w++) walk(wins[w], 0, s(function () { return wins[w].name(); }));
  out.visited = visited; out.roles = roles; out.walkMs = Date.now() - t0; out.truncated = truncated;
  var runs = matches.filter(function (m) { return /^run$/i.test(m.name.trim()); });
  out.pressed = null;
  if (cfg.PRESS) {
    if (runs.length === 1) {
      try { runs[0]._el.actions.byName('AXPress').perform(); out.pressed = 'ok'; }
      catch (e) { out.pressed = 'fail: ' + String(e).slice(0, 120); }
    } else out.pressed = 'skipped: ' + runs.length + ' "Run" matches';
  }
  out.matches = matches.map(function (m) { delete m._el; return m; });
  return JSON.stringify(out);
}
`;

const t = Date.now();
const r = spawnSync('osascript', ['-l', 'JavaScript', '-e', jxa], { encoding: 'utf8', timeout: 60000 });
const wall = Date.now() - t;
if (r.status !== 0) {
  const err = (r.stderr || '').trim();
  console.error('osascript failed:', err);
  if (/not allowed assistive|-25211|1743|not authorized/i.test(err)) {
    console.error('=> The calling process lacks Accessibility permission (System Settings > Privacy & Security > Accessibility).');
  }
  process.exit(1);
}
let o;
try { o = JSON.parse(r.stdout.trim()); } catch { console.error('Unparseable output:', r.stdout); process.exit(1); }
if (!o.running) { console.log('Cursor process not running. Nothing to walk.'); process.exit(0); }
console.log('enable attrs:', o.enable ? JSON.stringify(o.enable) : '(skipped, --no-enable)');
console.log(`windows: ${o.windowCount}, elements visited: ${o.visited}${o.truncated ? ' (stopped: ' + o.truncated + ')' : ''}`);
console.log(`walk time: ${o.walkMs} ms in-script, ${wall} ms wall (incl. osascript startup)`);
console.log('roles:', JSON.stringify(Object.fromEntries(Object.entries(o.roles || {}).sort((a, b) => b[1] - a[1]))));
console.log(`matching buttons: ${(o.matches || []).length}`);
for (const m of o.matches || []) console.log(`  ${m.role} "${m.name}" pos=${m.position} size=${m.size} window="${m.window}"`);
if (PRESS) console.log('press:', o.pressed);
