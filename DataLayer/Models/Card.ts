import { NoteType, Faction, CardType, DefaultDeckLimit, ProjectType } from "../../Common/Enums";
import { Project, SemanticVersion } from "./Project";
import { ImageAPI } from "../../Imaging/ImageAPI";
import { Issue } from "../../Github/Issues";
import { GithubAPI } from "../../Github/Github";
import { Endpoints } from "@octokit/types";
import { Data, DataRow } from "../Data";
import { CardColumn, Columns } from "../../Common/Columns";
import { DataObject } from "./DataObject";
import { Log } from "../../Common/Logger";

class Card extends DataObject {
    constructor(data: DataRow, public code: number, public development: Development, public faction: Faction, public name: string,
        public type: CardType, public traits: string[], public text: string, public illustrator: string, public deckLimit: number,
        public quantity: number, public flavor?: string, public designer?: string, public loyal?: boolean, public strength?: number | "X",
        public icons?: Icons, public unique?: boolean, public cost?: number | "X" | "-", public plotStats?: PlotStats) {
        super(data);
    }
    static fromData(data: DataRow): Card {
        try {
            const project = Data.instance.project;
            const number = data.getNumber(CardColumn.Number);
            // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
            const code = parseInt(project.code + (project.type === ProjectType.Cycle ? (number + 500) : number).toString().padStart(3, "0"));

            // Missing version should return a 'TBA' card
            if (!data.getString(CardColumn.Version)) {
                const tbaDevelopment = {
                    project,
                    number,
                    version: new SemanticVersion(0, 0, 0),
                    playtestVersion: new SemanticVersion(0, 0, 0),
                    note: { type: undefined, text: undefined }
                };
                return new Card(data, code, tbaDevelopment, Faction.Neutral, 'TBA', CardType.Character, [], '', '', 3, 3, undefined, undefined, undefined, 0, { military: false, intrigue: false, power: false }, false, 0, undefined);
            }
            const development = {
                project,
                number: number,
                version: SemanticVersion.fromString(data.getString(CardColumn.Version)),
                playtestVersion: data.hasValue(CardColumn.PlaytestVersion) ? SemanticVersion.fromString(data.getString(CardColumn.PlaytestVersion)) : undefined,
                note: {
                    type: data.hasValue(CardColumn.NoteType) ? NoteType[data.getString(CardColumn.NoteType)] : undefined,
                    text: data.hasValue(CardColumn.NoteText) ? data.getHtmlString(CardColumn.NoteText) : undefined
                },
                image: data.hasValue(CardColumn.ImageUrl) ? {
                    url: data.getRichTextValue(CardColumn.ImageUrl).getLinkUrl() || "",
                    version: SemanticVersion.fromString(data.getString(CardColumn.ImageUrl))
                } : undefined,
                githubIssue: data.hasValue(CardColumn.GithubIssue) ? {
                    status: data.getString(CardColumn.GithubIssue),
                    url: data.getRichTextValue(CardColumn.GithubIssue).getLinkUrl() || ""
                } : undefined,
                final: data.hasValue(CardColumn.PackShort) ? {
                    packCode: data.getString(CardColumn.PackShort),
                    number: data.getString(CardColumn.ReleaseNumber)
                } : undefined
            } as Development;
            const faction = data.getEnum<Faction>(Faction, CardColumn.Faction);
            const name = data.getString(CardColumn.Name);
            const type = CardType[data.getString(CardColumn.Type)];
            const traits = data.hasValue(CardColumn.Traits) ? data.getString(CardColumn.Traits).split(".").filter(t => t).map(t => t.trim()) : [];
            const text = data.getHtmlString(CardColumn.Textbox);
            const flavor = data.hasValue(CardColumn.Flavor) ? data.getHtmlString(CardColumn.Flavor) : undefined;
            const illustrator = data.hasValue(CardColumn.Illustrator) ? data.getString(CardColumn.Illustrator) : "?";
            const designer = data.hasValue(CardColumn.Designer) ? data.getString(CardColumn.Designer) : undefined;
            const loyal = faction !== Faction.Neutral ? data.getString(CardColumn.Loyal).toLowerCase() === "loyal" : undefined;

            let strength: number | "X" | undefined;
            let icons: Icons | undefined;
            let unique: boolean | undefined;
            let cost: number | "X" | "-" | undefined;
            let plotStats: PlotStats | undefined;
            switch (type) {
                case CardType.Character:
                    const strengthString = data.getString(CardColumn.Strength);
                    if (strengthString !== "X" && Number.isNaN(parseInt(strengthString))) {
                        throw new Error("Invalid strength value '" + strengthString + "': must be 'X' or a Number");
                    }
                    strength = strengthString == "X" ? "X" : parseInt(strengthString);
                    const iconsString = data.hasValue(CardColumn.Icons) ? data.getString(CardColumn.Icons) : "";
                    icons = {
                        military: iconsString.includes("M"),
                        intrigue: iconsString.includes("I"),
                        power: iconsString.includes("P")
                    } as Icons;
                case CardType.Attachment:
                case CardType.Location:
                    unique = data.getString(CardColumn.Unique) === "Unique";
                case CardType.Event:
                    const costString = data.hasValue(CardColumn.Cost) ? data.getString(CardColumn.Cost) : "-";
                    if (costString !== "X" && costString !== "-" && Number.isNaN(parseInt(costString))) {
                        throw new Error("Invalid cost value '" + costString + "': must be 'X', '-' or a Number");
                    }
                    cost = costString === "X" || costString === "-" ? costString : parseInt(costString);
                    break;
                case CardType.Plot:
                    plotStats = {
                        income: data.getNumber(CardColumn.Income),
                        initiative: data.getNumber(CardColumn.Initiative),
                        claim: data.getNumber(CardColumn.Claim),
                        reserve: data.getNumber(CardColumn.Reserve)
                    } as PlotStats;
                case CardType.Agenda:
                    // Nothing additional to add
                    break;
            }

            const deckLimit = data.hasValue(CardColumn.Limit) ? data.getNumber(CardColumn.Limit) : DefaultDeckLimit[CardType[type]];
            const quantity = 3;

            return new Card(data, code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor, designer,
                loyal, strength, icons, unique, cost, plotStats);
        } catch (e) {
            e.message = "Failed to create from below data row: " + e.message + "\n\n " + data.values.join(", ");
            throw e;
        }
    }

