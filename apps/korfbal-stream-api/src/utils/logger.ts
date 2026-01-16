import winston from 'winston';
import {AxiosError} from "axios";

// Helper functie om AxiosError objecten te 'sanitizen'
const sanitizeAxiosError = (error: any) => {
  // Controleer of het daadwerkelijk een Axios error is (gebaseerd op structuur)
  if (error && error.isAxiosError) {
    const { message, config, code, response } = error;
    console.log('Sanitizing axios error')
    // Bouw een schone structuur op
    const cleanError: any = {
      message,
      code,
      url: config?.url,
      method: config?.method?.toUpperCase(),
      timeout: config?.timeout,
      // We nemen alleen de status en headers van de response (indien aanwezig)
      status: response?.status,
      statusText: response?.statusText,
      // Log de response data niet tenzij strikt noodzakelijk, omdat die groot kan zijn
      // responseData: response?.data,
    };

    // Voeg request data toe zonder de circulaire 'socket' of 'client' objecten
    if (config) {
      // We loggen alleen de relevante request config data zonder de circulaire 'headers'
      cleanError.requestConfig = {
        headers: Object.keys(config.headers || {}).filter(k => k.toLowerCase() !== 'authorization'), // Filter gevoelige headers
        // Voeg andere relevante config toe
      };
    }

    return cleanError;
  }

  // Als het geen AxiosError is, gebruik de generieke replacer of retourneer het object
  return error;
};

// Functie om veilige JSON-serialisatie mogelijk te maken
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    // Standaard afhandeling voor grote/complexe objecten die niet nodig zijn
    if (key && typeof value === 'object' && value !== null) {
      // Vooral relevant voor Axios/Node.js errors
      if (key === 'socket' || key === 'parser' || key === 'client' || key === 'req' || key === 'res') {
        return `[${key} (circular/complex object)]`;
      }

      // Circulaire referentie detectie
      if (seen.has(value)) {
        // Circulaire verwijzing gevonden, vervang door placeholder
        return '[Circular]';
      }
      // Voeg het object toe aan de 'geziene' set
      seen.add(value);
    }
    // Als het geen object is of niet circulair, retourneer de waarde
    return value;
  };
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;

    const metaKeys = Object.keys(metadata);

    if (metaKeys.length > 0) {
      let loggableMetadata = metadata;

      // Specifieke check voor de fout zelf
      if (metadata.error && (metadata.error as any).isAxiosError || metadata.name === 'AxiosError') {
        loggableMetadata = {
          ...metadata, // behoudt eventuele andere metadata
          error: sanitizeAxiosError(metadata.error), // Vang de schone Axios error af
        };
      }

      try {
        // Gebruik nog steeds de 'getCircularReplacer' (of een simpele variant)
        // als een laatste vangnet voor eventuele *andere* circulaire objecten
        msg += ` ${JSON.stringify(loggableMetadata, getCircularReplacer(), 2)}`;
      } catch (e: any) {
        msg += ` [Metadata serialization error: ${e.message}]`;
      }
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
    } else if (error instanceof AxiosError) {
      logger.error(message, { error: error.message, status: error.response?.status, data: error.response?.data, code: error.code});
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
