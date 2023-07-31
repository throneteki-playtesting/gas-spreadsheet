import { RichTextRow } from "../RichTextRow";
import { NoteType, Faction, CardType, CardColumn, DefaultDeckLimit, ColumnHelper, ProjectType } from "../../Common/Enums";
import { Project, SemanticVersion } from "./Project";
import { ImageAPI } from "../../Imaging/ImageAPI";
import { Issue } from "../../Github/Issues";
import { Github, GithubAPI } from "../../Github/Github";
import { Endpoints } from "@octokit/types";

class Card extends RichTextRow {
    code: number;
    development: {
        project: Project,
        number: number,
        version: SemanticVersion,
        playtestVersion?: SemanticVersion | null,
        note?: {
            type: NoteType,
            text?: string // Maybe HTML type?
        },
        githubIssue?: {
            status: string,
            url: string
        },
        image?: {
            url: string,
            version: SemanticVersion
        }
    };
    faction: Faction;
    name: string;
    type: CardType;
    traits: string[];
    text: string; // Maybe HTML type?
    flavor?: string; // Maybe HTML type?
    illustrator: string;
    designer?: string;
    loyal?: boolean;
    deckLimit: number
    quantity: number

    // Draw Card Properties
    strength?: number | string;
    icons?: {
        military: boolean,
        intrigue: boolean,
        power: boolean
    };
    unique?: boolean;
    cost?: number | string;

    // Plot Card Properties
    plotStats?: {
        income: number,
        initiative: number,
        claim: number,
        reserve: number
    };

    static fromRichTextValues(project: Project, richTextValues: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[]): Card {
        const card = new Card();
        card.rowValues = richTextValues.map(rtv => rtv ? rtv : SpreadsheetApp.newRichTextValue().build());

        if (!card.getText(CardColumn.Version)) {
            // TODO: Handle missing version as "TBA" card
        }
        const number = card.getNumber(CardColumn.Number, true);
        // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
        card.code = parseInt(project.code + (project.type === ProjectType.Cycle ? (number + 500) : number).toString().padStart(3, "0"));
        card.development = {
            project,
            number: number,
            version: SemanticVersion.fromString(card.getText(CardColumn.Version, true)),
            playtestVersion: card.hasText(CardColumn.PlaytestVersion) ? SemanticVersion.fromString(card.getText(CardColumn.PlaytestVersion)) : undefined,
            note: card.hasText(CardColumn.NoteType) ? {
                type: NoteType[card.getText(CardColumn.NoteType, true)],
                text: card.getAsHtml(CardColumn.NoteText)
            } : undefined,
            image: card.hasText(CardColumn.ImageUrl) ? {
                url: card.getValue(CardColumn.ImageUrl).getLinkUrl() || "",
                version: SemanticVersion.fromString(card.getText(CardColumn.ImageUrl, true))
            } : undefined,
            githubIssue: card.hasText(CardColumn.GithubIssue) ? {
                status: card.getText(CardColumn.GithubIssue, true),
                url: card.getValue(CardColumn.GithubIssue).getLinkUrl() || ""
            } : undefined
        };
        card.faction = card.getEnumFromValue<Faction>(Faction, CardColumn.Faction, true);
        card.name = card.getText(CardColumn.Name, true);
        card.type = CardType[card.getText(CardColumn.Type, true)];
        card.traits = card.getText(CardColumn.Traits).split(".").filter(t => t).map(t => t.trim());
        card.text = card.getAsHtml(CardColumn.Textbox);
        if (card.hasText(CardColumn.Flavor)) {
            card.flavor = card.getAsHtml(CardColumn.Flavor);
        }
        card.illustrator = card.getText(CardColumn.Illustrator) || "?";
        if (card.hasText(CardColumn.Designer)) {
            card.designer = card.getText(CardColumn.Designer);
        }
        if (card.faction !== Faction.Neutral) {
            card.loyal = card.getText(CardColumn.Loyal).toLowerCase() === "loyal";
        }
        switch (card.type) {
            case CardType.Character:
                const strength = card.getNumber(CardColumn.Strength);
                card.strength = !isNaN(strength) ? strength : (card.getText(CardColumn.Strength) || "-");
                card.icons = {
                    military: card.getText(CardColumn.Icons).includes("M"),
                    intrigue: card.getText(CardColumn.Icons).includes("I"),
                    power: card.getText(CardColumn.Icons).includes("P")
                };
            case CardType.Attachment:
            case CardType.Location:
                card.unique = card.getText(CardColumn.Unique, true) === "Unique";
            case CardType.Event:
                const cost = card.getNumber(CardColumn.Cost);
                card.cost = !isNaN(cost) ? cost : (card.getText(CardColumn.Cost) || "-");
                break;
            case CardType.Plot:
                card.plotStats = {
                    income: card.getNumber(CardColumn.Income, true),
                    initiative: card.getNumber(CardColumn.Initiative, true),
                    claim: card.getNumber(CardColumn.Claim, true),
                    reserve: card.getNumber(CardColumn.Reserve, true)
                };
            case CardType.Agenda:
                // Nothing additional to add
                break;
        }

        card.deckLimit = card.hasText(CardColumn.Limit) ? card.getNumber(CardColumn.Limit) : DefaultDeckLimit[CardType[card.type]];
        card.quantity = 3;
        return card;
    };

