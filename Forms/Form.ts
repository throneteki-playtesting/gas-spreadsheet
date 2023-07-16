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
        const latestNames = Data.instance.latestCards.map(card => card.toString());

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
  const formReviews = responses.map(response => Review.fromResponse(response));

  const newReviews = formReviews.filter(review => !data.archivedReviews.some(formReview => formReview.id === review.id))
  data.archivedReviews = formReviews;

  data.commit();

  for(const review of newReviews) {
    DiscordHandler.sendReview(review);
  }
}

function manualSubmit() {
    const form = Forms.get();
    onFormSubmitted({ response: form.getResponses()[0] });
}
export { Forms }