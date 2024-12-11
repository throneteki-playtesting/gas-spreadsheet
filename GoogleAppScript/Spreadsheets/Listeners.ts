import { API } from "../API";
import { Log } from "../CloudLogger";
import { Forms } from "../Forms/Form";
import { GooglePropertiesType, Settings } from "../Settings";
import { DataSheet } from "./DataSheets";
import { UIHelper } from "./UserInput";

// Simple Triggers (does not need additional setup)
function onOpen(e: GoogleAppsScript.Events.SheetsOnOpen) {
    return Trigger.open(e);
}

// Complex Triggers (requires setup on Apps Script end)
function onEdited(e: GoogleAppsScript.Events.SheetsOnEdit) {
    return Trigger.edit(e);
}
function onFormSubmit(e: GoogleAppsScript.Events.FormsOnFormSubmit) {
    return Trigger.submit(e);
}

// Other listeners
function initialiseProject() {
    // Setup complex triggers (only if not already existing)
    const existing = ScriptApp.getProjectTriggers();
    if (!existing.some((trigger) => trigger.getHandlerFunction() === "onFormSubmit")) {
        ScriptApp.newTrigger("onFormSubmit")
            .forForm(Settings.getProperty(GooglePropertiesType.Script, "formId"))
            .onFormSubmit()
            .create();
    }
    if (!existing.some((trigger) => trigger.getHandlerFunction() === "onEdited") && SpreadsheetApp.getActiveSpreadsheet()) {
        ScriptApp.newTrigger("onEdited")
            .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
            .onEdit()
            .create();
    }
    return API.postProjectDetails();
}
function setAPIKey() {
    return API.setAPIKey();
}

function processPendingEdits() {
    for (const sheet of Object.values(DataSheet.sheets)) {
        Log.information(`Manually processing pending edits for ${sheet.sheet.getName()}...`);
        sheet.processPendingEdits();
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Trigger {
    export function edit(e: GoogleAppsScript.Events.SheetsOnEdit) {
        const sheet = e.range.getSheet();
        const dataSheet = Array.from(Object.values(DataSheet.sheets)).find((ds) => ds.isFor(sheet));
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
                .addItem("Initialise/Sync Project", "initialiseProject")
                .addItem("Push spreadsheet changes", "processPendingEdits")
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

    export function submit(e: GoogleAppsScript.Events.FormsOnFormSubmit) {
        Forms.submit(e.response);
    }
}

export {
    Trigger,
    onOpen,
    onEdited,
    onFormSubmit,
    initialiseProject,
    setAPIKey,
    processPendingEdits
};