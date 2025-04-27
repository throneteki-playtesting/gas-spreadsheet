import { Reviews } from "@/Common/Models/Reviews";
import { Forms } from "../Forms/Form";
import { Controller } from "./Controller";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace FormController {
    export interface GASReadFormReviews { reviews: Reviews.Model[] }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const { reviewer, number, version } = e.parameter;
        const reviews = Forms.toReviews(...Forms.get().getResponses()).filter((review) => (!reviewer || reviewer === review.reviewer) && (!number || parseInt(number) === review.number) && (!version || version === review.version));
        const response = { request: e, data: { reviews } } as Controller.GASResponse<GASReadFormReviews>;
        return Controller.sendResponse(response);
    }

    export interface GASSetFormValuesResponse { cards: number, reviewers: number }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const { reviewers, cards } = JSON.parse(e.postData.contents) as { reviewers: string[], cards: string[] };
        const result = Forms.syncFormValues(cards, reviewers);
        const response = { request: e, data: { cards: result.cards.length, reviewers: result.reviewers.length } } as Controller.GASResponse<GASSetFormValuesResponse>;
        return Controller.sendResponse(response);
    }
}

export {
    FormController
};