import { Controller } from "./Controller";
import { DataSheet } from "../Spreadsheets/DataSheets";
import { ReviewSerializer } from "../Spreadsheets/Serializers/ReviewSerializer";
import { Reviews } from "@/Common/Models/Reviews";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ReviewsController {
    export interface GASReadReviewsResponse { reviews: Reviews.Model[] }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        // TODO: Allow lists of any Reviews.Model value, then & them all in the get query to GAS
        const { ids } = e.parameter;
        const models = ids?.split(",").map((id: Reviews.Id) => Reviews.expandId(id) as Reviews.Model);
        const readFunc = models ? (values: string[], index: number) => models.some((model) => ReviewSerializer.instance.filter(values, index, model)) : undefined;

        const reviews = DataSheet.sheets.review.read(readFunc);

        return Controller.sendResponse({
            request: e,
            data: { reviews } as GASReadReviewsResponse
        });
    }

    export interface GASCreateReviewsResponse { created: Reviews.Model[] }
    export interface GASUpdateReviewsResponse { updated: Reviews.Model[] }
    export interface GASDestroyReviewsResponse { destroyed: Reviews.Model[] }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const reviews = JSON.parse(e.postData.contents) as Reviews.Model[];

        const review = DataSheet.sheets.review;
        const action = path.shift();
        switch (action) {
            case "create":
                // Review Create will add a review to archive
                const c = { request: e, data: { created: [] } } as Controller.GASResponse<GASCreateReviewsResponse>;
                c.data.created.push(...review.create(reviews));
                return Controller.sendResponse(c);
            case "update":
                // Review Update will update the first review it finds in archive
                const u = { request: e, data: { updated: [] } } as Controller.GASResponse<GASUpdateReviewsResponse>;
                const upsert = e.parameter.upsert === "true";
                u.data.updated.push(...review.update(reviews, true, upsert));
                return Controller.sendResponse(u);
            case "destroy":
                // Review Destroy will delete a review from archive
                const d = { request: e, data: { destroyed: [] } } as Controller.GASResponse<GASDestroyReviewsResponse>;
                d.data.destroyed.push(...review.delete(reviews));
                return Controller.sendResponse(d);
            default:
                throw Error(`"${action}" is not a valid review post action`);
        }
    }
}

export {
    ReviewsController
};