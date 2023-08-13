import { NoteType } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Card } from "../DataLayer/Models/Card";
import { Github } from "./Github";
import { PDFAPI } from "../Imaging/PdfAPI";

class Issue {
  owner: string;
  repo: string;
  number?: number;
  state?: string;
  html_url?: string;

  constructor(public title: string, public body: string, public labels: string[]) {
    this.owner = "throneteki-playtesting";
    this.repo = "throneteki";
  }

  static for(card: Card) {
    switch (card.development.note.type) {
      case NoteType.Replaced: {
        const template = Issue.buildTemplate(card, NoteType.Replaced);
        const title = card.code + " - Replace with " + card.name + " v" + card.development.version.toString()
        const body = Github.githubify(template.evaluate().getContent());
        const labels = ["automated", "implement-card", "update-card"];
        return new Issue(title, body, labels);
      }
      case NoteType.Reworked:
      case NoteType.Updated: {
        const template = Issue.buildTemplate(card, NoteType.Updated);
        const title = card.code + " - Update to " + card.name + " v" + card.development.version.toString()
        const body = Github.githubify(template.evaluate().getContent());
        const labels = ["automated", "update-card"];
        return new Issue(title, body, labels);
      }
      default: {
        if (card.development.version.is(1, 0) && !card.development.playtestVersion) {
          const template = Issue.buildTemplate(card, NoteType.Implemented);
          const title = card.code + " - Implement " + card.name + " v" + card.development.version.toString()
          const body = Github.githubify(template.evaluate().getContent());
          const labels = ["automated", "implement-card"];
          return new Issue(title, body, labels);
        }
      }
    }

    throw new Error("Failed to create Issue for card #" + card.development.number);
  }

  private static buildTemplate(card: Card, noteType: NoteType) {
    const data = Data.instance;
    const template = HtmlService.createTemplateFromFile(`Github/Templates/${NoteType[noteType]}Issue`);
    template.newCard = card.clone();
    if (template.newCard.development.note) {
      template.newCard.development.note.type = Object.keys(NoteType)[Object.values(NoteType).indexOf(template.newCard.development.note.type)];
    }
    template.pack = data.project;
    template.jsonRepoData = {
      name: "throneteki-json-data",
      url: "https://github.com/throneteki-playtesting/throneteki-json-data"
    };
    template.date = new Date().toDateString();

    if (card.development.playtestVersion) {
      const oldCard = data.findCard(card.development.number, card.development.playtestVersion);
      if (!oldCard) {
        throw new Error("Failed to build '" + NoteType[noteType] + "' issue template: Old card with No. '" + card.development.number + "' and Version '" + card.development.playtestVersion?.toString() + "' cannot be found");
      }
      template.oldCard = oldCard.clone();
      if (template.oldCard.development.note) {
        template.oldCard.development.note.type = Object.keys(NoteType)[Object.values(NoteType).indexOf(template.oldCard.development.note.type)];
      }
    }

    return template;
  }
}

class PullRequest {
  owner: string;
  repo: string;
  number?: number;

  constructor(public base: string, public head: string, public title: string, public body: string, public labels: string[]) {
    this.owner = "throneteki-playtesting";
    this.repo = "throneteki";
  }

  static forPlaytestingUpdate(finalise = false) {
    const data = Data.instance;
    const template = this.buildTemplate(finalise);

    const base = "playtesting";
    const head = "development-" + data.project.short;
    const title = "Playtesting Update v" + data.project.version.toString()
    const body = Github.githubify(template.evaluate().getContent());
    const labels = ["automated", "playtest-update"];
    return new PullRequest(base, head, title, body, labels);
  }

  private static buildTemplate(finalise = false) {
    const data = Data.instance;
    const template = HtmlService.createTemplateFromFile("Github/Templates/PlaytestUpdatePullRequest");

    template.project = data.project;
    template.date = new Date().toDateString();
    template.pdfAllUrl = finalise ? PDFAPI.syncLatestPhysicalPDFSheet() : "TBA";
    template.pdfUpdatedUrl = finalise ? PDFAPI.syncUpdatedPhysicalPDFSheet() : "TBA";

    const implemented: CardUpdateNote[] = [];
    const changeNoteGroups = {};
    for (const card of data.getPlaytestingUpdateCards()) {
      let newCard = card.clone();
      let oldCard = card.development.playtestVersion ? data.findCard(card.development.number, card.development.playtestVersion)?.clone() : undefined;
      if (card.development.note.type && card.development.note.type !== NoteType.Implemented) {
        const changeNote: CardUpdateNote = {
          newCard,
          oldCard,
          text: card.development.note.text,
          relatedType: card.isNewlyImplemented() ? NoteType.Implemented : NoteType.NotImplemented
        };
        changeNoteGroups[card.development.note.type] = changeNoteGroups[card.development.note.type] || [];
        changeNoteGroups[card.development.note.type].push(changeNote);
      }
      if (card.isNewlyImplemented()) {
        const archivedCopy = card.getPlaytestingArchiveCopy();
        // If there is a version of this card already being playtested, then get the archived copy of that card as it has the proper note data
        if (archivedCopy) {
          newCard = archivedCopy.clone();
          oldCard = card.development.playtestVersion ? data.findArchivedCard(card.development.number, card.development.playtestVersion)?.clone() : undefined;
        }
        const implementNote: CardUpdateNote = {
          newCard,
          oldCard,
          text: newCard.development.note.type === NoteType.Implemented ? newCard.development.note.text : !!archivedCopy ? "<em>Please note that the changes for this card were in a previous update</em>" : "",
          relatedType: newCard.development.note.type
        };
        implemented.push(implementNote);
      }
    }
    template.changeNoteGroups = changeNoteGroups;
    template.implemented = implemented.sort((a, b) => (a.relatedType || NoteType.Implemented) - (b.relatedType || NoteType.Implemented));

    return template;
  }
}

interface CardUpdateNote {
  newCard: Card,
  oldCard: Card | undefined,
  text: string | undefined,
  relatedType: NoteType | undefined
}

export { Issue, PullRequest }