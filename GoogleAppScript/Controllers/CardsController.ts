import { GASResponse, sendResponse } from "./Controller";
import CardSerializer from "../Spreadsheets/CardSerializer";
import { CardSheet, DataSheet, dataSheets } from "../Spreadsheets/DataSheets";
import { CardModel } from "@/Common/Models/Card";

export interface GASReadCardsResponse { cards: CardModel[] }
export function doGetCards(path: string[], e: GoogleAppsScript.Events.DoGet) {
    const { filter, ids } = e.parameter;

    const types = filter?.split(",").map((f) => f.trim() as CardSheet);
    const models = ids?.split(",").map((id) => {
        const [number, version] = id.split("@");
        return { number: parseInt(number), version } as CardModel;
    });

    const cards: CardModel[] = [];
    const readFunc = models ? (values: string[], index: number) => models.some((model) => CardSerializer.filter(values, index, model)) : undefined;
    doForEachSheet(types, (sheet) => {
        const reads = sheet.read(readFunc);
        for (const read of reads) {
            cards.push(read);
        };
    });

    return sendResponse({
        request: e,
        data: { cards } as GASReadCardsResponse
    });
}

export interface GASCreateCardsResponse { created: number }
export interface GASUpdateCardsResponse { updated: number }
export interface GASDestroyCardsResponse { destroyed: number }
export function doPostCards(path: string[], e: GoogleAppsScript.Events.DoPost) {
    const { filter } = e.parameter;

    const types = filter?.split(",").map((f) => f.trim() as CardSheet);
    const cards = JSON.parse(e.postData.contents) as CardModel[];

    const action = path.shift();

    switch (action) {
        case "create":
            const c = { request: e, data: { created: 0 } } as GASResponse<GASCreateCardsResponse>;
            doForEachSheet(types, (sheet) => {
                c.data.created += sheet.create(cards);
            });
            return sendResponse(c);
        case "update":
            const u = { request: e, data: { updated: 0 } } as GASResponse<GASUpdateCardsResponse>;
            doForEachSheet(types, (sheet) => {
                u.data.updated += sheet.update(cards);
            });
            return sendResponse(u);
        case "destroy":
            const d = { request: e, data: { destroyed: 0 } } as GASResponse<GASDestroyCardsResponse>;
            doForEachSheet(types, (sheet) => {
                d.data.destroyed += sheet.delete(cards);
            });
            return sendResponse(d);
        default:
            throw Error(`"${action}" is not a valid card post action`);
    }
}

function doForEachSheet(types: CardSheet[] = ["archive", "latest"], func: (sheet: DataSheet<CardModel>) => void) {
    // Loop through archive first, so that latest card overrides any identical cards from archive.
    // This is relevant for the latest non-initial version of each card, where it is saved in both latest & archive
    for (const type of ["archive", "latest"] as CardSheet[]) {
        if (types.includes(type)) {
            func(dataSheets.get(type));
        }
    }
}