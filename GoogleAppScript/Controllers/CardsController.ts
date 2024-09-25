import { CardSheet, DataSheet } from "../Spreadsheets/DataSheets";
import { Controller } from "./Controller";
import { CardSerializer } from "../Spreadsheets/Serializers/CardSerializer";
import { Cards } from "@/Common/Models/Cards";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace CardsController {
    export interface GASReadCardsResponse { cards: Cards.Model[] }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        // TODO: Allow lists of any Cards.Model value, then & them all in the get query to GAS
        const { filter, ids } = e.parameter;

        const types = filter?.split(",").map((f) => f.trim() as CardSheet);
        const models = ids?.split(",").map((id) => {
            const [number, version] = id.split("@");
            return { number: parseInt(number), version } as Cards.Model;
        });

        const cards: Cards.Model[] = [];
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

    export interface GASCreateCardsResponse { created: Cards.Model[] }
    export interface GASUpdateCardsResponse { updated: Cards.Model[] }
    export interface GASDestroyCardsResponse { destroyed: Cards.Model[] }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const cards = JSON.parse(e.postData.contents) as Cards.Model[];

        const action = path.shift();
        const latest = DataSheet.sheets.latest;
        const archive = DataSheet.sheets.archive;
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
                const remaining = cards.filter((card) => u.data.updated.some((updated) => card._id !== updated._id));
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

    function doForEachSheet(types: CardSheet[] = ["archive", "latest"], func: (sheet: DataSheet<Cards.Model>) => void) {
        // Loop through archive first, so that latest card overrides any identical cards from archive.
        // This is relevant for the latest non-initial version of each card, where it is saved in both latest & archive
        for (const type of ["archive", "latest"] as CardSheet[]) {
            if (types.includes(type)) {
                func(DataSheet.sheets[type]);
            }
        }
    }
}

export {
    CardsController
};