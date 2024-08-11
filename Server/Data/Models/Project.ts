import { SemVer } from "semver";
import config from "config";
import { ProjectType } from "@/Common/Enums";

class Project {
    readonly active: boolean;
    readonly scriptUrl: string;
    constructor(readonly name: string, readonly short: string, readonly code: number, readonly type: ProjectType, readonly cards: { perFaction: number, neutral: number }, public version: SemVer) {
        const projectConfig = config.get("projects")[short];
        if (!projectConfig) {
            throw Error(`Missing "${short}" details in config`);
        }
        this.active = projectConfig.active;
        this.scriptUrl = projectConfig.script;
    }

    static deserialise(data: unknown[]) {
        const name = data["name"] as string;
        const short = data["short"] as string;
        const code = parseInt(data["code"] as string);
        const type = ProjectType[data["type"] as string];
        const cards = {
            perFaction: parseInt(data["perFaction"] as string),
            neutral: parseInt(data["neutral"] as string)
        };
        const version = new SemVer(data["version"] as string);

        return new Project(name, short, code, type, cards, version);
    }

    get totalCards() {
        return (this.cards.perFaction * 8) + this.cards.neutral;
    }

    toString() {
        return `${this.name} (${this.version})`;
    }

    getDevCardCodeFor(cardNo: number): number {
        const offset = this.type === ProjectType.Cycle ? 500 : 0;
        const codeString = this.code.toString() + (cardNo + offset).toString().padStart(3, "0");
        return parseInt(codeString);
    }
}

export default Project;