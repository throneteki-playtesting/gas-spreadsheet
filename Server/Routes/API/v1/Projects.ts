import express from "express";
import { celebrate, Joi, Segments } from "celebrate";
import asyncHandler from "express-async-handler";
import * as Schemas from "./Schemas";
import { ProjectModel } from "@/Common/Models/Project";
import Project from "@/Server/Services/Data/Models/Project";
import { dataService } from "@/Server/Services/Services";

const router = express.Router();

router.post("/", celebrate({
    [Segments.BODY]: Joi.object(Schemas.Project)
}), asyncHandler(async (req, res) => {
    const project = Project.fromModel((req.body as ProjectModel));

    const result = await dataService.projects.update({ projects: [project] });

    res.send({
        updated: result
    });
}));

export default router;