import { CardSheet, DataSheet } from "../Spreadsheets/DataSheets";
import { CardModel } from "@/Common/Models/Card";
import { Controller } from "./Controller";
import { CardSerializer } from "../Spreadsheets/CardSerializer";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace CardsController {
    export interface GASReadCardsResponse { cards: CardModel[] }
    export function doGetCards(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const { filter, ids } = e.parameter;
    
        const types = filter?.split(",").map((f) => f.trim() as CardSheet);
        const models = ids?.split(",").map((id) => {
            const [number, version] = id.split("@");
            return { number: parseInt(number), version } as CardModel;
        });
    
        const cards: CardModel[] = [];
        const readFunc = models ? (values: string[], index: number) => models.some((model) => CardSerializer.instance.filter(values, index, model)) : undefined;
        doForEachSheet(types, (sheet) => {
            const reads = sheet.read(readFunc);
            for (const read of reads) {
                cards.push(read);
            };
        });
    
        return Controller.sendResponse({
            request: e,
            data: { cards } as GASReadCardsResponse
        });
    }
    
    export interface GASCreateCardsResponse { created: CardModel[] }
    export interface GASUpdateCardsResponse { updated: CardModel[] }
    export interface GASDestroyCardsResponse { destroyed: CardModel[] }
    export function doPostCards(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const { filter } = e.parameter;
    
        const types = filter?.split(",").map((f) => f.trim() as CardSheet);
        const cards = JSON.parse(e.postData.contents) as CardModel[];
    
        const action = path.shift();
        const latest = DataSheet.sheets.get("latest");
        const archive = DataSheet.sheets.get("archive");
        switch (action) {
            case "create":
                // Card Create will add a card to archive
                const c = { request: e, data: { created: [] } } as Controller.GASResponse<GASCreateCardsResponse>;
                c.data.created.push(...archive.create(cards));
                return Controller.sendResponse(c);
            case "update":
                // Card Update will update the first card it finds, "latest" first
                const u = { request: e, data: { updated: [] } } as Controller.GASResponse<GASUpdateCardsResponse>;
                u.data.updated.push(...latest.update(cards, true));
                const remaining = cards.filter((c) => u.data.updated.some((u) => c.id !== u.id));
                u.data.updated.push(...archive.update(remaining, true));
                return Controller.sendResponse(u);
            case "destroy":
                // Card Destroy will delete a card from archive
                const d = { request: e, data: { destroyed: [] } } as Controller.GASResponse<GASDestroyCardsResponse>;
                d.data.destroyed.push(...archive.delete(cards));
                return Controller.sendResponse(d);
            default:
                throw Error(`"${action}" is not a valid card post action`);
        }
    }
    
    function doForEachSheet(types: CardSheet[] = ["archive", "latest"], func: (sheet: DataSheet<CardModel>) => void) {
        // Loop through archive first, so that latest card overrides any identical cards from archive.
        // This is relevant for the latest non-initial version of each card, where it is saved in both latest & archive
        for (const type of ["archive", "latest"] as CardSheet[]) {
            if (types.includes(type)) {
                func(DataSheet.sheets.get(type));
            }
        }
    }
}

export {
    CardsController
};