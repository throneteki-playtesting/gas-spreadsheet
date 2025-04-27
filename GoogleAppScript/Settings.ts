import { Projects } from "@/Common/Models/Projects.js";
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

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Project {
    export function get() {
        const releases = Settings.getProperty(GooglePropertiesType.Script, "releases");
        const emoji = Settings.getProperty(GooglePropertiesType.Script, "emoji");
        const project = {
            active: Settings.getProperty(GooglePropertiesType.Script, "active") === "true",
            script: Settings.getProperty(GooglePropertiesType.Script, "script"),
            name: Settings.getProperty(GooglePropertiesType.Script, "name"),
            short: Settings.getProperty(GooglePropertiesType.Script, "short"),
            code: parseInt(Settings.getProperty(GooglePropertiesType.Script, "code")),
            type: Settings.getProperty(GooglePropertiesType.Script, "type"),
            perFaction: parseInt(Settings.getProperty(GooglePropertiesType.Script, "perFaction")),
            neutral: parseInt(Settings.getProperty(GooglePropertiesType.Script, "neutral")),
            releases: releases ? parseInt(releases) : 0,
            milestone: parseInt(Settings.getProperty(GooglePropertiesType.Script, "milestone")),
            formUrl: Settings.getProperty(GooglePropertiesType.Script, "formUrl"),
            emoji: emoji || undefined
        } as Projects.Model;
        return project;
    }

    export function set(project: Projects.Model) {
        Settings.setProperty(GooglePropertiesType.Script, "active", `${project.active}`);
        Settings.setProperty(GooglePropertiesType.Script, "script", project.script);
        Settings.setProperty(GooglePropertiesType.Script, "name", project.name);
        Settings.setProperty(GooglePropertiesType.Script, "short", project.short);
        Settings.setProperty(GooglePropertiesType.Script, "code", `${project.code}`);
        Settings.setProperty(GooglePropertiesType.Script, "type", project.type);
        Settings.setProperty(GooglePropertiesType.Script, "perFaction", `${project.perFaction}`);
        Settings.setProperty(GooglePropertiesType.Script, "neutral", `${project.neutral}`);
        Settings.setProperty(GooglePropertiesType.Script, "releases", `${project.releases}`);
        Settings.setProperty(GooglePropertiesType.Script, "milestone", `${project.milestone}`);
        Settings.setProperty(GooglePropertiesType.Script, "formUrl", `${project.formUrl}`);
        if (project.emoji) {
            Settings.setProperty(GooglePropertiesType.Script, "emoji", `${project.emoji}`);
        }
    }
}

export {
    GooglePropertiesType,
    Settings,
    Project
};