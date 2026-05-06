// PM2 Ecosystem — PartnerHub API
module.exports = {
  apps: [
    {
      name: 'partnerhub-api',
      script: 'index.js',
      cwd: '/var/www/partnerhub/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/partnerhub-api-error.log',
      out_file: '/var/log/pm2/partnerhub-api-out.log',
      time: true,
    },
  ],
};
