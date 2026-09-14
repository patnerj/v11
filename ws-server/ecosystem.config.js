module.exports = {
  apps: [
    {
      name: 'fxsim-ws-gateway',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        SECRET_TOKEN: 'a4f9b8c2e1d74653a928f01b54e76c3d82a10e4b7c6d5e9f1a2b3c4d5e6f7a8b',
        ALLOWED_ORIGINS: '*',
        MAX_TOTAL_CLIENTS: 10000,
        MAX_CLIENTS_PER_IP: 50,
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
