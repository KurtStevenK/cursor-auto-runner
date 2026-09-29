/* Verify better-sqlite3 loads inside Electron after rebuild. */
const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (v)');
    db.prepare('INSERT INTO t VALUES (?)').run(42);
    const row = db.prepare('SELECT v FROM t').get();
    console.log('SQLITE OK, row =', JSON.stringify(row));
    db.close();
  } catch (err) {
    console.error('SQLITE FAILED:', err.message);
    app.exitCode = 1;
  }
  app.exit(app.exitCode ?? 0);
});
