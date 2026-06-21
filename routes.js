const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { getReceitas } = require('./db');

function createEmailTransport() {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return require('nodemailer').createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  return require('nodemailer').createTransport({
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

function auth(req, res, next) {
  if (req.session.user) {
    return next();
  }

  res.status(401).send('Não autorizado');
}

function registerRoutes(app, db, transport) {
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
}

module.exports = {
  createEmailTransport,
  sendNotificationEmail,
  registerRoutes
};
