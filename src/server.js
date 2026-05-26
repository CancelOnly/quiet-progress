const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');

const {
  DB_PATH,
  initDatabase,
  connectDatabase,
  closeDatabase,
  run,
  get,
  all,
  databaseExists
} = require('./database');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 80 * 1024 * 1024
  },
  fileFilter: (request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.db')) {
      callback(new Error('Apenas arquivos .db são permitidos.'));
      return;
    }

    callback(null, true);
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isValidISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isValidMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

function normalizeDate(value) {
  return isValidISODate(value) ? value : todayISO();
}

function normalizeMonth(value) {
  if (isValidMonth(value)) return value;

  const today = todayISO();
  return today.slice(0, 7);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(Math.max(Math.round(number), min), max);
}

function sanitizePriority(value) {
  const normalized = String(value || 'MÉDIA').toUpperCase();

  if (['ALTA', 'MÉDIA', 'MEDIA', 'BAIXA'].includes(normalized)) {
    return normalized === 'MEDIA' ? 'MÉDIA' : normalized;
  }

  return 'MÉDIA';
}

function sanitizeStatus(value) {
  return String(value || '').toUpperCase() === 'CONCLUIDO' ? 'CONCLUIDO' : 'PENDENTE';
}

function addDaysISO(dateISO, amount) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;

  return {
    year,
    month,
    monthValue,
    start,
    end,
    totalDays: last.getDate()
  };
}

function getWeekdayIndexMondayFirst(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  const day = date.getDay();

  return day === 0 ? 6 : day - 1;
}

function getMonthWeeks(monthValue) {
  const { year, month, totalDays } = getMonthRange(monthValue);
  const weeks = [];
  let current = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = getWeekdayIndexMondayFirst(date);

    if (day === 1) {
      for (let i = 0; i < weekday; i += 1) current.push(null);
    }

    current.push({
      date,
      day,
      weekday
    });

    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  return weeks.map((days, index) => ({
    index,
    label: `Semana ${index + 1}`,
    days
  }));
}

function getWeekForDate(dateISO) {
  const start = addDaysISO(dateISO, -getWeekdayIndexMondayFirst(dateISO));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysISO(start, index);
    return {
      date,
      weekday: index,
      day: Number(date.slice(-2))
    };
  });

  return {
    start,
    end: days[6].date,
    days
  };
}

function getLocalNetworkUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((networkInterface) => {
    networkInterface.forEach((details) => {
      if (details.family === 'IPv4' && !details.internal) {
        urls.push(`http://${details.address}:${port}`);
      }
    });
  });

  return urls;
}

function dateIsWithinHabit(habit, date) {
  if (habit.data_inicio && date < habit.data_inicio) return false;
  if (habit.data_fim && date > habit.data_fim) return false;
  return true;
}

async function getHabitsForRange(start, end, includeInactiveWithLogs = true) {
  if (includeInactiveWithLogs) {
    return all(
      `
      SELECT DISTINCT h.*
      FROM habitos h
      LEFT JOIN habitos_log l
        ON l.habito_id = h.id
        AND l.data_ref BETWEEN ? AND ?
      WHERE h.ativo = 1
         OR l.id IS NOT NULL
      ORDER BY h.ordem ASC, h.id ASC
      `,
      [start, end]
    );
  }

  return all(
    `
    SELECT *
    FROM habitos
    WHERE ativo = 1
    ORDER BY ordem ASC, id ASC
    `
  );
}

async function getActiveHabitsForDate(date) {
  const habits = await all(
    `
    SELECT *
    FROM habitos
    WHERE ativo = 1
      AND (data_inicio IS NULL OR data_inicio <= ?)
      AND (data_fim IS NULL OR data_fim >= ?)
    ORDER BY ordem ASC, id ASC
    `,
    [date, date]
  );

  return habits;
}

