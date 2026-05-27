# Quiet Progress — Deploy local-first com Cloudflare Tunnel

Este guia prepara o Quiet Progress para acesso externo via **Cloudflare Tunnel**, sem abrir porta no roteador.

Objetivo da arquitetura:

```text
Internet
  ↓ HTTPS
Cloudflare
  ↓ Tunnel criptografado
cloudflared no notebook servidor
  ↓ http://127.0.0.1:3000
Quiet Progress Node.js + Express + SQLite
```

O app continua rodando localmente em `localhost:3000`. O Cloudflare Tunnel só publica um hostname HTTPS apontando para esse serviço local.

---

## 0. Premissas

Este guia assume:

```text
Sistema: Debian/Kali/Ubuntu ou derivado
App: Node.js + Express + SQLite
Pasta do app: /opt/quiet-progress
Usuário de serviço: quietprogress
Porta local: 3000
Domínio/subdomínio: quiet.seu-dominio.com
```

Troque os nomes conforme seu ambiente.

Não coloque segredos no Git:

```text
.env
quiet_progress.db
quiet_progress.db-wal
quiet_progress.db-shm
backups/
logs/
exports/
uploads/
node_modules/
```

---

## 1. Criar usuário e diretórios

```bash
sudo adduser --system --group --home /opt/quiet-progress quietprogress

sudo mkdir -p /opt/quiet-progress
sudo mkdir -p /var/lib/quiet-progress
sudo mkdir -p /var/backups/quiet-progress
sudo mkdir -p /var/log/quiet-progress

sudo chown -R quietprogress:quietprogress /opt/quiet-progress
sudo chown -R quietprogress:quietprogress /var/lib/quiet-progress
sudo chown -R quietprogress:quietprogress /var/backups/quiet-progress
sudo chown -R quietprogress:quietprogress /var/log/quiet-progress
```

Uso recomendado:

```text
/opt/quiet-progress          código do app
/var/lib/quiet-progress      banco SQLite
/var/backups/quiet-progress  backups manuais/automáticos
/var/log/quiet-progress      logs se você optar por arquivo
```

Se seu app atualmente espera `quiet_progress.db` na raiz do projeto, você pode manter assim. Para produção local, o ideal é adaptar `DB_PATH` via `.env`, mas se ainda não fez isso, mantenha o banco junto do app e garanta backup.

---

## 2. Copiar projeto

Exemplo usando Git:

```bash
cd /opt/quiet-progress
sudo -u quietprogress git clone https://github.com/SEU_USUARIO/quiet-progress.git .
```

Ou copiando manualmente:

```bash
sudo rsync -av --exclude node_modules --exclude .git ./quiet-progress/ /opt/quiet-progress/
sudo chown -R quietprogress:quietprogress /opt/quiet-progress
```

Instalar dependências:

```bash
cd /opt/quiet-progress
sudo -u quietprogress npm install --omit=dev
```

---

## 3. Configurar `.env.production`

Crie:

```bash
sudo -u quietprogress nano /opt/quiet-progress/.env
```

Modelo:

```env
PORT=3000
HOST=127.0.0.1
NODE_ENV=production

APP_PASSWORD=troque-por-uma-senha-forte
SESSION_SECRET=troque-por-um-segredo-longo-com-40-ou-mais-caracteres

PUBLIC_BASE_URL=https://quiet.seu-dominio.com

SESSION_MAX_AGE_DAYS=30

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:seu-email@example.com
```

Notas:

- `HOST=127.0.0.1` é recomendado com Cloudflare Tunnel. Assim o app não fica aberto para toda a LAN.
- `PUBLIC_BASE_URL` deve ser a URL HTTPS pública final.
- Em `NODE_ENV=production`, cookies seguros exigem HTTPS.

Para gerar VAPID keys:

```bash
cd /opt/quiet-progress
sudo -u quietprogress npm run generate:vapid
```

Copie o resultado para o `.env`.

---

## 4. Testar o app localmente

Antes de criar serviço:

