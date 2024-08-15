import Card from "./Card.js";

class Pack {
    code: string;
    name: string;
    releaseDate: Date | null;
    cards: Card[];

    constructor(cards: Card[], releaseDate?: Date | null) {
        this.cards = cards;
        const project = cards[0].development.project;
        this.code = project.short;
        this.name = project.name;

        if (releaseDate) {
            this.releaseDate = releaseDate;
        } else {
            if (project.type === "Cycle") {
                this.name += " (Unreleased)";
            }
            this.releaseDate = null;
        }
    }

    get releaseDateString() {
        if (!this.releaseDate) {
            return null;
        }
        return new Date(this.releaseDate.getTime() - (this.releaseDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
    }

    validate() {
        const errors: string[] = [];
        for (const card of this.cards) {
            const errorPrefix = "Card Dev#" + card.development.number + " (" + card.name + ")";
            if (!card.illustrator || card.illustrator == "?") {
                errors.push(errorPrefix + " missing illustrator");
            }

            if (!card.development.final || !card.development.final.number) {
                errors.push(errorPrefix + " missing final number");
            }

            // TODO (use fetchAll instead somehow, and confirm working)
            // if(card.development.image) {
            //     var imageResponse = UrlFetchApp.fetch(card.development.image.url);
            //     if(imageResponse.getResponseCode() !== 200) {
            //         errors.push(errorPrefix + " cannot successfully reach URL (" + imageResponse.getResponseCode() +")");
            //     }
            // } else {
            //     errors.push(errorPrefix + " missing image url");
            // }
        }
        return errors;
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

export { Pack };