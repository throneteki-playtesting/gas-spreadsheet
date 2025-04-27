import fs from "fs";
import path from "path";
import ejs from "ejs";
import { emojis, icons, discordify } from "./Utilities";
import { fileURLToPath } from "url";

export default class ReviewPages {
    public static renderTemplate(data: ejs.Data) {
        const { template, review, ...restData } = data;
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = `${__dirname}/Templates/Reviews/${template}.ejs`;
        const file = fs.readFileSync(filePath).toString();

        const render = ejs.render(file, { filename: filePath, emojis, icons, card: review.card, project: review.project, review, ...restData });

        return discordify(render);
    }
}