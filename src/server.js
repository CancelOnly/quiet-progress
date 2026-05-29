require('dotenv').config();

const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');

const {
  DB_PATH,
  initDatabase,
  connectDatabase,
  closeDatabase,
  run,
  get,
  all,
  databaseExists,
} = require('./database');

const app = express();

let lastMigrationInfo = { legacyHabitTypeMigration: false };

app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const APP_PASSWORD = process.env.APP_PASSWORD || 'trocar-essa-senha';
const SESSION_SECRET = process.env.SESSION_SECRET || 'trocar-esse-segredo';
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS || 30);
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:seu-email@example.com';
const PUSH_SCHEDULER_INTERVAL_MS = Number(
  process.env.PUSH_SCHEDULER_INTERVAL_MS || 30000
);
const WEB_PUSH_READY = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (WEB_PUSH_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn(
    '[PUSH] VAPID keys ausentes. PWA continua funcionando, mas Web Push fica desativado até configurar o .env.'
  );
}

if (
  IS_PRODUCTION &&
  (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET)
) {
  console.error(
    '[SECURITY] Em produção, defina APP_PASSWORD e SESSION_SECRET no .env.'
  );
  process.exit(1);
}

if (
  !IS_PRODUCTION &&
  (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET)
) {
  console.warn(
    '[SECURITY] Usando credenciais padrão de desenvolvimento. Configure APP_PASSWORD e SESSION_SECRET no .env.'
  );
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 80 * 1024 * 1024,
  },
  fileFilter: (request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.db')) {
      callback(new Error('Apenas arquivos .db são permitidos.'));
      return;
    }

    callback(null, true);
  },
});

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isAllowedLocalOrigin(origin, request) {
  if (!origin) return true;

  if (origin === 'null') {
    return !IS_PRODUCTION;
  }

  let originUrl;

  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const requestHost = request.get('host');
  const publicBaseUrl = new URL(PUBLIC_BASE_URL);

  const allowedHosts = new Set([
    requestHost,
    publicBaseUrl.host,
    `localhost:${PORT}`,
    `127.0.0.1:${PORT}`,
    `0.0.0.0:${PORT}`,
  ]);

  const hostname = originUrl.hostname;

  const isPrivateLan =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  const isExpectedPort = !originUrl.port || originUrl.port === String(PORT);

  if (allowedHosts.has(originUrl.host)) return true;

  if (!IS_PRODUCTION && isPrivateLan && isExpectedPort) {
    return true;
  }

  return false;
}

function sameOriginCors(request, response, next) {
  const origin = request.get('origin');

  if (!origin) {
    next();
    return;
  }

  if (isAllowedLocalOrigin(origin, request)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
    return;
  }

  console.warn('[SECURITY] Origem bloqueada:', {
    origin,
    host: request.get('host'),
    publicBaseUrl: PUBLIC_BASE_URL,
    nodeEnv: NODE_ENV,
  });

  response.status(403).json({ error: 'Origem não permitida.' });
}

function isAuthenticated(request) {
  return Boolean(request.session && request.session.authenticated === true);
}

const PUBLIC_PATHS = new Set([
  '/login',
  '/login.html',
  '/login.js',
  '/service-worker.js',
  '/manifest.json',
  '/favicon.ico',
  '/api/health',
]);

function requireAuthentication(request, response, next) {
  if (PUBLIC_PATHS.has(request.path) || request.path.startsWith('/icons/')) {
    next();
    return;
  }

  if (isAuthenticated(request)) {
    next();
    return;
  }

  if (request.path.startsWith('/api')) {
    response.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }

  const nextUrl = encodeURIComponent(request.originalUrl || '/');
  response.redirect(`/login?next=${nextUrl}`);
}

function noStoreProtectedPages(request, response, next) {
  if (isAuthenticated(request)) {
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
  }

  next();
}

function getSafeNextUrl(value) {
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login')) return '/';
  return value;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sendLoginResponse(request, response, ok, options = {}) {
  const wantsJson =
    request.is('application/json') ||
    String(request.get('accept') || '').includes('application/json');

  if (wantsJson) {
    response.status(ok ? 200 : 401).json(options.payload || { ok });
    return;
  }

  response.redirect(options.redirectTo || '/login');
}

app.use(sameOriginCors);
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '2mb' }));

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],

        /*
          Importante:
          remove upgrade-insecure-requests.
          Senão, em alguns browsers/mobile, http://localhost:3000
          vira tentativa de https://localhost:3000 e quebra com
          ERR_SSL_PROTOCOL_ERROR.
        */
        upgradeInsecureRequests: null,
      },
    },
  })
);

app.use(
  session({
    name: 'quiet_progress_sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      maxAge: SESSION_MAX_AGE_MS,
    },
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (request, response) => {
    const wantsJson =
      request.is('application/json') ||
      String(request.get('accept') || '').includes('application/json');

    if (wantsJson) {
      response.status(429).json({
        error:
          'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
      });
      return;
    }

    response.redirect('/login?rate_limited=1');
  },
});

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
    authenticated: isAuthenticated(request),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
    },
  });
});

app.get('/login', (request, response) => {
  if (isAuthenticated(request)) {
    response.redirect('/');
    return;
  }

  const nextUrl = getSafeNextUrl(request.query.next || '/');
  const hasError = request.query.error === '1';
  const rateLimited = request.query.rate_limited === '1';
  const template = fs.readFileSync(path.join(PUBLIC_DIR, 'login.html'), 'utf8');

  response
    .type('html')
    .send(
      template
        .replaceAll('{{NEXT_VALUE}}', escapeHtml(nextUrl))
        .replaceAll(
          '{{ERROR_MESSAGE}}',
          hasError
            ? '<div class="login-error">Senha inválida. Tenta de novo.</div>'
            : rateLimited
              ? '<div class="login-error">Muitas tentativas. Aguarde alguns minutos.</div>'
              : ''
        )
    );
});

