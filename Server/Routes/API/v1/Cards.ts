import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import { logger, service } from "../../..";
import Project from "@/Server/Data/Models/Project";
import Card from "@/Server/Data/Models/Card";
import { CardId } from "@/Common/CardSheetInfo";

export type ResourceFormat = "JSON" | "HTML" | "TXT" | "PNG" | "PDF";

const router = express.Router();

/**
 * Fetch a range of cards from a specific project, in a format (defaults to JSON)
 */
router.get("/:project", celebrate({
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid("JSON", "HTML", "PDF", "TXT").default("JSON"),
        hard: Joi.boolean().default(false),
        id: Joi.alternatives().try(
            Joi.array().items(Joi.string().regex(CardId.format)),
            Joi.string().regex(CardId.format)
        ),
        copies: Joi.number().default(3),
        perPage: Joi.number().default(9)
    }
}), asyncHandler(async (req, res) => {
    const projectShort = req.params.project;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const ids = !req.query.id ? undefined : (Array.isArray(req.query.id) ? req.query.id : [req.query.id]).map((id) => CardId.deserialize(id as string));
    const copies = req.query.copies as unknown as number;
    const perPage = req.query.perPage as unknown as number;

    const cards = await service.data.cards.read({ ids, projectShort, hard });

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
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid("JSON", "HTML", "PNG", "TXT").default("JSON"),
        hard: Joi.boolean().default(false),
        version: Joi.string().regex(/^\d+.\d+.\d+$/)
    }
}), asyncHandler(async (req, res) => {
    const projectShort = req.params.project;
    const number = parseInt(req.params.number);
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const version = req.query.version as string | undefined;

    const ids = [new CardId(number, version)];
    const cards = await service.data.cards.read({ projectShort, hard, ids });
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

// TODO: Add celebrate validation
router.post("/", asyncHandler(async (req, res) => {
    const project = Project.deserialise(req.body.project);
    const rawCards = req.body.cards as unknown[][];
    const cards = rawCards.map((rawCard) => Card.deserialise(project, rawCard));

    const result = await service.data.cards.database.update({ projectShort: project.short, values: cards });
    logger.info(`Card update recieved from ${project.short} spreadsheet: ${result.insertedCount} added, ${result.modifiedCount} updated`);
    res.send({
        added: result.insertedCount,
        updated: result.modifiedCount
    });
}));

export default router;