import { GooglePropertiesType, Project, Settings } from "./Settings";
import { Log } from "./CloudLogger";
import { UIHelper } from "./Spreadsheets/UserInput";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace API {
    export function setAPIKey() {
        const response = UIHelper.safelyGet().prompt("Please provide API Key for web app:");
        Settings.setProperty(GooglePropertiesType.Document, "apiKey", Utilities.base64Encode(response.getResponseText()));
    }
    export function post(subUrl: string, data: unknown) {
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
                Authorization: `Basic ${apiKey}`
            },
            contentType: "application/json",
            payload: JSON.stringify(data)
        } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

        const response = UrlFetchApp.fetch(url, options);

        const json = JSON.parse(response.getContentText());

        return json;
    }

    export function postProjectDetails() {
        API.post("projects", Project.get());
        Log.information("Successfully sent project info to API");
    }
}

export {
    API
};