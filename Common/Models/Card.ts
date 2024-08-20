import { SemanticVersion } from "../Utils";

export type Faction = "House Baratheon" | "House Greyjoy" | "House Lannister" | "House Martell" | "The Night's Watch" | "House Stark" | "House Targaryen" | "House Tyrell" | "Neutral";
export type Type = "Character" | "Location" | "Attachment" | "Event" | "Plot" | "Agenda";
export type NoteType = "Replaced" | "Reworked" | "Updated" | "Implemented" | "Not Implemented";

// number@version (ranging from 1@0.0.0 to 999@99.99.99)
export type CardId = `${number}@${SemanticVersion}`

export enum DefaultDeckLimit {
    Character = 3,
    Attachment = 3,
    Location = 3,
    Event = 3,
    Plot = 2,
    Agenda = 1
}

export interface CardModel {
    id: CardId,
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
    quantity: 3,
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