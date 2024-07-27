import { Log } from "../CloudLogger.js";
import { CardIdentifier, Column } from "./CardInfo.js";
import { DataColumn } from "./DataColumn.js";

// class Data {
//   private static instance_: Data;

//   private latestCardsSheet: DataSheet;
//   private archivedCardsSheet: DataSheet;
//   private archivedReviewsSheet: DataSheet;

//   private latestCards_: Card[];
//   private archivedCards_: Card[];
//   private archivedReviews_: Review[];

//   constructor() {
//     if (!SpreadsheetApp.getActiveSpreadsheet()) {
//       const spreadsheetId = Settings.getProperty(GooglePropertiesType.Script, "spreadsheetId");
//       SpreadsheetApp.setActiveSpreadsheet(SpreadsheetApp.openById(spreadsheetId));
//     }

//     this.latestCardsSheet = new DataSheet("Latest Cards", 5, 2, maxEnum(CardColumn), Project.totalCards);
//     this.archivedCardsSheet = new DataSheet("Archived Cards", 5, 2, maxEnum(CardColumn));
//     this.archivedReviewsSheet = new DataSheet("Archived Reviews", 4, 2, maxEnum(ReviewColumn));
//   }

//   static get instance(): Data {
//     if (!Data.instance_) {
//       Data.instance_ = new Data();
//       Log.verbose("Created new Data singleton instance.");
//     }

//     return Data.instance_;
//   }

//   get latestCards() {
//     if (!this.latestCards_) {
//       const rawData = this.latestCardsSheet.read();
//       const start = new Date();
//       this.latestCards_ = rawData.dataRows.map(dataRow => Card.fromData(dataRow));
//       const end = new Date();
//       Log.verbose("Mapped latest card data in " + (end.getTime() - start.getTime()) + "ms");
//     }
//     return this.latestCards_;
//   }
//   set latestCards(value) {
//     this.latestCards_ = value;
//   }
//   get archivedCards() {
//     if (!this.archivedCards_) {
//       const rawData = this.archivedCardsSheet.read();
//       const start = new Date();
//       this.archivedCards_ = rawData.dataRows.map(dataRow => Card.fromData(dataRow));
//       const end = new Date();
//       Log.verbose("Mapped archived card data in " + (end.getTime() - start.getTime()) + "ms");
//     }
//     return this.archivedCards_;
//   }
//   set archivedCards(value) {
//     this.archivedCards_ = value;
//   }
//   get archivedReviews() {
//     if (!this.archivedReviews_) {
//       const rawData = this.archivedReviewsSheet.read();
//       const start = new Date();
//       this.archivedReviews_ = rawData.dataRows.map(dataRow => Review.fromData(dataRow));
//       const end = new Date();
//       Log.verbose("Mapped archived review data in " + (end.getTime() - start.getTime()) + "ms");
//     }
//     return this.archivedReviews_;
//   }
//   set archivedReviews(value) {
//     this.archivedReviews_ = value;
//   }

//   get playtestingCards(): Card[] {
//     return this.latestCards.filter(card => card.development.playtestVersion).map(card => this.getArchivedCard(card.development.number, card.development.playtestVersion as SemanticVersion));
//   }

//   commit() {
//     if (this.latestCards_) this.latestCardsSheet.write(new DataTable(this.latestCards.map(card => card.dataRow)));
//     if (this.archivedCards_) this.archivedCardsSheet.write(new DataTable(this.archivedCards.map(card => card.dataRow)));
//     if (this.archivedReviews_) this.archivedReviewsSheet.write(new DataTable(this.archivedReviews.map(review => review.dataRow)));
//   }

//   getCard(number: number, version: SemanticVersion) {
//     const card = this.latestCards.concat(this.archivedCards).find(card => card.development.number === number && card.development.version.equals(version));
//     if (!card) {
//       throw Error("Failed to find any card with number '" + number + "' and version '" + version.toString() + "'");
//     }
//     return card;
//   }

//   getLatestCard(number: number, version: SemanticVersion) {
//     const card = this.latestCards.find(card => card.development.number === number && card.development.version.equals(version));
//     if (!card) {
//       throw Error("Failed to find latest card with number '" + number + "' and version '" + version.toString() + "'");
//     }
//     return card;
//   }

//   getArchivedCard(number: number, version: SemanticVersion) {
//     const card = this.archivedCards.find(card => card.development.number === number && card.development.version.equals(version));
//     if (!card) {
//       throw Error("Failed to find archived card with number '" + number + "' and version '" + version.toString() + "'");
//     }
//     return card;
//   }

