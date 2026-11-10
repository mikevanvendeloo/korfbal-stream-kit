import winston from 'winston';

// One line per entry (docker logs). Never log a header, token or raw URL with a secret in it.
const PRETTY = process.env.LOG_PRETTY ? process.env.LOG_PRETTY === 'true' : !!process.stdout.isTTY;

const logFormat = winston.format.combine(
  winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
  winston.format.errors({stack: true}),
  winston.format.splat(),
  winston.format.printf(({level, message, timestamp, stack, ...metadata}) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(metadata).length > 0) {
      try {
        msg += ` ${JSON.stringify(metadata, null, PRETTY ? 2 : undefined)}`;
      } catch {
        msg += ' [metadata not serializable]';
      }
    }
    return stack ? `${msg}\n${stack}` : msg;
  }),
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [new winston.transports.Console({format: PRETTY ? winston.format.combine(winston.format.colorize(), logFormat) : logFormat})],
});
