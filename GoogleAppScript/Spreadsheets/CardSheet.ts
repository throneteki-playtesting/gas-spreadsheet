import { CardId } from "@/Common/Identifiers";

const cardIdFunc = (row: unknown[], rowIndex: number, id: CardId) => id.number === row[Column.Number] && (!id.version || id.version === row[Column.Version]);

function getCardId(values: unknown[]) {
    return new CardId(parseInt(values[Column.Number] as string), values[Column.Version] as string);
}

enum Column {
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

export {
    cardIdFunc,
    getCardId,
    Column
};