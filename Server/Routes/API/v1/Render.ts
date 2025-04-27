import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import Card from "@/Server/Data/Models/Card";
import { Cards } from "@/Common/Models/Cards";
import { renderService } from "@/Server/Services";

export type ResourceFormat = "JSON" | "HTML" | "TXT" | "PNG" | "PDF";

const router = express.Router();

router.post("/", celebrate({
    [Segments.QUERY]: {
        format: Joi.string().insensitive().valid("JSON", "HTML", "PDF", "PNG").default("PNG")
    },
    // TODO: Update API schema to match the JSON API schema (eg. "martell" instead of "House Martell")
    [Segments.BODY]: Joi.alternatives(Joi.object(Card.schema), Joi.array().items(Card.schema))
}), asyncHandler(async (req, res) => {
    const format = req.query.format as ResourceFormat;

    const isArray = Array.isArray(req.body);
    const cards = await Card.fromModels(...(isArray ? req.body : [req.body]) as Cards.Model[]);

    switch (format) {
        case "JSON": {
            const json = cards.map((card) => card.toJSON());
            res.json(isArray ? json : json[0]);
        }
        case "HTML": {
            const html = await renderService.asHtml(isArray ? "Batch" : "Single", cards);
            res.send(html);
        }
        case "PDF": {
            const pdf = await renderService.asPDF(cards);
            res.contentType("application/pdf");
            res.send(pdf);
        }
        case "PNG": {
            if (isArray) {
                throw Error("Cannot create PNG with multiple cards provided");
            }
            const png = (await renderService.asPNG(cards)).shiftBuffer();
            res.type("png");
            res.send(png);
        }
    }
}));

export default router;