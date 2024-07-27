import config from "config";
import express from "express";
import partials from "express-partials";
import RenderingService, { BatchOptions } from "./Rendering/RenderingService";
import { ResourceFormat } from "../Common/Enums";
import DiscordService from "./Discord/DiscordService";
import DataService from "./Data/DataService";
import ImageService from "./Rendering/ImageService";
import { getQueryArray, getQuerySingle } from "../Common/Utils";
import { CardId } from "../GoogleAppScript/Spreadsheets/CardInfo";

const env = process.env.NODE_ENV || "development";

// Establish services
export const service = {
    data: new DataService(env, config.get("database.url"), config.get("google.clientEmail"), config.get("google.privateKey"), config.get("projects")),
    rendering: new RenderingService(),
    imaging: new ImageService(config.get("htmlcsstoimage.apiKey"), config.get("htmlcsstoimage.userId")),
    discord: new DiscordService(env, config.get("discord.token"), config.get("discord.clientId"))
};

const app = express();
// Add middleware
app.use(partials());
app.use(express.static("public"));

/**
 * Request should fetch a specific card from a specific project, in a format (defaults to JSON)
 */
app.get("/:project/card/:number", async (req, res) => {
    try {
        const format = req.query.format ? ResourceFormat[getQuerySingle(req.query.format as string | string[]).toUpperCase()] : ResourceFormat.JSON;
        const refresh = req.query.refresh ? getQuerySingle(req.query.format as string | string[]).toLowerCase() === "true" : false;
        const versions = req.query.version ? getQueryArray(req.query.version as string | string[]) : undefined;
        const number = parseInt(req.params.number);

        const ids = versions ? versions.map((version) => new CardId(number, version)) : [new CardId(number)];
        const cards = await service.data.readCards({ projectShort: req.params.project, refresh, ids });
        const card = cards.shift();
        switch (format) {
            case ResourceFormat.JSON:
                return res.json(card.toJSON());
            case ResourceFormat.HTML:
                return res.send(service.rendering.single(card));
            case ResourceFormat.TEXT:
                throw Error("Not Implemented Yet");
            default:
                throw Error(`Invalid format of "${format}"`);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json(err.message);
    }
});

/**
 * Request should fetch a range of cards from a specific project, in a format (defaults to JSON)
 */
app.get("/:project/cards", async (req, res) => {
    try {
        const format = req.query.format ? ResourceFormat[(req.query.format as string).toUpperCase()] : ResourceFormat.JSON;
        const refresh = req.query.refresh ? (req.query.refresh as string).toLowerCase() === "true" : false;
        const ids = req.query.ids ? getQueryArray(req.query.ids as string | string[]).map((id) => CardId.deserialize(id)) : undefined;

        const cards = await service.data.readCards({ ids, projectShort: req.params.project, refresh });

        switch (format) {
            case ResourceFormat.JSON:
                const json = cards.map((card) => card.toJSON());
                return res.json(json);
            case ResourceFormat.HTML:
                const options: BatchOptions = {
                    copies: req.query.copies ? parseInt(req.query.copies as string) : 3,
                    perPage: req.query.perPage ? parseInt(req.query.perPage as string) : 9
                };
                const html = service.rendering.batch(cards, options);
                return res.send(html);
            case ResourceFormat.TEXT:
                throw Error("Not Implemented Yet");
            default:
                throw Error(`Invalid format of "${format}"`);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json(err.message);
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});