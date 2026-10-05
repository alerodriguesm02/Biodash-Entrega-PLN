// lib/logger-winston.js
const write = (method, message, meta) => {
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console[method](`[${new Date().toISOString()}] ${message}${suffix}`);
};

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = logger;