    clone() {
        this.rowValues = this.toRichTextValues();
        return Card.fromRichTextValues(this.development.project, this.rowValues);
    }

    syncIssue(project: Project, existing?: Endpoints["GET /search/issues"]["response"]["data"]["items"] ): "Added" | "Updated" | "Closed" | undefined {
        const requiresImplementation = this.development.version.is(1, 0) && !this.development.note && !this.development.playtestVersion;

        const noteType = this.development.note?.type;
        // Ignore if there is no note type & card is not an initial implementation
        if (!(noteType || requiresImplementation)) {
            return;
        }
        // Sync image before pushing new or updating old issue
        this.syncImage(project);

        const potentialIssue = Issue.for(this);
        const currentIssue = existing?.find(existing => existing.title === potentialIssue.title) ?? GithubAPI.getIssues(this).find(a => a);

        let action: "Added" | "Updated" | "Closed" | undefined;

        if (currentIssue) {
            this.development.githubIssue = { status: currentIssue.state, url: currentIssue.html_url };

            // Check & Update issue if body is different
            if (potentialIssue.body !== currentIssue.body) {
                potentialIssue.number = currentIssue.number;
                let { state, html_url } = GithubAPI.updateIssue(potentialIssue);
                this.development.githubIssue = { status: state, url: html_url };
                action = "Updated";
            }
        } else {
            // Create new issue
            let { state, html_url } = GithubAPI.addIssue(Issue.for(this));
            this.development.githubIssue = { status: state, url: html_url };
            action = "Added";
        }

        if (requiresImplementation && this.development.githubIssue.status === "closed") {
            this.development.note = {
                type: NoteType.Implemented
            }

            action = "Closed";
        }
        return action;
    }

    syncImage(project: Project) {
        if (!(this.development.image?.version.equals(this.development.version))) {
            this.development.image = {
                url: ImageAPI.generateCard(project, this),
                version: this.development.version
            };
        }
    }

    toString() {
        return this.name + " (v" + this.development.version.toString() + ")";
    }

    toJSON(workInProgress = false): JSON {
        const obj: any = {
            code: this.code.toString(),
            ...(workInProgress && { version: this.development.version.toString() }),
            type: CardType[this.type].toLowerCase(),
            name: this.name,
            octgnId: null,
            quantity: this.quantity,
            ...(this.unique !== undefined && { unique: this.unique }),
            faction: Object.keys(Faction)[Object.values(Faction).indexOf(this.faction)].toLowerCase(),
            ...(this.plotStats && { plotStats: this.plotStats }),
            ...(this.loyal !== undefined && { loyal: this.loyal }),
            ...(this.cost !== undefined && { cost: this.cost }),
            ...(this.icons && { icons: this.icons }),
            ...(this.strength !== undefined && { strength: this.strength }),
            traits: this.traits,
            text: this.text,
            ...(this.flavor && { flavor: this.flavor }),
            deckLimit: this.deckLimit,
            illustrator: this.illustrator,
            ...(this.designer && { designer: this.designer }),
            imageUrl: this.development.image?.url || ""
        }
        return <JSON>obj;
    }

