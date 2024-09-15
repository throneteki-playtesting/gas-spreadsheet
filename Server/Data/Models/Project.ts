import { ProjectModel, Type } from "@/Common/Models/Project";
import { Joi } from "celebrate";

class Project implements ProjectModel {
    public _id: number;
    constructor(
        public active: boolean,
        public name: string,
        public short: string,
        public code: number,
        public type: Type,
        public perFaction: number,
        public neutral: number,
        public script: string,
        public releases: number,
        public milestone: number,
        public emoji?: string
    ) {
        this._id = this.code;
    }

    get cards() {
        return (this.perFaction * 8) + this.neutral;
    }

    static fromModel(model: ProjectModel) {
        return new Project(model.active, model.name, model.short, model.code, model.type, model.perFaction, model.neutral, model.script, model.releases, model.milestone, model.emoji);
    }

    static toModel(project: Project) {
        return { ...project } as ProjectModel;
    }

    clone() {
        const active = this.active;
        const name = this.name;
        const short = this.short;
        const code = this.code;
        const type = this.type;
        const perFaction = this.perFaction;
        const neutral = this.neutral;
        const script = this.script;
        const releases = this.releases;
        const milestone = this.milestone;
        const emoji = this.emoji;

        return new Project(active, name, short, code, type, perFaction, neutral, script, releases, milestone, emoji);
    }

    toString() {
        return this.name;
    }

    public static schema = {
        active: Joi.boolean().required(),
        script: Joi.string().required(),
        name: Joi.string().required(),
        short: Joi.string().required(),
        code: Joi.number().required(),
        type: Joi.string().required().valid("Cycle", "Expansion"),
        perFaction: Joi.number().required(),
        neutral: Joi.number().required(),
        releases: Joi.number().required(),
        milestone: Joi.number().required(),
        emoji: Joi.string()
    };
}

export default Project;