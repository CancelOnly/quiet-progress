const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');

const {
  DB_PATH,
  initDatabase,
  closeDatabase,
  connectDatabase,
  run,
  get,
  all,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.db')) {
      callback(new Error('Apenas arquivos .db são permitidos.'));
      return;
    }

    callback(null, true);
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function getPaginationParams(request, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);
  const rawLimit = Number.parseInt(request.query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, amount) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getLast7Days() {
  const today = todayISO();
  const dates = [];

  for (let i = 6; i >= 0; i--) {
    dates.push(addDaysISO(today, -i));
  }

  return dates;
}

async function calculateHabitStreak(habitId, baseDate = todayISO()) {
  let streak = 0;
  let cursor = baseDate;

  const todayLog = await get(
    `
    SELECT concluido
    FROM habitos_log
    WHERE habito_id = ?
      AND data_registro = ?
    `,
    [habitId, baseDate]
  );

  // Se hoje ainda não foi marcado, começa contando de ontem.
  if (!todayLog || Number(todayLog.concluido) !== 1) {
    cursor = addDaysISO(baseDate, -1);
  }

  while (true) {
    const row = await get(
      `
      SELECT concluido
      FROM habitos_log
      WHERE habito_id = ?
        AND data_registro = ?
      `,
      [habitId, cursor]
    );

    if (!row || Number(row.concluido) !== 1) break;

    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }

  return streak;
}

function normalizePriority(priority = 'MÉDIA') {
  const value = String(priority).trim().toUpperCase();

  if (['ALTA', 'MÉDIA', 'MEDIA', 'BAIXA'].includes(value)) {
    return value === 'MEDIA' ? 'MÉDIA' : value;
  }

  return 'MÉDIA';
}

function normalizeStatus(status = 'PENDENTE') {
  const value = String(status).trim().toUpperCase();

  if (['PENDENTE', 'CONCLUIDO', 'CONCLUÍDO'].includes(value)) {
    return value === 'CONCLUÍDO' ? 'CONCLUIDO' : value;
  }

  return 'PENDENTE';
}

async function getDashboardForDate(date) {
  const habitos = await all(
    `
    SELECT
      h.id,
      h.titulo,
      h.subtitulo,
      COALESCE(l.concluido, 0) AS concluido
    FROM habitos h
    LEFT JOIN habitos_log l
      ON l.habito_id = h.id
      AND l.data_registro = ?
    ORDER BY h.id ASC
  `,
    [date]
  );

  const tarefas = await all(
    `
    SELECT id, titulo, prioridade, status, data_criacao
    FROM tarefas
    WHERE data_criacao = ?
    ORDER BY
      CASE prioridade
        WHEN 'ALTA' THEN 1
        WHEN 'MÉDIA' THEN 2
        WHEN 'BAIXA' THEN 3
        ELSE 4
      END,
      id DESC
  `,
    [date]
  );

  let mindset = await get(
    `
    SELECT id, data_registro, energia, foco, humor, COALESCE(notas, '') AS notas
    FROM mindset
    WHERE data_registro = ?
  `,
    [date]
  );

  if (!mindset) {
    await run(
      `
      INSERT INTO mindset (data_registro, energia, foco, humor, notas)
      VALUES (?, 2, 2, 2, '')
    `,
      [date]
    );

    mindset = await get(
      `
    SELECT id, data_registro, energia, foco, humor, COALESCE(notas, '') AS notas
    FROM mindset
      WHERE data_registro = ?
    `,
      [date]
    );
  }

  const habitosConcluidos = habitos.filter(
    (habit) => Number(habit.concluido) === 1
  ).length;
  const tarefasConcluidas = tarefas.filter(
    (task) => task.status === 'CONCLUIDO'
  ).length;

  const totalItens = habitos.length + tarefas.length;
  const totalConcluidos = habitosConcluidos + tarefasConcluidas;
  const porcentagem =
    totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100);

  return {
    data: date,
    habitos: await Promise.all(
      habitos.map(async (habit) => ({
        ...habit,
        concluido: Number(habit.concluido) === 1,
        streak: await calculateHabitStreak(habit.id, date),
      }))
    ),
    tarefas,
    mindset,
    resumo: {
      totalItens,
      totalConcluidos,
      restantes: Math.max(totalItens - totalConcluidos, 0),
      habitosConcluidos,
      tarefasConcluidas,
      porcentagem,
    },
  };
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getLastNDays(days) {
  const dates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(toISODate(date));
  }

  return dates;
}

function isValidISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function yamlSafe(value) {
  return String(value ?? '')
    .replaceAll('"', '\\"')
    .replaceAll('\n', ' ')
    .trim();
}

function markdownCheckLine(checked, text, extra = '') {
  return `- [${checked ? 'x' : ' '}] ${text}${extra}`;
}

app.get('/api/exportar/:data', async (request, response) => {
  try {
    const { data } = request.params;

    if (!isValidISODate(data)) {
      return response.status(400).json({
        error: 'Data inválida. Use o formato YYYY-MM-DD.',
      });
    }

    const habitos = await all(
      `
      SELECT
        h.id,
        h.titulo,
        h.subtitulo,
        COALESCE(l.concluido, 0) AS concluido
      FROM habitos h
      LEFT JOIN habitos_log l
        ON l.habito_id = h.id
        AND l.data_registro = ?
      ORDER BY h.id ASC
      `,
      [data]
    );

    const tarefas = await all(
      `
      SELECT
        id,
        titulo,
        prioridade,
        status,
        data_criacao
      FROM tarefas
      WHERE data_criacao = ?
      ORDER BY
        CASE prioridade
          WHEN 'ALTA' THEN 1
          WHEN 'MÉDIA' THEN 2
          WHEN 'BAIXA' THEN 3
          ELSE 4
        END,
        id ASC
      `,
      [data]
    );

    const mindset = (await get(
      `
        SELECT
          id,
          data_registro,
          energia,
          foco,
          humor,
          COALESCE(notas, '') AS notas
        FROM mindset
        WHERE data_registro = ?
        `,
      [data]
    )) || {
      data_registro: data,
      energia: 0,
      foco: 0,
      humor: 0,
      notas: '',
    };

    const habitosConcluidos = habitos.filter(
      (habit) => Number(habit.concluido) === 1
    ).length;

    const tarefasConcluidas = tarefas.filter(
      (task) => task.status === 'CONCLUIDO'
    ).length;

    const totalItens = habitos.length + tarefas.length;
    const totalConcluidos = habitosConcluidos + tarefasConcluidas;

    const porcentagem =
      totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100);

    const habitLines = habitos.length
      ? habitos
          .map((habit) =>
            markdownCheckLine(Number(habit.concluido) === 1, habit.titulo)
          )
          .join('\n')
      : '- Nenhum hábito cadastrado nesse dia.';

    const taskLines = tarefas.length
      ? tarefas
          .map((task) => {
            const priorityTag = task.prioridade
              ? ` #${String(task.prioridade).toLowerCase()}`
              : '';

            return markdownCheckLine(
              task.status === 'CONCLUIDO',
              task.titulo,
              priorityTag
            );
          })
          .join('\n')
      : '- Nenhuma tarefa cadastrada nesse dia.';

    const journalText = String(mindset.notas || '').trim();

    const markdown = `---
type: quiet-progress-daily
date: ${data}
completion: ${porcentagem}
completed_items: ${totalConcluidos}
total_items: ${totalItens}
completed_habits: ${habitosConcluidos}
total_habits: ${habitos.length}
completed_tasks: ${tarefasConcluidas}
total_tasks: ${tarefas.length}
energia: ${Number(mindset.energia || 0)}
foco: ${Number(mindset.foco || 0)}
humor: ${Number(mindset.humor || 0)}
source: "Quiet Progress"
---

# Quiet Progress — ${data}

## Resumo

- Progresso geral: **${porcentagem}%**
- Itens concluídos: **${totalConcluidos}/${totalItens}**
- Hábitos concluídos: **${habitosConcluidos}/${habitos.length}**
- Tarefas concluídas: **${tarefasConcluidas}/${tarefas.length}**

## Mindset

- Energia: **${Number(mindset.energia || 0)}/3**
- Foco: **${Number(mindset.foco || 0)}/3**
- Humor: **${Number(mindset.humor || 0)}/3**

## Hábitos

${habitLines}

## Tarefas

${taskLines}

## Journal

${journalText || '_Sem journal registrado._'}
`;

    response.json({
      ok: true,
      data,
      markdown,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: 'Erro ao exportar Markdown retroativo.',
    });
  }
});

