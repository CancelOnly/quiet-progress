# Quiet Progress v3 — Sprint 1 Segurança

Dashboard local-first com Node.js, Express, SQLite e Vanilla JS. Esta versão adiciona autenticação básica por sessão para uso em LAN e preparação para HTTPS/Cloudflare Tunnel.

## Instalação em máquina fraca / Kali / Debian

```bash
sudo apt update
sudo apt install -y build-essential python3 make g++ sqlite3 libsqlite3-dev
npm install --omit=dev
cp .env.example .env
nano .env
npm start
```

Acesse:

```text
http://localhost:3000
```

Na LAN, use o IP mostrado no terminal:

```text
http://IP_DO_NOTEBOOK:3000
```

## Variáveis de ambiente

Crie um `.env` a partir do `.env.example`:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
APP_PASSWORD=trocar-essa-senha
SESSION_SECRET=trocar-esse-segredo
PUBLIC_BASE_URL=http://localhost:3000
SESSION_MAX_AGE_DAYS=30
```

Antes de expor fora de casa, troque obrigatoriamente:

```env
APP_PASSWORD=uma-senha-forte
SESSION_SECRET=um-segredo-longo-aleatorio
NODE_ENV=production
PUBLIC_BASE_URL=https://seu-dominio-ou-tunnel
```

Em `NODE_ENV=production`, o cookie de sessão usa `secure: true`, adequado para HTTPS. Para LAN local sem HTTPS, mantenha `NODE_ENV=development`.

## Segurança implementada

- Tela `/login` protegendo o app.
- Senha única via `APP_PASSWORD`.
- Sessão via cookie HTTP-only.
- Cookie com `sameSite: lax`.
- `secure: true` apenas em produção.
- Logout via `/api/logout`.
- `/api` protegida por autenticação, exceto `/api/health`.
- `helmet` para headers HTTP de segurança.
- `x-powered-by` desabilitado.
- Rate limit no login: 10 tentativas por 15 minutos por IP.
- CORS restrito a same-origin / `PUBLIC_BASE_URL`.
- Banco, uploads, logs, backups e exports fora de `public/`.

## Rotas de autenticação

```http
GET /login
POST /login
POST /api/logout
GET /api/auth/me
GET /api/health
```

`/api/health` é público para diagnóstico básico. As outras rotas `/api` exigem sessão autenticada.

## Banco

O arquivo `quiet_progress.db` é criado automaticamente na raiz do projeto e não deve ir para o GitHub.

## Backup/Restore

Use a seção **Backup** no app. O restore substitui o arquivo SQLite atual, então baixe um backup antes.

## Git

Arquivos ignorados:

```gitignore
.env
*.db
*.db-wal
*.db-shm
backups/
logs/
exports/
uploads/
node_modules/
```

## Scripts

```bash
npm start
```

## PM2 opcional

```bash
pm2 start src/server.js --name quiet-progress
pm2 save
pm2 startup systemd
```
