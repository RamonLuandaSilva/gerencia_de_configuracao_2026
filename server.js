const { createApp, createDb, initDb, Mailer } = require('./app');

const db = createDb('./database.db');
const mailer = new Mailer();
const app = createApp({ db, mailer });

initDb(db).then(() => {
  app.listen(3000, () => {
    console.log('Rodando em http://localhost:3000');
  });
});
