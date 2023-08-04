import { FormQuestion } from "../../Common/Enums";
import { Card } from "./Card";
import { Data, DataRow } from "../Data";
import { Columns, ReviewColumn } from "../../Common/Columns";
import { DataObject } from "./DataObject";
import { SemanticVersion } from "./Project";

class Review extends DataObject {
    constructor(data: DataRow, public id: string, public card: Card, public date: Date, public reviewer: string, public deck: string, public count: number,
        public rating: number, public release: ReleaseReady, public reason?: string, public additional?: string, public spreadheetUrl?: string) {
        super(data);
    }

    static fromData(data: DataRow) {
        const number = data.getNumber(ReviewColumn.Number);
        const version = SemanticVersion.fromString(data.getString(ReviewColumn.Version));

        const card = Data.instance.findCard(number, version);
        if (!card) {
            throw new Error("Attempted to build review from non-existent card (number: " + number + ", version: " + version.toString() + ").");
        }
        const id = data.getString(ReviewColumn.ResponseId);
        const date = new Date(data.getString(ReviewColumn.Date));
        const reviewer = data.getString(ReviewColumn.Reviewer);
        const deck = data.getRichTextValue(ReviewColumn.Deck).getLinkUrl() || "";
        const count = data.getNumber(ReviewColumn.Count);
        const rating = data.getNumber(ReviewColumn.Rating);
        const release = ReleaseReady[data.getString(ReviewColumn.Release)];
        const reason = data.hasValue(ReviewColumn.Reason) ? data.getString(ReviewColumn.Reason) : undefined;
        const additional = data.hasValue(ReviewColumn.Additional) ? data.getString(ReviewColumn.Additional) : undefined;

        return new Review(data, id, card, date, reviewer, deck, count, rating, release, reason, additional);
    }

    static fromResponse(response: GoogleAppsScript.Forms.FormResponse): Review {

        const cardString = response.getItemResponses()[FormQuestion.ReviewingCard].getResponse() as string;
        const card = Data.instance.latestCards.concat(Data.instance.archivedCards).find(card => card.toString() === cardString);
        if (!card) {
            throw new Error("Attempted to build form response review for card which does not exist (" + cardString + ")");
        }
        const id = response.getId();
        const date = new Date(response.getTimestamp().toUTCString());
        const reviewer = response.getItemResponses()[FormQuestion.DiscordName].getResponse() as string;
        const deck = response.getItemResponses()[FormQuestion.DeckLink].getResponse() as string;
        const count = parseInt(response.getItemResponses()[FormQuestion.GamesPlayed].getResponse() as string);
        const rating = parseInt(response.getItemResponses()[FormQuestion.Rating].getResponse() as string);
        const release = ReleaseReady[response.getItemResponses()[FormQuestion.ReleaseReady].getResponse() as string];
        const reasonString = response.getItemResponses()[FormQuestion.Reason].getResponse() as string;
        const reason = reasonString ? reasonString : undefined;
        const additionalString = response.getItemResponses()[FormQuestion.Additional].getResponse() as string;
        const additional = additionalString ? additionalString : undefined;

        const review = new Review(DataRow.new(Columns.getAmount(ReviewColumn)), id, card, date, reviewer, deck, count, rating, release, reason, additional);
        review.syncData();
        return review;
    }

    syncData() {
        const newData = DataRow.new(Columns.getAmount(ReviewColumn));

        try {
            newData.setString(ReviewColumn.ResponseId, this.id);
            newData.setString(ReviewColumn.Number, this.card.development.number);
            newData.setString(ReviewColumn.Version, this.card.development.version.toString());
            newData.setString(ReviewColumn.Faction, this.card.faction);
            newData.setString(ReviewColumn.Name, this.card.name);
            newData.setString(ReviewColumn.Date, this.date.toDateString());
            newData.setString(ReviewColumn.Reviewer, this.reviewer);
            newData.setRichTextValue(ReviewColumn.Deck, SpreadsheetApp.newRichTextValue().setText("ThronesDB").setLinkUrl(this.deck).build());
            newData.setString(ReviewColumn.Count, this.count);
            newData.setString(ReviewColumn.Rating, this.rating);
            newData.setString(ReviewColumn.Release, ReleaseReady[this.release]);
            if (this.reason) {
                newData.setString(ReviewColumn.Reason, this.reason);
            }
            if (this.additional) {
                newData.setString(ReviewColumn.Additional, this.additional);
            }

            // Update DataRow to newly created data
            this.data = newData;

            return true;
        } catch (e) {
            console.log("Failed to create RowData for review '" + this.id + "'. JSON dump of review values:\n" + JSON.stringify(this));
            console.log("Caused by the following error: " + e);
            // DataRow will not be updated (original values retained)
            return false;
        }
    }

    toString() {
        return "Review for '" + this.card.toString() + "' by " + this.reviewer;
    }

    clone() {
        // TODO Make this more efficient, but ensure all values are new, not same memory reference
        this.syncData();
        return Review.fromData(this.data);
    }
}

enum ReleaseReady {
    Yes,
    No,
    Unsure
}

export { Review, ReleaseReady }