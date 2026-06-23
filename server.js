const { createApp, createDb, initDb, Mailer } = require('./app');

const db = createDb();
const mailer = new Mailer();
const app = createApp({ db, mailer });

// TODO: Isso aqui quebra a pipeline
const ahsdah = 1;

initDb(db).then(() => {
  app.listen(3000, () => {
    console.log('Rodando em http://localhost:3000');
  });
});
