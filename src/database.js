const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(process.cwd(), 'quiet_progress.db')
);

let db = null;

function connectDatabase() {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
  if (!db) connectDatabase();
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

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function tableExists(table) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table]
  );

  return Boolean(row);
}

async function getColumns(table) {
  if (!(await tableExists(table))) return [];
  return all(`PRAGMA table_info(${table})`);
}

async function hasColumn(table, column) {
  const columns = await getColumns(table);
  return columns.some((item) => item.name === column);
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await hasColumn(table, column);

  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[SQLite] Migração: coluna adicionada ${table}.${column}`);
  }
}

async function createIndex(sql) {
  try {
    await run(sql);
  } catch (error) {
    console.warn('[SQLite] Índice não criado:', error.message);
  }
}

async function initDatabase() {
  connectDatabase();

  let legacyHabitTypeMigration = false;

  await run(`PRAGMA foreign_keys = ON`);
  await run(`PRAGMA journal_mode = WAL`).catch(() => {});
  await run(`PRAGMA synchronous = NORMAL`).catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS habitos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      subtitulo TEXT DEFAULT '',
      ativo INTEGER NOT NULL DEFAULT 1,
      cor TEXT DEFAULT NULL,
      ordem INTEGER DEFAULT 0,
      data_inicio TEXT DEFAULT NULL,
      data_fim TEXT DEFAULT NULL,
      archived_at TEXT DEFAULT NULL,
      habit_type TEXT NOT NULL DEFAULT 'build' CHECK (habit_type IN ('build', 'reduction')),
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS habitos_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habito_id INTEGER NOT NULL,
      data_ref TEXT NOT NULL,
      concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (habito_id) REFERENCES habitos(id),
      UNIQUE (habito_id, data_ref)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      prioridade TEXT NOT NULL DEFAULT 'MÉDIA',
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      data_ref TEXT NOT NULL,
      tipo TEXT DEFAULT 'task',
      ativo INTEGER NOT NULL DEFAULT 1,
      ordem INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mindset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_ref TEXT NOT NULL UNIQUE,
      energia INTEGER NOT NULL DEFAULT 2 CHECK (energia BETWEEN 1 AND 5),
      foco INTEGER NOT NULL DEFAULT 2 CHECK (foco BETWEEN 1 AND 5),
      motivacao INTEGER NOT NULL DEFAULT 2 CHECK (motivacao BETWEEN 1 AND 5),
      humor INTEGER NOT NULL DEFAULT 2 CHECK (humor BETWEEN 1 AND 5),
      notas TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'daily_checkin',
      time TEXT NOT NULL,
      days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      route TEXT NOT NULL DEFAULT '/',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      last_sent_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS day_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_ref TEXT NOT NULL UNIQUE,
      summary TEXT DEFAULT '',
      markdown TEXT DEFAULT '',
      closed_at TEXT,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_ref TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0, 1)),
      label TEXT DEFAULT 'Pomodoro',
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  /*
    Migrações defensivas para versões antigas.
    Não apaga histórico. Apenas cria colunas novas quando possível.
  */
  await addColumnIfMissing('habitos', 'subtitulo', "TEXT DEFAULT ''");
  await addColumnIfMissing('habitos', 'ativo', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('habitos', 'cor', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('habitos', 'ordem', 'INTEGER DEFAULT 0');
  await addColumnIfMissing('habitos', 'data_inicio', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('habitos', 'data_fim', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('habitos', 'archived_at', 'TEXT DEFAULT NULL');

  if (!(await hasColumn('habitos', 'habit_type'))) {
    legacyHabitTypeMigration = true;
    await addColumnIfMissing('habitos', 'habit_type', "TEXT NOT NULL DEFAULT 'build'");
  }

  await addColumnIfMissing('habitos', 'created_at', 'TEXT');
  await addColumnIfMissing('habitos', 'updated_at', 'TEXT');

  await addColumnIfMissing('habitos_log', 'data_ref', 'TEXT');
  await addColumnIfMissing('habitos_log', 'concluido', 'INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1))');
  await addColumnIfMissing('habitos_log', 'created_at', 'TEXT');
  await addColumnIfMissing('habitos_log', 'updated_at', 'TEXT');

  await addColumnIfMissing('tarefas', 'descricao', "TEXT DEFAULT ''");
  await addColumnIfMissing('tarefas', 'prioridade', "TEXT NOT NULL DEFAULT 'MÉDIA'");
  await addColumnIfMissing('tarefas', 'status', "TEXT NOT NULL DEFAULT 'PENDENTE'");
  await addColumnIfMissing('tarefas', 'data_ref', 'TEXT');
  await addColumnIfMissing('tarefas', 'tipo', "TEXT DEFAULT 'task'");
  await addColumnIfMissing('tarefas', 'ativo', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('tarefas', 'ordem', 'INTEGER DEFAULT 0');
  await addColumnIfMissing('tarefas', 'created_at', 'TEXT');
  await addColumnIfMissing('tarefas', 'updated_at', 'TEXT');

  await addColumnIfMissing('mindset', 'data_ref', 'TEXT');
  await addColumnIfMissing('mindset', 'energia', 'INTEGER NOT NULL DEFAULT 2 CHECK (energia BETWEEN 1 AND 5)');
  await addColumnIfMissing('mindset', 'foco', 'INTEGER NOT NULL DEFAULT 2 CHECK (foco BETWEEN 1 AND 5)');
  await addColumnIfMissing('mindset', 'motivacao', 'INTEGER NOT NULL DEFAULT 2 CHECK (motivacao BETWEEN 1 AND 5)');
  await addColumnIfMissing('mindset', 'humor', 'INTEGER NOT NULL DEFAULT 2 CHECK (humor BETWEEN 1 AND 5)');
  await addColumnIfMissing('mindset', 'notas', "TEXT DEFAULT ''");
  await addColumnIfMissing('mindset', 'created_at', 'TEXT');
  await addColumnIfMissing('mindset', 'updated_at', 'TEXT');

  const now = nowISO();
  const today = todayISO();

  await run(`
    UPDATE habitos
    SET habit_type = CASE
      WHEN LOWER(COALESCE(habit_type, 'build')) = 'reduction' THEN 'reduction'
      ELSE 'build'
    END
    WHERE habit_type IS NULL
       OR LOWER(habit_type) NOT IN ('build', 'reduction')
       OR habit_type != LOWER(habit_type)
  `).catch(() => {});

  await run(`UPDATE habitos SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)`, [now, now]);

  if (await hasColumn('habitos_log', 'data_registro')) {
    await run(`
      UPDATE habitos_log
      SET data_ref = COALESCE(data_ref, data_registro, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  } else {
    await run(`
      UPDATE habitos_log
      SET data_ref = COALESCE(data_ref, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  }

  await run(`
    UPDATE habitos_log
    SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)
  `, [now, now]);

  if (await hasColumn('tarefas', 'data_criacao')) {
    await run(`
      UPDATE tarefas
      SET data_ref = COALESCE(data_ref, data_criacao, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  } else if (await hasColumn('tarefas', 'data_agendada')) {
    await run(`
      UPDATE tarefas
      SET data_ref = COALESCE(data_ref, data_agendada, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  } else {
    await run(`
      UPDATE tarefas
      SET data_ref = COALESCE(data_ref, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  }

  if (await hasColumn('tarefas', 'concluido')) {
    await run(`
      UPDATE tarefas
      SET status = CASE WHEN concluido = 1 THEN 'CONCLUIDO' ELSE status END
      WHERE concluido IS NOT NULL
    `).catch(() => {});
  }

  await run(`
    UPDATE tarefas
    SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?),
        descricao = COALESCE(descricao, subtitulo, ''),
        prioridade = COALESCE(prioridade, 'MÉDIA'),
        status = COALESCE(status, 'PENDENTE')
  `, [now, now]).catch(async () => {
    await run(`
      UPDATE tarefas
      SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?),
          descricao = COALESCE(descricao, ''),
          prioridade = COALESCE(prioridade, 'MÉDIA'),
          status = COALESCE(status, 'PENDENTE')
    `, [now, now]);
  });

  if (await hasColumn('mindset', 'data_registro')) {
    await run(`
      UPDATE mindset
      SET data_ref = COALESCE(data_ref, data_registro, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  } else {
    await run(`
      UPDATE mindset
      SET data_ref = COALESCE(data_ref, ?)
      WHERE data_ref IS NULL OR TRIM(data_ref) = ''
    `, [today]);
  }

  await run(`
    UPDATE mindset
    SET created_at = COALESCE(created_at, ?),
        updated_at = COALESCE(updated_at, ?),
        motivacao = COALESCE(motivacao, 2),
        humor = COALESCE(humor, 2),
        notas = COALESCE(notas, '')
  `, [now, now]);

  await createIndex(`CREATE INDEX IF NOT EXISTS idx_habitos_ativo ON habitos(ativo)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_habitos_datas ON habitos(data_inicio, data_fim)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_habitos_log_data ON habitos_log(data_ref)`);
  await createIndex(`CREATE UNIQUE INDEX IF NOT EXISTS idx_habitos_log_unique ON habitos_log(habito_id, data_ref)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_tarefas_data ON tarefas(data_ref)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_tarefas_data_ativo ON tarefas(data_ref, ativo)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_mindset_data ON mindset(data_ref)`);
  await createIndex(`CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_reminders_enabled_time ON reminders(enabled, time)`);
  await createIndex(`CREATE UNIQUE INDEX IF NOT EXISTS idx_day_closures_data ON day_closures(data_ref)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_focus_sessions_data ON focus_sessions(data_ref)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_focus_sessions_completed ON focus_sessions(data_ref, completed)`);


  const reminderCount = await get(`SELECT COUNT(*) AS total FROM reminders`);
  if (Number(reminderCount?.total || 0) === 0) {
    await run(
      `
      INSERT INTO reminders (title, message, type, time, days_of_week, enabled, route, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `,
      [
        'Check-in diário',
        'Hora de registrar energia, foco, motivação, humor e nota do dia.',
        'daily_checkin',
        '21:30',
        '[0,1,2,3,4,5,6]',
        '/?view=tracker',
        now,
        now
      ]
    );
  }

  const defaultSettings = [
    ['auto_backup_enabled', 'true'],
    ['auto_backup_retention_days', '30'],
    ['pomodoro_mark_focus_habit', 'ask'],
  ];

  for (const [key, value] of defaultSettings) {
    await run(
      `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO NOTHING
      `,
      [key, value, now]
    ).catch(() => {});
  }

  const count = await get(`SELECT COUNT(*) AS total FROM habitos`);
  if (Number(count?.total || 0) === 0) {
    const defaults = [
      ['Beber água', 'Hidratação básica diária.', '#11CAA0'],
      ['Movimento físico', 'Treino, caminhada ou alongamento.', '#DEFF9A'],
      ['Bloco de foco', 'Sessão real de trabalho profundo.', '#BC84EE'],
      ['Fechamento do dia', 'Registrar aprendizados e próximo passo.', '#FFD166']
    ];

    for (let i = 0; i < defaults.length; i += 1) {
      const [titulo, subtitulo, cor] = defaults[i];
      await run(
        `
        INSERT INTO habitos (titulo, subtitulo, cor, ordem, ativo, habit_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, 'build', ?, ?)
        `,
        [titulo, subtitulo, cor, i, now, now]
      );
    }
  }

  console.log('[SQLite] Estrutura v3 temporal inicializada.');

  return { legacyHabitTypeMigration };
}

function databaseExists() {
  return fs.existsSync(DB_PATH);
}

module.exports = {
  DB_PATH,
  connectDatabase,
  closeDatabase,
  run,
  get,
  all,
  initDatabase,
  databaseExists
};
