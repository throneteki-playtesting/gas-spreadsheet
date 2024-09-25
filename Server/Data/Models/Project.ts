import { Projects } from "@/Common/Models/Projects";
import { Joi } from "celebrate";

class Project {
    public _id: Projects.Id;
    constructor(
        public active: boolean,
        public name: string,
        public short: string,
        public code: number,
        public type: Projects.Type,
        public perFaction: number,
        public neutral: number,
        public script: string,
        public releases: number,
        public milestone: number,
        public formUrl: string,
        public emoji?: string
    ) {
        this._id = Projects.condenseId({ code });
    }

    get cards() {
        return (this.perFaction * 8) + this.neutral;
    }

    static async fromModels(...models: Projects.Model[]) {
        return models.map((model) => new Project(model.active, model.name, model.short, model.code, model.type, model.perFaction, model.neutral, model.script, model.releases, model.milestone, model.formUrl, model.emoji));
    }

    static async toModels(...projects: Project[]) {
        return projects.map((project) => ({
            _id: project._id,
            active: project.active,
            script: project.script,
            name: project.name,
            short: project.short,
            code: project.code,
            type: project.type,
            perFaction: project.perFaction,
            neutral: project.neutral,
            releases: project.releases,
            milestone: project.milestone,
            formUrl: project.formUrl,
            emoji: project.emoji
        }) as Projects.Model);
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
        _id: Joi.number(),
        code: Joi.number().required(),
        active: Joi.boolean().required(),
        script: Joi.string().required(),
        name: Joi.string().required(),
        short: Joi.string().required(),
        type: Joi.string().required().valid("Cycle", "Expansion"),
        perFaction: Joi.number().required(),
        neutral: Joi.number().required(),
        releases: Joi.number().required(),
        milestone: Joi.number().required(),
        formUrl: Joi.string().required(),
        emoji: Joi.string()
    };
}

export default Project;