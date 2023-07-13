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

    constructor(row: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[]) {
        super(row);
        
        this.number = this.getNumber(ReviewColumn.Number, true);
        this.version = SemanticVersion.fromString(this.getText(ReviewColumn.Version, true));
        this.faction = this.getEnumFromValue<Faction>(Faction, ReviewColumn.Faction, true);
        this.date = new Date(this.getText(ReviewColumn.Date, true));
        this.reviewer = this.getText(ReviewColumn.Reviewer, true);
        this.deck = this.getValue(ReviewColumn.Deck).getLinkUrl() || "";
        this.count = this.getNumber(ReviewColumn.Count, true);
        this.rating = this.getNumber(ReviewColumn.Rating, true);
        const release = this.getText(ReviewColumn.Release, true);
        this.release = release !== "Unsure" ? (release === "Yes") : undefined;
        this.reason = this.hasText(ReviewColumn.Reason) ? this.getText(ReviewColumn.Reason) : undefined;
        this.additional = this.hasText(ReviewColumn.Additional) ? this.getText(ReviewColumn.Additional) : undefined;
    }

    static fromResponse(response: GoogleAppsScript.Forms.FormResponse) {
        //TODO: Implement

        // return new Review()
    }

    toRichTextValues(): GoogleAppsScript.Spreadsheet.RichTextValue[] {
        this.row = Array.from({ length: ColumnHelper.getCount(ReviewColumn) }, () => SpreadsheetApp.newRichTextValue().build());
        this.setText(ReviewColumn.Number, this.number);
        this.setText(ReviewColumn.Version, this.version.toString());
        this.setText(ReviewColumn.Faction, this.faction);
        this.setText(ReviewColumn.Date, this.date.toUTCString());
        this.setText(ReviewColumn.Reviewer, this.reviewer);
        this.row[ReviewColumn.Deck] = SpreadsheetApp.newRichTextValue().setText("ThronesDB").setLinkUrl(this.deck).build();
        this.setText(ReviewColumn.Count, this.count);
        this.setText(ReviewColumn.Rating, this.rating);
        this.setText(ReviewColumn.Release, this.release !== undefined ? (this.release ? "Yes" : "No") : "Unsure");
        if(this.reason) {
            this.setText(ReviewColumn.Reason, this.reason);
        }
        if(this.additional) {
            this.setText(ReviewColumn.Additional, this.additional);
        }

        return this.row;
    }
}
export { Review }