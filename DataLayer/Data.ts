import { RichTextRow } from "./RichTextRow";
import { Card } from "./Models/Card";
import { CardColumn, ColumnHelper, NoteType, ProjectType, ReviewColumn } from "../Common/Enums";
import { Project, SemanticVersion } from "./Models/Project";
import { Review } from "./Models/Review";
import { Pack } from "./Models/Pack";
import { Settings } from "./Settings";

class Data {
  private static instance_: Data;
  readonly project: Project;

  private latestCardsSheet: DataSheet<Card>;
  private archivedCardsSheet: DataSheet<Card>;
  private archivedReviewsSheet: DataSheet<Review>;
  
  private latestCards_: Card[];
  private archivedCards_: Card[];
  private archivedReviews_: Review[];

  constructor() {
    if (!SpreadsheetApp.getActiveSpreadsheet()) {
      const spreadsheetId = Settings.getScriptProperty("spreadsheetId");
      SpreadsheetApp.setActiveSpreadsheet(SpreadsheetApp.openById(spreadsheetId));
    }
    this.project = new Project();

    this.latestCardsSheet = new DataSheet(this.getSheetByName("Latest Cards"), 5, 2, ColumnHelper.getCount(CardColumn), this.project.totalCards, false);
    this.archivedCardsSheet = new DataSheet(this.getSheetByName("Archived Cards"), 5, 2, ColumnHelper.getCount(CardColumn), null, true);
    this.archivedReviewsSheet = new DataSheet(this.getSheetByName("Archived Reviews"), 4, 2, ColumnHelper.getCount(ReviewColumn), null, true);

    this.latestCards_ = this.latestCardsSheet.getRichTextData().map(rtv => new Card(this.project, rtv));
    this.archivedCards_ = this.archivedCardsSheet.getRichTextData().map(rtv => new Card(this.project, rtv));
    this.archivedReviews_ = this.archivedReviewsSheet.getRichTextData().map(rtv => new Review(rtv));
  }

  get latestCards() {
    return this.latestCards_;
  }
  set latestCards(value) {
    this.latestCardsSheet.isDirty = true;
    this.latestCards_ = value;
  }
  get archivedCards() {
    return this.archivedCards_;
  }
  set archivedCards(value) {
    this.archivedCardsSheet.isDirty = true;
    this.archivedCards_ = value;
  }
  get archivedReviews() {
    return this.archivedReviews_;
  }
  set archivedReviews(value) {
    this.archivedReviewsSheet.isDirty = true;
    this.archivedReviews_ = value;
  }

  static get instance(): Data {
    if (!Data.instance_) {
      Data.instance_ = new Data();
      console.log("Created new Data singleton instance.");
    }

    return Data.instance_;
  }

  private getSheetByName(name: string) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) {
      throw new Error("Failed to find sheet of name '" + name + "'.");
    }
    return sheet;
  }

  sync() {
    this.latestCardsSheet.setRichTextData(this.latestCards.map(card => card.toRichTextValues()));
    this.archivedCardsSheet.setRichTextData(this.archivedCards.map(card => card.toRichTextValues()));
    this.archivedReviewsSheet.setRichTextData(this.archivedReviews.map(review => review.toRichTextValues()));
  }

  get playtestingCards(): Card[] {
    return this.latestCards.filter(card => card.development.playtestVersion).map(card => {
      if (card.development.playtestVersion === card.development.version) {
        return card;
      }
      let archivedCard = this.archivedCards.find(archivedCard => archivedCard.code === card.code && archivedCard.development.version === card.development.playtestVersion);
      if (!archivedCard) {
        throw new Error("Failed to find archived card for '" + card.name + "' with version '" + card.development.playtestVersion + "'.");
      }

      return archivedCard;
    });
  }

  findCard(number: number, version: SemanticVersion): Card | undefined {
    return this.latestCards.concat(this.archivedCards).find(card => card.development.number === number && card.development.version.equals(version));
  }

  getDevelopmentPack() {
    return new Pack(this.latestCards, this.project);
  }

  getReleasePack(cards: Card[], code: number, short: string, name: string, type: ProjectType, releaseDate: Date) {
    const project = new Project(name, short, code, cards.length, type);
    return new Pack(cards, project);
  }

  getCompletedCards() {
    const hasBeenImplemented = (card: Card) => !card.development.playtestVersion && card.development.note?.type === NoteType.Implemented;
    const isBeingUpdated = (card: Card) => !card.development.version.equals(card.development.playtestVersion);

    return this.latestCards.filter(card => (hasBeenImplemented(card) || isBeingUpdated(card)) && card.development.githubIssue?.status === "closed");
  }

  archiveCompletedUpdates() {
    const archiving = this.getCompletedCards();

    const successful: string[] = [];
    for(const card of archiving) {
      successful.push(card.toString());
      this.archivedCards.push(card.clone());

      delete card.development.note;
      card.development.playtestVersion = card.development.version;
      delete card.development.githubIssue;
      // Note: Image is synced/updated when issue is created, not when card is archived
    }

    this.sync();

    console.log("Successfully archived " + successful.length + " card(s): " + successful.join(", "));
  }
}

