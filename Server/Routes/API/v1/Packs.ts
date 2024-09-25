import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import { dataService } from "@/Server/Services";
import { Pack } from "@/Server/Data/Models/Pack";

const router = express.Router();

router.get("/:project/development", celebrate({
    [Segments.PARAMS]: {
        project: Joi.number().required()
    }
}), asyncHandler(async (req, res) => {
    const projectId = req.params.project as unknown as number;

    const [project] = await dataService.projects.read({ codes: [projectId] });
    const cards = (await dataService.cards.read({ matchers: [{ projectId }] })).filter((card) => !card.isReleasable);
    const developmentPack = new Pack(project.short, project.name, cards);

    res.json(developmentPack.toJSON());
}));

router.get("/:project/release", celebrate({
    [Segments.PARAMS]: {
        project: Joi.number().required()
    },
    [Segments.QUERY]: {
        short: Joi.string().required(),
        name: Joi.string().required(),
        release: Joi.date().required()
    }
}), asyncHandler(async (req, res) => {
    const projectId = req.params.project as unknown as number;
    const short = req.query.short as unknown as string;
    const name = req.query.name as unknown as string;
    const release = req.query.release as unknown as Date;

    const cards = (await dataService.cards.read({ matchers: [{ projectId }] })).filter((card) => card.release?.short === short);
    const releasePack = new Pack(short, name, cards, release);

    res.json(releasePack.toJSON());
}));

export default router;