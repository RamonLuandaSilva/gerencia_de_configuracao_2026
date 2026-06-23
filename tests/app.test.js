const request = require('supertest');
// const sqlite3 = require('sqlite3').verbose();
const {
  createDb,
  createApp,
  initDb,
  buildReceitaQuery,
  getReceitas
} = require('../app');

function runDb(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getDb(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// function allDb(db, sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => {
//       if (err) return reject(err);
//       resolve(rows);
//     });
//   });
// }

describe('Receitas App', () => {
  let db;
  let app;
  let agent;
  let transport;

  beforeEach(async () => {
    db = createDb(':memory:');
    transport = { sendMail: jest.fn().mockResolvedValue({}) };
    app = createApp({ db, transport });
    await initDb(db);
    agent = request.agent(app);
  });

  afterEach(() => {
    db.close();
  });

  test('buildReceitaQuery without filters', () => {
    const query = buildReceitaQuery();
    expect(query.sql).toContain('SELECT * FROM receita');
    expect(query.params).toEqual([]);
  });

  test('buildReceitaQuery with date filter', () => {
    const query = buildReceitaQuery({ date: '2026-01-01' });
    expect(query.sql).toContain("date(data_registro) = ?");
    expect(query.params).toEqual(['2026-01-01']);
  });

  test('buildReceitaQuery with status filter', () => {
    const query = buildReceitaQuery({ status: 'doce' });
    expect(query.sql).toContain('tipo_receita = ?');
    expect(query.params).toEqual(['doce']);
  });

  test('buildReceitaQuery with both filters', () => {
    const query = buildReceitaQuery({ status: 'salgada', date: '2026-01-01' });
    expect(query.sql).toContain('WHERE tipo_receita = ? AND date(data_registro) = ?');
    expect(query.params).toEqual(['salgada', '2026-01-01']);
  });

  test('initDb creates default admin user', async () => {
    const user = await getDb(db, 'SELECT * FROM usuario WHERE login = ?', ['admin']);
    expect(user).toBeTruthy();
    expect(user.nome).toBe('Admin');
  });

  test('GET /receitas returns 401 without login', async () => {
    await agent.get('/receitas').expect(401);
  });

  test('POST /login invalid credentials returns 401', async () => {
    await agent.post('/login').send({ login: 'bad', senha: 'bad' }).expect(401);
  });

  test('POST /login with valid admin redirects', async () => {
    const res = await agent.post('/login').send({ login: 'admin', senha: '123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/receitas.html');
  });

  test('GET /receitas after login returns recipe list', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const res = await agent.get('/receitas').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /receitas creates a recipe and sends email', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    await agent.post('/receitas').send({ nome: 'Teste', descricao: 'Nova receita', custo: 3.5, tipo_receita: 'doce' }).expect(200);

    const receita = await getDb(db, 'SELECT * FROM receita WHERE nome = ?', ['Teste']);
    expect(receita).toBeTruthy();
    expect(transport.sendMail).toHaveBeenCalled();
  });

  test('POST /receitas returns 200 on create', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    await agent.post('/receitas').send({ nome: 'Teste2', descricao: 'Receita 2', custo: 4.0, tipo_receita: 'salgada' }).expect(200);
  });

  test('PUT /receitas/:id updates a recipe and sends email', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const created = await runDb(db, 'INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita) VALUES (?, ?, datetime("now"), ?, ?)', ['Editar', 'Antes', 2.5, 'doce']);
    await agent.put(`/receitas/${created.lastID}`).send({ nome: 'Editar', descricao: 'Depois', custo: 2.5, tipo_receita: 'doce' }).expect(200);

    const receita = await getDb(db, 'SELECT * FROM receita WHERE id = ?', [created.lastID]);
    expect(receita.descricao).toBe('Depois');
    expect(transport.sendMail).toHaveBeenCalled();
  });

  test('PUT /receitas/:id returns 200', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const created = await runDb(db, 'INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita) VALUES (?, ?, datetime("now"), ?, ?)', ['Atualiza', 'Antes', 5.0, 'salgada']);
    await agent.put(`/receitas/${created.lastID}`).send({ nome: 'Atualiza', descricao: 'Depois', custo: 5.0, tipo_receita: 'salgada' }).expect(200);
  });

  test('DELETE /receitas/:id removes a recipe', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const created = await runDb(db, 'INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita) VALUES (?, ?, datetime("now"), ?, ?)', ['Apaga', 'Excluir', 4.0, 'doce']);
    await agent.delete(`/receitas/${created.lastID}`).expect(200);
    const receita = await getDb(db, 'SELECT * FROM receita WHERE id = ?', [created.lastID]);
    expect(receita).toBeUndefined();
  });

  test('GET /receitas with status filter returns filtered items', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const res = await agent.get('/receitas?status=doce').expect(200);
    expect(res.body.every(item => item.tipo_receita === 'doce')).toBe(true);
  });

  test('GET /receitas with date filter returns matching rows', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const date = new Date().toISOString().split('T')[0];
    await runDb(db, 'INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita) VALUES (?, ?, ?, ?, ?)', ['DataFiltro', 'Teste', `${date} 12:00:00`, 5, 'doce']);
    const res = await agent.get(`/receitas?date=${date}`).expect(200);
    expect(res.body.some(item => item.nome === 'DataFiltro')).toBe(true);
  });

  test('GET /receitas/export/pdf returns a PDF file', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const res = await agent.get('/receitas/export/pdf').buffer(true).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.length).toBeGreaterThan(100);
  });

  test('GET /receitas/export/pdf includes data when there are recipes', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const res = await agent.get('/receitas/export/pdf').buffer(true).expect(200);
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(200);
  });

  test('GET /receitas returns an array after login', async () => {
    await agent.post('/login').send({ login: 'admin', senha: '123' });
    const res = await agent.get('/receitas').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('getReceitas returns recipes from the database', async () => {
    const rows = await getReceitas(db, {});
    expect(rows.length).toBeGreaterThan(0);
  });

  test('createApp attaches auth and routes', async () => {
    const res = await agent.get('/receitas').expect(401);
    expect(res.text).toBe('Não autorizado');
  });
});
