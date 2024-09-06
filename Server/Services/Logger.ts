import winston from "winston";

export default class LoggerService {
    public static initialise(verbose: boolean = false) {
        const baseFormat = [
            winston.format.errors({ stack: true }),
            winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss" }),
            winston.format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level}: ${stack ? stack : message}`)
        ];
        return winston.createLogger({
            level: "info",
            format: winston.format.combine(...baseFormat),
            transports: [
                new winston.transports.Console({ format: winston.format.combine(...(process.env.NODE_ENV === "production" ? [] : [winston.format.colorize({ level: true })]), ...baseFormat), level: verbose ? "verbose" : "info" }),
                ...(process.env.NODE_ENV === "production" ? [
                    new winston.transports.File({ filename: "logs\\error.log", level: "error", handleExceptions: true }),
                    new winston.transports.File({ filename: "logs\\combined.log" })
                ] : [])
            ],
            exitOnError: false
        });
    }
}