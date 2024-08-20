import Card from "./Card.js";

class Pack {
    constructor(public code: string, public name: string, public cards: Card[], public releaseDate?: Date) {
        if (!this.name.endsWith(" (Unreleased)")) {
            this.name += " (Unreleased)";
        }
    }

    validate() {
        // TODO
        return true;
    }

    toJSON() {
        const releaseDate = this.releaseDate ? new Date(this.releaseDate.getTime() - (this.releaseDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : null;
        return {
            cgdbId: null,
            code: this.code,
            name: this.name,
            releaseDate,
            ...(!!releaseDate && { workInProgress: true }),
            cards: this.cards.map(card => card.toJSON())
        };
    }
}

export { Pack };