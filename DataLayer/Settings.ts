import { UIHelper } from "../Spreadsheet/UserInput";

enum GooglePropertiesType {
    Script,
    Document,
    User
}

class Settings {
    private static getPropertiesService(type: GooglePropertiesType) {
        switch(type) {
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
        if(properties) {
            service.setProperties(properties);
        }
    }

    static getProperty(type: GooglePropertiesType, key: string) {
        const service = Settings.getPropertiesService(type);
        let value = service.getProperty(key);
        if(!value) {
            const response = SpreadsheetApp.getUi().prompt("Please provide value for " + key + ":");
            value = response.getResponseText();
            service.setProperty(key, value);
        }
        return value;
    }
}

export {
    GooglePropertiesType,
    Settings
}