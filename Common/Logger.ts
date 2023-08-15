import { Settings } from "../DataLayer/Settings";

class Log {
    static information(message: string) {
        console.log("[Info]: " + message);
    }

    static error(message: string) {
        console.log("[Error]: " + message);
    }

    static verbose(message: string) {
        if (Settings.getScriptProperty("mode") === "debug") {
            console.log("[Verbose]: " + message);
        }
    }
}

export { Log }