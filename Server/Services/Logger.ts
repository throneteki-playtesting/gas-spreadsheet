import winston from "winston";

export default class LoggerService {
    public static initialise(verbose: boolean = false) {
        const baseFormat = [winston.format.timestamp({ format: "YYYY-MM-DD hh:mm:ss" }), winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)];
        return winston.createLogger({
            level: "info",
            format: winston.format.combine(...baseFormat),
            transports: [
                new winston.transports.Console({ format: winston.format.combine(winston.format.colorize({ level: true }), ...baseFormat), level: verbose ? "verbose" : "info" }),
                ...(process.env.NODE_ENV === "production" ? [
                    new winston.transports.File({ filename: "logs\\error.log", level: "error" }),
                    new winston.transports.File({ filename: "logs\\combined.log" })
                ] : [])
            ]
        });
    }
}