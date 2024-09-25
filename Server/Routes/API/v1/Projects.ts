import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import Project from "@/Server/Data/Models/Project";
import { dataService } from "@/Server/Services";
import { Projects } from "@/Common/Models/Projects";

const router = express.Router();

router.post("/", celebrate({
    [Segments.BODY]: Joi.array().items(Project.schema)
}), asyncHandler(async (req, res) => {
    const projects = await Project.fromModels(...req.body as Projects.Model[]);

    const result = await dataService.projects.update({ projects });

    res.send({
        updated: result
    });
}));

export default router;