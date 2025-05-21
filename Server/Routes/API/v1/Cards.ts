import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import Card from "@/Server/Data/Models/Card";
import { inc } from "semver";
import { dataService, logger, renderService } from "@/Server/Services";
import { SemanticVersion, Utils } from "@/Common/Utils";
import { Cards } from "@/Common/Models/Cards";

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
            Joi.array().items(Joi.string().regex(Utils.Regex.Card.id.optional)),
            Joi.string().regex(Utils.Regex.Card.id.optional)
        ),
        copies: Joi.number().default(3),
        perPage: Joi.number().default(9)
    }
}), asyncHandler(async (req, res) => {
    const projectId = req.params.project as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const ids = !req.query.id ? undefined : (Array.isArray(req.query.id) ? req.query.id as string[] : [req.query.id as string]);
    const copies = req.query.copies as unknown as number;
    const perPage = req.query.perPage as unknown as number;

    const matchers = ids ? ids.map((id) => {
        const [number, version] = id.split("@");
        return { projectId, number: parseInt(number), ...(version && { version: version as SemanticVersion }) };
    }) : [{ projectId }];
    const cards = await dataService.cards.read({ matchers, hard });

    switch (format) {
        case "JSON":
            const json = cards.map((card) => card.toJSON());
            res.json(json);
            break;
        case "HTML":
            const html = await renderService.asHtml("Batch", cards, { copies, perPage });
            res.send(html);
            break;
        case "PDF":
            const pdf = await renderService.asPDF(cards, { copies, perPage });
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
    const projectId = req.params.project as unknown as number;
    const number = req.params.number as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const version = req.query.version ? req.query.version as SemanticVersion : undefined;

    const [card] = await dataService.cards.read({ matchers: [{ projectId, number, ...(version && { version }) }], hard });

    switch (format) {
        case "JSON":
            const json = card?.toJSON();
            res.json(json);
            break;
        case "HTML":
            const html = await renderService.asHtml("Single", card);
            res.send(html);
            break;
        case "PNG":
            const png = (await renderService.asPNG([card])).shiftBuffer();
            res.type("png");
            res.send(png);
            break;
        default:
            throw Error(`"${req.query.format as string}" not implemented yet`);
    }
}));

router.post("/", celebrate({
    [Segments.BODY]: Joi.array().items(Card.playtestingSchema)
}), asyncHandler(async (req, res) => {
    const forced = req.query.forced as unknown as boolean;
    const cards = await Card.fromModels(...req.body as Cards.Model[]);

    const incType = (type: Cards.NoteType) => {
        switch (type) {
            case "Replaced": return "major";
            case "Reworked": return "minor";
            case "Updated": return "patch";
        }
    };
    logger.verbose(`Recieved ${cards.length} card update(s) from sheets`);
    const latest: Card[] = [];
    const upsert: Card[] = [];
    const destroy: Cards.Matcher[] = [];

    for (const card of cards) {
        // If card is not in playtesting, push updates
        if (!card.playtesting) {
            upsert.push(card);
        }

        // If card is currently being drafted (eg. edited)
        if (forced || card.isReleasable || card.isDraft) {
            const expectedVersion = card.note ? inc(card.playtesting, incType(card.note.type)) : card.version;
            // If it's version has not been incremented, increment it, and push new id card to database/archive
            if (card.version !== expectedVersion) {
                const newCard = card.clone();
                // Latest needs old "_id" to properly update, whilst archive & database need new "_id" to properly insert
                card.version = newCard.version = inc(card.playtesting, incType(card.note.type)) as SemanticVersion;
                newCard._id = `${newCard.code}@${newCard.version}`;
                upsert.push(newCard);
            } else {
                upsert.push(card);
            }
            // Either way, push changes to latest to properly sync
            latest.push(card);
        }
        // If versions do not match (and is not in draft), then a draft has been reverted, and thus should be deleted in database/archive, and version reverted in latest
        else if (card.version !== card.playtesting) {
            destroy.push({ projectId: card.project._id, number: card.number, version: card.version });
            card.version = card.playtesting;
            latest.push(card);
        }
    }

    await dataService.cards.update({ cards: upsert, upsert: true });
    if (destroy.length > 0) {
        await dataService.cards.destroy({ matchers: destroy });
    }
    await dataService.cards.spreadsheet.update({ cards: latest, sheets: ["latest"] });

    res.send({
        updated: upsert.length + latest.length,
        deleted: destroy.length
    });
}));

export default router;