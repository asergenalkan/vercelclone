module.exports = {
    apps: [
      {
        name: 'vercel-app',
        script: 'npm',
        args: 'run start',
        cwd: '/var/www/vercelclone',
        env: {
          NODE_ENV: 'production',
          PORT: 3001
        },
        watch: false,
        instances: "1",
        exec_mode: 'fork',
        max_memory_restart: '300M'
      },
      {
        name: 'vercel-socket',
        script: 'npm',
        args: 'run socket',
        cwd: '/var/www/vercelclone',
        env: {
          NODE_ENV: 'production',
          SOCKET_URL: 'https://pixepix.com'
        },
        watch: false,
        instances: 1,
        exec_mode: 'fork'
      },
      {
        name: 'vercel-worker',
        script: 'npm',
        args: 'run worker',
        cwd: '/var/www/vercelclone',
        env: {
          NODE_ENV: 'production',
          SOCKET_URL: 'https://pixepix.com'
        },
        watch: false,
        instances: 1,
        exec_mode: 'fork'
      },
      {
        name: 'vercel-proxy',
        script: 'npm',
        args: 'run proxy',
        cwd: '/var/www/vercelclone',
        env: {
          NODE_ENV: 'production',
          PORT: 3005
        },
        watch: false,
        instances: 1,
        exec_mode: 'fork'
      }
    ]
  };
  