app.post('/login', loginLimiter, (request, response) => {
  const password = String(request.body.password || '');
  const nextUrl = getSafeNextUrl(
    request.body.next || request.query.next || '/'
  );

  if (password !== APP_PASSWORD) {
    sendLoginResponse(request, response, false, {
      redirectTo: `/login?error=1&next=${encodeURIComponent(nextUrl)}`,
      payload: { ok: false, error: 'Senha inválida.' },
    });
    return;
  }

  request.session.regenerate((error) => {
    if (error) {
      console.error('[AUTH] Erro ao regenerar sessão:', error);
      response.status(500).json({ error: 'Erro ao criar sessão.' });
      return;
    }

    request.session.authenticated = true;
    request.session.loginAt = nowISO();

    request.session.save((saveError) => {
      if (saveError) {
        console.error('[AUTH] Erro ao salvar sessão:', saveError);
        response.status(500).json({ error: 'Erro ao salvar sessão.' });
        return;
      }

      sendLoginResponse(request, response, true, {
        redirectTo: nextUrl,
        payload: { ok: true, next: nextUrl },
      });
    });
  });
});

app.get('/favicon.ico', (request, response) => {
  response.status(204).end();
});

app.use(requireAuthentication);
app.use(noStoreProtectedPages);

app.get('/api/auth/me', (request, response) => {
  response.json({
    ok: true,
    authenticated: true,
    loginAt: request.session.loginAt || null,
    environment: NODE_ENV,
  });
});

app.post('/api/logout', (request, response) => {
  request.session.destroy((error) => {
    if (error) {
      console.error('[AUTH] Erro ao encerrar sessão:', error);
      response.status(500).json({ error: 'Erro ao encerrar sessão.' });
      return;
    }

    response.clearCookie('quiet_progress_sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      path: '/',
    });

    response.json({
      ok: true,
      redirectTo: '/login',
    });
  });
});

app.use(
  express.static(PUBLIC_DIR, {
    dotfiles: 'deny',
    index: false,
    fallthrough: true,
  })
);


function isSecurePublicBaseUrl() {
  return PUBLIC_BASE_URL.startsWith('https://') || PUBLIC_BASE_URL.includes('localhost');
}

function parseDaysOfWeek(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  }

  if (typeof value === 'string') {
    try {
      return parseDaysOfWeek(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
    }
  }

  return [0, 1, 2, 3, 4, 5, 6];
}

function normalizeReminder(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    time: row.time,
    days_of_week: parseDaysOfWeek(row.days_of_week),
    enabled: Number(row.enabled) === 1,
    route: row.route || '/',
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_sent_at: row.last_sent_at,
  };
}

function normalizeReminderBody(body, current = {}) {
  const title = String(body.title ?? current.title ?? '').trim();
  const message = String(body.message ?? current.message ?? '').trim();
  const type = String(body.type ?? current.type ?? 'custom').trim() || 'custom';
  const time = String(body.time ?? current.time ?? '21:30').trim();
  const route = String(body.route ?? current.route ?? '/').trim() || '/';
  const days = parseDaysOfWeek(body.days_of_week ?? current.days_of_week);
  const enabled =
    body.enabled === undefined ? Number(current.enabled ?? 1) === 1 : Boolean(body.enabled);

  if (!title) {
    throw new Error('title é obrigatório.');
  }

  if (!message) {
    throw new Error('message é obrigatório.');
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('time deve estar no formato HH:mm.');
  }

  return {
    title,
    message,
    type,
    time,
    route,
    days_of_week: JSON.stringify(days.length ? days : [0, 1, 2, 3, 4, 5, 6]),
    enabled: enabled ? 1 : 0,
  };
}

function subscriptionFromRow(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function sendPushToActiveSubscriptions(payload) {
  if (!WEB_PUSH_READY) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: 'VAPID keys ausentes.',
    };
  }

  const subscriptions = await all(
    `
    SELECT *
    FROM push_subscriptions
    WHERE active = 1
    ORDER BY id ASC
    `
  );

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        subscriptionFromRow(subscription),
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (error) {
      failed += 1;

      const statusCode = Number(error.statusCode || error.status);

      console.warn('[PUSH] Falha ao enviar notificação:', {
        id: subscription.id,
        statusCode,
        message: error.message,
      });

      if (statusCode === 404 || statusCode === 410) {
        await run(
          `
          UPDATE push_subscriptions
          SET active = 0, updated_at = ?
          WHERE id = ?
          `,
          [nowISO(), subscription.id]
        );
      }
    }
  }

  return {
    sent,
    failed,
    skipped: false,
  };
}

async function runReminderTick() {
  if (!WEB_PUSH_READY) return;

  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const time = `${hour}:${minute}`;
  const dayOfWeek = now.getDay();
  const minuteKey = now.toISOString().slice(0, 16);

  const reminders = await all(
    `
    SELECT *
    FROM reminders
    WHERE enabled = 1
      AND time = ?
    ORDER BY id ASC
    `,
    [time]
  );

  for (const reminder of reminders) {
    const days = parseDaysOfWeek(reminder.days_of_week);

    if (!days.includes(dayOfWeek)) continue;
    if (reminder.last_sent_at && reminder.last_sent_at.slice(0, 16) === minuteKey) {
      continue;
    }

    const payload = {
      title: reminder.title,
      body: reminder.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      route: reminder.route || '/',
      reminderId: reminder.id,
      type: reminder.type,
      sentAt: now.toISOString(),
    };

    const result = await sendPushToActiveSubscriptions(payload);

    await run(
      `
      UPDATE reminders
      SET last_sent_at = ?, updated_at = ?
      WHERE id = ?
      `,
      [now.toISOString(), now.toISOString(), reminder.id]
    );

    console.log('[PUSH] Lembrete processado:', {
      reminderId: reminder.id,
      title: reminder.title,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });
  }
}

function startReminderScheduler() {
  let running = false;

  setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await runReminderTick();
    } catch (error) {
      console.error('[PUSH] Erro no scheduler:', error);
    } finally {
      running = false;
    }
  }, PUSH_SCHEDULER_INTERVAL_MS);

  console.log(
    `[PUSH] Scheduler iniciado. Intervalo: ${PUSH_SCHEDULER_INTERVAL_MS}ms. Web Push: ${WEB_PUSH_READY ? 'ativo' : 'aguardando VAPID'}`
  );
}