//   getDevelopmentPack() {
//     return new Pack(this.latestCards.filter(card => !card.development.final?.packCode), this.project);
//   }

//   getReleasePack(cards: Card[], code: number, short: string, name: string, type: ProjectType, releaseDate: Date) {
//     const project = new Project(name, short, code, cards.length, type);
//     return new Pack(cards, project, releaseDate);
//   }

//   getChangedCards() {
//     return this.latestCards.filter(card => card.isChanged);
//   }

//   getPlaytestingUpdateCards() {
//     return this.latestCards.filter(card => card.isChanged || card.isNewlyImplemented || card.isPreRelease);
//   }

//   archivePlaytestingUpdateCards() {
//     const checking = this.getPlaytestingUpdateCards();

//     const implemented: string[] = [];
//     const archived: string[] = [];
//     for (const card of checking) {
//       if(!card.development.version.equals(card.development.playtestVersion)) {
//         this.archivedCards.push(card.clone());
//         card.development.playtestVersion = card.development.version;
//         archived.push(card.toString());
//       }
//       delete card.development.note.type;
//       delete card.development.note.text;

//       if (card.isNewlyImplemented) {
//         delete card.development.githubIssue;
//         implemented.push(card.toString());
//       }
//     }
//     Forms.updateFormCards();

//     this.commit();

//     Log.information("Marked " + implemented.length + " card(s) as implemented: " + implemented.join(", "));
//     Log.information("Archived " + archived.length + " card(s): " + archived.join(", "));
//   }
// }
export class DataSheetFactory {
    private static cardIdentifierFunc = (id: CardIdentifier, row: unknown[]) => id.number === row[Column.Number] && (!id.version || id.version === row[Column.Version]);
    public static latest = () => new DataSheet("Latest Cards", DataTableType.STATIC, this.cardIdentifierFunc);
    public static archive = () => new DataSheet("Archived Cards", DataTableType.DYNAMIC, this.cardIdentifierFunc);
};

enum DataTableType {
    STATIC,
    DYNAMIC
}

class DataSheet<T> {
    private sheet: GoogleAppsScript.Spreadsheet.Sheet;
    private firstRow: number;
    private firstColumn: number;
    private maxColumns: number;
    private maxRows: number;

