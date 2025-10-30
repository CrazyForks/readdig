module.exports = {
  apps: [
    {
      name: 'api',
      script: 'babel-node',
      args: './src/server.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '*.log', 'tmp', 'temp', '.git', 'test', 'docs'],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'conductor',
      script: 'babel-node',
      args: './src/workers/conductor.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '*.log', 'tmp', 'temp', '.git', 'test', 'docs'],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'feed',
      script: 'babel-node',
      args: './src/workers/feed.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '*.log', 'tmp', 'temp', '.git', 'test', 'docs'],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'og',
      script: 'babel-node',
      args: './src/workers/og.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '*.log', 'tmp', 'temp', '.git', 'test', 'docs'],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'clean',
      script: 'babel-node',
      args: './src/workers/clean.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '*.log', 'tmp', 'temp', '.git', 'test', 'docs'],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};