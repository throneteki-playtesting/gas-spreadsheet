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
            const number = parseInt(groups[1].trim());
            const name = groups[2].trim();
            const decks = (items[Question.DeckLinks].getResponse() as string).split("\n").map((deck) => deck.trim()).filter((deck) => deck);
            const version = groups[3].trim() as SemanticVersion;

            const date = new Date(formResponse.getTimestamp().toUTCString());
            const statements = items[Question.Statements].getResponse() as string[];
            const review = {
                reviewer: items[Question.DiscordName].getResponse() as string,
                projectId,
                number,
                version,
                name,
                decks,
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
        return { cards, reviewers };
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