app.get('/api/push/vapid-public-key', (request, response) => {
  response.json({
    ok: true,
    publicKey: VAPID_PUBLIC_KEY,
    configured: WEB_PUSH_READY,
    secureContextRequired: true,
    publicBaseUrl: PUBLIC_BASE_URL,
    publicBaseUrlLooksSecure: isSecurePublicBaseUrl(),
  });
});

app.post('/api/push/subscribe', async (request, response) => {
  try {
    const { endpoint, keys } = request.body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      response.status(400).json({ error: 'Subscription inválida.' });
      return;
    }

    const now = nowISO();

    await run(
      `
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, created_at, updated_at, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(endpoint)
      DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        active = 1,
        updated_at = excluded.updated_at
      `,
      [
        endpoint,
        keys.p256dh,
        keys.auth,
        String(request.get('user-agent') || ''),
        now,
        now,
      ]
    );

    response.json({ ok: true });
  } catch (error) {
    console.error('[PUSH] Erro ao salvar subscription:', error);
    response.status(500).json({ error: 'Erro ao salvar inscrição push.' });
  }
});

app.post('/api/push/unsubscribe', async (request, response) => {
  try {
    const endpoint = String(request.body?.endpoint || '').trim();

    if (!endpoint) {
      response.status(400).json({ error: 'endpoint é obrigatório.' });
      return;
    }

    await run(
      `
      UPDATE push_subscriptions
      SET active = 0, updated_at = ?
      WHERE endpoint = ?
      `,
      [nowISO(), endpoint]
    );

    response.json({ ok: true });
  } catch (error) {
    console.error('[PUSH] Erro ao desinscrever:', error);
    response.status(500).json({ error: 'Erro ao remover inscrição push.' });
  }
});

app.post('/api/push/test', async (request, response) => {
  try {
    const result = await sendPushToActiveSubscriptions({
      title: 'Quiet Progress',
      body: 'Notificação de teste funcionando.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      route: '/',
      type: 'test',
      sentAt: nowISO(),
    });

    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error('[PUSH] Erro no teste:', error);
    response.status(500).json({ error: 'Erro ao enviar notificação de teste.' });
  }
});

app.get('/api/reminders', async (request, response) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM reminders
      ORDER BY time ASC, id ASC
      `
    );

    response.json({
      ok: true,
      items: rows.map(normalizeReminder),
    });
  } catch (error) {
    console.error('[PUSH] Erro ao listar reminders:', error);
    response.status(500).json({ error: 'Erro ao carregar lembretes.' });
  }
});

app.post('/api/reminders', async (request, response) => {
  try {
    const body = normalizeReminderBody(request.body);
    const now = nowISO();

    const result = await run(
      `
      INSERT INTO reminders (title, message, type, time, days_of_week, enabled, route, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        body.title,
        body.message,
        body.type,
        body.time,
        body.days_of_week,
        body.enabled,
        body.route,
        now,
        now,
      ]
    );

    const row = await get(`SELECT * FROM reminders WHERE id = ?`, [result.id]);

    response.status(201).json({
      ok: true,
      reminder: normalizeReminder(row),
    });
  } catch (error) {
    console.error('[PUSH] Erro ao criar reminder:', error);
    response.status(400).json({ error: error.message || 'Erro ao criar lembrete.' });
  }
});

