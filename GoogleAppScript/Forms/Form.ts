import { GooglePropertiesType, Settings } from "../Settings";
import { API } from "../API";
import { Log } from "../CloudLogger";
import { Reviews } from "@/Common/Models/Reviews";
import { SemanticVersion } from "@/Common/Utils";

class Forms {
    static get() {
        return FormApp.openById(Settings.getProperty(GooglePropertiesType.Script, "formId"));
    }

    public static toReviews(...formResponses: GoogleAppsScript.Forms.FormResponse[]) {
        const projectId = parseInt(Settings.getProperty(GooglePropertiesType.Script, "code"));

        const reviews: Reviews.Model[] = [];
        for (const formResponse of formResponses) {
            const items = formResponse.getItemResponses();

            // Collect the number, name & version from ReviewingCard in regex groups
            const cardRegex = /(\d+) - (.+) \((.+)\)/gm;
            const groups = cardRegex.exec(items[Question.ReviewingCard].getResponse() as string);
            const number = parseInt(groups[0].trim());
            const name = groups[1].trim();
            const version = groups[2].trim() as SemanticVersion;

            const date = new Date(formResponse.getTimestamp().toUTCString());
            const statements = items[Question.Statements].getResponse() as string[];
            const review = {
                reviewer: items[Question.DiscordName].getResponse() as string,
                projectId,
                number,
                version,
                name,
                decks: (items[Question.DeckLinks].getResponse() as string).split("\n").map((deck) => deck.trim()),
                played: parseInt(items[Question.Played].getResponse() as string) as Reviews.PlayedRange,
                statements: {
                    boring: statements[Statements.Boring],
                    competitive: statements[Statements.Competitive],
                    creative: statements[Statements.Creative],
                    balanced: statements[Statements.Balanced],
                    releasable: statements[Statements.Releasable]
                },
                additional: items[Question.Additional].getResponse() as string || undefined,
                epoch: date.getTime()
            } as Reviews.Model;

            reviews.push(review);
        }
        return reviews;
    }

    public static submit(formResponse: GoogleAppsScript.Forms.FormResponse) {
        const reviews = Forms.toReviews(formResponse);
        API.post("reviews", reviews);
        Log.information(`Pushed review ${formResponse.getId()} to API`);
    }

    public static syncFormValues(cards: string[], reviewers: string[]) {
        const reviewerListItem = this.get().getItems()[Question.DiscordName].asListItem();
        reviewerListItem.setChoiceValues(reviewers);
        const cardListItem = this.get().getItems()[Question.ReviewingCard].asListItem();
        cardListItem.setChoiceValues(cards);
        return true;
    }
}

enum Question {
    DiscordName,
    ReviewingCard,
    DeckLinks,
    Played,
    Statements,
    Additional
}

enum Statements {
    Boring, // It is boring
    Competitive, // It will see competitive play
    Creative, // It inspires creative, fun or jank ideas
    Balanced, // It is balanced
    Releasable // It could be released as is
}

export {
    Forms
};
// import { FormQuestion } from "../../Common/Enums";
// import { DiscordHandler } from "../../Discord/DiscordHandler";

// class Forms {
//     static get url() {
//         return this.get().getPublishedUrl();
//     }

//     static get() {
//         return FormApp.openById(Settings.getProperty(GooglePropertiesType.Document, "googleForms_formId"));
//     }

//     static getFormResponse(responseId: string) {
//         return this.get().getResponse(responseId);
//     }

//     static updateFormCards() {
//         const latestNames = Data.instance.playtestingCards.map(card => card.toString());

//         const cardListItem = this.get().getItems()[FormQuestion.ReviewingCard].asListItem();
//         cardListItem.setChoiceValues(latestNames);
//     }
// }

// function onFormSubmitted({ response }) {
//     const review = Review.fromResponse(response);
//     const data = Data.instance;
//     data.archivedReviews.push(review);

//     data.commit();

//     DiscordHandler.sendReview(review);
// }

// function syncReviews() {
//     const form = Forms.get();
//     const responses = form.getResponses();
//     const data = Data.instance;
//     const archivedIds = data.archivedReviews.map(review => review.id);
//     let successfullySynced = responses.filter(response => !archivedIds.includes(response.getId())).map(response => Review.fromResponse(response));

//     if (successfullySynced.length === 0) {
//         Log.information("No reviews to sync");
//         return;
//     }

//     // Save new reviews to sheet
//     data.archivedReviews = data.archivedReviews.concat(successfullySynced).sort((a, b) => a.date.getTime() - b.date.getTime());
//     data.commit();

//     type NewType = Review;

//     const failedToSend: NewType[] = [];
//     for (const review of successfullySynced) {
//         try {
//             DiscordHandler.sendReview(review);
//         } catch (e) {
//             failedToSend.push(review);
//             Log.error("Failed to send " + review.toString() + " (Id: " + review.id + ") to discord: " + e);
//         }
//     }

//     if (failedToSend.length > 0) {
//         // Remove any reviews which failed to send to discord, so they can be re-processed next run
//         data.archivedReviews = data.archivedReviews.filter(review => !failedToSend.includes(review));
//         successfullySynced = successfullySynced.filter(review => !failedToSend.includes(review));
//         data.commit();
//     }
//     if (successfullySynced.length > 0) {
//         Log.information("Successfully synced " + successfullySynced.length + " reviews:\n -" + successfullySynced.map(review => review.toString()).join("\n- "));
//     } else {
//         Log.information("Failed to sync any reviews");
//     }

// }

// function createTrigger() {
//     const currentTrigger = ScriptApp.getProjectTriggers().find(a => a.getHandlerFunction() === "onFormSubmitted");
//     if (currentTrigger) {
//         ScriptApp.deleteTrigger(currentTrigger);
//     }
//     ScriptApp.newTrigger("onFormSubmitted").forForm(Forms.get()).onFormSubmit().create();
// }

// function manualSubmit() {
//     const form = Forms.get();
//     onFormSubmitted({ response: form.getResponses()[0] });
// }

// function updateFormCards() {
//     Forms.updateFormCards();
// }

// export { Forms };