import { CardSheet, DataSheet } from "../Spreadsheets/DataSheets";
import { Controller } from "./Controller";
import { CardSerializer } from "../Spreadsheets/Serializers/CardSerializer";
import { Cards } from "@/Common/Models/Cards";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace CardsController {
    export interface GASReadCardsResponse { cards: Cards.Model[] }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        // TODO: Allow lists of any Cards.Model value, then & them all in the get query to GAS
        const { latest, ids } = e.parameter;

        // Reads content from archive, or latest if specified
        const models = ids?.split(",").map((id: Cards.Id) => Cards.expandId(id) as Cards.Model);
        const readFunc = models ? (values: string[], index: number) => models.some((model) => CardSerializer.instance.filter(values, index, model)) : undefined;
        const sheet = latest ? "latest" : "archive";
        const cards = DataSheet.sheets[sheet].read(readFunc);
        const response = { request: e, data: { cards } } as Controller.GASResponse<GASReadCardsResponse>;
        return Controller.sendResponse(response);
    }

    export interface GASCreateCardsResponse { created: Cards.Model[] }
    export interface GASUpdateCardsResponse { updated: Cards.Model[] }
    export interface GASDestroyCardsResponse { destroyed: Cards.Model[] }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const { latest, upsert, ids } = e.parameter;
        const cards: Cards.Model[] = e.postData ? JSON.parse(e.postData.contents) : undefined;

        const action = path.shift();
        switch (action) {
            case "create": {
                // Creates cards in archive
                const created = DataSheet.sheets.archive.create(cards);
                const response = { request: e, data: { created } } as Controller.GASResponse<GASCreateCardsResponse>;
                return Controller.sendResponse(response);
            }
            case "update": {
                // Updates cards from archive, or latest if specified
                const sheet = latest === "true" ? "latest" : "archive" as CardSheet;
                const isUpsert = upsert === "true";
                const updated = DataSheet.sheets[sheet].update(cards, false, isUpsert);
                const response = { request: e, data: { updated } } as Controller.GASResponse<GASUpdateCardsResponse>;
                return Controller.sendResponse(response);
            }
            case "destroy": {
                // Destroys cards from archive
                const models = ids?.split(",").map((id: Cards.Id) => Cards.expandId(id) as Cards.Model);
                const deleteFunc = models ? (values: string[], index: number) => models.some((model) => CardSerializer.instance.filter(values, index, model)) : undefined;
                const destroyed = DataSheet.sheets.archive.delete(deleteFunc);
                const response = { request: e, data: { destroyed } } as Controller.GASResponse<GASDestroyCardsResponse>;
                return Controller.sendResponse(response);
            }
            default:
                throw Error(`"${action}" is not a valid card post action`);
        }
    }
}

export {
    CardsController
};