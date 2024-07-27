export class CardId {
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

export enum Column {
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
    ImageUrl,
    NoteType,
    NoteText,
    PlaytestVersion,
    GithubIssue,
    PackShort,
    ReleaseNumber
}