app.post(
  '/api/sistema/restore',
  upload.single('database'),
  async (request, response) => {
    const uploadedPath = request.file?.path;

    try {
      if (!request.file) {
        return response.status(400).json({
          error: 'Arquivo .db é obrigatório.',
        });
      }

      if (!request.file.originalname.toLowerCase().endsWith('.db')) {
        return response.status(400).json({
          error: 'Arquivo inválido. Envie um backup .db.',
        });
      }

      const backupBeforeRestore = `${DB_PATH}.before_restore_${Date.now()}.bak`;

      await closeDatabase();

      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, backupBeforeRestore);
      }

      fs.copyFileSync(uploadedPath, DB_PATH);

      connectDatabase();
      await initDatabase();

      response.json({
        ok: true,
        message: 'Banco restaurado com sucesso.',
      });
    } catch (error) {
      console.error(error);

      try {
        connectDatabase();
      } catch (reconnectError) {
        console.error('[Restore] Falha ao reconectar:', reconnectError);
      }

      response.status(500).json({
        error: 'Erro ao restaurar banco de dados.',
        details: error.message,
      });
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }
  }
);

app.patch('/api/tarefas/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const { titulo } = request.body;
    const date = todayISO();

    const tarefa = await get(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE id = ?
      `,
      [id]
    );

    if (!tarefa) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    if (!titulo || !String(titulo).trim()) {
      return response.status(400).json({ error: 'titulo é obrigatório.' });
    }

    await run(
      `
      UPDATE tarefas
      SET titulo = ?
      WHERE id = ?
      `,
      [String(titulo).trim(), id]
    );

    const updated = await get(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE id = ?
      `,
      [id]
    );

    response.json({
      ok: true,
      tarefa: updated,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao editar tarefa.' });
  }
});

app.patch('/api/habitos/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const { titulo, subtitulo } = request.body;
    const date = todayISO();

    const habito = await get(
      `
      SELECT id, titulo, subtitulo
      FROM habitos
      WHERE id = ?
      `,
      [id]
    );

    if (!habito) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    const nextTitulo =
      titulo && String(titulo).trim() ? String(titulo).trim() : habito.titulo;

    const nextSubtitulo =
      subtitulo && String(subtitulo).trim()
        ? String(subtitulo).trim()
        : habito.subtitulo;

    await run(
      `
      UPDATE habitos
      SET titulo = ?, subtitulo = ?
      WHERE id = ?
      `,
      [nextTitulo, nextSubtitulo, id]
    );

    const updated = await get(
      `
      SELECT id, titulo, subtitulo
      FROM habitos
      WHERE id = ?
      `,
      [id]
    );

    response.json({
      ok: true,
      habito: updated,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);

    if (error.message && error.message.includes('UNIQUE')) {
      return response.status(409).json({
        error: 'Já existe um hábito com esse título.',
      });
    }

    response.status(500).json({ error: 'Erro ao editar hábito.' });
  }
});

app.get('/api/tarefas/historico', async (request, response) => {
  try {
    const date = todayISO();
    const { page, limit, offset } = getPaginationParams(request, 20, 100);

    const rows = await all(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE data_criacao != ?
      ORDER BY data_criacao DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [date, limit + 1, offset]
    );

    const hasMore = rows.length > limit;
    const tarefas = hasMore ? rows.slice(0, limit) : rows;

    response.json({
      ok: true,
      page,
      limit,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
      tarefas,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: 'Erro ao carregar histórico de tarefas.',
    });
  }
});