    constructor(sheetName: string, private type: DataTableType = DataTableType.DYNAMIC, private identifierFunc: (identifier: T, row: unknown[]) => boolean) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!sheet) {
            throw Error(`Failed to find sheet '${sheetName}'`);
        }
        this.sheet = sheet;

        this.firstRow = sheet.getFrozenRows() + 1;
        this.firstColumn = 2;
        this.maxColumns = (sheet.getLastColumn() + 1) - this.firstColumn;
        this.maxRows = (sheet.getLastRow() + 1) - this.firstRow;
    }

    public create(creating: string[][]) {
        if (creating.length > 0 && this.type === DataTableType.STATIC) {
            throw Error(`You cannot create rows on static data sheet "${this.sheet.getName()}"`);
        }

        // Default number of template rows is 1.
        // Only inserts if there is already data (eg. does not insert for first value, as this is consumed by template row)
        const insertingRows = creating.length - Math.max(0, (this.firstRow - this.sheet.getLastRow()));
        const lastRow = this.sheet.getLastRow();
        if (insertingRows > 0) {
            // Insert rows after current last row
            this.sheet.insertRowsAfter(Math.max(lastRow, this.firstRow), insertingRows);
            const insertedRange = this.sheet.getRange(lastRow + 1, this.firstColumn, insertingRows, this.maxColumns);

            // Copy the template row format into the newly inserted range (note: this isn't working as expected for borders)
            const templateRange = this.sheet.getRange(this.firstRow, this.firstColumn, 1, this.maxColumns);
            templateRange.copyTo(insertedRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        }

        const richTextValues = creating.map((row) => row.map((column) => DataColumn.deserialise(column)));
        this.sheet.getRange(lastRow + 1, this.firstColumn, richTextValues.length, this.maxColumns).setRichTextValues(richTextValues);

        Log.information(`Created ${richTextValues.length} rows in ${this.sheet.getName()}`);
        return richTextValues.length;
    }

    public read(reading?: T[]) {
        // TODO: Save current filter, unapply, then reapply when finished reading
        if (this.maxRows <= 0) {
            return [];
        }

        // Fetch all rows (as needs to be filtered)
        const range = this.sheet.getRange(this.firstRow, this.firstColumn, this.maxRows, this.maxColumns);
        const richTextValueMatrix = range.getRichTextValues();
        const valueMatrix = range.getValues();

        const tableValues: string[][] = [];
        for (let i = 0 ; i < valueMatrix.length ; i++) {
            const values = valueMatrix[i];
            // Only get row if matches filter
            if (!reading || reading.some((id) => this.identifierFunc(id, values))) {
                const rowValues: string[] = [];

                const richTextValues = richTextValueMatrix[i];
                for (let j = 0 ; j < values.length ; j++) {
                    const richTextValue = richTextValues[j];
                    if (richTextValue === null || richTextValue.getText() === "") {
                        const value = values[j];
                        rowValues.push(value);
                    } else {
                        rowValues.push(DataColumn.serialise(richTextValue));
                    }
                }
                // Row Number is "i + 1"
                tableValues.push(rowValues);
            }
        }

        Log.information(`Read ${tableValues.length} rows in ${this.sheet.getName()}`);
        return tableValues;
    }

    public update(updating: { id: T, values: string[] }[]) {
        // TODO: Save current filter, unapply, then reapply when finished reading
        if (this.maxRows <= 0) {
            return 0;
        }

        // Fetch all rows (as needs to be filtered)
        const range = this.sheet.getRange(this.firstRow, this.firstColumn, this.maxRows, this.maxColumns);
        const valueMatrix = range.getValues();

        const setMap = new Map<number, string[][]>();
        for (let i = 0 ; i < valueMatrix.length ; i++) {
            const values = valueMatrix[i];

            let startRow: number;
            const found = updating.find(({ id }) => this.identifierFunc(id, values))?.values;
            if (found) {
                startRow = startRow || (this.firstRow + i);
                const group: string[][] = setMap[startRow] || [];
                group.push(found);
                setMap.set(startRow, group);
            } else if (startRow !== undefined) {
                startRow = undefined;
            }
        }

        let totalGroups = 0;
        let totalUpdated = 0;
        for (const [startRow, values] of Array.from(setMap.entries())) {
            totalGroups++;
            const richTextValues = values.map((row) => row.map((column) => DataColumn.deserialise(column)));
            this.sheet.getRange(startRow, this.firstColumn, values.length, this.maxColumns).setRichTextValues(richTextValues);
            totalUpdated += richTextValues.length;
        }

        Log.information(`Updated ${totalUpdated} rows (${totalGroups} groups) in ${this.sheet.getName()}`);
        return totalUpdated;
    }

    public delete(deleting: T[]) {
        if (this.maxRows <= 0) {
            return 0;
        }

        // Fetch all rows (as needs to be filtered)
        const range = this.sheet.getRange(this.firstRow, this.firstColumn, this.maxRows, this.maxColumns);
        const valueMatrix = range.getValues();

        const setMap = new Map<number, T[]>();
        let startGroupRow: number;
        for (let i = 0 ; i < valueMatrix.length ; i++) {
            const values = valueMatrix[i];

            const found = deleting.find((id) => this.identifierFunc(id, values));
            if (found) {
                if (this.type === DataTableType.STATIC) {
                    throw Error(`You cannot delete rows on static data sheet "${this.sheet.getName()}"`);
                }
                startGroupRow = startGroupRow || (this.firstRow + i);
                const group: T[] = setMap.get(startGroupRow) || [];
                group.push(found);
                setMap.set(startGroupRow, group);
            } else if (startGroupRow !== undefined) {
                startGroupRow = undefined;
            }
        }

        let totalGroups = 0;
        let totalDeleted = 0;
        // Delete backwards to ensure higher row deletions are not affecting lower row deletions
        for (const [startRow, values] of Array.from(setMap.entries()).reverse()) {
            totalGroups++;
            // If template row is to be "deleted", instead clear it
            if (startRow === this.firstRow) {
                this.sheet.getRange(startRow, this.firstColumn, 1, this.maxColumns).clearContent();
                if (values.length > 1) {
                    this.sheet.deleteRows(startRow + 1, values.length - 1);
                }
            } else {
                this.sheet.deleteRows(startRow, values.length);
            }
            totalDeleted += values.length;
        }

        Log.information(`Deleted ${totalDeleted} rows (${totalGroups} groups) in ${this.sheet.getName()}`);
        return totalDeleted;
    }
}

// function incrementProjectVersion() {
//   const data = Data.instance;
//   const oldVersion = data.project.version.toString();
//   data.project.version = data.project.version.increment(0, 0, 1);
//   Log.information("Incremented Project Version from '" + oldVersion + "' to '" + data.project.version.toString() + "'");
// }