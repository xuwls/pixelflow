// PM2 ecosystem config for PixelFlow frontend
// Usage: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "pixelflow-frontend",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
    },
  ],
};
