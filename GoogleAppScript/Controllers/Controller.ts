import { Log } from "../CloudLogger.js";
import { doGetCards, doPostCards } from "./CardsController.js";

const getActions = {
    cards: doGetCards
};

export function doGet(e: GoogleAppsScript.Events.DoGet) {
    try {
        const pathInfo = e.pathInfo || "";
        const path = pathInfo.split("/");

        if (path.length < 1) {
            throw Error("No path options given");
        }

        const pathAction = path.shift();
        const action = getActions[pathAction];

        if (!action) {
            throw Error(`"${pathAction}" is not a valid path option`);
        }

        return action(path, e);
    } catch (err) {
        const json = JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        Log.error(`Failed to process request:\n${json}`);
        return sendResponse({
            error: json,
            request: e
        });
    }
}

const postActions = {
    cards: doPostCards
};

export function doPost(e: GoogleAppsScript.Events.DoPost) {
    try {
        const pathInfo = e.pathInfo || "";
        const path = pathInfo.split("/");

        if (path.length < 1) {
            throw Error("No path options given");
        }
        const pathAction = path.shift();
        const action = postActions[pathAction];

        if (!action) {
            throw Error(`"${pathAction}" is not a valid path option`);
        }

        return action(path, e);
    } catch (err) {
        const json = JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        Log.error(`Failed to process request:\n${json}`);
        return sendResponse({
            error: json,
            request: e
        });
    }
}

export interface GASResponse<T> {
    error?: object,
    request: GoogleAppsScript.Events.DoGet,
    data?: T
}

export function sendResponse<T>(resp: GASResponse<T>) {
    return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
}