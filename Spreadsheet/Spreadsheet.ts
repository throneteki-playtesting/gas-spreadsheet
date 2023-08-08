import { Data } from "../DataLayer/Data";
import { Settings } from "../DataLayer/Settings";
import { PDFAPI } from "../Imaging/PdfAPI";

class UIHelper {
  static get() {
    return SpreadsheetApp.getUi();
  }

  static openDialogWindow(title: string, html: string, width = 600, height = 500) {
    let output = HtmlService.createHtmlOutput(html);
    output.setWidth(width);
    output.setHeight(height);

    this.get().showModalDialog(output, title);
  }
}

function onSpreadsheetOpen() {
  const ui = UIHelper.get();
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

function finalizeChanges() {
  
}

function archivePlaytestingUpdateCards() {
  const data = Data.instance;
  data.archivePlaytestingUpdateCards();
}

function openJSONDevDialog() {
  const data = Data.instance;
  const pack = data.getDevelopmentPack();
  const json = JSON.stringify(pack.toJSON(), null, 4);

  const htmlTemplate = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Clipboard Popup");
  htmlTemplate.instructions = `Copy + Paste the following into the <strong>${pack.code}.json</strong> file in the <strong>development-${data.project.short}</strong> branch of <strong>throneteki-json-data</strong>`;
  htmlTemplate.text = json;

  UIHelper.openDialogWindow(pack.code + " exported as JSON", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
}

function openPDFSheetsDialog() {
  const data = Data.instance;

  const allPdf = PDFAPI.syncLatestPhysicalPDFSheet();
  const updatedPdf = PDFAPI.syncUpdatedPhysicalPDFSheet();

  const htmlTemplate = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Clipboard Popup");
  htmlTemplate.instructions = "Print PDF sheets to physically playtest!";
  htmlTemplate.text = "All Cards:\n" + allPdf;
  if (updatedPdf) {
    htmlTemplate.text += "\nUpdated Cards:\n" + updatedPdf;
  }

  UIHelper.openDialogWindow(data.project.short + " PDF Sheets (v" + data.project.version.toString() + ")", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
}

function openUpdateNotesDialog() {
  // TODO
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

export {
  UIHelper,
  onSpreadsheetOpen,
  finalizeChanges,
  archivePlaytestingUpdateCards,
  openJSONDevDialog,
  openPDFSheetsDialog,
  openUpdateNotesDialog,
  clearScriptProperties,
  clearDocumentProperties,
  clearUserProperties
}