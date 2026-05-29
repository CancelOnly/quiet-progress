const path = require('path');

module.exports = {
  apps: [
    {
      name: 'quiet-progress',
      cwd: __dirname,
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || '0.0.0.0',
        // Se DB_PATH não estiver no .env, fixa o banco na raiz do projeto,
        // evitando DB vazio quando o PM2 é iniciado de outro diretório.
        DB_PATH:
          process.env.DB_PATH || path.join(__dirname, 'quiet_progress.db'),
      },
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
    },
  ],
};