async function getMindsetForDate(date) {
  let mindset = await get(
    `
    SELECT *
    FROM mindset
    WHERE data_ref = ?
    `,
    [date]
  );

  if (!mindset) {
    const now = nowISO();

    await run(
      `
      INSERT INTO mindset (data_ref, energia, foco, motivacao, humor, notas, created_at, updated_at)
      VALUES (?, 2, 2, 2, 2, '', ?, ?)
      `,
      [date, now, now]
    );

    mindset = await get(`SELECT * FROM mindset WHERE data_ref = ?`, [date]);
  }

  return normalizeMindset(mindset);
}

function normalizeMindset(row) {
  return {
    id: row.id,
    data_ref: row.data_ref,
    energia: Number(row.energia || 2),
    foco: Number(row.foco || 2),
    motivacao: Number(row.motivacao || 2),
    humor: Number(row.humor || 2),
    notas: row.notas || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeTask(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao || '',
    prioridade: row.prioridade || 'MÉDIA',
    status: row.status || 'PENDENTE',
    data_ref: row.data_ref,
    tipo: row.tipo || 'task',
    ativo: Number(row.ativo) === 1,
    ordem: Number(row.ordem || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function calcPercent(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

async function getDayPayload(date, options = {}) {
  const includeInactiveWithLogs = Boolean(options.includeInactiveWithLogs);
  const allHabits = includeInactiveWithLogs
    ? await getHabitsForRange(date, date, true)
    : await getActiveHabitsForDate(date);

  const logs = await all(
    `
    SELECT habito_id, concluido
    FROM habitos_log
    WHERE data_ref = ?
    `,
    [date]
  );

  const logMap = new Map(logs.map((row) => [Number(row.habito_id), Number(row.concluido) === 1]));

  const habits = allHabits
    .filter((habit) => includeInactiveWithLogs || dateIsWithinHabit(habit, date))
    .map((habit) => ({
      id: habit.id,
      titulo: habit.titulo,
      subtitulo: habit.subtitulo || '',
      ativo: Number(habit.ativo) === 1,
      cor: habit.cor,
      ordem: Number(habit.ordem || 0),
      data_inicio: habit.data_inicio,
      data_fim: habit.data_fim,
      disabledForDate: !dateIsWithinHabit(habit, date),
      concluido: logMap.get(Number(habit.id)) === true
    }));

  const tasks = (
    await all(
      `
      SELECT *
      FROM tarefas
      WHERE data_ref = ?
        AND ativo = 1
      ORDER BY ordem ASC, id ASC
      `,
      [date]
    )
  ).map(normalizeTask);

  const mindset = await getMindsetForDate(date);

  const habitsDone = habits.filter((habit) => habit.concluido).length;
  const tasksDone = tasks.filter((task) => task.status === 'CONCLUIDO').length;

  const habitsPercent = calcPercent(habitsDone, habits.length);
  const tasksPercent = calcPercent(tasksDone, tasks.length);
  const totalItems = habits.length + tasks.length;
  const totalDone = habitsDone + tasksDone;

  return {
    date,
    habits,
    tasks,
    mindset,
    progress: {
      habitsDone,
      habitsTotal: habits.length,
      habitsPercent,
      tasksDone,
      tasksTotal: tasks.length,
      tasksPercent,
      totalDone,
      totalItems,
      totalPercent: calcPercent(totalDone, totalItems)
    }
  };
}

async function getDashboardMonth(monthValue) {
  const range = getMonthRange(monthValue);
  const weeks = getMonthWeeks(monthValue);
  const today = todayISO();
  const habits = await getHabitsForRange(range.start, range.end, true);

  const habitLogs = await all(
    `
    SELECT habito_id, data_ref, concluido
    FROM habitos_log
    WHERE data_ref BETWEEN ? AND ?
    `,
    [range.start, range.end]
  );

  const tasks = (await all(
    `
    SELECT *
    FROM tarefas
    WHERE data_ref BETWEEN ? AND ?
      AND ativo = 1
    ORDER BY data_ref ASC, ordem ASC, id ASC
    `,
    [range.start, range.end]
  )).map(normalizeTask);

  const mindsets = (await all(
    `
    SELECT *
    FROM mindset
    WHERE data_ref BETWEEN ? AND ?
    ORDER BY data_ref ASC
    `,
    [range.start, range.end]
  )).map(normalizeMindset);

  const logMap = {};
  const habitStats = {};
  const days = {};

  habits.forEach((habit) => {
    habitStats[habit.id] = {
      habit_id: habit.id,
      titulo: habit.titulo,
      cor: habit.cor,
      possibleDays: 0,
      doneDays: 0,
      percent: 0
    };
  });

  for (let day = 1; day <= range.totalDays; day += 1) {
    const date = `${range.monthValue}-${String(day).padStart(2, '0')}`;
    days[date] = {
      date,
      day,
      today: date === today,
      future: date > today,
      past: date < today,
      habitDone: 0,
      habitTotal: 0,
      taskDone: 0,
      taskTotal: 0,
      totalDone: 0,
      totalItems: 0,
      percent: 0,
      hasNote: false
    };
  }

  habitLogs.forEach((log) => {
    const key = `${log.habito_id}:${log.data_ref}`;
    logMap[key] = Number(log.concluido) === 1;
  });

  Object.keys(days).forEach((date) => {
    habits.forEach((habit) => {
      const visibleForDate = Number(habit.ativo) === 1 && dateIsWithinHabit(habit, date);
      const hasHistoricalLog = logMap[`${habit.id}:${date}`] !== undefined;

      if (visibleForDate || hasHistoricalLog) {
        days[date].habitTotal += 1;
        habitStats[habit.id].possibleDays += 1;

        if (logMap[`${habit.id}:${date}`] === true) {
          days[date].habitDone += 1;
          habitStats[habit.id].doneDays += 1;
        }
      }
    });
  });

  const tasksByDate = {};
  tasks.forEach((task) => {
    if (!tasksByDate[task.data_ref]) tasksByDate[task.data_ref] = [];
    tasksByDate[task.data_ref].push(task);

    if (days[task.data_ref]) {
      days[task.data_ref].taskTotal += 1;
      if (task.status === 'CONCLUIDO') days[task.data_ref].taskDone += 1;
    }
  });

  const mindsetByDate = {};
  mindsets.forEach((mindset) => {
    mindsetByDate[mindset.data_ref] = mindset;
    if (days[mindset.data_ref]) {
      days[mindset.data_ref].hasNote = Boolean(String(mindset.notas || '').trim());
    }
  });

  Object.keys(days).forEach((date) => {
    const day = days[date];
    day.totalDone = day.habitDone + day.taskDone;
    day.totalItems = day.habitTotal + day.taskTotal;
    day.percent = calcPercent(day.totalDone, day.totalItems);
    day.habitPercent = calcPercent(day.habitDone, day.habitTotal);
    day.taskPercent = calcPercent(day.taskDone, day.taskTotal);
  });

  Object.values(habitStats).forEach((item) => {
    item.percent = calcPercent(item.doneDays, item.possibleDays);
  });

  const weekStats = weeks.map((week) => {
    let totalDone = 0;
    let totalItems = 0;

    week.days.forEach((day) => {
      if (!day) return;
      const summary = days[day.date];
      totalDone += summary.totalDone;
      totalItems += summary.totalItems;
    });

    return {
      index: week.index,
      label: week.label,
      totalDone,
      totalItems,
      percent: calcPercent(totalDone, totalItems)
    };
  });

  const monthDone = Object.values(days).reduce((sum, day) => sum + day.totalDone, 0);
  const monthItems = Object.values(days).reduce((sum, day) => sum + day.totalItems, 0);

  return {
    month: range.monthValue,
    range,
    today,
    weeks,
    habits: habits.map((habit) => ({
      id: habit.id,
      titulo: habit.titulo,
      subtitulo: habit.subtitulo || '',
      ativo: Number(habit.ativo) === 1,
      cor: habit.cor,
      ordem: Number(habit.ordem || 0),
      data_inicio: habit.data_inicio,
      data_fim: habit.data_fim
    })),
    logMap,
    tasksByDate,
    mindsetByDate,
    days,
    stats: {
      monthDone,
      monthItems,
      monthPercent: calcPercent(monthDone, monthItems),
      weekStats,
      habitStats: Object.values(habitStats)
    }
  };
}

async function getStatsMonth(monthValue) {
  const dashboard = await getDashboardMonth(monthValue);
  const range = dashboard.range;
  const dates = Object.keys(dashboard.days).sort();

  const tasksDoneSeries = dates.map((date) => ({
    date,
    total: dashboard.days[date].taskDone
  }));

  const dayProgressSeries = dates.map((date) => ({
    date,
    percent: dashboard.days[date].percent
  }));

  const mindsetSeries = dates.map((date) => {
    const mindset = dashboard.mindsetByDate[date];

    return {
      date,
      energia: mindset ? Number(mindset.energia) : null,
      foco: mindset ? Number(mindset.foco) : null,
      motivacao: mindset ? Number(mindset.motivacao) : null,
      humor: mindset ? Number(mindset.humor) : null
    };
  });

  const priorityRows = await all(
    `
    SELECT
      prioridade,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) AS done
    FROM tarefas
    WHERE data_ref BETWEEN ? AND ?
      AND ativo = 1
    GROUP BY prioridade
    `,
    [range.start, range.end]
  );

  const priorityStats = priorityRows.map((row) => ({
    prioridade: row.prioridade || 'MÉDIA',
    total: Number(row.total || 0),
    done: Number(row.done || 0),
    percent: calcPercent(Number(row.done || 0), Number(row.total || 0))
  }));

  const validMindsets = mindsetSeries.filter((item) => item.energia !== null);
  const avg = (key) => {
    if (!validMindsets.length) return 0;
    const value = validMindsets.reduce((sum, item) => sum + Number(item[key] || 0), 0) / validMindsets.length;
    return Math.round(value * 10) / 10;
  };

  return {
    month: monthValue,
    monthSummary: dashboard.stats,
    dayProgressSeries,
    tasksDoneSeries,
    habitStats: dashboard.stats.habitStats,
    weekStats: dashboard.stats.weekStats,
    priorityStats,
    mindsetSeries,
    mindsetAverage: {
      energia: avg('energia'),
      foco: avg('foco'),
      motivacao: avg('motivacao'),
      humor: avg('humor')
    }
  };
}

function markdownTaskLine(task) {
  return `- [${task.status === 'CONCLUIDO' ? 'x' : ' '}] ${task.titulo}${task.prioridade ? ` #${String(task.prioridade).toLowerCase()}` : ''}`;
}

function markdownHabitLine(habit) {
  return `- [${habit.concluido ? 'x' : ' '}] ${habit.titulo}`;
}

async function buildDayMarkdown(date) {
  const day = await getDayPayload(date, { includeInactiveWithLogs: true });

  return `# Daily Check-in — ${date}

## Mindset
- Energy: ${day.mindset.energia}/5
- Focus: ${day.mindset.foco}/5
- Motivation: ${day.mindset.motivacao}/5
- Mood: ${day.mindset.humor}/5

## Hábitos
${day.habits.length ? day.habits.map(markdownHabitLine).join('\n') : '- Nenhum hábito registrado.'}

## Tarefas
${day.tasks.length ? day.tasks.map(markdownTaskLine).join('\n') : '- Nenhuma tarefa registrada.'}

## Progresso
- Hábitos: ${day.progress.habitsPercent}%
- Tarefas: ${day.progress.tasksPercent}%
- Geral: ${day.progress.totalPercent}%

## Nota do dia
${day.mindset.notas ? day.mindset.notas : '_Sem nota registrada._'}
`;
}

app.get('/api/health', (request, response) => {
  const memory = process.memoryUsage();

  response.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    databasePath: DB_PATH,
    databaseExists: databaseExists(),
    today: todayISO(),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external
    }
  });
});

app.get('/api/dashboard', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    response.json(await getDashboardMonth(month));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar dashboard mensal.' });
  }
});

