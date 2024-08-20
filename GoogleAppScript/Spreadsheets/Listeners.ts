import { API } from "../API";
import { DataSheet } from "./DataSheets";
import { UIHelper } from "./UserInput";

// Listeners for Triggers to pick up
function onEdited(e: GoogleAppsScript.Events.SheetsOnEdit) {
    return Trigger.edit(e);
}
function onOpen(e: GoogleAppsScript.Events.SheetsOnOpen) {
    return Trigger.open(e);
}

// Other listeners
function postProjectDetails() {
    return API.postProjectDetails();
}
function setAPIKey() {
    return API.setAPIKey();
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Trigger {
    export function edit(e: GoogleAppsScript.Events.SheetsOnEdit) {
        const sheet = e.range.getSheet();
        const dataSheet = Array.from(DataSheet.sheets.values()).find((ds) => ds.isFor(sheet));
        if (dataSheet) {
            dataSheet.onEdit(e);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    export function open(e: GoogleAppsScript.Events.SheetsOnOpen) {
        // Add UI (if able)
        const ui = UIHelper.safelyGet();
        if (ui) {
            ui.createMenu("Admin Tools")
                .addItem("Set API key", "setAPIKey")
                .addItem("Initialise/Sync Project", "postProjectDetails")
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
                .addToUi();
        }
    }
}

export {
    Trigger,
    onEdited,
    onOpen,
    postProjectDetails,
    setAPIKey
};