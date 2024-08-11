/* eslint-disable @typescript-eslint/no-unused-vars */
import { CardId } from "@/Common/Identifiers.js";
import { Log } from "../CloudLogger.js";
import { GooglePropertiesType, Settings } from "../Settings.js";
import { UIHelper } from "./UserInput.js";
import { dataSheets } from "./Data.js";
import { cardIdFunc } from "./CardSheet.js";

// Events //
function onSpreadsheetOpen() {
    // Add UI (if able)
    const ui = UIHelper.safelyGet();
    if (ui) {
        // ui.createMenu("Admin Tools")
        //     // .addSubMenu(
        //     //     ui.createMenu("Development")
        //     //         .addSubMenu(
        //     //             ui.createMenu("Finalize Dev Update")
        //     //                 .addItem("1. Sync Github Issues", "finalizeIssues")
        //     //                 .addItem("2. Sync Pull Requests", "finalizePullRequest")
        //     //                 .addItem("3. Generate JSON Data", "openJSONDevDialog")
        //     //                 .addItem("4. Generate Update Notes (Unimplemented)", "openUpdateNotesDialog")
        //     //                 .addItem("5. Archive Cards", "archivePlaytestingUpdateCards")
        //     //                 .addItem("6. Increment Project Version", "incrementProjectVersion")
        //     //         )
        //     //         .addSubMenu(
        //     //             ui.createMenu("Individual Tasks")
        //     //                 .addItem("Generate JSON Data", "openJSONDevDialog")
        //     //                 .addItem("Sync Reviews", "syncReviews")
        //     //                 .addItem("Sync Github Issues", "syncIssues")
        //     //                 .addItem("Sync Pull Requests", "syncPullRequests")
        //     //                 .addItem("Archive Cards", "archivePlaytestingUpdateCards")
        //     //                 .addItem("Update Form Cards", "updateFormCards")
        //     //                 .addItem("Increment Project Version", "incrementProjectVersion")
        //     //                 .addSubMenu(
        //     //                     ui.createMenu("Generate Card Images")
        //     //                         .addItem("All Digital Images (PNG)", "syncDigitalCardImages")
        //     //                         .addItem("Some Digital Images (PNG)", "syncSomeDigitalCardImages")
        //     //                         .addItem("Print Sheet (PDF)", "openPDFSheetsDialog")
        //     //                 )
        //     //                 .addItem("Generate Update Notes", "openUpdateNotesDialog")
        //     //                 .addItem("Test", "testMulti")
        //     //         ).addSubMenu(
        //     //             ui.createMenu("Edit Stored Data")
        //     //                 .addItem("Script Data", "editScriptProperties")
        //     //                 .addItem("Document Data", "editDocumentProperties")
        //     //                 .addItem("User Data", "editUserProperties")
        //     //         )
        //     // )
        //     // .addSubMenu(
        //     //     ui.createMenu("Release Tools")
        //     //         .addItem("Validate & Export JSON", "openJSONReleaseDialog")
        //     // )
        //     // .addSubMenu(
        //     //     ui.createMenu("Config")
        //     //         .addItem("WebApp API Credentials", "updateWebAppCredentials")
        //     // )
        //     .addToUi();
    }

    // Add installable triggers if not already added
    const allTriggers = ScriptApp.getProjectTriggers();
    if (!allTriggers.some((t) => t.getHandlerFunction() === "onEdited")) {
        ScriptApp.newTrigger("onEdited")
            .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
            .onEdit()
            .create();
    }
}

function onEdited(e: GoogleAppsScript.Events.SheetsOnEdit) {
    const apiUrl = PropertiesService.getScriptProperties().getProperty("apiUrl");
    const range = e.range;
    const sheet = range.getSheet();
    // TODO: Move all "onEdited" logic into separate classes for each sheet (eg. Review "onEdit" is handled separately to Latest "onEdit")
    const dataSheet = convertToDataSheet(sheet);

    // Another sheet is being edited
    if (!dataSheet) {
        return;
    }
    const firstRow = dataSheet.convertToDataRowNum(range.getRowIndex());
    const lastRow = dataSheet.convertToDataRowNum(range.getRowIndex() + range.getNumRows() - 1);
    const edited = dataSheet.read((values: unknown[], index: number) => (index + 1) >= firstRow && (index + 1) <= lastRow);

    if (apiUrl && edited.length > 0) {
        const type = "cards";
        const url = `${apiUrl}/${type}`;
        const options = {
            method: "post",
            headers: {
                Authorization: `Basic ${Utilities.base64Encode("patane97:qwerty123")}`
            },
            contentType: "application/json",
            payload: JSON.stringify({
                project: SpreadsheetHandler.fetchProjectSettings(),
                cards: edited
            })
        } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

        const response = UrlFetchApp.fetch(url, options);

        const json = JSON.parse(response.getContentText());

        Log.information(`Successfully updated ${json.updated} ${type}s.`);
    }
    // TODO: Add a buffer of 10 seconds (eg. send edits in batch after no edits within 10s)
}

function convertToDataSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
    switch (sheet.getName()) {
        case "Latest Cards":
            return dataSheets.latest();
        case "Archived Cards":
            return dataSheets.archive();
        case "Archived Reviews":
            return dataSheets.review();
    }
    return null;
}

export type AvailableSheetTypes = "archive" | "latest";
class SpreadsheetHandler {
    static createCards({ types, create }: { types?: AvailableSheetTypes[], create: string[][] }) {
        types = types || ["archive", "latest"];

        let total = 0;
        if (types.includes("latest")) {
            total += dataSheets.latest().create(create);
        }
        if (types.includes("archive")) {
            total += dataSheets.archive().create(create);
        }

        return total;
    }

