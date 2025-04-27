import { SemanticVersion } from "../Utils";
import { Cards } from "./Cards";
import { Projects } from "./Projects";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Reviews {
    export const statementAnswer = ["Strongly agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Strongly disagree"];
    export type StatementAnswer = typeof statementAnswer[number];
    export const playedRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
    export type PlayedRange = typeof playedRange[number];
    export type Statements = {
        boring: StatementAnswer,
        competitive: StatementAnswer,
        creative: StatementAnswer,
        balanced: StatementAnswer,
        releasable: StatementAnswer
    };

    // Id = "Reviewer@code@version"
    export type Id = `${string}@${Cards.Id}`;
    export type Matcher = Cards.Matcher & { reviewer?: string };

    export interface Model {
        _id?: Id,
        reviewer: string,
        projectId: number,
        number: number,
        version: SemanticVersion,
        faction?: Cards.Faction,
        name?: string,
        decks: string[],
        played: PlayedRange,
        statements: Statements,
        additional?: string,
        epoch: number
    };

    export function expandId(id: Id) {
        const [reviewer, code, version] = id.split("@") as [string, Cards.Code, SemanticVersion];
        const { projectId, number } = Cards.expandId(`${code}@${version}`);
        return { reviewer, projectId, number, version };
    }

    export function condenseId({ reviewer, projectId, number, version }: { reviewer: string, projectId: Projects.Id, number: number, version: SemanticVersion }) {
        const cardId = Cards.condenseId({ projectId, number, version });
        return `${reviewer}@${cardId}` as Id;
    }

    export enum StatementQuestions {
        boring = "It is boring",
        competitive = "It will see competitive play",
        creative = "It inspires creative, fun or jank ideas",
        balanced = "It is balanced",
        releasable = "It could be released as is"
    }
}

export {
    Reviews
};