app.get('/api/day/:date', async (request, response) => {
  try {
    const date = normalizeDate(request.params.date);
    response.json(await getDayPayload(date));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar dia.' });
  }
});

app.get('/api/stats', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    response.json(await getStatsMonth(month));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

app.post('/api/habits', async (request, response) => {
  try {
    const now = nowISO();
    const titulo = String(request.body.titulo || '').trim();

    if (!titulo) {
      return response.status(400).json({ error: 'titulo é obrigatório.' });
    }

    const result = await run(
      `
      INSERT INTO habitos (titulo, subtitulo, ativo, cor, ordem, data_inicio, data_fim, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        titulo,
        String(request.body.subtitulo || '').trim(),
        request.body.ativo === false ? 0 : 1,
        request.body.cor ? String(request.body.cor).trim() : null,
        clampNumber(request.body.ordem, 0, 9999, 0),
        isValidISODate(request.body.data_inicio) ? request.body.data_inicio : null,
        isValidISODate(request.body.data_fim) ? request.body.data_fim : null,
        now,
        now
      ]
    );

    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [result.id]);

    response.status(201).json({
      ok: true,
      habit
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao criar hábito.' });
  }
});

app.patch('/api/habits/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM habitos WHERE id = ?`, [request.params.id]);

    if (!current) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    const next = {
      titulo: request.body.titulo !== undefined && String(request.body.titulo).trim() ? String(request.body.titulo).trim() : current.titulo,
      subtitulo: request.body.subtitulo !== undefined ? String(request.body.subtitulo || '').trim() : current.subtitulo,
      ativo: request.body.ativo !== undefined ? Number(Boolean(request.body.ativo)) : Number(current.ativo),
      cor: request.body.cor !== undefined ? (request.body.cor ? String(request.body.cor).trim() : null) : current.cor,
      ordem: request.body.ordem !== undefined ? clampNumber(request.body.ordem, 0, 9999, Number(current.ordem || 0)) : Number(current.ordem || 0),
      data_inicio: request.body.data_inicio !== undefined ? (isValidISODate(request.body.data_inicio) ? request.body.data_inicio : null) : current.data_inicio,
      data_fim: request.body.data_fim !== undefined ? (isValidISODate(request.body.data_fim) ? request.body.data_fim : null) : current.data_fim
    };

    await run(
      `
      UPDATE habitos
      SET titulo = ?, subtitulo = ?, ativo = ?, cor = ?, ordem = ?, data_inicio = ?, data_fim = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        next.titulo,
        next.subtitulo,
        next.ativo,
        next.cor,
        next.ordem,
        next.data_inicio,
        next.data_fim,
        nowISO(),
        request.params.id
      ]
    );

    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [request.params.id]);

    response.json({
      ok: true,
      habit
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao editar hábito.' });
  }
});

app.delete('/api/habits/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM habitos WHERE id = ?`, [request.params.id]);

    if (!current) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    await run(
      `
      UPDATE habitos
      SET ativo = 0, updated_at = ?
      WHERE id = ?
      `,
      [nowISO(), request.params.id]
    );

    response.json({
      ok: true,
      deletedId: Number(request.params.id)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao excluir hábito.' });
  }
});

app.put('/api/habits/:id/log', async (request, response) => {
  try {
    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [request.params.id]);

    if (!habit) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    const date = normalizeDate(request.body.data_ref);
    const concluido = request.body.concluido ? 1 : 0;
    const now = nowISO();

    await run(
      `
      INSERT INTO habitos_log (habito_id, data_ref, concluido, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(habito_id, data_ref)
      DO UPDATE SET
        concluido = excluded.concluido,
        updated_at = excluded.updated_at
      `,
      [request.params.id, date, concluido, now, now]
    );

    response.json({
      ok: true,
      habitId: Number(request.params.id),
      data_ref: date,
      concluido: Boolean(concluido)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao salvar log do hábito.' });
  }
});

app.post('/api/tasks', async (request, response) => {
  try {
    const titulo = String(request.body.titulo || '').trim();

    if (!titulo) {
      return response.status(400).json({ error: 'titulo é obrigatório.' });
    }

    const now = nowISO();
    const dataRef = normalizeDate(request.body.data_ref);

    const result = await run(
      `
      INSERT INTO tarefas (titulo, descricao, prioridade, status, data_ref, tipo, ativo, ordem, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDENTE', ?, ?, 1, ?, ?, ?)
      `,
      [
        titulo,
        String(request.body.descricao || '').trim(),
        sanitizePriority(request.body.prioridade),
        dataRef,
        String(request.body.tipo || 'task').trim() || 'task',
        clampNumber(request.body.ordem, 0, 9999, 0),
        now,
        now
      ]
    );

    response.status(201).json({
      ok: true,
      task: normalizeTask(await get(`SELECT * FROM tarefas WHERE id = ?`, [result.id]))
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao criar tarefa.' });
  }
});

app.patch('/api/tasks/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id]);

    if (!current || Number(current.ativo) !== 1) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    const next = {
      titulo: request.body.titulo !== undefined && String(request.body.titulo).trim() ? String(request.body.titulo).trim() : current.titulo,
      descricao: request.body.descricao !== undefined ? String(request.body.descricao || '').trim() : current.descricao,
      prioridade: request.body.prioridade !== undefined ? sanitizePriority(request.body.prioridade) : current.prioridade,
      status: request.body.status !== undefined ? sanitizeStatus(request.body.status) : current.status,
      data_ref: request.body.data_ref !== undefined ? normalizeDate(request.body.data_ref) : current.data_ref,
      ordem: request.body.ordem !== undefined ? clampNumber(request.body.ordem, 0, 9999, Number(current.ordem || 0)) : Number(current.ordem || 0)
    };

    await run(
      `
      UPDATE tarefas
      SET titulo = ?, descricao = ?, prioridade = ?, status = ?, data_ref = ?, ordem = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        next.titulo,
        next.descricao,
        next.prioridade,
        next.status,
        next.data_ref,
        next.ordem,
        nowISO(),
        request.params.id
      ]
    );

    response.json({
      ok: true,
      task: normalizeTask(await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id]))
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao editar tarefa.' });
  }
});

app.delete('/api/tasks/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id]);

    if (!current || Number(current.ativo) !== 1) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    await run(
      `
      UPDATE tarefas
      SET ativo = 0, updated_at = ?
      WHERE id = ?
      `,
      [nowISO(), request.params.id]
    );

    response.json({
      ok: true,
      deletedId: Number(request.params.id)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao excluir tarefa.' });
  }
});

app.put('/api/tasks/:id/status', async (request, response) => {
  try {
    const status = sanitizeStatus(request.body.status);

    const current = await get(`SELECT * FROM tarefas WHERE id = ? AND ativo = 1`, [request.params.id]);

    if (!current) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    await run(
      `
      UPDATE tarefas
      SET status = ?, updated_at = ?
      WHERE id = ?
      `,
      [status, nowISO(), request.params.id]
    );

    response.json({
      ok: true,
      task: normalizeTask(await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id]))
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao atualizar status da tarefa.' });
  }
});

app.put('/api/mindset/:date', async (request, response) => {
  try {
    const date = normalizeDate(request.params.date);
    const now = nowISO();

    await run(
      `
      INSERT INTO mindset (data_ref, energia, foco, motivacao, humor, notas, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(data_ref)
      DO UPDATE SET
        energia = excluded.energia,
        foco = excluded.foco,
        motivacao = excluded.motivacao,
        humor = excluded.humor,
        notas = excluded.notas,
        updated_at = excluded.updated_at
      `,
      [
        date,
        clampNumber(request.body.energia, 1, 5, 2),
        clampNumber(request.body.foco, 1, 5, 2),
        clampNumber(request.body.motivacao, 1, 5, 2),
        clampNumber(request.body.humor, 1, 5, 2),
        String(request.body.notas || ''),
        now,
        now
      ]
    );

    response.json({
      ok: true,
      mindset: await getMindsetForDate(date)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao salvar check-in.' });
  }
});

app.get('/api/checkins', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    const q = String(request.query.q || '').trim().toLowerCase();
    const { start, end } = getMonthRange(month);

    let rows = await all(
      `
      SELECT *
      FROM mindset
      WHERE data_ref BETWEEN ? AND ?
      ORDER BY data_ref DESC
      LIMIT 80
      `,
      [start, end]
    );

    if (q) {
      rows = rows.filter((row) => String(row.notas || '').toLowerCase().includes(q));
    }

    response.json({
      ok: true,
      month,
      items: rows.map(normalizeMindset)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar check-ins.' });
  }
});

app.get('/api/notes', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    const q = String(request.query.q || '').trim().toLowerCase();
    const { start, end } = getMonthRange(month);

    let rows = await all(
      `
      SELECT *
      FROM mindset
      WHERE data_ref BETWEEN ? AND ?
        AND notas IS NOT NULL
        AND TRIM(notas) != ''
      ORDER BY data_ref DESC
      LIMIT 80
      `,
      [start, end]
    );

    if (q) {
      rows = rows.filter((row) => String(row.notas || '').toLowerCase().includes(q));
    }

    response.json({
      ok: true,
      month,
      items: rows.map(normalizeMindset)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar notas.' });
  }
});

app.get('/api/day/:date/export-md', async (request, response) => {
  try {
    const date = normalizeDate(request.params.date);
    response.json({
      ok: true,
      date,
      markdown: await buildDayMarkdown(date)
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao exportar Markdown.' });
  }
});

app.get('/api/day/:date/markdown', async (request, response) => {
  try {
    const date = normalizeDate(request.params.date);
    response.type('text/markdown').send(await buildDayMarkdown(date));
  } catch (error) {
    console.error(error);
    response.status(500).send('Erro ao exportar Markdown.');
  }
});

app.get('/api/backup', (request, response) => {
  if (!fs.existsSync(DB_PATH)) {
    return response.status(404).json({ error: 'Banco de dados não encontrado.' });
  }

  response.download(DB_PATH, `quiet_progress_${todayISO()}.db`);
});

app.post('/api/sistema/restore', upload.single('database'), async (request, response) => {
  const uploadedPath = request.file?.path;

  try {
    if (!request.file) {
      return response.status(400).json({ error: 'Arquivo .db é obrigatório.' });
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
      message: 'Banco restaurado com sucesso.'
    });
  } catch (error) {
    console.error(error);

    try {
      connectDatabase();
    } catch (reconnectError) {
      console.error('[Restore] Falha ao reconectar banco:', reconnectError);
    }

    response.status(500).json({
      error: 'Erro ao restaurar banco de dados.',
      details: error.message
    });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath);
    }
  }
});

app.get('*', (request, response) => {
  response.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      const urls = getLocalNetworkUrls(PORT);

      console.log('');
      console.log('==========================================');
      console.log(' Quiet Progress v3 Temporal está online');
      console.log('==========================================');
      console.log(` Local: http://localhost:${PORT}`);

      if (urls.length) {
        console.log(' Rede local:');
        urls.forEach((url) => console.log(` - ${url}`));
      } else {
        console.log(' Rede local: nenhum IP LAN detectado.');
      }

      console.log('==========================================');
      console.log('');
    });
  })
  .catch((error) => {
    console.error('[Startup] Falha ao inicializar:', error);
    process.exit(1);
  });
