import { RichTextRow } from "../RichTextRow";
import { ColumnHelper, Faction, FormQuestion, ReviewColumn } from "../../Common/Enums";
import { SemanticVersion } from "./Project";

class Review extends RichTextRow {
    number: number;
    version: SemanticVersion;
    faction: Faction;
    date: Date;
    reviewer: string;
    deck: string;
    count: number;
    rating: number;
    release?: boolean;
    reason?: string;
    additional?: string;

    static fromResponse(response: GoogleAppsScript.Forms.FormResponse) {
        //TODO: Implement

        // return new Review()
    }

    static fromRichTextValues(richTextValues: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[]): Review {
        const review = new Review();
        review.rowValues = richTextValues.map(rtv => rtv ? rtv : SpreadsheetApp.newRichTextValue().build());

        review.number = review.getNumber(ReviewColumn.Number, true);
        review.version = SemanticVersion.fromString(review.getText(ReviewColumn.Version, true));
        review.faction = review.getEnumFromValue<Faction>(Faction, ReviewColumn.Faction, true);
        review.date = new Date(review.getText(ReviewColumn.Date, true));
        review.reviewer = review.getText(ReviewColumn.Reviewer, true);
        review.deck = review.getValue(ReviewColumn.Deck).getLinkUrl() || "";
        review.count = review.getNumber(ReviewColumn.Count, true);
        review.rating = review.getNumber(ReviewColumn.Rating, true);
        const release = review.getText(ReviewColumn.Release, true);
        review.release = release !== "Unsure" ? (release === "Yes") : undefined;
        review.reason = review.hasText(ReviewColumn.Reason) ? review.getText(ReviewColumn.Reason) : undefined;
        review.additional = review.hasText(ReviewColumn.Additional) ? review.getText(ReviewColumn.Additional) : undefined;

        return review.track();
    }

    toRichTextValues(): GoogleAppsScript.Spreadsheet.RichTextValue[] {
        if(!this.isDirty) {
            return this.rowValues;
        }
        this.rowValues = Array.from({ length: ColumnHelper.getCount(ReviewColumn) }, () => SpreadsheetApp.newRichTextValue().build());
        this.setText(ReviewColumn.Number, this.number);
        this.setText(ReviewColumn.Version, this.version.toString());
        this.setText(ReviewColumn.Faction, this.faction);
        this.setText(ReviewColumn.Date, this.date.toUTCString());
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

        return this.rowValues;
    }
}
export { Review }