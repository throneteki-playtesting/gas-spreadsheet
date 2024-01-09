import { BatchType } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Card } from "../DataLayer/Models/Card";
import { Project, SemanticVersion } from "../DataLayer/Models/Project";
import { Settings } from "../DataLayer/Settings";
import { HTMLRenderEngine } from "./HTMLRenderEngine";

class PDFAPI {
  static generateSheet(project: Project, cards: Card[], fileName: string, sandbox = false): string {
    const url = "https://api.pdfshift.io/v3/convert/pdf";
    const baseFolder = "s3://agot-playtesting/printing";
    const apiKey = Settings.getProperty(GooglePropertiesType.User, 'pdf_apiKey');

    const html = HTMLRenderEngine.batch(project, cards);

    const payload = {
      source: html,
      s3_destination: `${baseFolder}/${project.short}/${fileName}.pdf`,
      sandbox, // Produces a sandbox/test image (watermarked & does not count to monthly total)
      delay: 1000
    };


    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      payload: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Utilities.base64Encode(`api:${apiKey}`)}`
      }
    };

    const response = UrlFetchApp.fetch(url, params);
    const json = JSON.parse(response.getContentText());
    return json.url;
  }

  static getFileName(short: string, version: SemanticVersion, type: BatchType) {
    return (short + "_Playtesting_Sheet_v" + version.toString() + "_" + BatchType[type].toLowerCase()).replace(/\./g, "_");
  }

  static syncUpdatedPhysicalPDFSheet(sandbox = false) {
    const data = Data.instance;
    // Only fetch completed cards which are updated from a previous version
    const changedCards = data.getChangedCards();
    let updatedPdfUrl = PropertiesService.getDocumentProperties().getProperty("pdf_updated");
    const newFileName = PDFAPI.getFileName(data.project.short, data.project.version, BatchType.Updated);

    if (changedCards.length > 0 && !updatedPdfUrl?.includes(newFileName)) {
      const generatedPdfUrl = PDFAPI.generateSheet(data.project, changedCards, newFileName, sandbox);
      updatedPdfUrl = generatedPdfUrl;
      PropertiesService.getDocumentProperties().setProperty("pdf_updated", updatedPdfUrl);
    }

    return updatedPdfUrl;
  }
  static syncLatestPhysicalPDFSheet(sandbox = false) {
    const data = Data.instance;
    let latestPdfUrl = PropertiesService.getDocumentProperties().getProperty("pdf_all");
    const newFileName = PDFAPI.getFileName(data.project.short, data.project.version, BatchType.All);

    // If either any cards are updated, or there is no initial PDF, and if there is a PDF, it's an outdated name
    if (((data.getChangedCards().length > 0 || !latestPdfUrl) && !latestPdfUrl?.includes(newFileName))) {
      const generatedPdfUrl = PDFAPI.generateSheet(data.project, data.latestCards, newFileName, sandbox);
      latestPdfUrl = generatedPdfUrl;
      PropertiesService.getDocumentProperties().setProperty("pdf_all", latestPdfUrl);
    }

    return latestPdfUrl;
  }
}

function syncUpdatedPhysicalPDFSheet(sandbox = false) {
  PDFAPI.syncUpdatedPhysicalPDFSheet(sandbox);
}

function syncLatestPhysicalPDFSheet(sandbox = false) {
  PDFAPI.syncLatestPhysicalPDFSheet(sandbox);
}

export { PDFAPI }