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



## Sprint 2/3 — PWA + Web Push

O Quiet Progress agora pode ser instalado como PWA e possui suporte a notificações Web Push.

### Instalação de dependências

```bash
npm install --omit=dev
```

### Gerar VAPID keys

```bash
npm run generate:vapid
```

Copie o resultado para o `.env`:

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:seu-email@example.com
```

### HTTPS é obrigatório para push no Android

Web Push em Android exige contexto seguro:

```text
https://seu-dominio.com
```

ou `localhost` em desenvolvimento. Acesso por `http://192.168.x.x:3000` na LAN não é contexto seguro para notificações push.

Para usar com Cloudflare Tunnel, ajuste:

```env
PUBLIC_BASE_URL=https://seu-dominio.com
NODE_ENV=production
```

Em produção, lembre-se de usar HTTPS real para que o cookie `secure` funcione corretamente.

### O que o Service Worker cacheia

O Service Worker cacheia apenas app shell seguro:

```text
/styles.css
/app.js
/login.js
/manifest.json
/icons/*
```

Ele **não cacheia**:

```text
/api/*
/login
navegações HTML protegidas
```

Isso evita vazamento de dados sensíveis e evita quebrar sessão/cookie.

### Endpoints adicionados

```text
GET    /api/push/vapid-public-key
POST   /api/push/subscribe
POST   /api/push/unsubscribe
POST   /api/push/test
GET    /api/reminders
POST   /api/reminders
PATCH  /api/reminders/:id
DELETE /api/reminders/:id
```

Todos ficam protegidos por login, exceto os arquivos públicos necessários para PWA, como `manifest.json`, `service-worker.js` e `icons`.

### Teste rápido

1. Rode com VAPID keys configuradas.
2. Sirva por HTTPS.
3. Abra Backup → Notificações.
4. Clique em “Ativar notificações”.
5. Aceite a permissão do navegador.
6. Clique em “Enviar teste”.
7. Crie/edite lembretes.
8. Feche o PWA e aguarde o horário configurado.



## Pre-commit / Operação local

Antes de commitar:

```bash
npm run check
git status --short
```

Não commitar:

```text
.env
quiet_progress.db
*.db
*.db-wal
*.db-shm
backups/
logs/
exports/
uploads/*
node_modules/
.cloudflared/
```

O repositório deve conter apenas código, docs, exemplos e `uploads/.gitkeep`.

## PM2

Esta versão inclui `ecosystem.config.cjs` para evitar o problema clássico de o PM2 iniciar o app em outro diretório e criar um `quiet_progress.db` vazio.

Uso recomendado:

```bash
npm install --omit=dev
cp .env.example .env
nano .env
npm run pm2:start
npm run pm2:logs
```

Comandos úteis:

```bash
pm2 status
pm2 logs quiet-progress --lines 100
pm2 restart quiet-progress
pm2 save
```

O `ecosystem.config.cjs` fixa `cwd` na raiz do projeto e, se `DB_PATH` não estiver no `.env`, usa:

```text
./quiet_progress.db
```

Para servidor/homelab, prefira definir no `.env`:

```env
DB_PATH=/opt/quiet-progress/quiet_progress.db
```

## Logs

Com PM2, os logs ficam em:

```text
logs/pm2-out.log
logs/pm2-error.log
```

Esses arquivos são ignorados pelo Git.

## Backup/restore

O backup usa exatamente o `DB_PATH` ativo, roda checkpoint WAL e valida:

```text
SQLite válido
integrity_check ok
tabelas não vazias
habitos
habitos_log
tarefas
mindset
```

Se o backup baixado vier com 4 KB e 0 tabelas, o servidor está apontando para o `DB_PATH` errado.
Verifique o log de startup:

```text
[SQLite] Banco conectado em: /caminho/real/quiet_progress.db
[SQLite] DB_PATH ativo: /caminho/real/quiet_progress.db
```


## Quiet Progress v1.3 — Rituals, Reviews, Data Health & Low-End PM2

Esta sprint adiciona recursos leves para uso real em LAN/homelab, sem frameworks novos e sem dependências pesadas.

### Novidades

```text
End Day / Fechamento do dia
Weekly Review em Markdown
Backup automático diário validado
Data Doctor / diagnóstico de dados
Archive Habit / restaurar hábito arquivado
Pomodoro registrado como focus_session
PM2 ajustado para PC debug e notebook servidor fraco
```

### Instalação rápida

```bash
npm install --omit=dev
cp .env.example .env
nano .env
npm start
```

### .env recomendado

Para evitar banco vazio por diretório errado, defina `DB_PATH` absoluto no notebook servidor:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

APP_PASSWORD=troque-essa-senha
SESSION_SECRET=gere-um-segredo-longo

