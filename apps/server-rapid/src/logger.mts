import winston, { format } from 'winston';
import { env } from './env.mjs';

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    format:
        env.NODE_ENV === 'development'
            ? format.combine(
                  // Pretty for development
                  format.colorize(),
                  format.timestamp(),
                  format.printf(({ timestamp, level, message, ...meta }) => {
                      const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                      return `[${timestamp}] ${level}: ${message} ${metaString}`;
                  }),
              )
            : format.json(),
    defaultMeta: { service: 'airstate-server' },
    transports: [new winston.transports.Console()],
});
