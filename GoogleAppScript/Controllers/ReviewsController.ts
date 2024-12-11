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
        const response = { request: e, data: { reviews } } as Controller.GASResponse<GASReadReviewsResponse>;
        return Controller.sendResponse(response);
    }

    export interface GASCreateReviewsResponse { created: Reviews.Model[] }
    export interface GASUpdateReviewsResponse { updated: Reviews.Model[] }
    export interface GASDestroyReviewsResponse { destroyed: Reviews.Model[] }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const { upsert, ids } = e.parameter;
        const reviews: Reviews.Model[] = e.postData ? JSON.parse(e.postData.contents) : undefined;

        const action = path.shift();
        switch (action) {
            case "create": {
                const created = DataSheet.sheets.review.create(reviews);
                const response = { request: e, data: { created } } as Controller.GASResponse<GASCreateReviewsResponse>;
                return Controller.sendResponse(response);
            }
            case "update": {
                const isUpsert = upsert === "true";
                const updated = DataSheet.sheets.review.update(reviews, false, isUpsert);
                const reponse = { request: e, data: { updated } } as Controller.GASResponse<GASUpdateReviewsResponse>;
                return Controller.sendResponse(reponse);
            }
            case "destroy": {
                const models = ids?.split(",").map((id: Reviews.Id) => Reviews.expandId(id) as Reviews.Model);
                const deleteFunc = models ? (values: string[], index: number) => models.some((model) => ReviewSerializer.instance.filter(values, index, model)) : undefined;
                const destroyed = DataSheet.sheets.review.delete(deleteFunc);
                const response = { request: e, data: { destroyed } } as Controller.GASResponse<GASDestroyReviewsResponse>;
                return Controller.sendResponse(response);
            }
            default:
                throw Error(`"${action}" is not a valid review post action`);
        }
    }
}

export {
    ReviewsController
};