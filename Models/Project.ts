import { SemVer } from "semver";
import { ProjectType } from "../Common/Enums.js";
import { ExpandoObject } from "../Common/Utils.js";

class Project {
    constructor(readonly name: string, readonly short: string, readonly code: number, readonly type: ProjectType, readonly cards: { perFaction: number, neutral: number }, public version: SemVer) {
        // Empty
    }

    static deserialise(object: ExpandoObject) {
        const name = object["name"] as string;
        const short = object["short"] as string;
        const code = parseInt(object["code"] as string);
        const type = ProjectType[object["type"] as string];
        const cards = {
            perFaction: parseInt(object["perFaction"] as string),
            neutral: parseInt(object["neutral"] as string)
        };
        const version = new SemVer(object["version"] as string);

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