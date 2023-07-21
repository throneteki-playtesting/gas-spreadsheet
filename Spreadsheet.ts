import { Forms } from "./Forms/Form";
import { Github } from "./Github/Github";
import { Data } from "./DataLayer/Data";
import { Settings } from "./DataLayer/Settings";
import { PDFAPI } from "./Image APIs/PdfAPI";

function onSpreadsheetOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Admin Tools")
    .addSubMenu(
      ui.createMenu("Development")
        .addItem("Generate JSON Data", "openJSONDevDialog")
        .addItem("Finalize Changes", "finalizeChanges")
        .addSubMenu(
          ui.createMenu("Individual Tasks")
            .addItem("Sync Reviews", "syncReviews")
            .addItem("Sync Github Issues", "syncIssues")
            .addItem("Archive Completed Cards", "archiveCompletedCards")
            .addItem("Update Form Cards", "updateFormCards")
            .addItem("Increment Project Version", "incrementProjectVersion")
            .addSubMenu(
              ui.createMenu("Generate Card Images")
                .addItem("All Digital Images (PNG)", "syncDigitalCardImages")
                .addItem("Some Digital Images (PNG)", "syncSomeDigitalCardImages")
                .addItem("Print Sheet (PDF)", "openPDFSheetsDialog")
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

  const htmlTemplate = HtmlService.createTemplateFromFile("Templates/Clipboard Popup");
  htmlTemplate.instructions = `Copy + Paste the following into the <strong>${pack.code}.json</strong> file in the <strong>development-${data.project.short}</strong> branch of <strong>throneteki-json-data</strong>`;
  htmlTemplate.text = json;

  openDialogWindow(pack.code + " exported as JSON", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
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

  data.commit();
}

function syncSomeDigitalCardImages() {
  const response = SpreadsheetApp.getUi().prompt("Please list which card numbers you would like to generate for (separated by commmas).").getResponseText();
  const splitResponse = response.split(",").map(r => r.trim()).filter(r => r);

  const invalid = splitResponse.filter(r => isNaN(parseInt(r)));
  if(invalid.length > 0) {
    throw new Error("Invalid card numbers given: " + invalid.join(", "));
  }
  const numbers = splitResponse.map(r => parseInt(r));

  const data = Data.instance;
  const cards = data.latestCards.filter(card => numbers.includes(card.development.number));
  for(const card of cards) {
    card.syncImage(data.project);
  }

  data.commit();
}

function openPDFSheetsDialog() {
  const data = Data.instance;

  const allPdf = PDFAPI.syncLatestPhysicalPDFSheet();
  const updatedPdf = PDFAPI.syncUpdatedPhysicalPDFSheet();

  const htmlTemplate = HtmlService.createTemplateFromFile("Templates/Clipboard Popup");
  htmlTemplate.instructions = "Print PDF sheets to physically playtest!";
  htmlTemplate.text = "All Cards:\n" + allPdf;
  if(updatedPdf) {
    htmlTemplate.text += "\nUpdated Cards:\n" + updatedPdf;
  }

  openDialogWindow(data.project.short + " PDF Sheets (v" + data.project.version.toString() + ")", htmlTemplate.evaluate().getContent().replace(/\n\n/g, "\n"));
}

function syncUpdatedPhysicalPDFSheet() {
  PDFAPI.syncUpdatedPhysicalPDFSheet();
}

function syncLatestPhysicalPDFSheet() {
  PDFAPI.syncLatestPhysicalPDFSheet();
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
    data.commit();
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