app.patch('/api/reminders/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM reminders WHERE id = ?`, [
      request.params.id,
    ]);

    if (!current) {
      response.status(404).json({ error: 'Lembrete não encontrado.' });
      return;
    }

    const body = normalizeReminderBody(request.body, current);

    await run(
      `
      UPDATE reminders
      SET title = ?, message = ?, type = ?, time = ?, days_of_week = ?, enabled = ?, route = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        body.title,
        body.message,
        body.type,
        body.time,
        body.days_of_week,
        body.enabled,
        body.route,
        nowISO(),
        request.params.id,
      ]
    );

    const updated = await get(`SELECT * FROM reminders WHERE id = ?`, [
      request.params.id,
    ]);

    response.json({
      ok: true,
      reminder: normalizeReminder(updated),
    });
  } catch (error) {
    console.error('[PUSH] Erro ao editar reminder:', error);
    response.status(400).json({ error: error.message || 'Erro ao editar lembrete.' });
  }
});

app.delete('/api/reminders/:id', async (request, response) => {
  try {
    const result = await run(`DELETE FROM reminders WHERE id = ?`, [
      request.params.id,
    ]);

    response.json({
      ok: true,
      deleted: result.changes > 0,
    });
  } catch (error) {
    console.error('[PUSH] Erro ao excluir reminder:', error);
    response.status(500).json({ error: 'Erro ao excluir lembrete.' });
  }
});
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
  return String(value || '').toUpperCase() === 'CONCLUIDO'
    ? 'CONCLUIDO'
    : 'PENDENTE';
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
    totalDays: last.getDate(),
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
      weekday,
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
    days,
  }));
}

function getWeekForDate(dateISO) {
  const start = addDaysISO(dateISO, -getWeekdayIndexMondayFirst(dateISO));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysISO(start, index);
    return {
      date,
      weekday: index,
      day: Number(date.slice(-2)),
    };
  });

  return {
    start,
    end: days[6].date,
    days,
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
    updated_at: row.updated_at,
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
    updated_at: row.updated_at,
  };
}

function calcPercent(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function normalizeHabitType(value) {
  return String(value || 'build').toLowerCase() === 'reduction'
    ? 'reduction'
    : 'build';
}

function suggestHabitType(habit) {
  const text = `${habit.titulo || ''} ${habit.subtitulo || ''}`.toLowerCase();
  const reductionTerms = [
    'álcool',
    'alcool',
    'lust',
    'pornografia',
    'cigarro',
    'açúcar',
    'acucar',
    'redes sociais',
  ];

  return reductionTerms.some((term) => text.includes(term))
    ? 'reduction'
    : 'build';
}

function isReductionHabit(habit) {
  return normalizeHabitType(habit.habit_type) === 'reduction';
}

function habitSuccessFromChecked(habit, checked) {
  return isReductionHabit(habit) ? !checked : checked;
}

function habitMetricLabel(habit) {
  return isReductionHabit(habit) ? 'clean days' : 'completion';
}

function habitMonthText(habit, item) {
  if (isReductionHabit(habit)) {
    return `${item.cleanDays}/${item.possibleDays} clean days · ${item.occurrences} occurrences`;
  }

  return `${item.completedDays}/${item.possibleDays} completed`;
}

function enumerateDates(start, end) {
  const dates = [];

  if (!start || !end || start > end) return dates;

  for (let date = start; date <= end; date = addDaysISO(date, 1)) {
    dates.push(date);
  }

  return dates;
}

function getHabitValidDates(habit, start, end, options = {}) {
  let currentStart = start;
  let currentEnd = end;

  if (habit.data_inicio && habit.data_inicio > currentStart) {
    currentStart = habit.data_inicio;
  }

  if (habit.data_fim && habit.data_fim < currentEnd) {
    currentEnd = habit.data_fim;
  }

  if (options.limitToToday !== false) {
    const today = todayISO();
    if (today < currentEnd) currentEnd = today;
  }

  return enumerateDates(currentStart, currentEnd);
}

function calcHabitStreaks(habit, dates, logMap, anchorDate) {
  const isReduction = isReductionHabit(habit);
  const validDates = dates.filter((date) => dateIsWithinHabit(habit, date));
  const validDateSet = new Set(validDates);
  const anchor =
    anchorDate && validDateSet.has(anchorDate)
      ? anchorDate
      : validDates.length
        ? validDates[validDates.length - 1]
        : null;

  let current = 0;

  if (anchor) {
    for (let date = anchor; validDateSet.has(date); date = addDaysISO(date, -1)) {
      const checked = logMap[`${habit.id}:${date}`] === true;
      const success = isReduction ? !checked : checked;

      if (!success) break;
      current += 1;
    }
  }

  let best = 0;
  let running = 0;

  validDates.forEach((date) => {
    const checked = logMap[`${habit.id}:${date}`] === true;
    const success = isReduction ? !checked : checked;

    if (success) {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  });

  return {
    current,
    best,
  };
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

  const logMap = new Map(
    logs.map((row) => [Number(row.habito_id), Number(row.concluido) === 1])
  );

  const habits = allHabits
    .filter(
      (habit) => includeInactiveWithLogs || dateIsWithinHabit(habit, date)
    )
    .map((habit) => {
      const checked = logMap.get(Number(habit.id)) === true;
      const habitType = normalizeHabitType(habit.habit_type);
      const success = habitType === 'reduction' ? !checked : checked;

      return {
        id: habit.id,
        titulo: habit.titulo,
        subtitulo: habit.subtitulo || '',
        ativo: Number(habit.ativo) === 1,
        cor: habit.cor,
        ordem: Number(habit.ordem || 0),
        data_inicio: habit.data_inicio,
        data_fim: habit.data_fim,
        habit_type: habitType,
        disabledForDate: !dateIsWithinHabit(habit, date),
        concluido: checked,
        occurrence: habitType === 'reduction' ? checked : false,
        cleanDay: habitType === 'reduction' ? !checked : null,
        success,
      };
    });

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

  const habitsDone = habits.filter((habit) => habit.success).length;
  const buildHabits = habits.filter((habit) => habit.habit_type === 'build');
  const reductionHabits = habits.filter(
    (habit) => habit.habit_type === 'reduction'
  );

  const buildDone = buildHabits.filter((habit) => habit.success).length;
  const reductionClean = reductionHabits.filter((habit) => habit.success).length;
  const reductionOccurrences = reductionHabits.filter(
    (habit) => habit.occurrence
  ).length;

  const tasksDone = tasks.filter((task) => task.status === 'CONCLUIDO').length;

  const habitsPercent = calcPercent(habitsDone, habits.length);
  const buildScore = calcPercent(buildDone, buildHabits.length);
  const reductionScore = calcPercent(reductionClean, reductionHabits.length);
  const scoreParts = [];
  if (buildHabits.length) scoreParts.push(buildScore);
  if (reductionHabits.length) scoreParts.push(reductionScore);
  const overallScore = scoreParts.length
    ? Math.round(scoreParts.reduce((sum, item) => sum + item, 0) / scoreParts.length)
    : 0;

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
      buildDone,
      buildTotal: buildHabits.length,
      buildScore,
      reductionClean,
      reductionTotal: reductionHabits.length,
      reductionOccurrences,
      reductionScore,
      overallScore,
      tasksDone,
      tasksTotal: tasks.length,
      tasksPercent,
      totalDone,
      totalItems,
      totalPercent: calcPercent(totalDone, totalItems),
    },
  };
}

async function getDashboardMonth(monthValue, options = {}) {
  const range = getMonthRange(monthValue);
  const weeks = getMonthWeeks(monthValue);
  const today = todayISO();
  const anchorDate = normalizeDate(options.anchorDate || today);
  const habits = await getHabitsForRange(range.start, range.end, true);

  const habitLogs = await all(
    `
    SELECT habito_id, data_ref, concluido
    FROM habitos_log
    WHERE data_ref BETWEEN ? AND ?
    `,
    [range.start, range.end]
  );

  const tasks = (
    await all(
      `
    SELECT *
    FROM tarefas
    WHERE data_ref BETWEEN ? AND ?
      AND ativo = 1
    ORDER BY data_ref ASC, ordem ASC, id ASC
    `,
      [range.start, range.end]
    )
  ).map(normalizeTask);

  const mindsets = (
    await all(
      `
    SELECT *
    FROM mindset
    WHERE data_ref BETWEEN ? AND ?
    ORDER BY data_ref ASC
    `,
      [range.start, range.end]
    )
  ).map(normalizeMindset);

  const logMap = {};
  const habitStats = {};
  const days = {};

  habits.forEach((habit) => {
    const habitType = normalizeHabitType(habit.habit_type);

    habitStats[habit.id] = {
      habit_id: habit.id,
      titulo: habit.titulo,
      cor: habit.cor,
      habit_type: habitType,
      metricLabel: habitType === 'reduction' ? 'clean days' : 'completion',
      possibleDays: 0,
      doneDays: 0,
      completedDays: 0,
      cleanDays: 0,
      occurrences: 0,
      percent: 0,
      currentStreak: 0,
      bestStreak: 0,
      monthText: '',
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
      buildDone: 0,
      buildTotal: 0,
      reductionClean: 0,
      reductionTotal: 0,
      reductionOccurrences: 0,
      taskDone: 0,
      taskTotal: 0,
      totalDone: 0,
      totalItems: 0,
      percent: 0,
      hasNote: false,
    };
  }

  habitLogs.forEach((log) => {
    const key = `${log.habito_id}:${log.data_ref}`;
    logMap[key] = Number(log.concluido) === 1;
  });

  Object.keys(days).forEach((date) => {
    habits.forEach((habit) => {
      const habitType = normalizeHabitType(habit.habit_type);
      const visibleForDate =
        Number(habit.ativo) === 1 && dateIsWithinHabit(habit, date);
      const hasHistoricalLog = logMap[`${habit.id}:${date}`] !== undefined;

      if (visibleForDate || hasHistoricalLog) {
        const checked = logMap[`${habit.id}:${date}`] === true;
        const success = habitSuccessFromChecked(habit, checked);

        days[date].habitTotal += 1;
        habitStats[habit.id].possibleDays += 1;

        if (success) {
          days[date].habitDone += 1;
          habitStats[habit.id].doneDays += 1;
        }

        if (habitType === 'reduction') {
          days[date].reductionTotal += 1;
          if (checked) {
            days[date].reductionOccurrences += 1;
            habitStats[habit.id].occurrences += 1;
          } else {
            days[date].reductionClean += 1;
            habitStats[habit.id].cleanDays += 1;
          }
        } else {
          days[date].buildTotal += 1;
          if (checked) {
            days[date].buildDone += 1;
            habitStats[habit.id].completedDays += 1;
          }
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
      days[mindset.data_ref].hasNote = Boolean(
        String(mindset.notas || '').trim()
      );
    }
  });

  Object.keys(days).forEach((date) => {
    const day = days[date];
    day.totalDone = day.habitDone + day.taskDone;
    day.totalItems = day.habitTotal + day.taskTotal;
    day.percent = calcPercent(day.totalDone, day.totalItems);
    day.habitPercent = calcPercent(day.habitDone, day.habitTotal);
    day.buildScore = calcPercent(day.buildDone, day.buildTotal);
    day.reductionScore = calcPercent(day.reductionClean, day.reductionTotal);
    day.taskPercent = calcPercent(day.taskDone, day.taskTotal);
  });

  const allDates = Object.keys(days).sort();

  habits.forEach((habit) => {
    const item = habitStats[habit.id];
    const validDates = getHabitValidDates(habit, range.start, range.end, {
      limitToToday: true,
    });
    const streaks = calcHabitStreaks(habit, validDates, logMap, anchorDate);

    item.percent = calcPercent(item.doneDays, item.possibleDays);
    item.currentStreak = streaks.current;
    item.bestStreak = streaks.best;
    item.monthText = habitMonthText(habit, item);
  });

  const buildStats = Object.values(habitStats).filter(
    (item) => item.habit_type === 'build'
  );
  const reductionStats = Object.values(habitStats).filter(
    (item) => item.habit_type === 'reduction'
  );

  const avgPercent = (items) => {
    const valid = items.filter((item) => item.possibleDays > 0);
    if (!valid.length) return 0;
    return Math.round(
      valid.reduce((sum, item) => sum + item.percent, 0) / valid.length
    );
  };

  const buildScore = avgPercent(buildStats);
  const reductionScore = avgPercent(reductionStats);
  const scoreParts = [];
  if (buildStats.length) scoreParts.push(buildScore);
  if (reductionStats.length) scoreParts.push(reductionScore);
  const overallScore = scoreParts.length
    ? Math.round(scoreParts.reduce((sum, item) => sum + item, 0) / scoreParts.length)
    : 0;

  const activeStreaks = {
    build: buildStats
      .filter((item) => item.currentStreak > 0)
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 3),
    reduction: reductionStats
      .filter((item) => item.currentStreak > 0)
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 3),
  };

  const bestStreaks = {
    build: buildStats
      .filter((item) => item.bestStreak > 0)
      .sort((a, b) => b.bestStreak - a.bestStreak)
      .slice(0, 3),
    reduction: reductionStats
      .filter((item) => item.bestStreak > 0)
      .sort((a, b) => b.bestStreak - a.bestStreak)
      .slice(0, 3),
  };

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
      percent: calcPercent(totalDone, totalItems),
    };
  });

  const monthDone = Object.values(days).reduce(
    (sum, day) => sum + day.totalDone,
    0
  );
  const monthItems = Object.values(days).reduce(
    (sum, day) => sum + day.totalItems,
    0
  );

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
      data_fim: habit.data_fim,
      habit_type: normalizeHabitType(habit.habit_type),
      suggested_habit_type: suggestHabitType(habit),
    })),
    logMap,
    tasksByDate,
    mindsetByDate,
    days,
    stats: {
      monthDone,
      monthItems,
      monthPercent: calcPercent(monthDone, monthItems),
      buildScore,
      reductionScore,
      overallScore,
      buildHabitCount: buildStats.length,
      reductionHabitCount: reductionStats.length,
      weekStats,
      habitStats: Object.values(habitStats),
      activeStreaks,
      bestStreaks,
    },
  };
}

async function getStatsMonth(monthValue) {
  const dashboard = await getDashboardMonth(monthValue);
  const range = dashboard.range;
  const dates = Object.keys(dashboard.days).sort();

  const tasksDoneSeries = dates.map((date) => ({
    date,
    total: dashboard.days[date].taskDone,
  }));

  const reductionOccurrencesSeries = dates.map((date) => ({
    date,
    total: dashboard.days[date].reductionOccurrences || 0,
  }));

  const scoreTrendSeries = dates.map((date) => ({
    date,
    buildScore: dashboard.days[date].buildScore || 0,
    reductionScore: dashboard.days[date].reductionScore || 0,
    overallScore: dashboard.days[date].percent || 0,
  }));

  const dayProgressSeries = dates.map((date) => ({
    date,
    percent: dashboard.days[date].percent,
  }));

  const mindsetSeries = dates.map((date) => {
    const mindset = dashboard.mindsetByDate[date];

    return {
      date,
      energia: mindset ? Number(mindset.energia) : null,
      foco: mindset ? Number(mindset.foco) : null,
      motivacao: mindset ? Number(mindset.motivacao) : null,
      humor: mindset ? Number(mindset.humor) : null,
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
    percent: calcPercent(Number(row.done || 0), Number(row.total || 0)),
  }));

  const validMindsets = mindsetSeries.filter((item) => item.energia !== null);
  const avg = (key) => {
    if (!validMindsets.length) return 0;
    const value =
      validMindsets.reduce((sum, item) => sum + Number(item[key] || 0), 0) /
      validMindsets.length;
    return Math.round(value * 10) / 10;
  };

  return {
    month: monthValue,
    monthSummary: dashboard.stats,
    dayProgressSeries,
    tasksDoneSeries,
    reductionOccurrencesSeries,
    scoreTrendSeries,
    habitStats: dashboard.stats.habitStats,
    weekStats: dashboard.stats.weekStats,
    priorityStats,
    mindsetSeries,
    mindsetAverage: {
      energia: avg('energia'),
      foco: avg('foco'),
      motivacao: avg('motivacao'),
      humor: avg('humor'),
    },
  };
}

function markdownTaskLine(task) {
  return `- [${task.status === 'CONCLUIDO' ? 'x' : ' '}] ${task.titulo}${task.prioridade ? ` #${String(task.prioridade).toLowerCase()}` : ''}`;
}

function markdownHabitLine(habit) {
  if (habit.habit_type === 'reduction') {
    return `- [${habit.concluido ? 'x' : ' '}] ${habit.titulo} — ${habit.concluido ? 'occurrence' : 'clean day'}`;
  }

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

app.get('/api/dashboard', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    response.json(await getDashboardMonth(month, { anchorDate: request.query.date }));
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

app.get('/api/habits', async (request, response) => {
  try {
    const habits = await all(
      `
      SELECT *
      FROM habitos
      ORDER BY ativo DESC, ordem ASC, id ASC
      `
    );

    response.json({
      ok: true,
      legacyHabitTypeMigration: Boolean(lastMigrationInfo.legacyHabitTypeMigration),
      habits: habits.map((habit) => ({
        id: habit.id,
        titulo: habit.titulo,
        subtitulo: habit.subtitulo || '',
        ativo: Number(habit.ativo) === 1,
        habit_type: normalizeHabitType(habit.habit_type),
        suggested_habit_type: suggestHabitType(habit),
        data_inicio: habit.data_inicio,
        data_fim: habit.data_fim,
      })),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao listar hábitos.' });
  }
});

app.patch('/api/habits/types', async (request, response) => {
  try {
    const updates = Array.isArray(request.body?.updates)
      ? request.body.updates
      : [];

    if (!updates.length) {
      return response.status(400).json({ error: 'Nenhuma alteração enviada.' });
    }

    const now = nowISO();

    for (const update of updates) {
      const id = Number(update.id);
      if (!Number.isInteger(id) || id <= 0) continue;

      await run(
        `
        UPDATE habitos
        SET habit_type = ?, updated_at = ?
        WHERE id = ?
        `,
        [normalizeHabitType(update.habit_type), now, id]
      );
    }

    lastMigrationInfo.legacyHabitTypeMigration = false;

    response.json({
      ok: true,
      updated: updates.length,
      legacyHabitTypeMigration: false,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao atualizar tipos de hábitos.' });
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
      INSERT INTO habitos (titulo, subtitulo, ativo, cor, ordem, data_inicio, data_fim, habit_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        titulo,
        String(request.body.subtitulo || '').trim(),
        request.body.ativo === false ? 0 : 1,
        request.body.cor ? String(request.body.cor).trim() : null,
        clampNumber(request.body.ordem, 0, 9999, 0),
        isValidISODate(request.body.data_inicio)
          ? request.body.data_inicio
          : null,
        isValidISODate(request.body.data_fim) ? request.body.data_fim : null,
        normalizeHabitType(request.body.habit_type),
        now,
        now,
      ]
    );

    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [result.id]);

    response.status(201).json({
      ok: true,
      habit,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao criar hábito.' });
  }
});

app.patch('/api/habits/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM habitos WHERE id = ?`, [
      request.params.id,
    ]);

    if (!current) {
      return response.status(404).json({ error: 'Hábito não encontrado.' });
    }

    const next = {
      titulo:
        request.body.titulo !== undefined && String(request.body.titulo).trim()
          ? String(request.body.titulo).trim()
          : current.titulo,
      subtitulo:
        request.body.subtitulo !== undefined
          ? String(request.body.subtitulo || '').trim()
          : current.subtitulo,
      ativo:
        request.body.ativo !== undefined
          ? Number(Boolean(request.body.ativo))
          : Number(current.ativo),
      cor:
        request.body.cor !== undefined
          ? request.body.cor
            ? String(request.body.cor).trim()
            : null
          : current.cor,
      ordem:
        request.body.ordem !== undefined
          ? clampNumber(request.body.ordem, 0, 9999, Number(current.ordem || 0))
          : Number(current.ordem || 0),
      data_inicio:
        request.body.data_inicio !== undefined
          ? isValidISODate(request.body.data_inicio)
            ? request.body.data_inicio
            : null
          : current.data_inicio,
      data_fim:
        request.body.data_fim !== undefined
          ? isValidISODate(request.body.data_fim)
            ? request.body.data_fim
            : null
          : current.data_fim,
      habit_type:
        request.body.habit_type !== undefined
          ? normalizeHabitType(request.body.habit_type)
          : normalizeHabitType(current.habit_type),
    };

    await run(
      `
      UPDATE habitos
      SET titulo = ?, subtitulo = ?, ativo = ?, cor = ?, ordem = ?, data_inicio = ?, data_fim = ?, habit_type = ?, updated_at = ?
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
        next.habit_type,
        nowISO(),
        request.params.id,
      ]
    );

    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [
      request.params.id,
    ]);

    response.json({
      ok: true,
      habit,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao editar hábito.' });
  }
});

app.delete('/api/habits/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM habitos WHERE id = ?`, [
      request.params.id,
    ]);

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
      deletedId: Number(request.params.id),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao excluir hábito.' });
  }
});

