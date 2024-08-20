import { ProjectModel } from "@/Common/Models/Project";
import { GooglePropertiesType, Settings } from "./Settings";
import { Log } from "./CloudLogger";

export function apiPost(subUrl: string, data: unknown) {
    const apiUrl = PropertiesService.getScriptProperties().getProperty("apiUrl");
    if (!apiUrl) {
        throw Error("Missing 'apiUrl' value in settings");
    }
    const apiKey = Settings.getProperty(GooglePropertiesType.Document, "apiKey");
    if (!apiKey) {
        throw Error("Missing 'apiKey'");
    }

    const url = `${apiUrl}/${subUrl}`;
    const options = {
        method: "post",
        headers: {
            Authorization: `Basic ${Utilities.base64Encode(apiKey)}`
        },
        contentType: "application/json",
        payload: JSON.stringify(data)
    } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

    const response = UrlFetchApp.fetch(url, options);

    const json = JSON.parse(response.getContentText());

    return json;
}

export function postProjectDetails() {
    const project = {
        active: Settings.getProperty(GooglePropertiesType.Script, "active") === "true",
        script: Settings.getProperty(GooglePropertiesType.Script, "neutral"),
        name: Settings.getProperty(GooglePropertiesType.Script, "name"),
        short: Settings.getProperty(GooglePropertiesType.Script, "short"),
        code: parseInt(Settings.getProperty(GooglePropertiesType.Script, "code")),
        type: Settings.getProperty(GooglePropertiesType.Script, "type"),
        perFaction: parseInt(Settings.getProperty(GooglePropertiesType.Script, "perFaction")),
        neutral: parseInt(Settings.getProperty(GooglePropertiesType.Script, "neutral"))
    } as ProjectModel;

    try {
        apiPost("projects", project);
        Log.information("Successfully sent project info to API");
    } catch (err) {
        Log.error(err);
    }
}