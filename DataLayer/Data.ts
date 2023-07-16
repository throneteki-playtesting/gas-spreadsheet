import { Card } from "./Models/Card";
import { CardColumn, ColumnHelper, NoteType, ProjectType, ReviewColumn } from "../Common/Enums";
import { Project, SemanticVersion } from "./Models/Project";
import { Review } from "./Models/Review";
import { Pack } from "./Models/Pack";
import { Settings } from "./Settings";

class Data {
  private static instance_: Data;
  readonly project: Project;

  private latestCardsSheet: DataSheet;
  private archivedCardsSheet: DataSheet;
  private archivedReviewsSheet: DataSheet;

  private latestCards_: Card[];
  private archivedCards_: Card[];
  private archivedReviews_: Review[];

  constructor() {
    if (!SpreadsheetApp.getActiveSpreadsheet()) {
      const spreadsheetId = Settings.getScriptProperty("spreadsheetId");
      SpreadsheetApp.setActiveSpreadsheet(SpreadsheetApp.openById(spreadsheetId));
    }
    this.project = new Project();

    this.latestCardsSheet = new DataSheet("Latest Cards", 5, 2, ColumnHelper.getCount(CardColumn), this.project.totalCards, false);
    this.archivedCardsSheet = new DataSheet("Archived Cards", 5, 2, ColumnHelper.getCount(CardColumn), null, true);
    this.archivedReviewsSheet = new DataSheet("Archived Reviews", 4, 2, ColumnHelper.getCount(ReviewColumn), null, true);
  }

  static get instance(): Data {
    if (!Data.instance_) {
      Data.instance_ = new Data();
      console.log("Created new Data singleton instance.");
    }

    return Data.instance_;
  }

  get latestCards() {
    if (!this.latestCards_) {
      this.latestCards_ = this.latestCardsSheet.getRichTextData().map(rtv => Card.fromRichTextValues(this.project, rtv));
    }
    return this.latestCards_;
  }
  set latestCards(value) {
    this.latestCards_ = value;
  }
  get archivedCards() {
    if (!this.archivedCards_) {
      this.archivedCards_ = this.archivedCardsSheet.getRichTextData().map(rtv => Card.fromRichTextValues(this.project, rtv));
    }
    return this.archivedCards_;
  }
  set archivedCards(value) {
    this.archivedCards_ = value;
  }
  get archivedReviews() {
    if (!this.archivedReviews_) {
      this.archivedReviews_ = this.archivedReviewsSheet.getRichTextData().map(rtv => Review.fromRichTextValues(rtv));
    }
    return this.archivedReviews_;
  }
  set archivedReviews(value) {
    this.archivedReviews_ = value;
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

  commit() {
    this.latestCardsSheet.setRichTextData(this.latestCards.map(card => card.toRichTextValues()));
    this.archivedCardsSheet.setRichTextData(this.archivedCards.map(card => card.toRichTextValues()));
    this.archivedReviewsSheet.setRichTextData(this.archivedReviews.map(review => review.toRichTextValues()));
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
    for (const card of archiving) {
      successful.push(card.toString());
      this.archivedCards.push(card.clone());

      delete card.development.note;
      card.development.playtestVersion = card.development.version;
      delete card.development.githubIssue;
      // Note: Image is synced/updated when issue is created, not when card is archived
    }

    this.commit();

    console.log("Successfully archived " + successful.length + " card(s): " + successful.join(", "));
  }
}

class DataSheet {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor(sheetName: string, private firstRow: number, private firstColumn: number, private numColumns: number, private numRows: number | null, private hasTemplateRow: boolean) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Failed to find sheet of name '" + sheetName + "'.");
    }
    this.sheet = sheet;
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
    const saving = data.map(a => a.map(b => b.getText()));

    if (data.length > 0 && data[0].length != this.numColumns) {
      throw new Error("Cannot setRichTextData as data length (" + data[0].length + ") does not match '" + this.sheet.getName() + "' column length (" + this.numColumns + ").");
    }
    // If there is a set number of rows, then rows cannot be added or removed
    if (this.numRows) {
      if (data.length !== this.numRows) {
        throw new Error("Cannot setRichTextData as data length (" + data.length + ") does not match '" + this.sheet.getName() + "' number of rows (" + this.numRows + ").");
      }
      this.sheet.getRange(this.firstRow, this.firstColumn, this.numRows, this.numColumns).setRichTextValues(data);
    } else {
      // Calculate how many rows to be added or removed via rowOffset
      const lastRow = this.sheet.getLastRow();
      const numRows = this.numRows || (lastRow + 1) - this.firstRow;
      // Note: rowOffset will keep numTemplateRows in mind, and never offset to delete a template row
      const rowOffset = Math.max(this.numTemplateRows, data.length) - Math.max(this.numTemplateRows, numRows);

      if (rowOffset > 0) {
        // Insert the required number of rows, and save that range in insertedRange
        const insertedRange = this.sheet.insertRowsAfter(Math.max(lastRow, this.firstRow), rowOffset).getRange(lastRow + 1, this.firstColumn, rowOffset, this.numColumns);

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
}
export { Data }