app.put('/api/habits/:id/log', async (request, response) => {
  try {
    const habit = await get(`SELECT * FROM habitos WHERE id = ?`, [
      request.params.id,
    ]);

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
      concluido: Boolean(concluido),
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
        now,
      ]
    );

    response.status(201).json({
      ok: true,
      task: normalizeTask(
        await get(`SELECT * FROM tarefas WHERE id = ?`, [result.id])
      ),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao criar tarefa.' });
  }
});

app.patch('/api/tasks/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM tarefas WHERE id = ?`, [
      request.params.id,
    ]);

    if (!current || Number(current.ativo) !== 1) {
      return response.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    const next = {
      titulo:
        request.body.titulo !== undefined && String(request.body.titulo).trim()
          ? String(request.body.titulo).trim()
          : current.titulo,
      descricao:
        request.body.descricao !== undefined
          ? String(request.body.descricao || '').trim()
          : current.descricao,
      prioridade:
        request.body.prioridade !== undefined
          ? sanitizePriority(request.body.prioridade)
          : current.prioridade,
      status:
        request.body.status !== undefined
          ? sanitizeStatus(request.body.status)
          : current.status,
      data_ref:
        request.body.data_ref !== undefined
          ? normalizeDate(request.body.data_ref)
          : current.data_ref,
      ordem:
        request.body.ordem !== undefined
          ? clampNumber(request.body.ordem, 0, 9999, Number(current.ordem || 0))
          : Number(current.ordem || 0),
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
        request.params.id,
      ]
    );

    response.json({
      ok: true,
      task: normalizeTask(
        await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id])
      ),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao editar tarefa.' });
  }
});

