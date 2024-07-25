import { UIHelper } from "./Spreadsheets/UserInput.js";

enum GooglePropertiesType {
    Script,
    Document,
    User
}

class Settings {
    private static getPropertiesService(type: GooglePropertiesType) {
        switch (type) {
            case GooglePropertiesType.Script:
                return PropertiesService.getScriptProperties();
            case GooglePropertiesType.Document:
                return PropertiesService.getDocumentProperties();
            case GooglePropertiesType.User:
                return PropertiesService.getUserProperties();
        }
    }

    static editProperties(type: GooglePropertiesType) {
        const service = Settings.getPropertiesService(type);
        let properties = service.getProperties();
        properties = UIHelper.openMultiWindow(properties, "Edit " + GooglePropertiesType[type] + " Properties");
        if (properties) {
            service.setProperties(properties);
        }
    }

    static getProperties(type: GooglePropertiesType) {
        const service = Settings.getPropertiesService(type);
        return service.getProperties();
    }

    static getProperty(type: GooglePropertiesType, key: string) {
        const service = Settings.getPropertiesService(type);
        let value = service.getProperty(key);
        const ui = UIHelper.safelyGet();
        if (!value && ui) {
            const response = ui.prompt("Please provide value for " + key + ":");
            value = response.getResponseText();
            service.setProperty(key, value);
        }
        return value;
    }

    static setProperty(type: GooglePropertiesType, key: string, value: string | undefined) {
        const service = Settings.getPropertiesService(type);
        if (!value) {
            service.deleteProperty(key);
        } else {
            service.setProperty(key, value);
        }
    }

    static deleteProperty(type: GooglePropertiesType, key: string) {
        const service = Settings.getPropertiesService(type);
        service.deleteProperty(key);
    }
}

export {
    GooglePropertiesType,
    Settings
};