const path = require('path');

const commonEnv = {
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'quiet_progress.db'),
};

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
      max_memory_restart: '300M',
      time: true,
      merge_logs: true,
      out_file: path.join(__dirname, 'logs', 'out.log'),
      error_file: path.join(__dirname, 'logs', 'err.log'),
      log_file: path.join(__dirname, 'logs', 'combined.log'),
      env_development: {
        ...commonEnv,
        NODE_ENV: 'development',
        HOST: process.env.HOST || '0.0.0.0',
        PORT: process.env.PORT || 3000,
      },
      env_production_local: {
        ...commonEnv,
        NODE_ENV: 'development',
        HOST: process.env.HOST || '0.0.0.0',
        PORT: process.env.PORT || 3000,
      },
      env_production_tunnel: {
        ...commonEnv,
        NODE_ENV: 'production',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
