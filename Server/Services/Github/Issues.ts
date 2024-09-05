import Card from "../Data/Models/Card";
import fs from "fs";
import ejs from "ejs";
import { emojis } from "./Utils";
import path from "path";
import { fileURLToPath } from "url";
import Project from "../Data/Models/Project";
import GithubService from ".";
import { NoteType } from "@/Common/Models/Card";
import { apiUrl } from "@/Server";

export type GeneratedIssue = {
    title: string,
    body: string,
    labels: string[],
    milestone: number
};
export type GeneratedPullRequest = {
    title: string,
    body: string,
    labels: string[],
    milestone: number
};

type NotePackage = { icons: string, title: string, text: string };

export class Issue {
    static forCard(project: Project, card: Card) {
        const milestone = project.milestone;
        const type = card.note?.type || (card.isPreRelease && !card.isImplemented ? "Implemented" : null);
        if (!type) {
            return null;
        }
        const slimCard = {
            name: card.name,
            version: card.version,
            imageUrl: card.imageUrl,
            note: card.note?.text
        };
        const previousSlimCard = () => {
            if (card.playtesting) {
                throw Error("Playtesting version is missing or invalid");
            }
            const version = card.playtesting;
            const imageUrl = card.previousImageUrl;
            return { version, imageUrl };
        };
        let title = `${card.code} | ${project.short} - `;

        switch (type) {
            case "Replaced": {
                title += `Replace with ${card.toString()}`;
                const replaced = slimCard;
                const previous = previousSlimCard();
                const body = Issue.renderTemplate({ type, replaced, previous, project });
                const labels = ["automated", "implement-card", "update-card"];
                return { title, body, labels, milestone } as GeneratedIssue;
            }
            case "Reworked": {
                title += `Rework as ${card.toString()}`;
                const reworked = slimCard;
                const previous = previousSlimCard();
                const body = Issue.renderTemplate({ type, reworked, previous, project });
                const labels = ["automated", "update-card"];
                return { title, body, labels, milestone } as GeneratedIssue;
            }
            case "Updated": {
                title += `Update to ${card.toString()}`;
                const updated = slimCard;
                const previous = previousSlimCard();
                const body = Issue.renderTemplate({ type, updated, previous, project });
                const labels = ["automated", "update-card"];
                return { title, body, labels, milestone } as GeneratedIssue;
            }
            case "Implemented": {
                title += `Implement ${card.toString()}`;
                const implemented = slimCard;
                const body = Issue.renderTemplate({ type, implemented, project });
                const labels = ["automated", "implement-card"];
                return { title, body, labels, milestone } as GeneratedIssue;
            }
            default: throw Error(`"${type}" is not a valid note type`);
        }
    }
    static forUpdate(project: Project, cards: Card[]) {
        if (cards.length === 0) {
            return null;
        }
        const milestone = project.milestone;
        const noteTypeOrdered = ["Replaced", "Reworked", "Updated", "Implemented"] as NoteType[];
        const notesMap = cards.reduce((map, card) => {
            const noteType = card.note?.type;
            if (noteType && noteTypeOrdered.includes(noteType)) {
                const icons = [emojis[noteType]];
                if (card.isNewlyImplemented) {
                    icons.unshift(emojis["Implemented"]);
                }
                const title = `${card.number} | ${card.name} v${card.version}`;
                const text = card.note?.text;

                const current = map.get(noteType) || [];
                current.push({ icons: icons.join(), title, text });
                map.set(noteType, current);
            }
            return map;
        }, new Map<NoteType, NotePackage[]>());

        const notesLegend = noteTypeOrdered.filter((nt) => notesMap.has(nt)).map((nt) => `${emojis[nt]} ${nt}`).join(" | ");
        const notes = Array.from(notesMap.values());
        const number = project.releases + 1;
        const pdf = {
            all: encodeURI(`${apiUrl}/pdf/${project.code}/${number}_all.png`),
            updated: cards.some((card) => card.isChanged) ? encodeURI(`${apiUrl}/pdf/${project.code}/${number}_updated.pdf`) : undefined
        };
        const date = new Date().toDateString();
        const body = Issue.renderTemplate({ type: "Playtesting Update", emojis, number, project, pdf, notesLegend, notes, date });

        const title = `${project.short} | Playtesting Update ${number}`;
        const labels = ["automated", "playtest-update"];

        return { title, body, labels, milestone }as GeneratedPullRequest;
    }

