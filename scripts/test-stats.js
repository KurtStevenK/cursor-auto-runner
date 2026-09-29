/* Integration diagnostic for the aggregated SQLite stats snapshot. */
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.whenReady().then(() => {
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-auto-runner-stats-'));
  const { StatsStore } = require(path.join(__dirname, '..', 'dist', 'src', 'main', 'stats.js'));
  const store = new StatsStore(temporaryDir);
  try {
    assert.equal(fs.existsSync(path.join(temporaryDir, 'stats.db')), true, 'SQLite backend did not initialize');
    const empty = store.snapshot('idle');
    assert.equal(empty.total, 0);
    assert.equal(empty.byDay.length, 7);

    store.record('run');
    store.record('always-run');
    const populated = store.snapshot('run');
    assert.equal(populated.session, 2);
    assert.equal(populated.day, 2);
    assert.equal(populated.week, 2);
    assert.equal(populated.month, 2);
    assert.equal(populated.total, 2);
    assert.equal(populated.byDay.reduce((sum, bucket) => sum + bucket.count, 0), 2);
    console.log('STATS OK', JSON.stringify(populated));
  } finally {
    store.dispose();
    fs.rmSync(temporaryDir, { recursive: true, force: true });
    app.exit(0);
  }
}).catch((error) => {
  console.error('STATS FAILED', error);
  app.exit(1);
});
