/* eslint-disable @typescript-eslint/no-namespace */
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

export namespace CardSheet {
    export const cardIdFunc = (row: unknown[], rowIndex: number, id: CardId) => id.number === row[CardColumn.Number] && (!id.version || id.version === row[CardColumn.Version]);

    export function getCardId(values: unknown[]) {
        return new CardId(parseInt(values[CardColumn.Number] as string), values[CardColumn.Version] as string);
    }
};

export enum CardColumn {
    Number,
    Version,
    Faction,
    Name,
    Type,
    Loyal,
    Unique,
    Income = Unique,
    Cost,
    Initiative = Cost,
    Strength,
    Claim = Strength,
    Icons,
    Reserve = Icons,
    Traits,
    Textbox,
    Flavor,
    Limit,
    Designer,
    Illustrator,
    NoteType,
    NoteText,
    PlaytestVersion,
    GithubIssue,
    PackShort,
    ReleaseNumber
}