DB_PATH=/opt/quiet-progress/quiet_progress.db
PUBLIC_BASE_URL=http://IP_DO_NOTEBOOK:3000
```

Em LAN HTTP, mantenha `NODE_ENV=development`. Não use `NODE_ENV=production` sem HTTPS, porque cookies `secure` podem impedir login.

### PC principal / debug

```bash
npm start
```

Acesse:

```text
http://localhost:3000
```

### Notebook Linux / servidor LAN com PM2

```bash
npm install --omit=dev
npm run pm2:start
npm run pm2:logs
pm2 save
```

Comandos:

```bash
npm run pm2:restart
npm run pm2:stop
npm run pm2:delete
npm run pm2:logs
```

Reset se der bagunça:

```bash
npm run pm2:delete
npm run pm2:start
pm2 save
```

O `ecosystem.config.cjs` usa:

```text
instances: 1
watch: false
max_memory_restart: 300M
logs/out.log
logs/err.log
logs/combined.log
```

### Futuro tunnel/HTTPS

Para Cloudflare Tunnel/HTTPS:

```env
NODE_ENV=production
HOST=127.0.0.1
PUBLIC_BASE_URL=https://seu-subdominio.com
```

Use:

```bash
npm run pm2:start:tunnel
```

### End Day

No Overview, o card **End Day** gera o fechamento do dia selecionado.

Ações:

```text
Fechar dia
Copiar Markdown
Baixar .md
```

O fechamento salva/atualiza registro em `day_closures`, mas não bloqueia edições futuras.

### Weekly Review

No Journal, a seção **Weekly Review** gera um Markdown da semana do dia selecionado:

```text
Scores
Build Highlights
Reduction
Tasks
Mindset Average
Notes
```

### Backup automático

Ao iniciar o servidor, se não houver backup automático do dia, o app cria um backup validado em:

```text
backups/auto/
```

O backup automático:

```text
usa DB_PATH real
roda WAL checkpoint
valida integrity_check
confere tabelas essenciais
não aceita banco vazio de 4 KB
mantém retenção simples
```

Você também pode clicar em **Criar backup agora** na tela Backup.

### Data Doctor

Na tela Backup, o Data Doctor mostra:

```text
DB_PATH absoluto
DB existe
tamanho do banco
integrity_check
tabelas
contagens de hábitos/logs/tarefas/check-ins
WAL/SHM detectados
último backup automático
warnings/errors
```

Isso ajuda a diagnosticar backup vazio, DB_PATH errado e backup antigo.

### Archive Habit

Na Habit Matrix, use **Arquivar** para remover um hábito do tracker sem apagar histórico.

Em Backup/Config, a seção **Hábitos arquivados** permite restaurar.

### Pomodoro como dado real

Ao completar um Pomodoro, o app registra uma linha em `focus_sessions`.

O Overview mostra:

```text
Focus blocks today
Focus minutes
```

O End Day inclui:

```text
Pomodoros completed
Focus minutes
```

### Git hygiene

Antes de commitar:

```bash
npm run check
git status --short
```

Não commitar:

```text
.env
quiet_progress.db
*.db
*.db-wal
*.db-shm
backups/
logs/
exports/
uploads/*
node_modules/
.cloudflared/
```

Pode commitar:

```text
src/
public/
scripts/
deploy/
README.md
README-deploy.md
.env.example
ecosystem.config.cjs
package.json
package-lock.json
uploads/.gitkeep
```

### Teste manual recomendado

```text
1. npm run check
2. npm start
3. login
4. Habit Matrix
5. Build habit
6. Reduction habit
7. scores/streaks/gráficos
8. End Day copiar/baixar Markdown
9. Weekly Review copiar/baixar Markdown
10. Backup manual
11. Backup automático / Data Doctor
12. Arquivar/restaurar hábito
13. Pomodoro curto e focus_session
14. Restore com backup válido
15. PM2 start/logs/restart/stop
16. git status sem arquivos proibidos
```


## Hotfix v1.3.1 — runtime frontend e DB_PATH

Correções:

```text
runAutoBackupNow/loadDataDoctor/loadArchivedHabits restaurados no app.js
Data Doctor/Backup Status carregam corretamente
CSP permite source map do Chart.js via jsdelivr
meta mobile-web-app-capable adicionada
service-worker cache bump para evitar app.js antigo
```

Se o app não carregar o banco esperado, confira o log:

```text
[SQLite] Banco conectado em: /caminho/do/quiet_progress.db
[SQLite] DB_PATH ativo: /caminho/do/quiet_progress.db
```

Para PM2 no notebook, prefira `.env` com caminho absoluto:

```env
DB_PATH=/caminho/absoluto/quiet_progress.db
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
```

Depois:

```bash
npm run pm2:restart
npm run pm2:logs
```


## v1.3.3 — Manual Habit Reorder

Esta versão adiciona reordenação manual de hábitos.

### Como usar

Desktop:

```text
Tracker → Habit Matrix → arrastar pelo ícone ☰ ao lado do nome do hábito
```

Mobile:

```text
Tracker → Habit Matrix → usar botões ↑ ↓ na linha do hábito
```

### Persistência

A ordem é salva em:

```text
habitos.ordem
```

Endpoint:

```text
PATCH /api/habits/reorder
```

Body:

```json
{
  "orderedIds": [3, 1, 5, 2]
}
```

### Regras

```text
Não altera habit_type
Não altera logs
Não altera ativo/archived_at
Não apaga dados
Não muda cálculo de streaks/scores
```

Listas operacionais seguem a ordem manual. Rankings/top streaks podem continuar ordenados por desempenho.
