/* eslint-disable @typescript-eslint/no-namespace */
import { CardId } from "@/Common/Identifiers";

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