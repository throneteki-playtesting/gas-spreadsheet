import { Card } from "../DataLayer/Models/Card";
import { Project } from "../DataLayer/Models/Project";
import { Settings } from "../DataLayer/Settings";
import { HtmlHelper } from "./Helpers";

class PDFAPI {
  static generateSheet(project: Project, cards: Card[], fileName: string, sandbox = false) {
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
}

export { PDFAPI }