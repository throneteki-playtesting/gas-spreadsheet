import { RichTextRow } from "../RichTextRow";
import { NoteType, Faction, CardType, CardColumn, DefaultDeckLimit, ColumnHelper, ProjectType } from "../../Common/Enums";
import { Project, SemanticVersion } from "./Project";
import { ImageAPI } from "../../Image APIs/ImageAPI";

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
    strength?: number;
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

    constructor(project: Project, row: (GoogleAppsScript.Spreadsheet.RichTextValue | null)[]) {
        super(row);
        if (!this.getText(CardColumn.Version)) {
            // Handle missing version as "TBA" card
        }
        const number = this.getNumber(CardColumn.Number, true);
        // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
        this.code = parseInt(project.code + (project.type === ProjectType.Cycle ? (number + 500) : number).toString().padStart(3, "0"));
        this.development = {
            project,
            number: number,
            version: SemanticVersion.fromString(this.getText(CardColumn.Version, true)),
            playtestVersion: this.hasText(CardColumn.PlaytestVersion) ? SemanticVersion.fromString(this.getText(CardColumn.PlaytestVersion)) : undefined,
            note: this.hasText(CardColumn.NoteType) ? {
                type: NoteType[this.getText(CardColumn.NoteType, true)],
                text: this.getAsHtml(CardColumn.NoteText)
            } : undefined,
            image: this.hasText(CardColumn.ImageUrl) ? {
                url: this.getValue(CardColumn.ImageUrl).getLinkUrl() || "",
                version: SemanticVersion.fromString(this.getText(CardColumn.ImageUrl, true))
            } : undefined,
            githubIssue: this.hasText(CardColumn.GithubIssue) ? {
                status: this.getText(CardColumn.GithubIssue, true),
                url: this.getValue(CardColumn.GithubIssue).getLinkUrl() || ""
            } : undefined
        };
        this.faction = this.getEnumFromValue<Faction>(Faction, CardColumn.Faction, true);
        this.name = this.getText(CardColumn.Name, true);
        this.type = CardType[this.getText(CardColumn.Type, true)];
        this.traits = this.getText(CardColumn.Traits).split(".").filter(t => t).map(t => t.trim());
        this.text = this.getAsHtml(CardColumn.Textbox);
        if (this.hasText(CardColumn.Flavor)) {
            this.flavor = this.getAsHtml(CardColumn.Flavor);
        }
        this.illustrator = this.getText(CardColumn.Illustrator) || "?";
        if (this.hasText(CardColumn.Designer)) {
            this.designer = this.getText(CardColumn.Designer);
        }
        if (this.faction !== Faction.Neutral) {
            this.loyal = this.getText(CardColumn.Loyal).toLowerCase() === "loyal";
        }
        switch (this.type) {
            case CardType.Character:
                this.strength = this.getNumber(CardColumn.Strength, true)
                this.icons = {
                    military: this.getText(CardColumn.Icons).includes("M"),
                    intrigue: this.getText(CardColumn.Icons).includes("I"),
                    power: this.getText(CardColumn.Icons).includes("P")
                };
            case CardType.Attachment:
            case CardType.Location:
                this.unique = this.getText(CardColumn.Unique, true) === "Unique";
            case CardType.Event:
                const cost = this.getNumber(CardColumn.Cost);
                this.cost = !isNaN(cost) ? cost : this.getText(CardColumn.Cost) || "-";
                break;
            case CardType.Plot:
                this.plotStats = {
                    income: this.getNumber(CardColumn.Income, true),
                    initiative: this.getNumber(CardColumn.Initiative, true),
                    claim: this.getNumber(CardColumn.Claim, true),
                    reserve: this.getNumber(CardColumn.Reserve, true)
                };
            case CardType.Agenda:
                // Nothing additional to add
                break;
        }

        this.deckLimit = this.hasText(CardColumn.Limit) ? this.getNumber(CardColumn.Limit) : DefaultDeckLimit[CardType[this.type]]

        // TODO: Revisit this once pack is being released
        // const packStr = encodeURIComponent(data.project.short);
        // const cardStr = encodeURIComponent(this.development.number.toString().padStart(2, "0") + "_" + this.name.replace("'", "_"));
        // this.imageUrl = "https://throneteki.ams3.cdn.digitaloceanspaces.com/packs/" + packStr + "/" + cardStr + ".png";
    }

    clone() {
        return new Card(this.development.project, this.toRichTextValues());
    }

    requiresIssue() {
        switch (this.development.note?.type) {
            case NoteType.Replaced:
            case NoteType.Reworked:
            case NoteType.Updated:
                return true;
            default:
                return this.requiresImplementation();
        }
    }

    requiresImplementation() {
        return this.development.version.is(1, 0) && !this.development.note && !this.development.playtestVersion;
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
        return this.code + " - " + this.name + "(v " + this.development.version.toString() + ")";
    }

    toJSON(): JSON {
        const obj: any = {
            code: this.code,
            type: CardType[this.type].toLowerCase(),
            name: this.name,
            octgnId: null,
            quantity: this.quantity,
            ...(this.unique && { unique: this.unique }),
            faction: Object.keys(Faction)[Object.values(Faction).indexOf(this.faction)].toLowerCase(),
            ...(this.plotStats && { plotStats: this.plotStats }),
            ...(this.loyal && { loyal: this.loyal }),
            ...(this.cost && { cost: this.cost }),
            ...(this.icons && { icons: this.icons }),
            ...(this.strength && { strength: this.strength }),
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
        const dashColumns = [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits];

        const testing = this;

        this.row = Array.from({ length: ColumnHelper.getCount(CardColumn) }, (v, i) => SpreadsheetApp.newRichTextValue().setText(dashColumns.includes(i) ? "-" : "").build());
        this.setText(CardColumn.Number, this.development.number);
        this.setText(CardColumn.Version, this.development.version.toString());
        this.setText(CardColumn.Faction, this.faction);
        this.setText(CardColumn.Name, this.name);
        this.setText(CardColumn.Type, CardType[this.type]);
        if (this.loyal != undefined) {
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
            this.row[CardColumn.ImageUrl] = SpreadsheetApp.newRichTextValue().setText(this.development.image.version.toString()).setLinkUrl(this.development.image.url).build();
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

        if (this.development.githubIssue) {
            this.row[CardColumn.GithubIssue] = SpreadsheetApp.newRichTextValue().setText(this.development.githubIssue.status).setLinkUrl(this.development.githubIssue.url).build();
        }

        switch (this.type) {
            case CardType.Character:
                this.setText(CardColumn.Strength, this.strength || 0);
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
                if (this.cost) {
                    this.setText(CardColumn.Cost, this.cost);
                }
                break;
            case CardType.Plot:
                this.setText(CardColumn.Income, this.plotStats?.income || 0);
                this.setText(CardColumn.Initiative, this.plotStats?.initiative || 0);
                this.setText(CardColumn.Claim, this.plotStats?.claim || 0);
                this.setText(CardColumn.Reserve, this.plotStats?.reserve || 0);
            case CardType.Agenda:
            // Nothing to set
        }
        return this.row;
    }
}

export { Card };