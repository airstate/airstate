import winston from 'winston';

export const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'debug'],
        }),
    ],
});

export default logger;