    toRichTextValues() {
        const tempRowValues = [...this.rowValues];
        try {
            const dashColumns = [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits];

            this.rowValues = Array.from({ length: ColumnHelper.getCount(CardColumn) }, (v, i) => SpreadsheetApp.newRichTextValue().setText(dashColumns.includes(i) ? "-" : "").build());
            this.setText(CardColumn.Number, this.development.number);
            this.setText(CardColumn.Version, this.development.version.toString());
            this.setText(CardColumn.Faction, this.faction);
            this.setText(CardColumn.Name, this.name);
            this.setText(CardColumn.Type, CardType[this.type]);
            if (this.loyal !== undefined) {
                this.setText(CardColumn.Loyal, this.loyal ? "Loyal" : "Non-Loyal");
            }
            if (this.traits.length > 0) {
                this.setText(CardColumn.Traits, this.traits.map(t => t + ".").join(" "));
            }
            this.setFromHtml(CardColumn.Textbox, this.text);
            if (this.flavor) {
                this.setFromHtml(CardColumn.Flavor, this.flavor);
            }
            if (this.deckLimit !== DefaultDeckLimit[CardType[this.type]]) {
                this.setText(CardColumn.Limit, this.deckLimit);
            }
            if (this.designer) {
                this.setText(CardColumn.Designer, this.designer);
            }
            if (this.illustrator !== "?") {
                this.setText(CardColumn.Illustrator, this.illustrator);
            }
            if (this.development.image) {
                this.rowValues[CardColumn.ImageUrl] = SpreadsheetApp.newRichTextValue().setText(this.development.image.version.toString()).setLinkUrl(this.development.image.url).build();
            }
            if (this.development.note) {
                this.setText(CardColumn.NoteType, NoteType[this.development.note.type]);
                if (this.development.note.text) {
                    this.setFromHtml(CardColumn.NoteText, this.development.note.text);
                }
            }
            if (this.development.playtestVersion) {
                this.setText(CardColumn.PlaytestVersion, this.development.playtestVersion.toString());
            }

            if (this.development.githubIssue?.status && this.development.githubIssue?.url) {
                this.rowValues[CardColumn.GithubIssue] = SpreadsheetApp.newRichTextValue().setText(this.development.githubIssue.status).setLinkUrl(this.development.githubIssue.url).build();
            }

            switch (this.type) {
                case CardType.Character:
                    this.setText(CardColumn.Strength, this.strength !== undefined ? this.strength : "-");
                    const iconLetters = [
                        ... this.icons?.military ? ["M"] : [],
                        ... this.icons?.intrigue ? ["I"] : [],
                        ... this.icons?.power ? ["P"] : []
                    ];
                    this.setText(CardColumn.Icons, iconLetters.join(" / "));
                case CardType.Attachment:
                case CardType.Location:
                    this.setText(CardColumn.Unique, this.unique ? "Unique" : "Non-Unique");
                case CardType.Event:
                    this.setText(CardColumn.Cost, this.cost !== undefined ? this.cost : "-");
                    break;
                case CardType.Plot:
                    this.setText(CardColumn.Income, this.plotStats?.income || 0);
                    this.setText(CardColumn.Initiative, this.plotStats?.initiative || 0);
                    this.setText(CardColumn.Claim, this.plotStats?.claim || 0);
                    this.setText(CardColumn.Reserve, this.plotStats?.reserve || 0);
                case CardType.Agenda:
                // Nothing to set
            }
            return this.rowValues;
        } catch (e) {
            console.log("Failed toRichTextValues for card #" + this.development.number);
            return tempRowValues;
        }
    }
}

export { Card };