export type Type = "Cycle" | "Expansion";

export interface ProjectModel {
    active: boolean,
    script: string,
    name: string,
    short: string,
    code: number,
    type: Type,
    perFaction: number,
    neutral: number
}