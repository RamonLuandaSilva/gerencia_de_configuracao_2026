const sqlite3 = require('sqlite3').verbose();

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

// initDb provides a bootstrap schema and default data for local usage.
// For production migration workflows (Flyway, Liquibase, etc.), replace or augment this
// initialization with a migration-based mechanism.
function initDb(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS usuario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        login TEXT,
        senha TEXT,
        situacao TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS receita (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        descricao TEXT,
        data_registro TEXT,
        custo REAL,
        tipo_receita TEXT
      )`);

      db.run(`INSERT INTO usuario (nome, login, senha, situacao)
              SELECT 'Admin', 'admin', '123', 'ativo'
              WHERE NOT EXISTS (SELECT 1 FROM usuario)`);

      const receitas = [
        ['Coxinha', 'Salgado de frango', 5.5, 'salgada'],
        ['Brigadeiro', 'Doce de chocolate', 2.0, 'doce'],
        ['Pastel', 'Carne', 6.0, 'salgada'],
        ['Beijinho', 'Doce de coco', 2.5, 'doce'],
        ['Empada', 'Frango', 7.0, 'salgada'],
        ['Pudim', 'Leite condensado', 8.0, 'doce'],
        ['Esfirra', 'Carne', 4.0, 'salgada'],
        ['Quindim', 'Coco e ovo', 3.0, 'doce'],
        ['Kibe', 'Carne', 5.0, 'salgada'],
        ['Bolo', 'Chocolate', 10.0, 'doce']
      ];

      receitas.forEach(r => {
        db.run(`INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
                SELECT ?, ?, datetime('now'), ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM receita WHERE nome = ?
                )`,
          [...r, r[0]]);
      });

      resolve();
    });
  });
}

module.exports = {
  createDb,
  buildReceitaQuery,
  getReceitas,
  initDb
};
