# Quiet Progress v3 Temporal

Dashboard local-first com Node.js, Express, SQLite e Vanilla JS.

## Instalação em máquina fraca / Kali / Debian

```bash
sudo apt update
sudo apt install -y build-essential python3 make g++ sqlite3 libsqlite3-dev
npm install --omit=dev
npm start
```

Acesse:

```text
http://localhost:3000
```

O servidor escuta em `0.0.0.0`, então também funciona via IP local na LAN.

## Scripts

```bash
npm start
```

## Banco

O arquivo `quiet_progress.db` é criado automaticamente na raiz do projeto e não deve ir para o GitHub.

## Backup/Restore

Use a seção Backup no app.