    /**
     * Fetch cards (by Card Number) from Google App Script spreadsheet
     * @param type Either "latest", "archive" or undefined. If undefined, will get all cards (latest + archive) of that number
     * @param numbers Card numbers to fetch
     * @returns Array of serialized card values
     */
    static readCards({ types, read }: { types?: AvailableSheetTypes[], read?: CardId[] }) {
        types = types || ["archive", "latest"];
        const cards: string[][] = [];
        const filterFunc = read ? (values: unknown[], index: number) => read.some((id) => cardIdFunc(values, index, id)) : () => true;
        if (types.includes("latest")) {
            cards.push(...dataSheets.latest().read(filterFunc));
        }
        if (types.includes("archive")) {
            cards.push(...dataSheets.archive().read(filterFunc));
        }

        return cards;
    }

    /**
     * Update cards (by serialized card values) to Google App Script spreadsheet
     * @param type Either "latest" or "archive". Defaults to "latest"
     * @param cards Card values to update. Uses the column defined in "Column.Number" to match spreadsheet data
     */
    static updateCards({ types, update }: { types?: AvailableSheetTypes[], update: { id: CardId, values: string[] }[] }) {
        types = types || ["archive", "latest"];

        let total = 0;
        if (types.includes("latest")) {
            total += dataSheets.latest().update(update);
        }
        if (types.includes("archive")) {
            total += dataSheets.archive().update(update);
        }

        return total;
    }
    static destroyCards({ types, destroy }: { types?: AvailableSheetTypes[], destroy: CardId[] }) {
        types = types || ["archive", "latest"];
        const filterFunc = (values: unknown[], index: number) => destroy.some((id) => cardIdFunc(values, index, id));

        let total = 0;
        if (types.includes("latest")) {
            total += dataSheets.latest().delete(filterFunc);
        }
        if (types.includes("archive")) {
            total += dataSheets.archive().delete(filterFunc);
        }

        return total;
    }

    static fetchProjectSettings() {
        return Settings.getProperties(GooglePropertiesType.Script);
    }
}

// function finalizeChanges() {
//   // TODO
// }

// function archivePlaytestingUpdateCards() {
//   const data = Data.instance;
//   data.archivePlaytestingUpdateCards();
// }

// function openJSONDevDialog() {
//   const data = Data.instance;
//   const pack = data.getDevelopmentPack();
//   const json = JSON.stringify(pack.toJSON(), null, 4);

//   const htmlTemplate = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Clipboard Popup");
//   htmlTemplate.instructions = `Copy + Paste the following into the <strong>${pack.code}.json</strong> file in the <strong>development-${data.project.short}</strong> branch of <strong>throneteki-json-data</strong>`;
//   htmlTemplate.text = json;

//   UIHelper.openDialogWindow(pack.code + " exported as JSON", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
// }

// function openJSONReleaseDialog() {
//   const data = Data.instance;
//   const options = {
//     "Pack Short": {
//       type: 'select',
//       options: data.latestCards.map(c => c.development.final?.packShort).filter((pc, index, self) => pc && self.indexOf(pc) === index)
//     },
//     "Full Pack Name": undefined,
//     "Release Date": {
//       type: 'date'
//     }
//   }
//   const packData = UIHelper.openMultiWindow(options, "Provide Release Data", undefined, undefined, "Generate");
//   const name = packData["Full Pack Name"];
//   const short = packData["Pack Short"];
//   const code = Data.instance.project.code;
//   const type = ProjectType.Pack;
//   const releaseDate = new Date(packData["Release Date"]);

//   const cards = data.latestCards.filter(card => card.development.final?.packCode === short);

//   const pack = data.getReleasePack(cards, code, short, name, type, releaseDate);

//   const errors = pack.validate();

//   const json = JSON.stringify(pack.toJSON(), null, 4);

//   const htmlTemplate = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Clipboard Popup");
//   htmlTemplate.instructions = `Copy + Paste the following into the <strong>${pack.code}.json</strong> file into the appropriate branch within <strong>throneteki-json-data</strong>`;
//   if(errors.length > 0) {
//     htmlTemplate.instructions += `\n\nNote: The following errors were found:\n- ${errors.join('\n- ')}`;
//   }
//   htmlTemplate.text = json;

//   UIHelper.openDialogWindow(pack.code + " exported as JSON", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
// }

// function openPDFSheetsDialog() {
//   const data = Data.instance;

//   const allPdf = PDFAPI.syncLatestPhysicalPDFSheet();
//   const updatedPdf = PDFAPI.syncUpdatedPhysicalPDFSheet();

//   const htmlTemplate = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Clipboard Popup");
//   htmlTemplate.instructions = "Print PDF sheets to physically playtest!";
//   htmlTemplate.text = "All Cards:\n" + allPdf;
//   if (updatedPdf) {
//     htmlTemplate.text += "\nUpdated Cards:\n" + updatedPdf;
//   }

//   UIHelper.openDialogWindow(data.project.short + " PDF Sheets (v" + data.project.version.toString() + ")", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
// }

// function openUpdateNotesDialog() {
//   // TODO
// }

// function editScriptProperties() {
//   Settings.editProperties(GooglePropertiesType.Script);
// }
// function editDocumentProperties() {
//   Settings.editProperties(GooglePropertiesType.Document);
// }
// function editUserProperties() {
//   Settings.editProperties(GooglePropertiesType.User);
// }

export {
    SpreadsheetHandler,
    onEdited,
    onSpreadsheetOpen
};