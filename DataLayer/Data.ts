import { Card } from "./Models/Card";
import { NoteType, ProjectType } from "../Common/Enums";
import { Project, SemanticVersion } from "./Models/Project";
import { Review } from "./Models/Review";
import { Pack } from "./Models/Pack";
import { Settings } from "./Settings";
import { CardColumn, Columns, ReviewColumn } from "../Common/Columns";

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

    this.latestCardsSheet = new DataSheet("Latest Cards", 5, 2, Columns.getAmount(CardColumn), this.project.totalCards);
    this.archivedCardsSheet = new DataSheet("Archived Cards", 5, 2, Columns.getAmount(CardColumn));
    this.archivedReviewsSheet = new DataSheet("Archived Reviews", 4, 2, Columns.getAmount(ReviewColumn));
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
      this.latestCards_ = this.latestCardsSheet.read().dataRows.map(dataRow => Card.fromData(dataRow));
    }
    return this.latestCards_;
  }
  set latestCards(value) {
    this.latestCards_ = value;
  }
  get archivedCards() {
    if (!this.archivedCards_) {
      this.archivedCards_ = this.archivedCardsSheet.read().dataRows.map(dataRow => Card.fromData(dataRow));
    }
    return this.archivedCards_;
  }
  set archivedCards(value) {
    this.archivedCards_ = value;
  }
  get archivedReviews() {
    if (!this.archivedReviews_) {
      this.archivedReviews_ = this.archivedReviewsSheet.read().dataRows.map(dataRow => Review.fromData(dataRow));
    }
    return this.archivedReviews_;
  }
  set archivedReviews(value) {
    this.archivedReviews_ = value;
  }

  get playtestingCards(): Card[] {
    return this.latestCards.map(card => {
      if (!card.development.playtestVersion) {
        return card;
      }
      let archivedCard = this.archivedCards.find(archivedCard => archivedCard.code === card.code && archivedCard.development.version.equals(card.development.playtestVersion));
      if (!archivedCard) {
        throw new Error("Failed to find archived card for '" + card.name + "' with version '" + card.development.playtestVersion + "'.");
      }

      return archivedCard;
    });
  }

  commit() {
    if(this.latestCards_) this.latestCardsSheet.write(new DataTable(this.latestCards.map(card => card.dataRow)));
    if(this.archivedCards_) this.archivedCardsSheet.write(new DataTable(this.archivedCards.map(card => card.dataRow)));
    if(this.archivedReviews_) this.archivedReviewsSheet.write(new DataTable(this.archivedReviews.map(review => review.dataRow)));
  }

  findCard(number: number, version: SemanticVersion): Card | undefined {
    return this.latestCards.concat(this.archivedCards).find(card => card.development.number === number && card.development.version.equals(version));
  }

  findLatestCard(number: number, version: SemanticVersion): Card | undefined {
    return this.latestCards.find(card => card.development.number === number && card.development.version.equals(version));
  }
  findArchivedCard(number: number, version: SemanticVersion): Card | undefined {
    return this.archivedCards.find(card => card.development.number === number && card.development.version.equals(version));
  }

  getDevelopmentPack() {
    return new Pack(this.latestCards, this.project);
  }

  getReleasePack(cards: Card[], code: number, short: string, name: string, type: ProjectType, releaseDate: Date) {
    const project = new Project(name, short, code, cards.length, type);
    return new Pack(cards, project);
  }

  getChangedCards() {
    return this.latestCards.filter(card => card.isChanged());
  }

  getPlaytestingUpdateCards() {
    return this.latestCards.filter(card => card.isChanged() || card.isNewlyImplemented());
  }

  archivePlaytestingUpdateCards() {
    const archiving = this.getPlaytestingUpdateCards();

    const implemented: string[] = [];
    const archived: string[] = [];
    for (const card of archiving) {
      if(card.canBeArchived()) {
        this.archivedCards.push(card.clone());
        delete card.development.note.type;
        delete card.development.note.text;
        card.development.playtestVersion = card.development.version;
        archived.push(card.toString());
      }
      
      if(card.isNewlyImplemented()) {
        delete card.development.githubIssue;
        implemented.push(card.toString());
      }
    }

    this.commit();

    console.log("Marked " + implemented.length + " card(s) as implemented: " + implemented.join(", "));
    console.log("Archived " + archived.length + " card(s): " + archived.join(", "));
  }
}

