import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import Card from "@/Server/Services/Data/Models/Card";
import { inc } from "semver";
import { CardModel, NoteType } from "@/Common/Models/Card";
import { dataService, logger, renderService } from "@/Server/Services/Services";
import { SemanticVersion, Utils } from "@/Common/Utils";

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
    const project = req.params.project as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const ids = !req.query.id ? undefined : (Array.isArray(req.query.id) ? req.query.id as string[] : [req.query.id as string]);
    const copies = req.query.copies as unknown as number;
    const perPage = req.query.perPage as unknown as number;

    const matchers = ids ? ids.map((id) => {
        const [number, version] = id.split("@");
        return { project, number: parseInt(number), version: version as SemanticVersion };
    }) : [{ project }];
    const cards = await dataService.cards.read({ matchers, hard });

    switch (format) {
        case "JSON":
            const json = cards.map((card) => card.toJSON());
            res.json(json);
            break;
        case "HTML":
            const html = renderService.asHtml("Batch", cards, { copies, perPage });
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
    const project = req.params.project as unknown as number;
    const number = req.params.number as unknown as number;
    const format = req.query.format as ResourceFormat;
    const hard = req.query.hard as unknown as boolean;
    const version = req.query.version ? req.query.version as SemanticVersion : undefined;

    const cards = await dataService.cards.read({ matchers: [{ project, number, version }], hard });
    const card = cards.shift();

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
    [Segments.BODY]: Joi.array().items(Card.schema)
}), asyncHandler(async (req, res) => {
    const cards = (req.body as CardModel[]).map(Card.fromModel);

    const incType = (type: NoteType) => {
        switch (type) {
            case "Replaced": return "major";
            case "Reworked": return "minor";
            case "Updated": return "patch";
        }
    };
    const { database, spreadsheet } = cards.reduce((data, card) => {
        // If a card is in a draft state, we do not want to update it on server.
        // We DO however want to ensure the version is being updated appropriately on spreadsheet...
        if (!!card.playtesting && card.isDraft) {
            const expectedVersion = inc(card.playtesting, incType(card.note.type));
            if (card.version !== expectedVersion) {
                const draft = card.clone();
                card.version = draft.version = inc(card.playtesting, incType(card.note.type)) as SemanticVersion;
                // Increment the id only for database insert (draft sent to spreadsheet needs old ID to update)
                card._id = `${card.number}@${card.version}`;

                data.spreadsheet.push(draft);
            }
        } else if (!!card.playtesting && card.version !== card.playtesting) {
            card.version = card.playtesting;
            data.spreadsheet.push(card);
        } else {
            data.database.push(card);
        }
        return data;
    }, { database: [], spreadsheet: [] } as { database: Card[], spreadsheet: Card[] });

    const result = await dataService.cards.database.update({ cards: database });
    if (spreadsheet.length > 0) {
        const sheetResult = await dataService.cards.spreadsheet.update({ cards: spreadsheet });
        for (const card of sheetResult) {
            const previous = spreadsheet.find((p) => card.id === `${p.number}@${p.version}`);
            if (previous) {
                logger.info(`Adjusted draft version: ${previous.id} -> ${card.id}`);
            }
        }
    }
    res.send({
        updated: result
    });
}));

export default router;