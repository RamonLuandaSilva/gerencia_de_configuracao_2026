const { createDb, runMigrations } = require('./db');

const db = createDb(process.env.DB_FILE || './database.db');

runMigrations(db)
  .then(() => {
    console.log('Migrações aplicadas com sucesso.');
    db.close();
  })
  .catch(err => {
    console.error('Falha ao aplicar migrações:', err);
    db.close();
    process.exit(1);
  });