    private static renderTemplate(data: ejs.Data) {
        const { type, ...restData } = data;
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = `${__dirname}/Templates/${type}.ejs`;
        const file = fs.readFileSync(filePath).toString();

        const jsonRepoData = {
            name: "throneteki-json-data",
            url: "https://github.com/throneteki-playtesting/throneteki-json-data"
        };
        const date = new Date().toDateString();
        const render = ejs.render(file, { filename: filePath, jsonRepoData, date, emojis, ...restData });

        return GithubService.githubify(render);
    }
}

// class PullRequest {
//     owner: string;
//     repo: string;
//     number?: number;

//     constructor(public base: string, public head: string, public title: string, public body: string, public labels: string[]) {
//         this.owner = "throneteki-playtesting";
//         this.repo = "throneteki";
//     }

//     static forPlaytestingUpdate(finalise = false) {
//         const data = Data.instance;
//         const template = this.buildTemplate(finalise);

//         const base = "playtesting";
//         const head = "development-" + data.project.short;
//         const title = "Playtesting Update v" + data.project.version.toString();
//         const body = Github.githubify(template.evaluate().getContent());
//         const labels = ["automated", "playtest-update"];
//         return new PullRequest(base, head, title, body, labels);
//     }

//     private static buildTemplate(finalise = false) {
//         const data = Data.instance;
//         const template = HtmlService.createTemplateFromFile("Github/Templates/PlaytestUpdatePullRequest");

//         template.project = data.project;
//         template.date = new Date().toDateString();
//         template.pdfAllUrl = finalise ? PDFAPI.syncLatestPhysicalPDFSheet() : "TBA";
//         template.pdfUpdatedUrl = finalise ? PDFAPI.syncUpdatedPhysicalPDFSheet() : "TBA";

//         const changeNotes: CardUpdateNote[] = [];
//         const implemented: CardUpdateNote[] = [];
//         for (const card of data.getPlaytestingUpdateCards()) {
//             let newCard = card.clone();
//             let oldCard = card.development.playtestVersion ? data.getCard(card.development.number, card.development.playtestVersion).clone() : undefined;
//             if (card.development.note.type !== undefined && card.development.note.type !== NoteType.Implemented) {
//                 const changeNote: CardUpdateNote = {
//                     type: card.development.note.type,
//                     icons: [Emoji[NoteType[card.isNewlyImplemented ? NoteType.Implemented : NoteType.NotImplemented]]],
//                     newCard,
//                     oldCard,
//                     text: card.development.note.text
//                 };
//                 changeNotes.push(changeNote);
//             }
//             if (card.isNewlyImplemented) {
//                 const reference = card.getReferenceCard();
//                 // Use the reference for proper note information
//                 let implementText = newCard.development.note.type === NoteType.Implemented ? newCard.development.note.text : undefined;
//                 if (reference !== card) {
//                     newCard = reference.clone();
//                     oldCard = card.development.playtestVersion ? data.getArchivedCard(card.development.number, card.development.playtestVersion).clone() : undefined;
//                     implementText = implementText ?? "<em>Please note that the changes for this card were in a previous update</em>";
//                 }
//                 const implementNote: CardUpdateNote = {
//                     type: newCard.development.note.type !== undefined ? newCard.development.note.type : NoteType.Implemented,
//                     icons: [Emoji[NoteType[NoteType.Implemented]]],
//                     newCard,
//                     oldCard,
//                     text: implementText
//                 };
//                 if (implementNote.type !== NoteType.Implemented) {
//                     implementNote.icons.push(Emoji[NoteType[implementNote.type]]);
//                 }
//                 implemented.push(implementNote);
//             }
//         }
//         template.changeNoteGroups = changeNotes.reduce((groups, changeNote) => {
//             const { type } = changeNote;
//             groups[type] = groups[type] ?? [];
//             groups[type].push(changeNote);
//             return groups;
//         }, {});
//         template.implemented = implemented.sort((a, b) => a.type - b.type || a.newCard.code - b.newCard.code);

//         return template;
//     }
// }

// interface CardUpdateNote {
//   type: NoteType,
//   icons: string[],
//   newCard: Card,
//   oldCard: Card | undefined,
//   text: string | undefined
// }

// export { Issue, PullRequest };