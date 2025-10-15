import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }

    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: logFormat,
    }),
  ],
});

// Helper methods for better logging
export const log = {
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  error: (message: string, error?: any) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, { error });
    }
  },
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
};

// Override console methods to use winston (optional)
console.log = (...args) => logger.info(args.map(arg =>
  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
).join(' '));

console.error = (...args) => logger.error(args.map(arg =>
  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
).join(' '));
