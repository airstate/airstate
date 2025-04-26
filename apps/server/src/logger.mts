import winston from 'winston';
import { env } from './env.mjs';

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'airstate-core-api' },
    transports: [new winston.transports.Console()],
});
