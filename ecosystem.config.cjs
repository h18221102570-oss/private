module.exports = {
  apps: [{
    name: 'engineering-app',
    script: 'server.js',
    env: {
      PORT: 3001,
    },
    instances: 1,
    exec_mode: 'fork',
    restart_delay: 3000,
    max_memory_restart: '300M',
  }],
};
