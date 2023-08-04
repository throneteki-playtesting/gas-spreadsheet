import { FormQuestion } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Review } from "../DataLayer/Models/Review";
import { Settings } from "../DataLayer/Settings";
import { DiscordHandler } from "../Discord/DiscordHandler";

class Forms {
    static get url() {
        return this.get().getPublishedUrl();
    }

    static get() {
        return FormApp.openById(Settings.getDocumentProperty("googleForms_formId"));
    }

    static getFormResponse(responseId: string) {
        return this.get().getResponse(responseId);
    }

    static updateFormCards() {
        const latestNames = Data.instance.playtestingCards.map(card => card.toString());

        const cardListItem = this.get().getItems()[FormQuestion.ReviewingCard].asListItem();
        cardListItem.setChoiceValues(latestNames);
    }
}

function onFormSubmitted({ response }) {
    const review = Review.fromResponse(response);
    const data = Data.instance;
    data.archivedReviews.push(review);

    data.commit();

    DiscordHandler.sendReview(review);
}

function syncReviews() {
    const form = Forms.get();
    const responses = form.getResponses();
    const data = Data.instance;
    const archivedIds = data.archivedReviews.map(review => review.id);
    const newReviews = responses.filter(response => !archivedIds.includes(response.getId())).map(response => Review.fromResponse(response));

    const successfullySent: Review[] = [];

    for (const review of newReviews) {
        try {
            DiscordHandler.sendReview(review);
            successfullySent.push(review);
        } catch (e) {
            console.log("Failed to send " + review.toString() + " (Id: " + review.id + ") to discord: " + e);
        }
    }

    if (successfullySent.length > 0) {
        data.archivedReviews = data.archivedReviews.concat(successfullySent).sort((a, b) => a.date.getTime() - b.date.getTime());

        data.commit();
        console.log("Successfully synced " + successfullySent.length + " reviews:\n" + successfullySent.map(review => review.toString()).join("\n- "));
    } else {
        console.log("No reviews have been synced");
    }

}

function createTrigger() {
    const currentTrigger = ScriptApp.getProjectTriggers().find(a => a.getHandlerFunction() === "onFormSubmitted");
    if(currentTrigger) {
        ScriptApp.deleteTrigger(currentTrigger);
    }
    ScriptApp.newTrigger("onFormSubmitted").forForm(Forms.get()).onFormSubmit().create();
}

function manualSubmit() {
    const form = Forms.get();
    onFormSubmitted({ response: form.getResponses()[0] });
}

function updateFormCards() {
    Forms.updateFormCards();
}

export { Forms }