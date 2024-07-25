import { ExpandoObject, ExpandoValue } from "../Common/Utils.js";
import { Log } from "./CloudLogger.js";
import { Column } from "./Spreadsheets/CardInfo.js";
import { AvailableSheetTypes, SpreadsheetHandler } from "./Spreadsheets/Spreadsheet.js";

export function doGet(e: GoogleAppsScript.Events.DoGet) {
    try {
        const pathInfo = e.pathInfo || "";
        const splitPath = pathInfo.split("/");

        if (splitPath.length < 1) {
            throw Error("Must provide action in path (eg. /cards)");
        }
        const action = splitPath.shift();

        switch (action) {
            case "cards":
                const { filter, no } = e.parameter;

                const types = (filter || "").split(",").map((f) => f.trim() as AvailableSheetTypes);

                const ids = no ? no.split(",") : [];
                const r = ids.map((id) => id.trim().split("@")).map(([number, version]) => ({ number: parseInt(number), version }));
                const cardList = SpreadsheetHandler.readCards({ types, read: r });
                const data = {
                    project: SpreadsheetHandler.fetchProjectSettings(),
                    cards: cardList
                };
                return sendResponse({
                    request: e,
                    data
                });
            case "info":
                const settings = SpreadsheetHandler.fetchProjectSettings();
                return sendResponse({
                    request: e,
                    data: settings
                });
            default:
                return sendResponse({
                    request: e
                });
        }
    } catch (err) {
        Log.error(`Failed to process request: ${err}`);
        return sendResponse({
            error: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
            request: e
        });
    }
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
    try {
        const pathInfo = e.pathInfo || "";
        const splitPath = pathInfo.split("/");

        if (splitPath.length < 1) {
            throw Error("Must provide action in path (eg. /cards)");
        }
        const action = splitPath.shift();
        switch (action) {
            case "cards":
                const { filter } = e.parameter;

                const types = filter?.split(",").map((f) => f.trim() as AvailableSheetTypes);
                const json = JSON.parse(e.postData.contents) as string[][];

                const subAction = splitPath.shift();

                switch (subAction) {
                    case "delete":
                        const deleting = json.map((j) => ({ number: parseInt(j[Column.Number]), version: j[Column.Version] }));
                        const deleted = SpreadsheetHandler.deleteCards({ types, delete: deleting });
                        return sendResponse({
                            request: e,
                            data: {
                                deleted
                            }
                        });
                    case "create":
                        const creating = json;
                        const created = SpreadsheetHandler.createCards({ types, create: creating });
                        return sendResponse({
                            request: e,
                            data: {
                                created
                            }
                        });
                    case "update":
                    default:
                        const updating = json.map((j) => ({ id: { number: parseInt(j[Column.Number]), version: j[Column.Version] }, values: j }));
                        const updated = SpreadsheetHandler.updateCards({ types, update: updating });
                        return sendResponse({
                            request: e,
                            data: {
                                updated
                            }
                        });
                }
            default:
                return sendResponse({
                    request: e
                });
        }
    } catch (err) {
        Log.error(`Failed to process request: ${err}`);
        return sendResponse({
            error: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
            request: e
        });
    }
}

function sendResponse(resp: GASResponse) {
    return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
}


export interface GASResponse {
    error?: ExpandoObject | ExpandoValue,
    request: GoogleAppsScript.Events.DoGet,
    data?: ExpandoObject | ExpandoValue
}