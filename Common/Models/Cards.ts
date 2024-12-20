import { SemanticVersion } from "../Utils";
import { Projects } from "./Projects";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Cards {
    export const factions = ["House Baratheon", "House Greyjoy", "House Lannister", "House Martell", "The Night's Watch", "House Stark", "House Targaryen", "House Tyrell", "Neutral"] as const;
    export const types = ["Character", "Location", "Attachment", "Event", "Plot", "Agenda"] as const;
    export const noteTypes = ["Replaced", "Reworked", "Updated", "Implemented"] as const;
    export const githubStatuses = ["open", "closed", "complete"] as const;
    export type Faction = typeof factions[number];
    export type Type = typeof types[number];
    export type NoteType = typeof noteTypes[number];
    export type GithubStatus = typeof githubStatuses[number];

    export type Code = `${Projects.Id}${number}`;
    // {code}@{version} (eg. 27501@1.0.0)
    export type Id = `${Code}@${SemanticVersion}`;
    export type Matcher = { projectId: Projects.Id, number?: number, version?: SemanticVersion };

    export interface Model {
        _id?: Id,
        projectId: Projects.Id,
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
            status: GithubStatus,
            issueUrl: string
        },
        release?: {
            short: string,
            number: number
        }
    };

    export enum DefaultDeckLimit {
        Character = 3,
        Attachment = 3,
        Location = 3,
        Event = 3,
        Plot = 2,
        Agenda = 1
    }

    export function expandId(id: Id) {
        const [code, version] = id.split("@") as [Code, SemanticVersion];
        const projectId = parseInt(code.substring(0, 2));
        const number = parseInt(code.substring(2)) - 500;
        return { projectId, number, version };
    }

    export function condenseId({ projectId, number, version }: { projectId: Projects.Id, number: number, version: SemanticVersion }) {
        const code = projectId.toString() + (number + 500).toString() as Cards.Code;
        return `${code}@${version}` as Id;
    }
}

export {
    Cards
};