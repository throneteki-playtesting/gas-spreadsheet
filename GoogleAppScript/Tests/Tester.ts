import { onEdited } from "../Spreadsheets/Listeners/onEdited";

function doGetTester() {
    const e = {
        pathInfo: "cards",
        parameter: {
            ids: "1@0.0.0"
        }
    };
    this.doGet(e);
}
function doPostTester() {
    let e: unknown = {};
    // Create
    e = {
        pathInfo: "cards/create",
        parameter: {
            filter: "archive"
        },
        postData: {
            contents: "[[\"1\",\"2.0.0\",\"House Baratheon\",\"New Melisandre\",\"Character\",\"Loyal\",\"Unique\",\"6\",\"5\",\"I / P\",\"Lady. R'hllor.\",\"Shadow (5).\\n<b>Reaction:</b> After you win a challenge in which Melisandre is attacking, choose and reveal a card in shadows controlled by the losing opponent. If that card is a character, you may kneel your faction card to put it into play under your control.\",\"\",\"\",\"\",\"\",\"<a href=\\\"https://hcti.io/v1/image/82aa440a-98cd-4d3f-95ee-fb39ffdf67ff\\\">1.0.0</a>\",\"\",\"\",\"1.0.0\",\"\",\"\",\"\"],[\"1\",\"2.0.1\",\"House Baratheon\",\"New Melisandre 2\",\"Character\",\"Loyal\",\"Unique\",\"6\",\"5\",\"I / P\",\"Lady. R'hllor.\",\"Shadow (5).\\n<b>Reaction:</b> After you win a challenge in which Melisandre is attacking, choose and reveal a card in shadows controlled by the losing opponent. If that card is a character, you may kneel your faction card to put it into play under your control.\",\"\",\"\",\"\",\"\",\"<a href=\\\"https://hcti.io/v1/image/82aa440a-98cd-4d3f-95ee-fb39ffdf67ff\\\">1.0.0</a>\",\"\",\"\",\"1.0.0\",\"\",\"\",\"\"]]"
        }
    };
    this.doPost(e);

    // Update
    e = {
        pathInfo: "cards/update",
        parameter: {},
        postData: {
            contents: "[[\"1\",\"2.0.0\",\"House Baratheon\",\"New Melisandre Updated\",\"Character\",\"Loyal\",\"Unique\",\"6\",\"5\",\"I / P\",\"Lady. R'hllor.\",\"Shadow (5).\\n<b>Reaction:</b> After you win a challenge in which Melisandre is attacking, choose and reveal a card in shadows controlled by the losing opponent. If that card is a character, you may kneel your faction card to put it into play under your control.\",\"\",\"\",\"\",\"\",\"<a href=\\\"https://hcti.io/v1/image/82aa440a-98cd-4d3f-95ee-fb39ffdf67ff\\\">1.0.0</a>\",\"\",\"\",\"1.0.0\",\"\",\"\",\"\"]]"
        }
    };
    this.doPost(e);

    // Delete
    e = {
        pathInfo: "cards/delete",
        parameter: {},
        postData: {
            contents: "[[\"1\",\"2.0.0\"],[\"1\",\"2.0.1\"]]"
        }
    };
    this.doPost(e);
}

function onEditedTester() {
    const e = {
        range: SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Latest Cards").getRange(5, 13)
    } as GoogleAppsScript.Events.SheetsOnEdit;
    onEdited(e);
}

export {
    doGetTester,
    doPostTester,
    onEditedTester
};