class DataSheet {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor(sheetName: string, private firstRow: number, private firstColumn: number, private numColumns: number, private numRows: number | null = null) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Failed to find sheet of name '" + sheetName + "'.");
    }
    this.sheet = sheet;
  }

  private get hasTemplateRow() {
    return this.numRows !== undefined;
  }

  private get numTemplateRows() {
    return this.hasTemplateRow ? 1 : 0;
  }

  read(): DataTable {
    const numRows = this.numRows || (this.sheet.getLastRow() + 1) - this.firstRow;
    console.log("Reading " + numRows + " rows from " + this.sheet.getName() + "...");

    if (numRows <= 0) {
      return new DataTable([]);
    }

    const range = this.sheet.getRange(this.firstRow, this.firstColumn, numRows, this.numColumns);
    const richTextValues = range.getRichTextValues();
    const values = range.getValues();

    const rowData = values.map((value, index) => new DataRow(richTextValues[index], value));
    return new DataTable(rowData);
  }

  write(data: DataTable) {
    console.log("Writing " + data.values.length + " data rows to '" + this.sheet.getName() + "'...");
    this.validate(data);

    try {
      // If there is a set number of rows, then rows cannot be added or removed
      if (this.numRows) {
        if (data.values.length !== this.numRows) {
          throw new Error("Failed to write to " + this.sheet.getName() + " as data length (" + data.values.length + ") does not match number of rows (" + this.numRows + ")");
        }
        this.sheet.getRange(this.firstRow, this.firstColumn, this.numRows, this.numColumns).setRichTextValues(this.merge(data));
      } else {
        // Calculate how many rows to be added or removed via rowOffset
        const lastRow = this.sheet.getLastRow();
        const numRows = this.numRows || (lastRow + 1) - this.firstRow;
        // Note: rowOffset will keep numTemplateRows in mind, and never offset to delete a template row
        const rowOffset = Math.max(this.numTemplateRows, data.values.length) - Math.max(this.numTemplateRows, numRows);

        if (rowOffset > 0) {
          // Insert the required number of rows, and save that range in insertedRange
          const insertedRange = this.sheet.insertRowsAfter(Math.max(lastRow, this.firstRow), rowOffset).getRange(lastRow + 1, this.firstColumn, rowOffset, this.numColumns);

          if (this.hasTemplateRow) {
            // Copy the template row format into the newly inserted range (note: this isn't working as expected for borders)
            const templateRange = this.sheet.getRange(this.firstRow, this.firstColumn, this.numTemplateRows, this.numColumns);
            templateRange.copyTo(insertedRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
          }
        } else if (rowOffset < 0) {
          // Delete number of required rows from firstRow (as data will be overridden anyway)
          this.sheet.deleteRows(this.firstRow, Math.abs(rowOffset));
        }

        // Either clear template rows, or set the range
        if (this.hasTemplateRow && data.values.length === 0) {
          this.sheet.getRange(this.firstRow, this.firstColumn, this.numTemplateRows, this.numColumns).clearContent();
        } else if (data.values.length > 0) {
          this.sheet.getRange(this.firstRow, this.firstColumn, data.values.length, this.numColumns).setRichTextValues(this.merge(data));
        }
      }
      console.log("Successfully written " + data.values.length + " data rows.");
      return true;
    } catch (e) {
      console.log("Failed to write to sheet: " + e);
      return false;
    }
  }

  private merge(data: DataTable): GoogleAppsScript.Spreadsheet.RichTextValue[][] {
    return data.richTextValues.map((row, iRow) => row.map((column, iColumn) => column ?? SpreadsheetApp.newRichTextValue().setText(data.values[iRow][iColumn].toString()).build()));
  }

  private validate(data: DataTable) {
    const rtvRows = data.richTextValues.length;
    const valRows = data.richTextValues.length;
    const rtvColumns = rtvRows > 0 ? data.richTextValues[0].length : this.numColumns;
    const valColumns = valRows > 0 ? data.values[0].length : this.numColumns;

    if (this.numRows && (rtvRows !== this.numRows || valRows !== this.numRows)) {
      throw new Error("Rich Text Values or Values are incorrect number of rows (was " + rtvRows + " / " + valRows + ", should be " + this.numRows);
    }
    if (rtvColumns != this.numColumns || valColumns != this.numColumns) {
      throw new Error("Rich Text Values or Values are incorrect number of columns (was " + rtvColumns + " / " + valColumns + ", should be " + this.numColumns);
    }
  }
}

class DataTable {
  constructor(private rows: DataRow[]) { }

  public get richTextValues() {
    return this.rows.map(row => row.richTextValues);
  }

  public get values() {
    return this.rows.map(row => row.values);
  }

  public get dataRows() {
    return this.rows;
  }
}

class DataRow {
  constructor(public richTextValues: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[], public values: any[]) { }

  static new(numColumns: number, dashIndecies: number[] = []) {
    const raw = Array.from({ length: numColumns }, (v, i) => dashIndecies.includes(i) ? "-" : "");
    return new DataRow(raw.map(r => SpreadsheetApp.newRichTextValue().setText(r).build()), raw);
  }

