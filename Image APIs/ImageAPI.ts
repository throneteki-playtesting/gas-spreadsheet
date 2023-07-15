import { Settings } from "../DataLayer/Settings";
import { HTMLRenderEngine } from "./HTMLRenderEngine";

class ImageAPI {
  static generateCard(project: any, card: any) {
    const url = "https://hcti.io/v1/image";
    const apiKey = Settings.getUserProperty('image_apiKey');
    const userId = Settings.getUserProperty('image_userId');

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
    return json.url;
  }
}

export { ImageAPI }