```bash
cd /opt/quiet-progress
sudo -u quietprogress npm start
```

Em outro terminal:

```bash
curl -I http://127.0.0.1:3000/login
curl http://127.0.0.1:3000/api/health
```

Depois pare com `Ctrl+C`.

---

## 5. systemd do Quiet Progress

Copie o service:

```bash
sudo cp deploy/systemd/quiet-progress.service /etc/systemd/system/quiet-progress.service
sudo systemctl daemon-reload
sudo systemctl enable quiet-progress
sudo systemctl start quiet-progress
```

Ver status:

```bash
systemctl status quiet-progress --no-pager
journalctl -u quiet-progress -f
```

Reiniciar:

```bash
sudo systemctl restart quiet-progress
```

Parar:

```bash
sudo systemctl stop quiet-progress
```

---

## 6. Instalar cloudflared

No Debian/Kali/Ubuntu, siga a documentação atual da Cloudflare para instalar `cloudflared`.

Teste:

```bash
cloudflared --version
```

---

## 7. Criar Tunnel

Faça login:

```bash
cloudflared tunnel login
```

Crie o túnel:

```bash
cloudflared tunnel create quiet-progress
```

Liste:

```bash
cloudflared tunnel list
```

Você terá um UUID do túnel e um arquivo de credenciais, normalmente em:

```text
~/.cloudflared/<TUNNEL_UUID>.json
```

---

## 8. Configurar cloudflared

Crie diretório:

```bash
sudo mkdir -p /etc/cloudflared
```

Copie o arquivo de credenciais gerado para `/etc/cloudflared/`:

```bash
sudo cp ~/.cloudflared/<TUNNEL_UUID>.json /etc/cloudflared/<TUNNEL_UUID>.json
sudo chmod 600 /etc/cloudflared/<TUNNEL_UUID>.json
```

Crie `/etc/cloudflared/config.yml`:

```bash
sudo nano /etc/cloudflared/config.yml
```

Modelo:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: quiet.seu-dominio.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Teste manual:

```bash
cloudflared tunnel --config /etc/cloudflared/config.yml run
```

Se funcionar, pare com `Ctrl+C`.

---

## 9. Rota DNS / hostname

Você pode criar o DNS pelo CLI:

```bash
cloudflared tunnel route dns quiet-progress quiet.seu-dominio.com
```

Ou pelo painel Cloudflare Zero Trust:

```text
Networks / Tunnels → seu tunnel → Routes → Add route → Published application
Hostname: quiet.seu-dominio.com
Service: http://127.0.0.1:3000
```

---

## 10. cloudflared com systemd

Opção A — usar o service install do cloudflared:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Ver logs:

```bash
journalctl -u cloudflared -f
```

Opção B — service manual incluso neste pacote:

```bash
sudo cp deploy/systemd/cloudflared-quiet-progress.service /etc/systemd/system/cloudflared-quiet-progress.service
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-quiet-progress
sudo systemctl start cloudflared-quiet-progress
```

Ver status:

```bash
systemctl status cloudflared-quiet-progress --no-pager
journalctl -u cloudflared-quiet-progress -f
```

---

## 11. Teste externo

No navegador:

```text
https://quiet.seu-dominio.com
```

Critérios:

```text
1. Abre /login
2. Senha errada mostra erro
3. Senha correta entra
4. Logout funciona
5. /api/dashboard sem sessão retorna 401
6. PWA instala no Android
7. Web Push permite solicitar permissão
8. Test notification funciona
```

---

## 12. Backup do banco

Antes de atualizar:

```bash
sudo systemctl stop quiet-progress

sudo mkdir -p /var/backups/quiet-progress
sudo cp /opt/quiet-progress/quiet_progress.db /var/backups/quiet-progress/quiet_progress_$(date +%F_%H%M%S).db

sudo systemctl start quiet-progress
```

Se você usa WAL (`quiet_progress.db-wal` e `quiet_progress.db-shm`), prefira backup via SQLite:

