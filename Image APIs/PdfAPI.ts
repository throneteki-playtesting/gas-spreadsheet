import { BatchType } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Card } from "../DataLayer/Models/Card";
import { Project, SemanticVersion } from "../DataLayer/Models/Project";
import { Settings } from "../DataLayer/Settings";
import { HtmlHelper } from "./Helpers";

class PDFAPI {
  static generateSheet(project: Project, cards: Card[], fileName: string, sandbox = false): string {
    const url = "https://api.pdfshift.io/v3/convert/pdf";
    const baseFolder = "s3://agot-playtesting/printing";
    const apiKey = Settings.getUserProperty('pdf_apiKey');

    const html = HtmlHelper.renderBatch(project, cards);

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
    return (short + "_Playtesting_Sheet_v" + version.toString() + "_" + BatchType[type].toLowerCase()).replace(".", "_");
  }

  static syncUpdatedPhysicalPDFSheet() {
    const data = Data.instance;
    const updated = data.getCompletedCards();
    let updatedPdfUrl = PropertiesService.getDocumentProperties().getProperty("pdf_updated");

    if(updated.length > 0 && !(updatedPdfUrl?.includes("v" + data.project.version.toString()))) {
      const fileName = PDFAPI.getFileName(data.project.short, data.project.version, BatchType.Updated);
      const generatedPdfUrl = PDFAPI.generateSheet(data.project, updated, fileName, true);
      updatedPdfUrl = generatedPdfUrl;
      PropertiesService.getDocumentProperties().setProperty("pdf_updated", updatedPdfUrl);
    }

    return updatedPdfUrl;
  }

  static syncLatestPhysicalPDFSheet() {
    const data = Data.instance;

    let latestPdfUrl = PropertiesService.getDocumentProperties().getProperty("pdf_all");

    if(!(latestPdfUrl?.includes("v" + data.project.version.toString()))) {
      const fileName = PDFAPI.getFileName(data.project.short, data.project.version, BatchType.All);
      const generatedPdfUrl = PDFAPI.generateSheet(data.project, data.latestCards, fileName, true);
      latestPdfUrl = generatedPdfUrl;
      PropertiesService.getDocumentProperties().setProperty("pdf_all", latestPdfUrl);
    }

    return latestPdfUrl;
  }
}

export { PDFAPI }