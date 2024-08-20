import { dataSheets } from "../DataSheets";

export function onEdited(e: GoogleAppsScript.Events.SheetsOnEdit) {
    const sheet = e.range.getSheet();
    const dataSheet = Array.from(dataSheets.values()).find((ds) => ds.isFor(sheet));
    // TODO: Add a buffer of 10 seconds (eg. send edits in batch after no edits within 10s)
    if (dataSheet) {
        dataSheet.onEdit(e);
    }
}