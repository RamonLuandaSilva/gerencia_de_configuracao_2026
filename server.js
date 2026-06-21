const { createApp, createDb, initDb } = require('./app');

const db = createDb('./database.db');
const app = createApp({ db });

initDb(db).then(() => {
  app.listen(3000, () => {
    console.log('Rodando em http://localhost:3000');
  });
});