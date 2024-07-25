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