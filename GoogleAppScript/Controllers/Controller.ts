import { Log } from "../CloudLogger.js";
import { CardsController } from "./CardsController.js";
import { ProjectController } from "./ProjectController.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Controller {
    const getActions = {
        cards: CardsController.doGet,
        project: ProjectController.doGet
    };
    export function get(e: GoogleAppsScript.Events.DoGet) {
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
            Log.error(`Failed to process request:\n${err}`);
            return sendResponse({
                error: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
                request: e
            });
        }
    }

    const postActions = {
        cards: CardsController.doPost,
        project: ProjectController.doPost
    };
    export function post(e: GoogleAppsScript.Events.DoPost) {
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
            Log.error(`Failed to process request:\n${err}`);
            return sendResponse({
                error: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
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
}

function doGet(e: GoogleAppsScript.Events.DoGet) {
    return Controller.get(e);
}
function doPost(e: GoogleAppsScript.Events.DoPost) {
    return Controller.post(e);
}

export {
    Controller,
    doGet,
    doPost
};