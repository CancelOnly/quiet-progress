const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'quiet_progress.db');

let db = null;

function connectDatabase() {
  db = new sqlite3.Database(DB_PATH, (error) => {
    if (error) {
      console.error('[SQLite] Erro ao abrir banco:', error.message);
      process.exit(1);
    }

    console.log(`[SQLite] Banco conectado em: ${DB_PATH}`);
  });

  return db;
}

function getDb() {
  if (!db) {
    connectDatabase();
  }

  return db;
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      db = null;
      resolve();
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run('PRAGMA foreign_keys = ON');

  await run(`
    CREATE TABLE IF NOT EXISTS habitos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL UNIQUE,
      subtitulo TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS habitos_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habito_id INTEGER NOT NULL,
      data_registro TEXT NOT NULL,
      concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1)),
      FOREIGN KEY (habito_id) REFERENCES habitos(id) ON DELETE CASCADE,
      UNIQUE (habito_id, data_registro)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      prioridade TEXT NOT NULL DEFAULT 'MÉDIA' CHECK (prioridade IN ('ALTA', 'MÉDIA', 'BAIXA')),
      status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONCLUIDO')),
      data_criacao TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mindset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_registro TEXT NOT NULL UNIQUE,
    energia INTEGER NOT NULL DEFAULT 2 CHECK (energia BETWEEN 1 AND 3),
    foco INTEGER NOT NULL DEFAULT 2 CHECK (foco BETWEEN 1 AND 3),
    humor INTEGER NOT NULL DEFAULT 2 CHECK (humor BETWEEN 1 AND 3),
    notas TEXT
    )
  `);

  await new Promise((resolve) => {
    db.run(`ALTER TABLE mindset ADD COLUMN notas TEXT`, (error) => {
      if (error) {
        // SQLite retorna erro se a coluna já existe. Isso é esperado.
        if (error.message.includes('duplicate column name')) {
          console.log('[SQLite] Coluna mindset.notas já existe.');
        } else {
          console.warn(
            '[SQLite] Não foi possível adicionar mindset.notas:',
            error.message
          );
        }
      } else {
        console.log('[SQLite] Coluna mindset.notas adicionada.');
      }

      resolve();
    });
  });

  const defaultHabits = [
    ['Beber água', 'Hidratação básica antes de cafeína infinita.'],
    ['Movimento físico', 'Treino, caminhada ou alongamento. Sem heroísmo.'],
    ['Bloco de foco', 'Uma sessão real sem pular para 12 abas.'],
    [
      'Fechamento do dia',
      'Registrar o que andou, o que travou e o próximo passo.',
    ],
  ];

  for (const [titulo, subtitulo] of defaultHabits) {
    await run(
      `INSERT OR IGNORE INTO habitos (titulo, subtitulo) VALUES (?, ?)`,
      [titulo, subtitulo]
    );
  }

  console.log('[SQLite] Estrutura inicializada.');
}

module.exports = {
  DB_PATH,
  getDb,
  connectDatabase,
  closeDatabase,
  run,
  get,
  all,
  initDatabase,
};
