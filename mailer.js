const nodemailer = require('nodemailer');

class Mailer {
  constructor(options = {}) {
    this.transport = options.transport || this.createTransport();
    this.from = options.from || process.env.EMAIL_FROM || 'no-reply@example.com';
    this.to = options.to || process.env.EMAIL_TO || 'admin@example.com';
  }

  createTransport() {
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

  verify() {
    return new Promise((resolve, reject) => {
      if (!this.transport || typeof this.transport.verify !== 'function') {
        return resolve(false);
      }

      this.transport.verify((err, success) => {
        if (err) {
          return reject(err);
        }
        resolve(success);
      });
    });
  }

  sendNotification(action, receita) {
    if (!this.transport) {
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

    return this.transport.sendMail({
      from: this.from,
      to: this.to,
      subject,
      html
    });
  }
}

module.exports = Mailer;
