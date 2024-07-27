import { Log } from "../CloudLogger.js";
import { CardId, Column } from "./CardInfo.js";
import { DataColumn } from "./DataColumn.js";

export class DataSheetFactory {
    private static CardIdFunc = (id: CardId, row: unknown[]) => id.number === row[Column.Number] && (!id.version || id.version === row[Column.Version]);
    public static latest = () => new DataSheet("Latest Cards", DataTableType.STATIC, this.CardIdFunc);
    public static archive = () => new DataSheet("Archived Cards", DataTableType.DYNAMIC, this.CardIdFunc);
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