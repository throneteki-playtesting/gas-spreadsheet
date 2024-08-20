import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import { logger, service } from "../../..";
import Card from "@/Server/Data/Models/Card";
import { inc } from "semver";
import { Regex, SemanticVersion } from "@/Common/Utils";
import * as Schemas from "./Schemas";
import { CardModel, NoteType } from "@/Common/Models/Card";

export type ResourceFormat = "JSON" | "HTML" | "TXT" | "PNG" | "PDF";

const router = express.Router();

/**
 * Fetch a range of cards from a specific project, in a format (defaults to JSON)
 */
router.get("/:project", celebrate({
    [Segments.PARAMS]: {
        project: Joi.number().required()
    },
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid("JSON", "HTML", "PDF", "TXT").default("JSON"),
        hard: Joi.boolean().default(false),
        id: Joi.alternatives().try(
            Joi.array().items(Joi.string().regex(Regex.Card.id.optional)),
            Joi.string().regex(Regex.Card.id.optional)
        ),
        copies: Joi.number().default(3),
        perPage: Joi.number().default(9)
    }
}), asyncHandler(async (req, res) => {
    const project = req.params.project as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const ids = !req.query.id ? undefined : (Array.isArray(req.query.id) ? req.query.id as string[] : [req.query.id as string]);
    const copies = req.query.copies as unknown as number;
    const perPage = req.query.perPage as unknown as number;

    const matchers = ids?.map((id) => {
        const [number, version] = id.split("@");
        return { project, number: parseInt(number), version: version as SemanticVersion };
    });
    const cards = await service.data.cards.read({ matchers, hard });

    switch (format) {
        case "JSON":
            const json = cards.map((card) => card.toJSON());
            res.json(json);
            break;
        case "HTML":
            const html = service.render.asHtml("Batch", cards, { copies, perPage });
            res.send(html);
            break;
        case "PDF":
            const pdf = await service.render.asPDF(cards, { copies, perPage });
            res.contentType("application/pdf");
            res.send(pdf);
            break;
        default:
            throw Error(`"${req.query.format as string}" not implemented yet`);
    }
}));

/**
 * Fetch a specific card from a specific project, in a format (defaults to JSON)
 */
router.get("/:project/:number", celebrate({
    [Segments.PARAMS]: {
        project: Joi.number().required(),
        number: Joi.number().required()
    },
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid("JSON", "HTML", "PNG", "TXT").default("JSON"),
        hard: Joi.boolean().default(false),
        version: Joi.string().regex(/^\d+.\d+.\d+$/)
    }
}), asyncHandler(async (req, res) => {
    const project = req.params.project as unknown as number;
    const number = req.params.number as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const version = req.query.version ? req.query.version as SemanticVersion : undefined;

    const cards = await service.data.cards.read({ matchers: [{ project, number, version }], hard });
    const card = cards.shift();

    switch (format) {
        case "JSON":
            res.json(card?.toJSON());
            break;
        case "HTML":
            res.send(service.render.asHtml("Single", card));
            break;
        case "PNG":
            const png = (await service.render.asPNG([card])).shiftBuffer();
            res.type("png");
            res.send(png);
            break;
        default:
            throw Error(`"${req.query.format as string}" not implemented yet`);
    }
}));

router.post("/", celebrate({
    [Segments.BODY]: Joi.array().items(Schemas.Card)
}), asyncHandler(async (req, res) => {
    const cards = req.body.cards as CardModel[] as Card[];

    const drafts: Card[] = [];
    const incType = (type: NoteType) => {
        switch (type) {
            case "Replaced": return "major";
            case "Reworked": return "minor";
            case "Updated": return "patch";
        }
    };
    for (const card of cards) {
        // If card change is being drafted, but current version is playtesting version, raise the current version appropriately
        if (card.isDraft && card.isPlaytesting) {
            card.version = inc(card.version, incType(card.note.type)) as SemanticVersion;
            drafts.push(card);
        }
    }
    const result = await service.data.cards.database.update({ cards });
    if (drafts.length > 0) {
        const sheetResult = await service.data.cards.spreadsheet.update({ cards: drafts });
        if (sheetResult) {
            logger.info(`Increased the versions of following cards:\n- ${drafts.map((card) => `${card.name} -> ${card.version}`).join("\n -")}`);
        }
    }
    res.send({
        updated: result
    });
}));

export default router;