import { SemanticVersion } from "../Utils";

export const factions = ["House Baratheon", "House Greyjoy", "House Lannister", "House Martell", "The Night's Watch", "House Stark", "House Targaryen", "House Tyrell", "Neutral"] as const;
export const types = ["Character", "Location", "Attachment", "Event", "Plot", "Agenda"] as const;
export const noteTypes = ["Replaced", "Reworked", "Updated", "Implemented", "Not Implemented"] as const;
export type Faction = typeof factions[number];
export type Type = typeof types[number];
export type NoteType = typeof noteTypes[number];

// number@version (ranging from 1@0.0.0 to 999@99.99.99)
export type CardId = `${number}@${SemanticVersion}`
export type CardMatcher = { project: number, number?: number, version?: SemanticVersion };

export interface CardModel {
    _id: CardId,
    project: number,
    number: number,
    version: SemanticVersion,
    faction: Faction,
    name: string,
    type: Type,
    loyal?: boolean,
    traits: string[],
    text: string,
    illustrator: string,
    flavor?: string,
    designer?: string,
    deckLimit: number,
    quantity: 1 | 2 | 3,
    cost?: number | "X" | "-",
    unique?: boolean,
    strength?: number | "X",
    icons?: {
        military: boolean,
        intrigue: boolean,
        power: boolean
    },
    plotStats?: {
        income: number | "X",
        initiative: number | "X",
        claim: number | "X",
        reserve: number | "X"
    },
    note?: {
        type: NoteType,
        text: string
    },
    playtesting?: SemanticVersion,
    github?: {
        status: string,
        issueUrl: string
    },
    release?: {
        short: string,
        number: number
    }
};