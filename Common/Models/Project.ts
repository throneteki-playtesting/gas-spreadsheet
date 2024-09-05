export type Type = "Cycle" | "Expansion";

export interface ProjectModel {
    _id: number,
    active: boolean,
    script: string,
    name: string,
    short: string,
    code: number,
    type: Type,
    perFaction: number,
    neutral: number,
    releases: number,
    milestone: number,
    emoji?: string
}