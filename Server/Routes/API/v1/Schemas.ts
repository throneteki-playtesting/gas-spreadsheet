import { Utils } from "@/Common/Utils";
import { Joi } from "celebrate";

const JoiXNumber = Joi.alternatives().try(
    Joi.number(),
    Joi.string().valid("X")
);
const JoiXDashNumber = Joi.alternatives().try(
    Joi.number(),
    Joi.string().valid("X", "-")
);

export const Card = {
    id: Joi.string().required().regex(Utils.Regex.Card.id.full),
    project: Joi.number().required(),
    number: Joi.number().required(),
    version: Joi.string().required().regex(Utils.Regex.SemanticVersion),
    faction: Joi.string().required().valid("House Baratheon", "House Greyjoy", "House Lannister", "House Martell", "The Night's Watch", "House Stark", "House Targaryen", "House Tyrell", "Neutral"),
    name: Joi.string().required(),
    type: Joi.string().required().valid("Character", "Location", "Attachment", "Event", "Plot", "Agenda"),
    loyal: Joi.boolean(),
    traits: Joi.array().items(Joi.string()),
    text: Joi.string().required(),
    illustrator: Joi.string(),
    flavor: Joi.string(),
    designer: Joi.string(),
    deckLimit: Joi.number(),
    quantity: Joi.number(),
    cost: JoiXDashNumber,
    unique: Joi.boolean(),
    strength: JoiXNumber,
    icons: Joi.object({
        military: Joi.boolean().required(),
        intrigue: Joi.boolean().required(),
        power: Joi.boolean().required()
    }),
    plotStats: Joi.object({
        income: JoiXNumber.required(),
        initiative: JoiXNumber.required(),
        claim: JoiXNumber.required(),
        reserve: JoiXNumber.required()
    }),
    note: Joi.object({
        type: Joi.string().required().valid("Replaced", "Reworked", "Updated", "Implemented", "Not Implemented"),
        text: Joi.string().required()
    }),
    playtesting: Joi.string().regex(Utils.Regex.SemanticVersion),
    github: Joi.object({
        status: Joi.string().required(),
        issueUrl: Joi.string().required()
    }),
    release: Joi.object({
        short: Joi.string().required(),
        number: Joi.number().required()
    })
};

export const Project = {
    active: Joi.boolean().required(),
    script: Joi.string().required(),
    name: Joi.string().required(),
    short: Joi.string().required(),
    code: Joi.number().required(),
    type: Joi.string().required().valid("Cycle", "Expansion"),
    perFaction: Joi.number().required(),
    neutral: Joi.number().required()
};