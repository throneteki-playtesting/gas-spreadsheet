import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import { getEnumName, ResourceFormat } from "../../../../Common/Enums";
import { CardId } from "../../../../GoogleAppScript/Spreadsheets/CardInfo";
import { service } from "../../..";

const router = express.Router();

/**
 * Fetch a range of cards from a specific project, in a format (defaults to JSON)
 */
router.get("/:project", celebrate({
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid(...Object.keys(ResourceFormat)).default(getEnumName(ResourceFormat, ResourceFormat.JSON)),
        refresh: Joi.boolean().default(false),
        id: Joi.alternatives().try(
            Joi.array().items(Joi.string().regex(CardId.format)),
            Joi.string().regex(CardId.format)
        )
    }
}), asyncHandler(async (req, res) => {
    const projectShort = req.params.project;
    const format = ResourceFormat[req.query.format as string];
    const refresh = req.query.refresh as unknown as boolean;
    const ids = !req.query.id ? undefined : (Array.isArray(req.query.id) ? req.query.id : [req.query.id]).map((id) => CardId.deserialize(id as string));

    const cards = await service.data.readCards({ ids, projectShort, refresh });

    switch (format) {
        case ResourceFormat.JSON:
            const json = cards.map((card) => card.toJSON());
            res.json(json);
            break;
        case ResourceFormat.HTML:
            const options = {
                copies: req.query.copies ? parseInt(req.query.copies as string) : 3,
                perPage: req.query.perPage ? parseInt(req.query.perPage as string) : 9
            };
            const html = service.rendering.batch(cards, options);
            res.send(html);
            break;
        case ResourceFormat.TEXT:
            throw Error("Not Implemented Yet");
    }
}));

/**
 * Fetch a specific card from a specific project, in a format (defaults to JSON)
 */
router.get("/:project/:number", celebrate({
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid(...Object.keys(ResourceFormat)).default(getEnumName(ResourceFormat, ResourceFormat.JSON)),
        refresh: Joi.boolean().default(false),
        version: Joi.string().regex(/^\d+.\d+.\d+$/)
    }
}), asyncHandler(async (req, res) => {
    const projectShort = req.params.project;
    const number = parseInt(req.params.number);
    const format = ResourceFormat[req.query.format as string];
    const refresh = req.query.refresh as unknown as boolean;
    const version = req.query.version as string | undefined;

    const ids = [new CardId(number, version)];
    const cards = await service.data.readCards({ projectShort, refresh, ids });
    const card = cards.shift();

    switch (format) {
        case ResourceFormat.JSON:
            res.json(card?.toJSON());
            break;
        case ResourceFormat.HTML:
            res.send(service.rendering.single(card));
            break;
        case ResourceFormat.TEXT:
            throw Error("Not Implemented Yet");
    }
}));

export default router;