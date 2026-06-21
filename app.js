const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

function createDb(filename = './database.db') {
  return new sqlite3.Database(filename);
}

function createEmailTransport() {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  return nodemailer.createTransport({
    jsonTransport: true
  });
}

function sendNotificationEmail(transport, action, receita) {
  if (!transport) {
    return Promise.resolve();
  }

  const subject = `Receita ${action}: ${receita.nome}`;
  const html = `
    <h2>Receita ${action}</h2>
    <p><strong>Nome:</strong> ${receita.nome}</p>
    <p><strong>Descrição:</strong> ${receita.descricao}</p>
    <p><strong>Custo:</strong> ${receita.custo}</p>
    <p><strong>Tipo:</strong> ${receita.tipo_receita}</p>
    <p><strong>Data de registro:</strong> ${receita.data_registro}</p>
  `;

  return transport.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    to: process.env.EMAIL_TO || 'admin@example.com',
    subject,
    html
  });
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

function createApp(options = {}) {
  const db = options.db || createDb('./database.db');
  const transport = options.transport || createEmailTransport();
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'segredo',
    resave: false,
    saveUninitialized: true
  }));

  app.use(express.static('public'));

  function auth(req, res, next) {
    if (req.session.user) {
      return next();
    }
    res.status(401).send('Não autorizado');
  }

  app.post('/login', (req, res) => {
    const { login, senha } = req.body;

    db.get(`SELECT * FROM usuario WHERE login = ? AND senha = ?`,
      [login, senha],
      (err, user) => {
        if (err) {
          return res.status(500).send('Erro no banco');
        }

        if (user) {
          req.session.user = user;
          return res.redirect('/receitas.html');
        }

        res.status(401).send('Login inválido');
      });
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/index.html');
    });
  });

  app.get('/receitas.html', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receitas.html'));
  });

  app.get('/receitas', auth, async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        date: req.query.date
      };
      const rows = await getReceitas(db, filters);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao recuperar receitas' });
    }
  });

  app.get('/receitas/export/pdf', auth, async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        date: req.query.date
      };

      const rows = await getReceitas(db, filters);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=receitas.pdf');

      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(18).text('Lista de Receitas', { align: 'center' });
      doc.moveDown();

      if (!rows.length) {
        doc.text('Nenhuma receita encontrada.');
      } else {
        rows.forEach((r, index) => {
          doc.fontSize(12).text(`${index + 1}. ${r.nome}`, { underline: true });
          doc.text(`Descrição: ${r.descricao}`);
          doc.text(`Custo: ${r.custo}`);
          doc.text(`Tipo: ${r.tipo_receita}`);
          doc.text(`Data de registro: ${r.data_registro}`);
          doc.moveDown();
        });
      }

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
  });

  app.post('/receitas', auth, (req, res) => {
    const { nome, descricao, custo, tipo_receita } = req.body;

    db.run(`INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
            VALUES (?, ?, datetime('now'), ?, ?)`,
      [nome, descricao, custo, tipo_receita], function (err) {
        if (err) {
          return res.status(500).json({ error: 'Erro ao criar receita' });
        }

        const insertedId = this.lastID;
        db.get('SELECT * FROM receita WHERE id = ?', [insertedId], async (err, receita) => {
          if (!err && receita) {
            await sendNotificationEmail(transport, 'criada', receita).catch(() => {});
          }
          res.sendStatus(200);
        });
      });
  });

  app.put('/receitas/:id', auth, (req, res) => {
    const { nome, descricao, custo, tipo_receita } = req.body;

    db.run(`UPDATE receita SET nome = ?, descricao = ?, custo = ?, tipo_receita = ? WHERE id = ?`,
      [nome, descricao, custo, tipo_receita, req.params.id], function (err) {
        if (err) {
          return res.status(500).json({ error: 'Erro ao atualizar receita' });
        }

        db.get('SELECT * FROM receita WHERE id = ?', [req.params.id], async (err, receita) => {
          if (!err && receita) {
            await sendNotificationEmail(transport, 'atualizada', receita).catch(() => {});
          }
          res.sendStatus(200);
        });
      });
  });

  app.delete('/receitas/:id', auth, (req, res) => {
    db.run(`DELETE FROM receita WHERE id = ?`, [req.params.id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao excluir receita' });
      }
      res.sendStatus(200);
    });
  });

  return app;
}

module.exports = {
  createDb,
  createEmailTransport,
  createApp,
  initDb,
  buildReceitaQuery,
  getReceitas,
  sendNotificationEmail
};
