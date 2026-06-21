const express = require('express');
const session = require('express-session');
const { createDb, initDb, buildReceitaQuery, getReceitas } = require('./db');
const { registerRoutes, createEmailTransport } = require('./routes');

function createApp(options = {}) {
  const db = options.db || createDb();
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

  registerRoutes(app, db, transport);

  return app;
}

module.exports = {
  createDb,
  createEmailTransport,
  createApp,
  initDb,
  buildReceitaQuery,
  getReceitas
};