app.delete('/api/tarefas/:id', async (request, response) => {
  try {
    const { id } = request.params;

    const tarefa = await get(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE id = ?
      `,
      [id]
    );

    if (!tarefa) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    await run(
      `
      DELETE FROM tarefas
      WHERE id = ?
      `,
      [id]
    );

    response.json({
      ok: true,
      deletedId: Number(id),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao deletar tarefa.' });
  }
});

app.get('/api/habitos/semana', async (request, response) => {
  try {
    const dates = getLast7Days();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const habitos = await all(`
      SELECT id, titulo
      FROM habitos
      ORDER BY id ASC
    `);

    const logs = await all(
      `
      SELECT
        habito_id,
        data_registro,
        concluido
      FROM habitos_log
      WHERE data_registro BETWEEN ? AND ?
      `,
      [startDate, endDate]
    );

    const logMap = new Map();

    logs.forEach((log) => {
      const key = `${log.habito_id}:${log.data_registro}`;
      logMap.set(key, Number(log.concluido) === 1);
    });

    const weekly = habitos.map((habit) => ({
      id: habit.id,
      nome: habit.titulo,
      datas: dates,
      ultimos7Dias: dates.map((date) => {
        const key = `${habit.id}:${date}`;
        return logMap.get(key) === true;
      }),
    }));

    response.json({
      ok: true,
      datas: dates,
      habitos: weekly,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: 'Erro ao carregar grid semanal de hábitos.',
    });
  }
});

app.post('/api/habitos', async (request, response) => {
  try {
    const { titulo, subtitulo } = request.body;
    const date = todayISO();

    if (!titulo || !String(titulo).trim()) {
      return response.status(400).json({ error: 'titulo é obrigatório.' });
    }

    const cleanTitle = String(titulo).trim();
    const cleanSubtitle =
      subtitulo && String(subtitulo).trim()
        ? String(subtitulo).trim()
        : 'Hábito personalizado.';

    const result = await run(
      `
      INSERT INTO habitos (titulo, subtitulo)
      VALUES (?, ?)
      `,
      [cleanTitle, cleanSubtitle]
    );

    const habito = await get(
      `
      SELECT id, titulo, subtitulo
      FROM habitos
      WHERE id = ?
      `,
      [result.id]
    );

    response.status(201).json({
      ok: true,
      habito,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);

    if (error.message && error.message.includes('UNIQUE')) {
      return response.status(409).json({
        error: 'Já existe um hábito com esse título.',
      });
    }

    response.status(500).json({ error: 'Erro ao criar hábito.' });
  }
});

app.delete('/api/habitos/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const date = todayISO();

    const habito = await get(
      `
      SELECT id, titulo
      FROM habitos
      WHERE id = ?
      `,
      [id]
    );

    if (!habito) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    await run(
      `
      DELETE FROM habitos
      WHERE id = ?
      `,
      [id]
    );

    response.json({
      ok: true,
      deletedId: Number(id),
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao deletar hábito.' });
  }
});

app.get('/api/mindset/historico', async (request, response) => {
  try {
    const { page, limit, offset } = getPaginationParams(request, 20, 100);

    const rows = await all(
      `
      SELECT
        id,
        data_registro,
        energia,
        foco,
        humor,
        COALESCE(notas, '') AS notas
      FROM mindset
      WHERE notas IS NOT NULL
        AND TRIM(notas) != ''
      ORDER BY data_registro DESC
      LIMIT ? OFFSET ?
      `,
      [limit + 1, offset]
    );

    const hasMore = rows.length > limit;
    const registros = hasMore ? rows.slice(0, limit) : rows;

    response.json({
      ok: true,
      page,
      limit,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
      registros,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: 'Erro ao carregar histórico de journals.',
    });
  }
});

app.get('/api/estatisticas', async (request, response) => {
  try {
    const heatmapDates = getLastNDays(35);
    const mindsetDates = getLastNDays(30);

    const heatmapStart = heatmapDates[0];
    const heatmapEnd = heatmapDates[heatmapDates.length - 1];

    const mindsetStart = mindsetDates[0];
    const mindsetEnd = mindsetDates[mindsetDates.length - 1];

    const totalHabitosRow = await get(`
      SELECT COUNT(*) AS total
      FROM habitos
    `);

    const totalHabitos = Number(totalHabitosRow?.total || 0);

    const habitosConcluidosPorDia = await all(
      `
      SELECT
        data_registro,
        COUNT(*) AS total_concluido
      FROM habitos_log
      WHERE data_registro BETWEEN ? AND ?
        AND concluido = 1
      GROUP BY data_registro
      `,
      [heatmapStart, heatmapEnd]
    );

    const tarefasPorDia = await all(
      `
      SELECT
        data_criacao,
        COUNT(*) AS total_tarefas,
        SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) AS total_concluido
      FROM tarefas
      WHERE data_criacao BETWEEN ? AND ?
      GROUP BY data_criacao
      `,
      [heatmapStart, heatmapEnd]
    );

    const habitosMap = new Map(
      habitosConcluidosPorDia.map((row) => [
        row.data_registro,
        Number(row.total_concluido || 0),
      ])
    );

    const tarefasMap = new Map(
      tarefasPorDia.map((row) => [
        row.data_criacao,
        {
          totalTarefas: Number(row.total_tarefas || 0),
          totalConcluido: Number(row.total_concluido || 0),
        },
      ])
    );

    const heatmap = heatmapDates.map((date) => {
      const habitosConcluidos = habitosMap.get(date) || 0;
      const tarefasData = tarefasMap.get(date) || {
        totalTarefas: 0,
        totalConcluido: 0,
      };

      const totalItens = totalHabitos + tarefasData.totalTarefas;
      const totalConcluido = habitosConcluidos + tarefasData.totalConcluido;

      const porcentagem =
        totalItens === 0 ? 0 : Math.round((totalConcluido / totalItens) * 100);

      return {
        data: date,
        totalItens,
        totalConcluido,
        porcentagem,
      };
    });

    const mindset = await all(
      `
      SELECT
        data_registro,
        energia,
        foco,
        humor
      FROM mindset
      WHERE data_registro BETWEEN ? AND ?
      ORDER BY data_registro ASC
      `,
      [mindsetStart, mindsetEnd]
    );

    const rankingHabitos = await all(`
      SELECT
        h.id,
        h.titulo,
        COUNT(l.id) AS total_registros,
        SUM(CASE WHEN l.concluido = 1 THEN 1 ELSE 0 END) AS total_concluido,
        CASE
          WHEN COUNT(l.id) = 0 THEN 0
          ELSE ROUND(
            (SUM(CASE WHEN l.concluido = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(l.id)
          )
        END AS porcentagem
      FROM habitos h
      LEFT JOIN habitos_log l
        ON l.habito_id = h.id
      GROUP BY h.id, h.titulo
      ORDER BY porcentagem DESC, h.id ASC
    `);

    response.json({
      heatmap,
      mindset,
      rankingHabitos: rankingHabitos.map((habit) => ({
        id: habit.id,
        titulo: habit.titulo,
        totalRegistros: Number(habit.total_registros || 0),
        totalConcluido: Number(habit.total_concluido || 0),
        porcentagem: Number(habit.porcentagem || 0),
      })),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: 'Erro ao carregar estatísticas.',
    });
  }
});

app.get('/api/backup', (request, response) => {
  const dbPath = path.join(__dirname, '..', 'quiet_progress.db');
  const filename = `quiet_progress_backup_${todayISO()}.db`;

  response.download(dbPath, filename, (error) => {
    if (error) {
      console.error(error);

      if (!response.headersSent) {
        response.status(500).json({
          error: 'Erro ao gerar backup do banco.',
        });
      }
    }
  });
});

app.get('/api/health', (request, response) => {
  response.json({ ok: true, service: 'quiet-progress-api', date: todayISO() });
});

app.get('/api/dashboard/hoje', async (request, response) => {
  try {
    const dashboard = await getDashboardForDate(todayISO());
    response.json(dashboard);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar dashboard de hoje.' });
  }
});

app.post('/api/habitos/toggle', async (request, response) => {
  try {
    const { habito_id } = request.body;
    const date = todayISO();

    if (!habito_id) {
      return response.status(400).json({ error: 'habito_id é obrigatório.' });
    }

    const habit = await get(`SELECT id FROM habitos WHERE id = ?`, [habito_id]);

    if (!habit) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    const existingLog = await get(
      `
      SELECT id, concluido
      FROM habitos_log
      WHERE habito_id = ? AND data_registro = ?
    `,
      [habito_id, date]
    );

    let novoStatus = 1;

    if (existingLog) {
      novoStatus = existingLog.concluido === 1 ? 0 : 1;

      await run(
        `
        UPDATE habitos_log
        SET concluido = ?
        WHERE id = ?
      `,
        [novoStatus, existingLog.id]
      );
    } else {
      await run(
        `
        INSERT INTO habitos_log (habito_id, data_registro, concluido)
        VALUES (?, ?, 1)
      `,
        [habito_id, date]
      );
    }

    response.json({
      ok: true,
      habito_id: Number(habito_id),
      data_registro: date,
      concluido: novoStatus === 1,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao alternar hábito.' });
  }
});

app.get('/api/tarefas', async (request, response) => {
  try {
    const date = request.query.data || todayISO();

    const tarefas = await all(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE data_criacao = ?
      ORDER BY id DESC
    `,
      [date]
    );

    response.json({ data: date, tarefas });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao listar tarefas.' });
  }
});

app.post('/api/tarefas', async (request, response) => {
  try {
    const { titulo, prioridade } = request.body;
    const date = todayISO();

    if (!titulo || !String(titulo).trim()) {
      return response.status(400).json({ error: 'titulo é obrigatório.' });
    }

    const result = await run(
      `
      INSERT INTO tarefas (titulo, prioridade, status, data_criacao)
      VALUES (?, ?, 'PENDENTE', ?)
    `,
      [String(titulo).trim(), normalizePriority(prioridade), date]
    );

    const tarefa = await get(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE id = ?
    `,
      [result.id]
    );

    response.status(201).json({
      ok: true,
      tarefa,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao cadastrar tarefa.' });
  }
});

app.put('/api/tarefas/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const { status, action } = request.body;
    const date = todayISO();

    const tarefa = await get(`SELECT * FROM tarefas WHERE id = ?`, [id]);

    if (!tarefa) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    let newStatus;

    if (action === 'toggle' || !status) {
      newStatus = tarefa.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO';
    } else if (String(status).toUpperCase() === 'START') {
      newStatus = 'PENDENTE';
    } else {
      newStatus = normalizeStatus(status);
    }

    await run(
      `
      UPDATE tarefas
      SET status = ?
      WHERE id = ?
    `,
      [newStatus, id]
    );

    const updated = await get(
      `
      SELECT id, titulo, prioridade, status, data_criacao
      FROM tarefas
      WHERE id = ?
    `,
      [id]
    );

    response.json({
      ok: true,
      tarefa: updated,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao atualizar tarefa.' });
  }
});

app.post('/api/mindset', async (request, response) => {
  try {
    const date = todayISO();
    const energia = Number(request.body.energia);
    const foco = Number(request.body.foco);
    const humor = Number(request.body.humor);
    const notas = request.body.notas ? String(request.body.notas).trim() : '';

    const values = { energia, foco, humor };

    for (const [key, value] of Object.entries(values)) {
      if (!Number.isInteger(value) || value < 1 || value > 3) {
        return response.status(400).json({
          error: `${key} precisa ser um número inteiro entre 1 e 3.`,
        });
      }
    }

    await run(
      `
      INSERT INTO mindset (data_registro, energia, foco, humor, notas)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(data_registro)
      DO UPDATE SET
        energia = excluded.energia,
        foco = excluded.foco,
        humor = excluded.humor,
        notas = excluded.notas
      `,
      [date, energia, foco, humor, notas]
    );

    const mindset = await get(
      `
      SELECT id, data_registro, energia, foco, humor, COALESCE(notas, '') AS notas
      FROM mindset
      WHERE data_registro = ?
      `,
      [date]
    );

    response.json({
      ok: true,
      mindset,
      dashboard: await getDashboardForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao salvar mindset.' });
  }
});

app.get('*', (request, response) => {
  response.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function getLocalNetworkUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((netInterface) => {
    netInterface.forEach((details) => {
      const isIPv4 = details.family === 'IPv4';
      const isInternal = details.internal;

      if (isIPv4 && !isInternal) {
        urls.push(`http://${details.address}:${port}`);
      }
    });
  });

  return urls;
}

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      const lanUrls = getLocalNetworkUrls(PORT);

      console.log('');
      console.log('==========================================');
      console.log(' Quiet Progress está online');
      console.log('==========================================');
      console.log(` Local: http://localhost:${PORT}`);

      if (lanUrls.length) {
        console.log(' Rede local:');
        lanUrls.forEach((url) => {
          console.log(` - ${url}`);
        });
      } else {
        console.log(' Rede local: nenhum IP LAN detectado.');
      }

      console.log('==========================================');
      console.log('');
    });
  })
  .catch((error) => {
    console.error('[Startup] Falha ao inicializar aplicação:', error);
    process.exit(1);
  });