  private getValue(column: number): any {
    let val = this.richTextValues[column]?.getText() || this.values[column];
    if (val === "-" || val === "" || val === null || val === undefined) {
      throw new Error("Failed to get value for column index " + column + ".\nFull Row Values: " + this.values.join(", "));
    }
    return val;
  }

  hasValue(column: number) {
    const val = this.richTextValues[column]?.getText() || this.values[column];
    return !(val === "-" || val === "" || val === null || val === undefined);
  }

  getString(column: number) {
    return this.getValue(column).toString() as string;
  }

  getNumber(column: number) {
    const val = this.getString(column);
    if (Number.isNaN(val)) {
      throw new Error("Failed to parse number from '" + val + "' for column index " + column + ".\nFull Row Values: " + this.values.join(", "));
    }
    return parseInt(val);
  }

  getEnum<E>(enumType: any, column: number) {
    const val = this.getString(column);
    const e = Object.entries(enumType).find(([key, value]) => value === val)?.[1];
    if (!e) {
      throw new Error("Failed to get enum value for '" + enumType + "' from value '" + val + "' for column index " + column + ".\nFull Row Values: " + this.values.join(", "));
    }
    return val as E;
  }

  getRichTextValue(column: number) {
    const rtv = this.richTextValues[column];
    if (!rtv) {
      throw new Error("Failed to get required rich text value for column index " + column + ".\nFull Row Values: " + this.values.join(", "));
    }
    return rtv;
  }

  getHtmlString(column: number) {
    let htmlString = "";
    const isTrait = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
      ts.isBold()
      && ts.isItalic()
      && !ts.isStrikethrough()
      && !ts.isUnderline()

    const isTriggeredAbility = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
      ts.isBold()
      && !ts.isItalic()
      && !ts.isStrikethrough()
      && !ts.isUnderline()

    for (let run of this.richTextValues[column]?.getRuns() ?? []) {
      let text = run.getText();
      const style = run.getTextStyle();

      // Regex to gather only the text portion of the string, whilst leaving the trim/newlines untouched
      const regex = /([^ \n]+(?: [^ \n]+)*)/g;
      if (isTrait(style)) {
        text = text.replace(regex, "<i>$1</i>");
      } else if (isTriggeredAbility(style)) {
        text = text.replace(regex, "<b>$1</b>");
      }
      // // Replacing new-line with break
      // text = text.replace(/\n/g, "<br>");
      // Replacing icons
      text = text.replace(/:(\w+):/g, "[$1]");
      // Replacing citing
      text = text.replace(/(?<=" )[-~]\s+([\w ]+)/g, "<cite>$1</cite>");
      htmlString += text;
    }

    return htmlString;
  }

  setString(column: number, value: string | number) {
    const val = value.toString();
    this.setRichTextValue(column, SpreadsheetApp.newRichTextValue().setText(val).build());
    this.values[column] = val;
  }

  setRichTextValue(column: number, richTextValue: GoogleAppsScript.Spreadsheet.RichTextValue) {
    this.richTextValues[column] = richTextValue;
  }

  setHtmlString(column: number, html: string) {
    const regex = /(?:<([^>]+)>)?(?<!<)([^<>]+)?(?!>)(?:<\/[^>]+>)?/gm;
    const textStyles: {
      startOffset: number,
      endOffset: number,
      textStyle: GoogleAppsScript.Spreadsheet.TextStyle
    }[] = [];
    let fullText = "";

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      const element = match[1];
      const text = match[2] || "";
      let textStyle: GoogleAppsScript.Spreadsheet.TextStyle | null = null;
      switch (element) {
        case "i":
          textStyle = SpreadsheetApp.newTextStyle().setBold(true).setItalic(true).build();
        case "b":
          textStyle = textStyle || SpreadsheetApp.newTextStyle().setBold(true).build();
          textStyles.push({
            startOffset: fullText.length,
            endOffset: fullText.length + text.length,
            textStyle
          });
          fullText += text;
          break;
        case "cite":
          fullText += "- " + text;
          break;
        default:
          fullText += text;
      }

    }

    // Converts all [icons] into :icons:
    fullText = fullText.replace(/\[([^\]]+)\]/g, ":$1:");
    let builder = SpreadsheetApp.newRichTextValue().setText(fullText);
    for (let ts of textStyles) {
      builder = builder.setTextStyle(ts.startOffset, ts.endOffset, ts.textStyle);
    }

    this.setRichTextValue(column, builder.build());
  }
}

function incrementProjectVersion() {
  const data = Data.instance;
  const oldVersion = data.project.version.toString();
  data.project.version = data.project.version.increment(0, 0, 1);
  console.log("Incremented Project Version from '" + oldVersion + "' to '" + data.project.version.toString() + "'");
}

export { Data, DataTable, DataRow }