```bash
sqlite3 /opt/quiet-progress/quiet_progress.db ".backup '/var/backups/quiet-progress/quiet_progress_$(date +%F_%H%M%S).db'"
```

Script incluso:

```bash
sudo install -o root -g root -m 755 deploy/scripts/backup-quiet-progress.sh /usr/local/bin/backup-quiet-progress
sudo backup-quiet-progress
```

---

## 13. Atualização do app

```bash
cd /opt/quiet-progress

sudo systemctl stop quiet-progress

sudo -u quietprogress git pull
sudo -u quietprogress npm install --omit=dev

sudo backup-quiet-progress

sudo systemctl start quiet-progress
sudo systemctl status quiet-progress --no-pager
```

Se preferir backup antes do pull:

```bash
sudo backup-quiet-progress
sudo systemctl stop quiet-progress
```

---

## 14. Rollback

### Rollback de código

Se usa Git:

```bash
cd /opt/quiet-progress
sudo systemctl stop quiet-progress

git log --oneline -n 10
sudo -u quietprogress git checkout <COMMIT_ANTERIOR>
sudo -u quietprogress npm install --omit=dev

sudo systemctl start quiet-progress
```

Para voltar ao branch:

```bash
sudo -u quietprogress git checkout main
```

### Rollback de banco

Pare o app:

```bash
sudo systemctl stop quiet-progress
```

Faça cópia do estado quebrado:

```bash
sudo cp /opt/quiet-progress/quiet_progress.db /var/backups/quiet-progress/broken_$(date +%F_%H%M%S).db
```

Restaure backup:

```bash
sudo cp /var/backups/quiet-progress/quiet_progress_YYYY-MM-DD_HHMMSS.db /opt/quiet-progress/quiet_progress.db
sudo chown quietprogress:quietprogress /opt/quiet-progress/quiet_progress.db
```

Suba:

```bash
sudo systemctl start quiet-progress
journalctl -u quiet-progress -f
```

### Rollback do Tunnel

Parar Cloudflare Tunnel:

```bash
sudo systemctl stop cloudflared
```

ou, se usou o service manual:

```bash
sudo systemctl stop cloudflared-quiet-progress
```

O app continuará acessível localmente se você alterar `HOST=0.0.0.0` ou acessar direto no servidor via `127.0.0.1`.

---

## 15. Checklist de segurança

Antes de expor:

```text
[ ] APP_PASSWORD forte, não 123456
[ ] SESSION_SECRET longo e aleatório
[ ] .env não versionado
[ ] quiet_progress.db não versionado
[ ] backups fora de public/
[ ] logs fora de public/
[ ] uploads fora de public/
[ ] NODE_ENV=production
[ ] HOST=127.0.0.1 quando usando Cloudflare Tunnel
[ ] PUBLIC_BASE_URL=https://quiet.seu-dominio.com
[ ] HTTPS funcionando pelo Cloudflare Tunnel
[ ] /api protegido sem sessão
[ ] logout invalida sessão
[ ] cookies Secure em produção
[ ] Cloudflare Access considerado para camada extra
[ ] servidor atualizado
[ ] firewall sem porta 3000 exposta na internet
[ ] backup testado
```

---

## 16. Comandos úteis

Quiet Progress:

```bash
sudo systemctl status quiet-progress --no-pager
sudo systemctl restart quiet-progress
journalctl -u quiet-progress -f
```

Cloudflared:

```bash
sudo systemctl status cloudflared --no-pager
sudo systemctl restart cloudflared
journalctl -u cloudflared -f
```

Se usar service manual:

```bash
sudo systemctl status cloudflared-quiet-progress --no-pager
sudo systemctl restart cloudflared-quiet-progress
journalctl -u cloudflared-quiet-progress -f
```

Porta local:

```bash
ss -ltnp | grep 3000
curl -I http://127.0.0.1:3000/login
```

Tunnel:

```bash
cloudflared tunnel list
cloudflared tunnel info quiet-progress
cloudflared tunnel route dns quiet-progress quiet.seu-dominio.com
```

