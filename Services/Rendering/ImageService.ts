import { service } from "..";
import fs from "fs";
import path from "path";
import Card from "../../Models/Card";

class ImageService {
    constructor(private apiKey: string, private userId: string) {
        // Empty
    }
    public async update(cards: Card[]) {
        for (const card of cards) {
            if (card.development.versions.current !== card.development.versions.image || !card.development.imageUrl) {
                const url = "https://hcti.io/v1/image";

                const html = service.rendering.single(card);
                const css = fs.readFileSync(path.resolve(__dirname, "../../public/css/render.css")).toString();
                const options = {
                    method: "POST",
                    body: JSON.stringify({
                        html,
                        css,
                        device_scale: 1.25,
                        ms_delay: 1000,
                        selector: "body"
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${Buffer.from(`${this.userId}:${this.apiKey}`).toString("base64")}`
                    }
                } as RequestInit;

                const response = await fetch(url, options);

                if (!response.ok) {
                    const json = await response.json() as { error: string, statusCode: number, message: string };
                    throw Error(`Failed to fetch card image from API: ${json.error} (${json.statusCode}): ${json.message}`);
                }

                const json = await response.json() as { url: string };

                card.development.imageUrl = json.url;
                card.development.versions.image = card.development.versions.current;
            }
        }
        return cards;
    }
}

// function syncDigitalCardImages() {
//     const data = Data.instance;
//     for (const card of data.latestCards) {
//         card.syncImage(data.project);
//     }

//     data.commit();
// }

// function syncSomeDigitalCardImages() {
//     const response = UIHelper.get().prompt("Please list which card numbers you would like to generate for (separated by commmas).").getResponseText();
//     const splitResponse = response.split(",").map(r => r.trim()).filter(r => r);

//     const invalid = splitResponse.filter(r => isNaN(parseInt(r)));
//     if (invalid.length > 0) {
//         throw Error("Invalid card numbers given: " + invalid.join(", "));
//     }
//     const numbers = splitResponse.map(r => parseInt(r));

//     const data = Data.instance;
//     const cards = data.latestCards.filter(card => numbers.includes(card.development.number));
//     for (const card of cards) {
//         card.syncImage(data.project);
//     }

//     data.commit();
// }

export default ImageService;