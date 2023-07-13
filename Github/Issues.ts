import { NoteType } from "../Common/Enums";
import { Data } from "../DataLayer/Data";
import { Card } from "../DataLayer/Models/Card";

class Issue {
  owner: string;
  repo: string;
  number?: number;

  private constructor(public title: string, public body: string, public labels: string[]) {
    this.owner = "throneteki-playtesting";
    this.repo = "throneteki";
  }

  static requiresIssue(card: Card) {
    switch (card.development.note?.type) {
      case NoteType.Replaced:
      case NoteType.Reworked:
      case NoteType.Updated:
        return true;
      default:
        if (card.development.version.is(1, 0) && !card.development.playtestVersion) {
          return true
        }
        return false;
    }
  }

  static for(card: Card) {
    switch (card.development.note?.type) {
      case NoteType.Replaced: {
        const template = Issue.buildTemplate(card, NoteType.Replaced);
        const title = card.code + " - Replace with " + card.name + " v" + card.development.version.toString()
        const body = this.githubify(template.evaluate().getContent());
        const labels = ["automated", "implement-card", "update-card"];
        return new Issue(title, body, labels);
      }
      case NoteType.Reworked:
      case NoteType.Updated: {
        const template = Issue.buildTemplate(card, NoteType.Updated);
        const title = card.code + " - Update to " + card.name + " v" + card.development.version.toString()
        const body = this.githubify(template.evaluate().getContent());
        const labels = ["automated", "update-card"];
        return new Issue(title, body, labels);
      }
      default: {
        if (card.development.version.is(1, 0) && !card.development.playtestVersion) {
          const template = Issue.buildTemplate(card, NoteType.Implemented);
          const title = card.code + " - Implement " + card.name + " v" + card.development.version.toString()
          const body = this.githubify(template.evaluate().getContent());
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
    if(template.newCard.development.note) {
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
      if(template.oldCard.development.note) {
        template.oldCard.development.note.type = Object.keys(NoteType)[Object.values(NoteType).indexOf(template.oldCard.development.note.type)];
      }
    }

    return template;
  }

  private static githubify(text: string) {
    // Html Converting
    return text
      .replace(/<i>/g, "***")
      .replace(/<\/i>/g, "***")
      .replace(/<b>|<\/b>/g, "**")
      .replace(/<em>|<\/em>/g, "_")
      .replace(/<s>|<\/s>/g, "~~")
      .replace(/<cite>/g, "-")
      .replace(/<\/cite>/g, "")
      .replace(/<nl>/g, "")
      .replace(/<h1>/g, "")
      .replace(/<\/h1>/g, "\n===")
      .replace(/<h2>/g, "")
      .replace(/<\/h2>/g, "\n---")
      .replace(/<h3>/g, "### ")
      .replace(/<\/h3>/g, "")
      .replace(/  /g, " &nbsp;")
      // Absolutely no idea why, but the HTMLOutput builder is adding an extra line. ????
      .replace(/\n\n/g, "\n");
  }
}

class PullRequest {
  owner: string;
  repo: string;

  constructor(public base: string, public merge: string, public title: string, public body: string, public labels: string[]) {
    this.owner = "throneteki";
    this.repo = "throneteki";
  }
}

export { Issue, PullRequest }