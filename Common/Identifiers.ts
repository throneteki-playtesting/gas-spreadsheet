export class CardId {
    public static format = /^\d+(?:@\d+.\d+.\d+)?$/;
    constructor(public number: number, public version?: string) {
        // Empty
    }

    static deserialize(data: string) {
        const split = data.split("@");
        const number = parseInt(split[0].trim());
        const version = split[1] ? split[1].trim() : undefined;
        return new CardId(number, version);
    }

    public toString() {
        if (this.version) {
            return `${this.number}@${this.version}`;
        }
        return `${this.number}`;
    }
}

export class ReviewId {
    constructor(public responseId: string) {
        // Empty
    }

    public toString() {
        return this.responseId;
    }
}