export class Log {
    static information(message: string) {
        console.log("[Info]: " + message);
    }

    static error(message: string) {
        console.log("[Error]: " + message);
    }
}