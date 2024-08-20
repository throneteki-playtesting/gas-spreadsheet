import { ProjectModel, Type } from "@/Common/Models/Project";

class Project implements ProjectModel {
    constructor(
        public active: boolean,
        public name: string,
        public short: string,
        public code: number,
        public type: Type,
        public perFaction: number,
        public neutral: number,
        public script: string
    ) {
        // Empty
    }

    get cards() {
        return (this.perFaction * 8) + this.neutral;
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

        return new Project(active, name, short, code, type, perFaction, neutral, script);
    }

    toString() {
        return this.name;
    }
}

export default Project;