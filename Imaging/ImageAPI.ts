import { Log } from "../Common/Logger";
import { Data } from "../DataLayer/Data";
import { Settings } from "../DataLayer/Settings";
import { UIHelper } from "../Spreadsheet/Spreadsheet";
import { HTMLRenderEngine } from "./HTMLRenderEngine";

class ImageAPI {
  static generateCard(project: any, card: any) {
    Log.verbose("Generating new image for " + card.toString() + "...");
    const url = "https://hcti.io/v1/image";
    const apiKey = Settings.getProperty(GooglePropertiesType.User, 'image_apiKey');
    const userId = Settings.getProperty(GooglePropertiesType.User, 'image_userId');

    const html = HTMLRenderEngine.single(project, card);

    const payload = {
      html,
      device_scale: 1.25, // Scaling better for ThronesDB & TiT image sizes
      ms_delay: 1000,
      selector: "body"
    };

    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      payload: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Utilities.base64Encode(`${userId}:${apiKey}`)}`
      }
    };
    const response = UrlFetchApp.fetch(url, params);
    const json = JSON.parse(response.getContentText());
    Log.verbose("Successfully generated image: " + json.url);
    return json.url;
  }
}

function syncDigitalCardImages() {
  const data = Data.instance;
  for (const card of data.latestCards) {
    card.syncImage(data.project);
  }

  data.commit();
}

function syncSomeDigitalCardImages() {
  const response = UIHelper.get().prompt("Please list which card numbers you would like to generate for (separated by commmas).").getResponseText();
  const splitResponse = response.split(",").map(r => r.trim()).filter(r => r);

  const invalid = splitResponse.filter(r => isNaN(parseInt(r)));
  if (invalid.length > 0) {
    throw new Error("Invalid card numbers given: " + invalid.join(", "));
  }
  const numbers = splitResponse.map(r => parseInt(r));

  const data = Data.instance;
  const cards = data.latestCards.filter(card => numbers.includes(card.development.number));
  for (const card of cards) {
    card.syncImage(data.project);
  }

  data.commit();
}

export { ImageAPI, syncDigitalCardImages, syncSomeDigitalCardImages }