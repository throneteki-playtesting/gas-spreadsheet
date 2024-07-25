import { GooglePropertiesType, Settings } from "../Settings.js";
import { CardIdentifier } from "./CardInfo.js";
import { DataSheetFactory } from "./Data.js";
import { UIHelper } from "./UserInput.js";

function onSpreadsheetOpen() {
    const ui = UIHelper.safelyGet();
    if (ui) {
        ui.createMenu("Admin Tools")
            .addSubMenu(
                ui.createMenu("Development")
                    .addSubMenu(
                        ui.createMenu("Finalize Dev Update")
                            .addItem("1. Sync Github Issues", "finalizeIssues")
                            .addItem("2. Sync Pull Requests", "finalizePullRequest")
                            .addItem("3. Generate JSON Data", "openJSONDevDialog")
                            .addItem("4. Generate Update Notes (Unimplemented)", "openUpdateNotesDialog")
                            .addItem("5. Archive Cards", "archivePlaytestingUpdateCards")
                            .addItem("6. Increment Project Version", "incrementProjectVersion")
                    )
                    .addSubMenu(
                        ui.createMenu("Individual Tasks")
                            .addItem("Generate JSON Data", "openJSONDevDialog")
                            .addItem("Sync Reviews", "syncReviews")
                            .addItem("Sync Github Issues", "syncIssues")
                            .addItem("Sync Pull Requests", "syncPullRequests")
                            .addItem("Archive Cards", "archivePlaytestingUpdateCards")
                            .addItem("Update Form Cards", "updateFormCards")
                            .addItem("Increment Project Version", "incrementProjectVersion")
                            .addSubMenu(
                                ui.createMenu("Generate Card Images")
                                    .addItem("All Digital Images (PNG)", "syncDigitalCardImages")
                                    .addItem("Some Digital Images (PNG)", "syncSomeDigitalCardImages")
                                    .addItem("Print Sheet (PDF)", "openPDFSheetsDialog")
                            )
                            .addItem("Generate Update Notes", "openUpdateNotesDialog")
                            .addItem("Test", "testMulti")
                    ).addSubMenu(
                        ui.createMenu("Edit Stored Data")
                            .addItem("Script Data", "editScriptProperties")
                            .addItem("Document Data", "editDocumentProperties")
                            .addItem("User Data", "editUserProperties")
                    )
            ).addSubMenu(
                ui.createMenu("Release Tools")
                    .addItem("Validate & Export JSON", "openJSONReleaseDialog")
            ).addToUi();
    }
}

export type AvailableSheetTypes = "archive" | "latest";

export class SpreadsheetHandler {
    static createCards(options: { types: AvailableSheetTypes[], create: string[][] }) {
        options.types = options.types || ["archive", "latest"];

        let total = 0;
        if (options.types.includes("latest")) {
            total += DataSheetFactory.latest().create(...options.create);
        }
        if (options.types.includes("archive")) {
            total += DataSheetFactory.archive().create(...options.create);
        }

        return total;
    }

    /**
     * Fetch cards (by Card Number) from Google App Script spreadsheet
     * @param type Either "latest", "archive" or undefined. If undefined, will get all cards (latest + archive) of that number
     * @param numbers Card numbers to fetch
     * @returns Array of serialized card values
     */
    static readCards(options: { types: AvailableSheetTypes[], read: CardIdentifier[] }) {
        options.types = options.types || ["archive", "latest"];

        const cards: string[][] = [];
        if (options.types.includes("latest")) {
            cards.concat(DataSheetFactory.latest().read(...options.read));
        }
        if (options.types.includes("archive")) {
            cards.concat(DataSheetFactory.archive().read(...options.read));
        }

        return cards;
    }

    /**
     * Update cards (by serialized card values) to Google App Script spreadsheet
     * @param type Either "latest" or "archive". Defaults to "latest"
     * @param cards Card values to update. Uses the column defined in "Column.Number" to match spreadsheet data
     */
    static updateCards(options: { types?: AvailableSheetTypes[], update: { id: CardIdentifier, values: string[] }[] }) {
        options.types = options.types || ["archive", "latest"];

        let total = 0;
        if (options.types.includes("latest")) {
            total += DataSheetFactory.latest().update(...options.update);
        }
        if (options.types.includes("archive")) {
            total += DataSheetFactory.archive().update(...options.update);
        }

        return total;
    }
    static deleteCards(options: { types?: AvailableSheetTypes[], delete: CardIdentifier[] }) {
        options.types = options.types || ["archive", "latest"];

        let total = 0;
        if (options.types.includes("latest")) {
            total += DataSheetFactory.latest().delete(...options.delete);
        }
        if (options.types.includes("archive")) {
            total += DataSheetFactory.archive().delete(...options.delete);
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
    onSpreadsheetOpen
//   finalizeChanges,
//   archivePlaytestingUpdateCards,
//   openJSONDevDialog,
//   openPDFSheetsDialog,
//   openUpdateNotesDialog
};