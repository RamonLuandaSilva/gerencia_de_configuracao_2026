CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  login TEXT,
  senha TEXT,
  situacao TEXT
);

CREATE TABLE IF NOT EXISTS receita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  descricao TEXT,
  data_registro TEXT,
  custo REAL,
  tipo_receita TEXT
);

INSERT INTO usuario (nome, login, senha, situacao)
SELECT 'Admin', 'admin', '123', 'ativo'
WHERE NOT EXISTS (SELECT 1 FROM usuario);

INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
SELECT 'Coxinha', 'Salgado de frango', datetime('now'), 5.5, 'salgada'
WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Coxinha');

INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
SELECT 'Brigadeiro', 'Doce de chocolate', datetime('now'), 2.0, 'doce'
WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Brigadeiro');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Pastel', 'Carne', datetime('now'), 6.0, 'salgada'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Pastel');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Beijinho', 'Doce de coco', datetime('now'), 2.5, 'doce'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Beijinho');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Empada', 'Frango', datetime('now'), 7.0, 'salgada'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Empada');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Pudim', 'Leite condensado', datetime('now'), 8.0, 'doce'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Pudim');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Esfirra', 'Carne', datetime('now'), 4.0, 'salgada'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Esfirra');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Quindim', 'Coco e ovo', datetime('now'), 3.0, 'doce'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Quindim');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Kibe', 'Carne', datetime('now'), 5.0, 'salgada'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Kibe');

-- INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
-- SELECT 'Bolo', 'Chocolate', datetime('now'), 10.0, 'doce'
-- WHERE NOT EXISTS (SELECT 1 FROM receita WHERE nome = 'Bolo');
