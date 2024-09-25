import Card from "./Card.js";

class Pack {
    constructor(public short: string, public name: string, public cards: Card[], public releaseDate?: Date) {
        // Empty
    }

    validate() {
        // TODO: Validation
        // - Check number of cards is even?
        // - Check all imageUrl's reach an endpoint
        return true;
    }

    toJSON() {
        const releaseDate = this.releaseDate ? new Date(this.releaseDate.getTime() - (this.releaseDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : null;
        return {
            cgdbId: null,
            code: this.short,
            name: !releaseDate ? `${this.name} (Unreleased)` : this.name,
            releaseDate,
            ...(!releaseDate && { workInProgress: true }),
            cards: this.cards.map(card => card.toJSON())
        };
    }
}

export { Pack };