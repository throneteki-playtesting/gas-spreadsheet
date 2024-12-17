import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import { dataService, discordService } from "@/Server/Services";
import { Reviews } from "@/Common/Models/Reviews";
import Review from "@/Server/Data/Models/Review";
import ReviewThreads from "@/Server/Discord/ReviewThreads";

const router = express.Router();

router.post("/", celebrate({
    [Segments.BODY]: Joi.array().items(Review.schema)
}), asyncHandler(async (req, res) => {
    const reviews = await Review.fromModels(...req.body as Reviews.Model[]);

    await dataService.reviews.update({ reviews, upsert: true });

    const allCreated = [];
    const allUpdated = [];
    const allFailed = [];

    const guilds = await discordService.getGuilds();
    for (const [, guild] of guilds) {
        const { created, updated, failed } = await ReviewThreads.sync(guild, true, ...reviews);
        allCreated.push(...created);
        allUpdated.push(...updated);
        allFailed.push(...failed);
    }

    res.send({
        created: allCreated,
        updated: allUpdated,
        failed: allFailed
    });
}));

export default router;