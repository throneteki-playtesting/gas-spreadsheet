// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Projects {
    export const types = ["Cycle", "Expansion"] as const;
    export type Type = typeof types[number];
    // Id = Code
    export type Id = number;
    export interface Model {
        _id?: Id,
        code: number,
        active: boolean,
        script: string,
        name: string,
        short: string,
        type: Type,
        perFaction: number,
        neutral: number,
        releases: number,
        milestone: number,
        formUrl: string,
        emoji?: string
    }

    export function expandId(id: Id) {
        return { code: id };
    }

    export function condenseId({ code }: { code: number }) {
        return code as Id;
    }
}

export {
    Projects
};