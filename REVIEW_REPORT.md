# Quiet Progress — Pre-commit Review

## Resultado

Esta revisão corrigiu inconsistências reais antes do commit:

- pacote sanitizado sem `.env`, banco SQLite e backups;
- `.gitignore` reforçado;
- `.env.example` completo com `DB_PATH`, VAPID e scheduler;
- `ecosystem.config.cjs` adicionado para PM2;
- scripts PM2 adicionados ao `package.json`;
- `public/app.js` limpo para não disparar logout duplicado;
- restore agora envia cookies explicitamente no `fetch`;
- Service Worker com cache version bump para evitar UI antiga;
- handler JSON para erros de upload/multer;
- graceful shutdown para fechar SQLite em PM2/systemd;
- README atualizado com checklist de pre-commit, PM2/logs e DB_PATH.

## Achados importantes

### 1. Arquivos sensíveis estavam no ZIP original

O ZIP recebido continha:

```text
.env
quiet_progress.db
backups/*.db
backups/*.db-wal
backups/*.db-shm
```

Esses arquivos não devem ir para GitHub.

### 2. PM2 poderia criar/usar banco errado

Sem `cwd` fixo ou `DB_PATH` absoluto, PM2 pode iniciar o app de outro diretório e criar um SQLite vazio.

Correção:

```text
ecosystem.config.cjs
cwd: __dirname
DB_PATH fallback: path.join(__dirname, 'quiet_progress.db')
```

### 3. Logout tinha implementação duplicada no frontend

Havia duas funções `logout()` e dois caminhos de binding. Isso podia gerar dois POSTs de logout e comportamento confuso nos logs.

Correção:

```text
mantida apenas a versão com fetch('/api/logout') + window.location.replace('/login')
```

### 4. Service Worker podia manter frontend antigo

O cache version foi atualizado para forçar atualização do app shell.

### 5. Upload/restore precisava erro JSON consistente

Foi adicionado middleware para erros de upload/multer.

## Checks executados

```text
node --check src/database.js
node --check src/server.js
node --check public/app.js
node --check public/login.js
node --check public/service-worker.js
node --check scripts/generate-vapid.js
```

Todos passaram.

## Banco do ZIP original

O banco original foi inspecionado e continha tabelas reais:

```text
habitos
habitos_log
mindset
push_subscriptions
reminders
tarefas
```

Ele não foi incluído no pacote final.
