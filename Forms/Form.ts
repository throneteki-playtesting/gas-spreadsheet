import { FormQuestion } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Settings } from "../DataLayer/Settings";

class Forms {
    static getFormResponse(responseId: string) {
        const form = FormApp.openById(Settings.getDocumentProperty("googleForms_formId"));
        return form.getResponse(responseId);
    }

    static updateFormCards() {
        const form = FormApp.openById(Settings.getDocumentProperty("googleForms_formId"));
        const latestNames = Data.instance.latestCards.map(card => card.toString());

        const cardListItem = form.getItems()[FormQuestion.ReviewingCard].asListItem();
        cardListItem.setChoiceValues(latestNames);
    }
}

export { Forms }