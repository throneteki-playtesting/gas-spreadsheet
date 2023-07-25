import { ProjectType } from "../../Common/Enums";
import { Card } from "./Card";
import { Project } from "./Project";

class Pack {
    code: string;
    name: string;
    releaseDate: Date | null;
    cards: Card[];

    constructor(cards: Card[], project: Project, releaseDate?: Date | null) {
        this.cards = cards;
        this.code = project.short;
        this.name = project.name;
        
        if (releaseDate) {
            this.releaseDate = releaseDate;
        } else {
            if (project.type === ProjectType.Cycle) {
                this.name += " (Unreleased)";
            }
            this.releaseDate = null;
        }
    }

    get releaseDateString() {
        if (!this.releaseDate) {
            return null;
        }
        const year = this.releaseDate.getFullYear();
        const month = this.releaseDate.getMonth().toString().padStart(2, "0");
        const day = this.releaseDate.getDay().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    toJSON() {
        const workInProgress = !this.releaseDate;
        return {
            cgdbId: null,
            code: this.code,
            name: this.name,
            releaseDate: this.releaseDateString,
            ...(workInProgress && { workInProgress }),
            cards: this.cards.map(cd => cd.toJSON(workInProgress))
        };
    }
}

export { Pack }