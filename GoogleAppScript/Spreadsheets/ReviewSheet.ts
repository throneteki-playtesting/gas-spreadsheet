import { ReviewId } from "@/Common/Identifiers";

export const reviewIdFunc = (row: unknown[], rowIndex: number, id: ReviewId) => id.responseId === row[Column.ResponseId];

export function getReviewId(values: unknown[]) {
    return new ReviewId(values[Column.ResponseId] as string);
}

export enum Column {
    Number,
    Version,
    Faction,
    Name,
    Date,
    Reviewer,
    Deck,
    Count,
    Rating,
    Release,
    Reason,
    Additional,
    ResponseId
}