app.delete('/api/tasks/:id', async (request, response) => {
  try {
    const current = await get(`SELECT * FROM tarefas WHERE id = ?`, [
      request.params.id,
    ]);

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
      deletedId: Number(request.params.id),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao excluir tarefa.' });
  }
});

app.put('/api/tasks/:id/status', async (request, response) => {
  try {
    const status = sanitizeStatus(request.body.status);

    const current = await get(
      `SELECT * FROM tarefas WHERE id = ? AND ativo = 1`,
      [request.params.id]
    );

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
      task: normalizeTask(
        await get(`SELECT * FROM tarefas WHERE id = ?`, [request.params.id])
      ),
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
        now,
      ]
    );

    response.json({
      ok: true,
      mindset: await getMindsetForDate(date),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao salvar check-in.' });
  }
});

app.get('/api/checkins', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    const q = String(request.query.q || '')
      .trim()
      .toLowerCase();
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
      rows = rows.filter((row) =>
        String(row.notas || '')
          .toLowerCase()
          .includes(q)
      );
    }

    response.json({
      ok: true,
      month,
      items: rows.map(normalizeMindset),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Erro ao carregar check-ins.' });
  }
});

app.get('/api/notes', async (request, response) => {
  try {
    const month = normalizeMonth(request.query.month);
    const q = String(request.query.q || '')
      .trim()
      .toLowerCase();
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
      rows = rows.filter((row) =>
        String(row.notas || '')
          .toLowerCase()
          .includes(q)
      );
    }

    response.json({
      ok: true,
      month,
      items: rows.map(normalizeMindset),
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
      markdown: await buildDayMarkdown(date),
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


function openTempSQLite(filePath, mode = sqlite3.OPEN_READONLY) {
  return new Promise((resolve, reject) => {
    const tempDb = new sqlite3.Database(filePath, mode, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(tempDb);
    });
  });
}

function closeTempSQLite(tempDb) {
  return new Promise((resolve, reject) => {
    tempDb.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function tempGet(tempDb, sql, params = []) {
  return new Promise((resolve, reject) => {
    tempDb.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function tempAll(tempDb, sql, params = []) {
  return new Promise((resolve, reject) => {
    tempDb.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function validateSQLiteBackupFile(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Arquivo SQLite não encontrado.');
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 4096) {
    throw new Error('Backup inválido: arquivo pequeno demais para conter o banco do app.');
  }

  const tempDb = await openTempSQLite(filePath, sqlite3.OPEN_READONLY);

  try {
    const integrity = await tempGet(tempDb, `PRAGMA integrity_check`);
    const integrityValue = Object.values(integrity || {})[0];

    if (integrityValue !== 'ok') {
      throw new Error(`Arquivo SQLite falhou no integrity_check: ${integrityValue}`);
    }

    const tableRows = await tempAll(
      tempDb,
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
      `
    );

    const tableNames = tableRows.map((row) => row.name);

    if (tableNames.length === 0) {
      throw new Error(
        'Backup inválido: o banco de origem não contém tabelas. Verifique DB_PATH.'
      );
    }

    const expectedTables = ['habitos', 'habitos_log', 'tarefas', 'mindset'];
    const missing = expectedTables.filter((table) => !tableNames.includes(table));

    if (missing.length) {
      throw new Error(`Backup inválido. Tabelas ausentes: ${missing.join(', ')}`);
    }

    if (options.requireAppTables !== false && !tableNames.includes('habitos')) {
      throw new Error('Backup inválido: tabela habitos não encontrada.');
    }

    return {
      ok: true,
      size: stats.size,
      tables: tableNames,
    };
  } finally {
    await closeTempSQLite(tempDb);
  }
}

async function checkpointDatabase() {
  try {
    await run(`PRAGMA wal_checkpoint(FULL)`);
  } catch (error) {
    console.warn('[SQLite] WAL checkpoint falhou:', error.message);
  }
}

async function copyCurrentDatabaseBackup(reason = 'manual') {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Banco ativo não encontrado em DB_PATH: ${DB_PATH}`);
  }

  await checkpointDatabase();

  const activeValidation = await validateSQLiteBackupFile(DB_PATH);

  if (!activeValidation.tables.length) {
    throw new Error(
      'Backup inválido: o banco de origem não contém tabelas. Verifique DB_PATH.'
    );
  }

  const safeReason = String(reason).replace(/[^a-z0-9_-]/gi, '_');
  const backupPath = path.join(
    BACKUP_DIR,
    `quiet_progress_${safeReason}_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
  );

  fs.copyFileSync(DB_PATH, backupPath);

  await validateSQLiteBackupFile(backupPath);

  return backupPath;
}

function removeSQLiteSidecars(dbPath) {
  [`${dbPath}-wal`, `${dbPath}-shm`].forEach((sidecar) => {
    if (fs.existsSync(sidecar)) {
      fs.rmSync(sidecar, { force: true });
    }
  });
}


app.get('/api/backup', async (request, response) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return response.status(404).json({
        error: `Banco de dados não encontrado em DB_PATH: ${DB_PATH}`,
      });
    }

    await checkpointDatabase();

    const activeValidation = await validateSQLiteBackupFile(DB_PATH);

    if (!activeValidation.tables.length) {
      return response.status(500).json({
        error:
          'Backup inválido: o banco de origem não contém tabelas. Verifique DB_PATH.',
        dbPath: DB_PATH,
      });
    }

    const backupPath = await copyCurrentDatabaseBackup('download');
    const backupValidation = await validateSQLiteBackupFile(backupPath);

    response.setHeader('X-Quiet-Progress-DB-Path', DB_PATH);
    response.setHeader('X-Quiet-Progress-DB-Tables', backupValidation.tables.join(','));

    response.download(backupPath, `quiet_progress_${todayISO()}.db`, (error) => {
      if (error) {
        console.error('[Backup] Falha no download:', error);
      }
    });
  } catch (error) {
    console.error('[Backup] Erro:', error);
    response.status(500).json({
      error: error.message || 'Erro ao gerar backup.',
      dbPath: DB_PATH,
    });
  }
});

app.post(
  '/api/sistema/restore',
  upload.single('database'),
  async (request, response) => {
    const uploadedPath = request.file?.path;
    let safetyBackupPath = null;

    try {
      if (!request.file) {
        return response
          .status(400)
          .json({ error: 'Arquivo .db é obrigatório.' });
      }

      const uploadedValidation = await validateSQLiteBackupFile(uploadedPath);

      safetyBackupPath = await copyCurrentDatabaseBackup('before_restore');

      await closeDatabase();

      removeSQLiteSidecars(DB_PATH);

      fs.copyFileSync(uploadedPath, DB_PATH);

      connectDatabase();
      const migrationInfo = await initDatabase();
      lastMigrationInfo = migrationInfo || { legacyHabitTypeMigration: false };

      const restoredValidation = await validateSQLiteBackupFile(DB_PATH);
      const healthCheck = await get(`SELECT COUNT(*) AS total FROM habitos`);

      if (!healthCheck) {
        throw new Error('Banco restaurado não respondeu ao health check.');
      }

      response.json({
        ok: true,
        message: 'Restore concluído. Banco validado e recarregado.',
        requiresRestart: false,
        legacyHabitTypeMigration: Boolean(lastMigrationInfo.legacyHabitTypeMigration),
        dbPath: DB_PATH,
        restoredTables: restoredValidation.tables,
        uploadedTables: uploadedValidation.tables,
        safetyBackup: safetyBackupPath ? path.basename(safetyBackupPath) : null,
      });
    } catch (error) {
      console.error('[Restore] Erro:', error);

      try {
        await closeDatabase();
      } catch {}

      if (safetyBackupPath && fs.existsSync(safetyBackupPath)) {
        try {
          fs.copyFileSync(safetyBackupPath, DB_PATH);
          removeSQLiteSidecars(DB_PATH);
          connectDatabase();
          await initDatabase();
          console.warn('[Restore] Rollback automático aplicado:', safetyBackupPath);
        } catch (rollbackError) {
          console.error('[Restore] Falha no rollback automático:', rollbackError);
        }
      } else {
        try {
          connectDatabase();
          await initDatabase();
        } catch (reconnectError) {
          console.error('[Restore] Falha ao reconectar banco:', reconnectError);
        }
      }

      response.status(400).json({
        error: error.message || 'Erro ao restaurar banco de dados.',
        dbPath: DB_PATH,
        restoredPreviousDatabase: Boolean(safetyBackupPath),
      });
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
    }
  }
);


function uploadErrorHandler(error, request, response, next) {
  if (!error) {
    next();
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({
      error: 'Erro no upload do arquivo.',
      details: error.message,
    });
    return;
  }

  response.status(400).json({
    error: error.message || 'Erro no upload do arquivo.',
  });
}

app.use(uploadErrorHandler);


app.get('*', (request, response) => {
  response.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function gracefulShutdown(signal) {
  console.log(`[Shutdown] Recebido ${signal}. Fechando SQLite...`);

  try {
    await closeDatabase();
    console.log('[Shutdown] SQLite fechado com segurança.');
    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] Falha ao fechar SQLite:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});


initDatabase()
  .then((migrationInfo) => {
    lastMigrationInfo = migrationInfo || { legacyHabitTypeMigration: false };
    console.log(`[SQLite] DB_PATH ativo: ${DB_PATH}`);
    startReminderScheduler();

    app.listen(PORT, HOST, () => {
      const urls = getLocalNetworkUrls(PORT);

      console.log('');
      console.log('==========================================');
      console.log(' Quiet Progress v3 Temporal está online');
      console.log(` Ambiente: ${NODE_ENV}`);
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