    syncIssue(project: Project, currentIssues: Endpoints["GET /search/issues"]["response"]["data"]["items"]): "Added" | "Updated" | "Closed" | undefined {
        if (!this.requiresImplementation) {
            return;
        }

        // Sync image before pushing new or updating old issue
        this.syncImage(project);
        const potentialIssue = Issue.for(this.getReferenceCard());

        const currentIssue = currentIssues.find(current => current.title === potentialIssue.title);

        let action: "Added" | "Updated" | "Closed" | undefined;

        if (currentIssue) {
            if (currentIssue.state === "closed") {
                if (this.development.githubIssue?.status !== "closed") {
                    this.development.githubIssue = { status: currentIssue.state, url: currentIssue.html_url };
                    action = "Closed";
                    Log.verbose("Set issue status of " + this.toString() + " to 'Closed'");
                }
            }
            // Check & Update issue if body is different (for open issues)
            else if (potentialIssue.body !== currentIssue.body) {
                potentialIssue.number = currentIssue.number;
                let { number, state, html_url } = GithubAPI.updateIssue(potentialIssue);
                this.development.githubIssue = { status: state, url: html_url };
                action = "Updated";
                Log.verbose("Updated existing issue (#" + number + ") for " + this.toString());
            }
        } else {
            // Create new issue
            let { number, state, html_url } = GithubAPI.addIssue(potentialIssue);
            this.development.githubIssue = { status: state, url: html_url };
            action = "Added";
            Log.verbose("Added new issue for " + this.toString() + ": #" + number);
        }

        if (action === "Closed" && this.isImplemented && this.development.note.type === undefined) {
            this.development.note.type = NoteType.Implemented;
            Log.verbose("Marked " + this.toString() + " as implemented");
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

    toJSON(workInProgress = false): JSON {
        const obj: any = {
            code: workInProgress || !this.development.final ? this.code : parseInt(this.development.project.code + this.development.final.number.toString().padStart(3, "0")),
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
            imageUrl: workInProgress ? this.development.image?.url || "" : this.releaseUrl
        }
        return obj as JSON;
    }

    syncData() {
        const newData = DataRow.new(Columns.getAmount(CardColumn), [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits]);

        try {
            newData.setString(CardColumn.Number, this.development.number);
            newData.setString(CardColumn.Version, this.development.version.toString());
            newData.setString(CardColumn.Faction, this.faction);
            newData.setString(CardColumn.Name, this.name);
            newData.setString(CardColumn.Type, CardType[this.type]);
            if (this.loyal !== undefined) {
                newData.setString(CardColumn.Loyal, this.loyal ? "Loyal" : "Non-Loyal");
            }
            if (this.traits.length > 0) {
                newData.setString(CardColumn.Traits, this.traits.map(t => t + ".").join(" "));
            }
            newData.setHtmlString(CardColumn.Textbox, this.text);
            if (this.flavor) {
                newData.setHtmlString(CardColumn.Flavor, this.flavor);
            }
            if (this.deckLimit !== DefaultDeckLimit[CardType[this.type]]) {
                newData.setString(CardColumn.Limit, this.deckLimit);
            }
            if (this.designer) {
                newData.setString(CardColumn.Designer, this.designer);
            }
            if (this.illustrator !== "?") {
                newData.setString(CardColumn.Illustrator, this.illustrator);
            }
            if (this.development.image) {
                newData.setRichTextValue(CardColumn.ImageUrl, SpreadsheetApp.newRichTextValue().setText(this.development.image.version.toString()).setLinkUrl(this.development.image.url).build());
            }
            if (this.development.note.type !== undefined) {
                newData.setString(CardColumn.NoteType, NoteType[this.development.note.type]);
            }
            if (this.development.note.text) {
                newData.setHtmlString(CardColumn.NoteText, this.development.note.text);
            }
            if (this.development.playtestVersion) {
                newData.setString(CardColumn.PlaytestVersion, this.development.playtestVersion.toString());
            }

            if (this.development.githubIssue?.status && this.development.githubIssue?.url) {
                newData.setRichTextValue(CardColumn.GithubIssue, SpreadsheetApp.newRichTextValue().setText(this.development.githubIssue.status).setLinkUrl(this.development.githubIssue.url).build());
            }

            if (this.development.final?.packCode) {
                newData.setString(CardColumn.PackShort, this.development.final.packCode);
            }
            if (this.development.final?.number) {
                newData.setString(CardColumn.ReleaseNumber, this.development.final.number);
            }

            switch (this.type) {
                case CardType.Character:
                    newData.setString(CardColumn.Strength, this.strength !== undefined ? this.strength : "-");
                    const iconLetters = [
                        ... this.icons?.military ? ["M"] : [],
                        ... this.icons?.intrigue ? ["I"] : [],
                        ... this.icons?.power ? ["P"] : []
                    ];
                    newData.setString(CardColumn.Icons, iconLetters.join(" / "));
                case CardType.Attachment:
                case CardType.Location:
                    newData.setString(CardColumn.Unique, this.unique ? "Unique" : "Non-Unique");
                case CardType.Event:
                    newData.setString(CardColumn.Cost, this.cost !== undefined ? this.cost : "-");
                    break;
                case CardType.Plot:
                    newData.setString(CardColumn.Income, this.plotStats?.income || 0);
                    newData.setString(CardColumn.Initiative, this.plotStats?.initiative || 0);
                    newData.setString(CardColumn.Claim, this.plotStats?.claim || 0);
                    newData.setString(CardColumn.Reserve, this.plotStats?.reserve || 0);
                case CardType.Agenda:
                // Nothing to set
            }

            // Update DataRow to newly created data
            this.data = newData;

            return true;
        } catch (e) {
            Log.error("Failed to create RowData for card #" + this.development.number + ". JSON dump of card values:\n" + JSON.stringify(this));
            Log.error("Caused by the following error: " + e);
            // DataRow will not be updated (original values retained)
            return false;
        }
    }

    toString() {
        return this.name + " (v" + this.development.version.toString() + ")";
    }

    clone() {
        // Log.verbose("Cloning '" + this.toString() + "'...");
        // const start = new Date();

        const code = this.code;
        const development = {
            project: this.development.project, // All cards can share same project reference
            number: this.development.number,
            version: this.development.version.clone(),
            playtestVersion: !this.development.playtestVersion ? this.development.playtestVersion : this.development.playtestVersion.clone(),
            note: {
                type: this.development.note.type,
                text: this.development.note.text
            },
            githubIssue: !this.development.githubIssue ? this.development.githubIssue : {
                status: this.development.githubIssue.status,
                url: this.development.githubIssue.url
            },
            image: !this.development.image ? this.development.image : {
                url: this.development.image.url,
                version: this.development.image.version.clone()
            },
            final: !this.development.final ? this.development.final : {
                packCode: this.development.final.packCode,
                number: this.development.final.number
            }
        };
        const faction = this.faction;
        const name = this.name;
        const type = this.type;
        const traits = [...this.traits];
        const text = this.text;
        const illustrator = this.illustrator;
        const deckLimit = this.deckLimit;
        const quantity = this.quantity;
        const flavor = this.flavor;
        const designer = this.designer;
        const loyal = this.loyal;
        const strength = this.strength;
        const icons = !this.icons ? undefined : {
            military: this.icons.military,
            intrigue: this.icons.intrigue,
            power: this.icons.power
        };
        const unique = this.unique;
        const cost = this.cost;
        const plotStats = !this.plotStats ? this.plotStats : {
            income: this.plotStats.income,
            initiative: this.plotStats.initiative,
            claim: this.plotStats.claim,
            reserve: this.plotStats.reserve
        };
        const clone = new Card(this.data, code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor,
            designer, loyal, strength, icons, unique, cost, plotStats);
        // const end = new Date();
        // Log.verbose("Successfully cloned in " + (end.getTime() - start.getTime()) + "ms!");
        return clone;
    }

    // legacyClone() {
    //     // Log.verbose("Cloning '" + this.toString() + "' (Legacy)...");
    //     // const start = new Date();
    //     this.syncData();
    //     const clone = Card.fromData(this.data);
    //     // const end = new Date();
    //     // Log.verbose("Successfully cloned in " + (end.getTime() - start.getTime()) + "ms!");
    //     return clone;
    // }

    /**
     *  @returns True if this card is being or needs to be implemented online
     */
    get requiresImplementation() {
        return this.development.githubIssue ? this.development.githubIssue.status !== "closed" : !this.development.version.equals(this.development.playtestVersion);
    }
    /**
     *  @returns True if this card has been implemented online
     */
    get isImplemented() {
        return this.development.githubIssue ? this.development.githubIssue.status === "closed" : this.development.version.equals(this.development.playtestVersion);
    }
    /**
     * @returns True if this card has been implemented online after the previous playtesting update
     */
    get isNewlyImplemented() {
        return this.development.githubIssue?.status === "closed";
    }
    /**
     * @returns True if this card is the initial 1.0 version
     */
    get isInitial() {
        return this.development.version.is(1, 0);
    }
    /**
     * @returns True if this card is the initial 1.0 version, and has not been published for playtesting
     */
    get isPreRelease() {
        return this.isInitial && !this.development.version.equals(this.development.playtestVersion);
    }
    /**
     *  @returns True if this card has been changed (eg. not in its initial or currently playtested state)
     */
    get isChanged() {
        return !this.isInitial && !this.development.version.equals(this.development.playtestVersion);
    }

    /***
     * @returns True if this card has all data ready to be released
     */
    get isReleasable() {
        return this.development.final && this.development.final.packCode && this.development.final.number;
    }

    /***
     * @returns The url for this card, ready for release
     */
    get releaseUrl() {
        if(!this.isReleasable) {
            return "";
        }
        const urlNumber = this.development.final?.number;
        const name = encodeURI(this.name.replace(/[<>:"/\\|?*]/g, "").replace(/\s/g, "_"));
        return "https://throneteki.ams3.cdn.digitaloceanspaces.com/packs/" + this.development.final?.packCode + "/" + urlNumber + "_" + name + ".png";
    }

    /**
     * @returns Gets the copy of this card which is currently being referenced for issues/coding
     */
    getReferenceCard() {
        if (!this.isImplemented && this.development.version.equals(this.development.playtestVersion)) {
            return Data.instance.getArchivedCard(this.development.number, this.development.version);
        }
        return this;
    }
}

interface Development {
    project: Project,
    number: number,
    version: SemanticVersion,
    playtestVersion?: SemanticVersion | null,
    note: {
        type?: NoteType,
        text?: string // Maybe HTML type?
    },
    githubIssue?: {
        status: string,
        url: string
    },
    image?: {
        url: string,
        version: SemanticVersion
    },
    final?: {
        packCode: string,
        number: number
    }
};

interface Icons {
    military: boolean,
    intrigue: boolean,
    power: boolean
}

interface PlotStats {
    income: number,
    initiative: number,
    claim: number,
    reserve: number
}
export { Card };

// function test_clone_speed() {
//     console.log("Starting clone speed test...");
//     const cards = Data.instance.latestCards;
//     let start = new Date();
//     cards.map(card => card.legacyClone());
//     let end = new Date();
//     Log.verbose("Test #1: Cloned " + cards.length + " cards using legacyClone(): " + (end.getTime() - start.getTime()) + "ms");

//     start = new Date();
//     cards.map(card => card.clone());
//     end = new Date();
//     Log.verbose("Test #1: Cloned " + cards.length + " cards using clone(): " + (end.getTime() - start.getTime()) + "ms");

//     start = new Date();
//     cards.map(card => card.clone());
//     end = new Date();
//     Log.verbose("Test #2: Cloned " + cards.length + " cards using clone(): " + (end.getTime() - start.getTime()) + "ms");

//     start = new Date();
//     cards.map(card => card.legacyClone());
//     end = new Date();
//     Log.verbose("Test #2: Cloned " + cards.length + " cards using legacyClone(): " + (end.getTime() - start.getTime()) + "ms");
// }

// function test_clone() {
//     console.log("Starting clone test...");
//     const data = Data.instance;
//     let testing = data.latestCards.find(a => a.type === CardType.Character) as Card;
//     let cloned = testing.clone();
//     cloned.name = testing.name + " testing";
//     cloned.development.version = cloned.development.version.increment(1);
//     cloned.traits.push("test");
//     if (cloned.icons && testing.icons) cloned.icons.military = !testing.icons.military;

//     const failed: string[] = [];
//     if (testing.name === cloned.name) {
//         failed.push("Name value incorrectly matches.");
//     }
//     if (testing.development.version.equals(cloned.development.version)) {
//         failed.push("Version incorrectly matches.");
//     }
//     if (testing.traits.length === cloned.traits.length) {
//         failed.push("Traits incorrectly match.");
//     }
//     if (testing.icons?.military === cloned.icons?.military) {
//         failed.push("Icons incorrectly match.");
//     }
//     if (failed.length > 0) {
//         console.log("Failed:\n- " + failed.join("\n- "));
//     } else {
//         console.log("Passed!");
//     }
// }