class DataSheet<T extends RichTextRow> {
  isDirty: boolean;
  constructor(private sheet: GoogleAppsScript.Spreadsheet.Sheet, private firstRow: number, private firstColumn: number, private numColumns: number, private numRows: number | null, private hasTemplateRow: boolean) {
    this.isDirty = false;
  }

  private get numTemplateRows() {
    return this.hasTemplateRow ? 1 : 0;
  }

  getRichTextData(): (GoogleAppsScript.Spreadsheet.RichTextValue | null)[][] {
    const lastRow = this.sheet.getLastRow();
    const numRows = this.numRows || (lastRow + 1) - this.firstRow;
    if (numRows <= 0) {
      return [];
    }
    return this.sheet.getRange(this.firstRow, this.firstColumn, numRows, this.numColumns).getRichTextValues();
  }

  setRichTextData(data: GoogleAppsScript.Spreadsheet.RichTextValue[][]) {
    if (data.length > 0 && data[0].length != this.numColumns) {
      throw new Error("Cannot setRichTextData as data length (" + data[0].length + ") does not match '" + this.sheet.getName() + "' column length (" + this.numColumns + ").");
    }
    
    if(!this.isDirty) {
      return;
    }

    // If there is a set number of rows, then rows cannot be added or removed
    if (this.numRows) {
      this.sheet.getRange(this.firstRow, this.firstColumn, this.numRows, this.numColumns).setRichTextValues(data);
    } else {
      // Calculate how many rows to be added or removed via rowOffset
      const lastRow = this.sheet.getLastRow();
      const numRows = this.numRows || (lastRow + 1) - this.firstRow;
      // Note: rowOffset will keep numTemplateRows in mind, and never offset to delete a template row
      const rowOffset = Math.max(this.numTemplateRows, data.length) - Math.max(this.numTemplateRows, numRows);

      if (rowOffset > 0) {
        // Insert the required number of rows, and save that range in insertedRange
        const insertedRange = this.sheet.insertRowsAfter(lastRow, rowOffset).getRange(lastRow + 1, this.firstColumn, rowOffset, this.numColumns);

        if (this.hasTemplateRow) {
          // Copy the template row into the newly inserted range
          const templateRange = this.sheet.getRange(this.firstRow, this.firstColumn, this.numTemplateRows, this.numColumns);
          templateRange.copyTo(insertedRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        }
      } else if (rowOffset < 0) {
        // Delete number of required rows from firstRow (as data will be overridden anyway)
        this.sheet.deleteRows(this.firstRow, Math.abs(rowOffset));
      }

      // Either clear template rows, or set the range
      if (this.hasTemplateRow && data.length === 0) {
        this.sheet.getRange(this.firstRow, this.firstColumn, this.numTemplateRows, this.numColumns).clearContent();
      } else if (data.length > 0) {
        this.sheet.getRange(this.firstRow, this.firstColumn, data.length, this.numColumns).setRichTextValues(data);
      }
    }
  }

  addRow(row: T) {
    const rtvs = row.toRichTextValues();
    if (rtvs.length !== this.numColumns) {
      throw new Error("Cannot addRichTextRow as row length (" + rtvs.length + ") does not match '" + this.sheet.getName() + "' column length (" + this.numColumns + ").");
    }

    const current = this.getRichTextData();
    const lastRow = this.sheet.getLastRow();

    // Inserts rows when the current data is at or beyond the template rows
    if (current.length >= this.numTemplateRows) {
      // Insert 1 row, and save that range in insertedRange
      const insertedRange = this.sheet.insertRowsAfter(lastRow, 1).getRange(lastRow + 1, this.firstColumn, lastRow + 1, this.numColumns);

      if (this.hasTemplateRow) {
        // Copy the template row into the newly inserted range
        const templateRange = this.sheet.getRange(this.firstRow, this.firstColumn, this.numTemplateRows, this.numColumns);
        templateRange.copyTo(insertedRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      }
    }

    this.sheet.getRange(lastRow + 1, this.firstColumn, 1, this.numColumns).setRichTextValues([row.toRichTextValues()]);
  }
}
export { Data }