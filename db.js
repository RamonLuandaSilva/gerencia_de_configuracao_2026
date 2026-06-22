const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const migrationsDir = path.join(__dirname, 'migrations');
const migrationsTable = 'schema_version';

function createDb(filename = process.env.DB_FILE || './database.db') {
  return new sqlite3.Database(filename);
}

function buildReceitaQuery(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('tipo_receita = ?');
    params.push(filters.status);
  }

  if (filters.date) {
    where.push("date(data_registro) = ?");
    params.push(filters.date);
  }

  let sql = 'SELECT * FROM receita';

  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY data_registro DESC';

  return { sql, params };
}

function getReceitas(db, filters = {}) {
  const { sql, params } = buildReceitaQuery(filters);

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

function ensureMigrationsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      version TEXT PRIMARY KEY,
      description TEXT,
      installed_on TEXT NOT NULL DEFAULT (datetime('now'))
    )`, err => err ? reject(err) : resolve());
  });
}

function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs.readdirSync(migrationsDir)
    .filter(name => /^V\d+__.*\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

function getAppliedMigrationVersions(db) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT version FROM ${migrationsTable}`, (err, rows) => {
      if (err) {
        return reject(err);
      }
      const applied = new Set(rows.map(row => row.version));
      resolve(applied);
    });
  });
}

function migrationVersion(fileName) {
  return fileName.replace(/\.sql$/i, '');
}

function migrationDescription(fileName) {
  const parts = fileName.split('__');
  return parts[1] ? parts[1].replace(/\.sql$/i, '').replace(/_/g, ' ') : '';
}

function runSqlFile(db, filePath) {
  return new Promise((resolve, reject) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    db.exec(sql, err => err ? reject(err) : resolve());
  });
}

function applyMigration(db, fileName) {
  const version = migrationVersion(fileName);
  const description = migrationDescription(fileName);
  const filePath = path.join(migrationsDir, fileName);

  return runSqlFile(db, filePath)
    .then(() => new Promise((resolve, reject) => {
      db.run(`INSERT INTO ${migrationsTable} (version, description) VALUES (?, ?)`,
        [version, description], err => err ? reject(err) : resolve());
    }));
}

function runMigrations(db) {
  return ensureMigrationsTable(db)
    .then(() => getAppliedMigrationVersions(db))
    .then(applied => {
      const files = getMigrationFiles();
      const pending = files.filter(file => !applied.has(migrationVersion(file)));
      return pending.reduce((promise, file) => promise.then(() => applyMigration(db, file)), Promise.resolve());
    });
}

function initDb(db) {
  return runMigrations(db);
}

module.exports = {
  createDb,
  buildReceitaQuery,
  getReceitas,
  initDb,
  runMigrations
};
