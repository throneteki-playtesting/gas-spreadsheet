import { Forms } from "./Forms/Form";
import { Github } from "./Github/Github";
import { Data } from "./DataLayer/Data";
import { Settings } from "./DataLayer/Settings";

function onSpreadsheetOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Admin Tools")
    .addSubMenu(
      ui.createMenu("Development")
        .addItem("Generate JSON Data", "openJSONDevDialog")
        .addItem("Finalize Changes", "finalizeChanges")
        .addSubMenu(
          ui.createMenu("Individual Tasks")
            .addItem("Sync Github Issues", "syncIssues")
            .addItem("Archive Completed Cards", "archiveCompletedCards")
            .addItem("Update Form Cards", "updateFormCards")
            .addItem("Increment Project Version", "incrementProjectVersion")
            .addSubMenu(
              ui.createMenu("Generate Card Images")
                .addItem("Digital Images (PNG)", "syncDigitalCardImages")
                .addItem("Print Sheet (PDF)", "generatePhysicalSheets")
            )
            .addItem("Update Pull Request", "updatePullRequest")
            .addItem("Generate Update Notes", "openUpdateNotesDialog")
        ).addSubMenu(
          ui.createMenu("Clear Stored Data")
            .addItem("Script Data", "clearScriptProperties")
            .addItem("Document Data", "clearDocumentProperties")
            .addItem("User Data", "clearUserProperties")
        )
      // ).addSubMenu(
      // ui.createMenu("Generate New Pack")
      //   // .addItem("1. Validate Data", "TODO")
      //   // .addItem("2. Export to JSON", "TODO")
    ).addToUi();
}


function openDialogWindow(title: string, html: string, width = 600, height = 500) {
  let output = HtmlService.createHtmlOutput(html);
  output.setWidth(width);
  output.setHeight(height);

  SpreadsheetApp.getUi().showModalDialog(output, title);
}

/**
 * Generate development JSON data & present in a dialog window
 */
function openJSONDevDialog() {
  const data = Data.instance;
  const pack = data.getDevelopmentPack();
  const json = JSON.stringify(pack.toJSON(), null, 4);

  const htmlTemplate = HtmlService.createTemplateFromFile("Clipboard Popup");
  htmlTemplate.instructions = `Copy + Paste the following into the <strong>${pack.code}.json</strong> file in the <strong>development-${data.project.short}</strong> branch of <strong>throneteki-json-data</strong>`;
  htmlTemplate.text = json;

  openDialogWindow(pack.code + " exported as JSON", htmlTemplate.evaluate().getContent());
}

function finalizeChanges() {
}

function archiveCompletedCards() {
  const data = Data.instance;
  data.archiveCompletedUpdates();
}

function updateFormCards() {
  Forms.updateFormCards();
}

function syncDigitalCardImages() {
  const data = Data.instance;
  for(const card of data.latestCards) {
    card.syncImage(data.project);
  }

  data.sync();
}

function generatePhysicalSheets() {

  // const updatedCards = updated || DataHandler.getInstance().updatingCards;

  // const data = DataHandler.getInstance();
  // data.project.latestPDFs.all = CardImages.getPDFSheetUrl(data.project, data.latestCards, (data.project.short + "_Playtesting_Sheet_v" + data.project.playtestVersion.toString() + "_all").replace(".", "_"), true);
  // if (updatedCards.length > 0) {
  //   data.project.latestPDFs.changed = CardImages.getPDFSheetUrl(data.project, updatedCards, (data.project.short + "_Playtesting_Sheet_v" + data.project.playtestVersion.toString() + "_changed").replace(".", "_"), true);

  //   return data.project.latestPDFs;
  // }
  // return null;
}

function openUpdateNotesDialog() {
  // TODO
}

function syncPullRequests() {
  // TODO
}

function syncIssues() {
  const data = Data.instance;

  if(Github.syncIssues(data.project, data.latestCards)) {
    data.sync();
  }
}

function clearScriptProperties() {
  Settings.clearScriptProperties();
}
function clearDocumentProperties() {
  Settings.clearDocumentProperties();
}
function clearUserProperties() {
  Settings.clearUserProperties();
}