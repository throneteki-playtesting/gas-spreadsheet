class Settings {
    static getScriptProperty(key: string, question?: string): string {
        let value = PropertiesService.getScriptProperties().getProperty(key);
        if (!value) {
            const response = SpreadsheetApp.getUi().prompt(question || "Please provide value for " + key + ":");
            value = response.getResponseText();
            PropertiesService.getScriptProperties().setProperty(key, value);
        }
        return value;
    }

    static getDocumentProperty(key: string, question?: string): string {
        let value = PropertiesService.getDocumentProperties().getProperty(key);
        if (!value) {
            const response = SpreadsheetApp.getUi().prompt(question || "Please provide value for " + key + ":");
            value = response.getResponseText();
            PropertiesService.getDocumentProperties().setProperty(key, value);
        }
        return value;
    }

    static getUserProperty(key: string, question?: string): string {
        let value = PropertiesService.getUserProperties().getProperty(key);
        if (!value) {
            const response = SpreadsheetApp.getUi().prompt(question || "Please provide value for " + key + ":");
            value = response.getResponseText();
            PropertiesService.getUserProperties().setProperty(key, value);
        }
        return value;
    }

    static clearScriptProperties() {
        PropertiesService.getScriptProperties().deleteAllProperties();
    }

    static clearDocumentProperties() {
        PropertiesService.getDocumentProperties().deleteAllProperties();
    }

    static clearUserProperties() {
        PropertiesService.getUserProperties().deleteAllProperties();
    }
}

export { Settings }