import { RichTextRow } from "../RichTextRow";
import { ColumnHelper, Faction, FormQuestion, ReviewColumn } from "../../Common/Enums";
import { SemanticVersion } from "./Project";
import { Card } from "./Card";
import { Data } from "../Data";

class Review extends RichTextRow {
    id: string;
    card: Card;
    date: Date;
    reviewer: string;
    deck: string;
    count: number;
    rating: number;
    release?: boolean;
    reason?: string;
    additional?: string;

    spreadsheetUrl?: string;

    static fromResponse(response: GoogleAppsScript.Forms.FormResponse): Review {
        const review = new Review();
        review.id = response.getId();
        const cardName = response.getItemResponses()[FormQuestion.ReviewingCard].getResponse() as string;
        const data = Data.instance;
        const card = data.playtestingCards.find(card => card.toString() === cardName) ?? data.latestCards.find(card => card.toString() === cardName);
        
        if(!card) {
            throw new Error("Failed to build review as card/version cannot be found: " + cardName + ".");
        }

        review.card = card;
        review.date = new Date(response.getTimestamp().toUTCString());
        review.reviewer = response.getItemResponses()[FormQuestion.DiscordName].getResponse() as string;
        review.deck = response.getItemResponses()[FormQuestion.DeckLink].getResponse() as string;
        review.count = parseInt(response.getItemResponses()[FormQuestion.GamesPlayed].getResponse() as string);
        review.rating = parseInt(response.getItemResponses()[FormQuestion.Rating].getResponse() as string);
        const release = response.getItemResponses()[FormQuestion.ReleaseReady].getResponse() as string;
        review.release = release === "Yes" ? true : (release === "No" ? false : undefined);
        const reason = response.getItemResponses()[FormQuestion.Reason].getResponse() as string;
        review.reason = reason ? reason : undefined;
        const additional = response.getItemResponses()[FormQuestion.Additional].getResponse() as string;
        review.additional = additional ? additional : undefined;

        review.rowValues = review.toRichTextValues();

        return review;
    }

    static fromRichTextValues(richTextValues: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[]): Review {
        const review = new Review();
        review.rowValues = richTextValues.map(rtv => rtv ? rtv : SpreadsheetApp.newRichTextValue().build());
        review.id = review.getText(ReviewColumn.ResponseId, true);
        const number = review.getNumber(ReviewColumn.Number, true);
        const version = SemanticVersion.fromString(review.getText(ReviewColumn.Version, true));
        
        const data = Data.instance;
        const card = data.findCard(number, version);
        if(!card) {
            throw new Error("Attempted to build review from non-existent card (number: " + number + ", version: " + version.toString() + ").");
        }
        review.card = card;
        review.date = new Date(review.getText(ReviewColumn.Date, true));
        review.reviewer = review.getText(ReviewColumn.Reviewer, true);
        review.deck = review.getValue(ReviewColumn.Deck).getLinkUrl() || "";
        review.count = review.getNumber(ReviewColumn.Count, true);
        review.rating = review.getNumber(ReviewColumn.Rating, true);
        const release = review.getText(ReviewColumn.Release, true);
        review.release = release !== "Unsure" ? (release === "Yes") : undefined;
        review.reason = review.hasText(ReviewColumn.Reason) ? review.getText(ReviewColumn.Reason) : undefined;
        review.additional = review.hasText(ReviewColumn.Additional) ? review.getText(ReviewColumn.Additional) : undefined;

        return review;
    }

    toRichTextValues(): GoogleAppsScript.Spreadsheet.RichTextValue[] {
        this.rowValues = Array.from({ length: ColumnHelper.getCount(ReviewColumn) }, () => SpreadsheetApp.newRichTextValue().setText("").build());
        this.setText(ReviewColumn.Number, this.card.development.number);
        this.setText(ReviewColumn.Version, this.card.development.version.toString());
        this.setText(ReviewColumn.Faction, this.card.faction);
        this.setText(ReviewColumn.Name, this.card.name);
        this.setText(ReviewColumn.Date, this.date.toDateString());
        this.setText(ReviewColumn.Reviewer, this.reviewer);
        this.rowValues[ReviewColumn.Deck] = SpreadsheetApp.newRichTextValue().setText("ThronesDB").setLinkUrl(this.deck).build();
        this.setText(ReviewColumn.Count, this.count);
        this.setText(ReviewColumn.Rating, this.rating);
        this.setText(ReviewColumn.Release, this.release !== undefined ? (this.release ? "Yes" : "No") : "Unsure");
        if(this.reason) {
            this.setText(ReviewColumn.Reason, this.reason);
        }
        if(this.additional) {
            this.setText(ReviewColumn.Additional, this.additional);
        }
        this.setText(ReviewColumn.ResponseId, this.id);

        return this.rowValues;
    }
}
export { Review }