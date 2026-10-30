import pino from 'pino';

export function createLogger(logLevel: string = process.env.LOG_LEVEL || 'info') {
  const isDev = process.env.NODE_ENV !== 'production';

  return pino({
    level: logLevel,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      service: 'vidashboard-backend',
    },
  });
}

export const logger = createLogger();
