import { ProjectType } from "../../Common/Enums";
import { Log } from "../../Common/Logger";
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
        return new Date(this.releaseDate.getTime() - (this.releaseDate.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
    }

    validate() {
        let errors:String[] = [];
        for(let card of this.cards) {
            if(!card.illustrator || card.illustrator == '?') {
                errors.push("Card Dev#" + card.development.number + " missing illustrator");
            }

            if(!card.development.final || !card.development.final.number) {
                errors.push("Card Dev#" + card.development.number + " missing final number");
            }
        }

        if(errors.length > 0) {
            Log.error("Validation failed for '" + this.name + "' due to following errors:" + errors.map(error => "\n- " + error).join());
            return false;
        } else {
            Log.information("Validation passed for '" + this.name + "'");
        }
        
        return true;
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