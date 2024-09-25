import { Reviews } from "@/Common/Models/Reviews";
import { Forms } from "../Forms/Form";
import { Controller } from "./Controller";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace FormController {
    export interface GASReadFormReviews { reviews: Reviews.Model[] }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const { reviewer, name, version } = e.parameter;
        const reviews = Forms.toReviews(...Forms.get().getResponses()).filter((review) => (!reviewer || reviewer === review.reviewer) && (!name || name === review.name) && (!version || version === review.version));

        return Controller.sendResponse({
            request: e,
            data: { reviews } as GASReadFormReviews
        });
    }

    export interface GASSetFormValuesResponse { success: boolean }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const { reviewers, cards } = JSON.parse(e.postData.contents) as { reviewers: string[], cards: string[] };
        const success = Forms.syncFormValues(cards, reviewers);
        return Controller.sendResponse({
            request: e,
            data: { success } as GASSetFormValuesResponse
        });
    }
}

export {
    FormController
};