const express = require('express');
const session = require('express-session');
const { createDb, initDb, buildReceitaQuery, getReceitas } = require('./db');
const { registerRoutes } = require('./routes');
const Mailer = require('./mailer');

function createApp(options = {}) {
  const db = options.db || createDb();
  const mailer = options.mailer || new Mailer({ transport: options.transport });
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'segredo',
    resave: false,
    saveUninitialized: true
  }));

  app.use(express.static('public'));

  registerRoutes(app, db, mailer);

  return app;
}

module.exports = {
  createDb,
  createApp,
  initDb,
  buildReceitaQuery,
  getReceitas,
  Mailer
};
