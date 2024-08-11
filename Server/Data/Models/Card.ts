import { SemVer } from "semver";
import * as Ver from "semver";
import Project from "./Project.js";
import { CardType, DefaultDeckLimit, Faction, getEnum, getEnumName, maxEnum, NoteType } from "../../../Common/Enums.js";
import Server from "@/Server/Server.js";
import { CardId, CardColumn } from "@/Common/CardSheetInfo.js";

class Card {
    constructor(public code: number, public development: Development, public faction: Faction, public name: string,
        public type: CardType, public traits: string[], public text: string, public illustrator: string, public deckLimit: number,
        public quantity: number, public flavor?: string, public designer?: string, public loyal?: boolean, public strength?: number | "X",
        public icons?: Icons, public unique?: boolean, public cost?: number | "X" | "-", public plotStats?: PlotStats) {

        // Empty
    }

    // syncIssue(currentIssues: Endpoints["GET /search/issues"]["response"]["data"]["items"]): "Added" | "Updated" | "Closed" | undefined {
    //     if (!this.requiresImplementation) {
    //         return;
    //     }

    //     // Sync image before pushing new or updating old issue
    //     this.syncImage();
    //     const potentialIssue = Issue.for(this.getReferenceCard());

    //     const currentIssue = currentIssues.find(current => current.title === potentialIssue.title);

    //     let action: "Added" | "Updated" | "Closed" | undefined;

    //     if (currentIssue) {
    //         if (currentIssue.state === "closed") {
    //             if (this.development.github?.status !== "closed") {
    //                 this.development.github = { status: currentIssue.state, issueUrl: currentIssue.html_url };
    //                 action = "Closed";
    //                 Log.verbose("Set issue status of " + this.toString() + " to 'Closed'");
    //             }
    //         }
    //         // Check & Update issue if body is different (for open issues)
    //         else if (potentialIssue.body !== currentIssue.body) {
    //             potentialIssue.number = currentIssue.number;
    //             let { number, state, html_url } = GithubAPI.updateIssue(potentialIssue);
    //             this.development.github = { status: state, issueUrl: html_url };
    //             action = "Updated";
    //             Log.verbose("Updated existing issue (#" + number + ") for " + this.toString());
    //         }
    //     } else {
    //         // Create new issue
    //         let { number, state, html_url } = GithubAPI.addIssue(potentialIssue);
    //         this.development.github = { status: state, issueUrl: html_url };
    //         action = "Added";
    //         Log.verbose("Added new issue for " + this.toString() + ": #" + number);
    //     }

    //     if (action === "Closed" && this.isImplemented && this.development.note) {
    //         this.development.note.type = NoteType.Implemented;
    //         Log.verbose("Marked " + this.toString() + " as implemented");
    //     }
    //     return action;
    // }

    toJSON(workInProgress = false) {
        const obj: CardJSON = {
            code: workInProgress || !this.development.final ? this.code.toString() : this.development.project.code + this.development.final.number.toString().padStart(3, "0"),
            ...(workInProgress && { version: this.development.versions.current.toString() }),
            type: CardType[this.type].toLowerCase(),
            name: this.name,
            octgnId: null,
            quantity: this.quantity,
            ...(this.unique !== undefined && { unique: this.unique }),
            faction: getEnumName(Faction, this.faction).toLowerCase(),
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
            imageUrl: this.imageUrl
        };
        return obj;
    }

    static deserialise(project: Project, data: unknown[]) {
        const stripHTML = (str: string) => str.replace(/<[^>]*>/g, "");
        const htmlColumns = [CardColumn.Textbox, CardColumn.Flavor, CardColumn.NoteText];
        const extractLinkText = (str: string) => {
            const regex = /<a\s+href="(.+)">([^<]*)<\/a>/gm;
            const groups = regex.exec(str);
            if (groups === null) {
                throw Error(`Failed to extract link/text from '${str}'`);
            }
            return {
                link: groups[1],
                text: groups[2]
            };
        };
        const parseTypedNumber = <T>(str: string) => {
            try {
                if (!Number.isNaN(parseInt(str))) {
                    return parseInt(str);
                }
                return str as T;
            } catch {
                throw Error(`Invalid value '${str}' cannot be cast to Number or special type`);
            }
        };

        const sData = data.map((value, index) => htmlColumns.includes(index) ? value.toString() : stripHTML(value.toString()));
        try {
            const number = parseInt(sData[CardColumn.Number]);
            // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
            const code = project.getDevCardCodeFor(number);

            // Missing version should return a 'TBA' card
            if (!sData[CardColumn.Version]) {
                const tbaDevelopment = {
                    id: new CardId(number),
                    number,
                    project,
                    versions: {
                        current: new SemVer("0.0.0"),
                        playtesting: new SemVer("0.0.0")
                    }
                };
                return new Card(code, tbaDevelopment, Faction.Neutral, "TBA", CardType.Character, [], "", "", 3, 3, undefined, undefined, undefined, 0, { military: false, intrigue: false, power: false }, false, 0, undefined);
            }
            const development = {
                id: new CardId(number, sData[CardColumn.Version]),
                number: number,
                project,
                versions: {
                    current: new SemVer(sData[CardColumn.Version]),
                    playtesting: sData[CardColumn.PlaytestVersion] ? new SemVer(sData[CardColumn.PlaytestVersion]) : undefined
                },
                note: sData[CardColumn.NoteType] || sData[CardColumn.NoteText] ? {
                    type: sData[CardColumn.NoteType] ? NoteType[sData[CardColumn.NoteType]] : undefined,
                    text: sData[CardColumn.NoteText] ? sData[CardColumn.NoteText] : undefined
                } : undefined,
                github: sData[CardColumn.GithubIssue] ? {
                    status: sData[CardColumn.GithubIssue],
                    issueUrl: extractLinkText(sData[CardColumn.GithubIssue]).link || ""
                } : undefined,
                final: sData[CardColumn.PackShort] ? {
                    packShort: sData[CardColumn.PackShort],
                    number: parseInt(sData[CardColumn.ReleaseNumber])
                } : undefined
            } as Development;
            const faction = getEnum<Faction>(Faction, sData[CardColumn.Faction]);
            const name = sData[CardColumn.Name];
            const type = CardType[sData[CardColumn.Type]];
            const traits = sData[CardColumn.Traits] ? sData[CardColumn.Traits].split(".").map(t => t.trim()).filter(t => t && t != "-") : [];
            const text = sData[CardColumn.Textbox];
            const flavor = sData[CardColumn.Flavor] ? sData[CardColumn.Flavor] : undefined;
            const illustrator = sData[CardColumn.Illustrator] ? sData[CardColumn.Illustrator] : "?";
            const designer = sData[CardColumn.Designer] ? sData[CardColumn.Designer] : undefined;
            const loyal = faction !== Faction.Neutral ? sData[CardColumn.Loyal].toLowerCase() === "loyal" : undefined;

            let strength: number | "X" | undefined;
            let icons: Icons | undefined;
            let unique: boolean | undefined;
            let cost: number | "X" | "-" | undefined;
            let plotStats: PlotStats | undefined;
            switch (type) {
                case CardType.Character:
                    strength = parseTypedNumber(sData[CardColumn.Strength]);
                    const iconsString = sData[CardColumn.Icons];
                    icons = {
                        military: iconsString.includes("M"),
                        intrigue: iconsString.includes("I"),
                        power: iconsString.includes("P")
                    } as Icons;
                case CardType.Attachment:
                case CardType.Location:
                    unique = sData[CardColumn.Unique] === "Unique";
                case CardType.Event:
                    cost = parseTypedNumber(sData[CardColumn.Cost] ? sData[CardColumn.Cost] : "-");
                    break;
                case CardType.Plot:
                    plotStats = {
                        income: parseTypedNumber(sData[CardColumn.Income]),
                        initiative: parseTypedNumber(sData[CardColumn.Initiative]),
                        claim: parseTypedNumber(sData[CardColumn.Claim]),
                        reserve: parseTypedNumber(sData[CardColumn.Reserve])
                    } as PlotStats;
                case CardType.Agenda:
                    // Nothing additional to add
                    break;
            }

            const deckLimit = sData[CardColumn.Limit] ? parseInt(sData[CardColumn.Limit]) : DefaultDeckLimit[CardType[type]];
            const quantity = 3;

            return new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor, designer,
                loyal, strength, icons, unique, cost, plotStats);
        } catch (err) {
            throw Error(`Failed to deserialise ${sData[CardColumn.Number] ? `card #${sData[CardColumn.Number]}` : "card with unknown or invalid #"}`, { cause: err });
        }
    }

    static serialise(card: Card) {
        const data: string[] = Array.from({ length: maxEnum(CardColumn) }, (v, i) => [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits].includes(i) ? "-" : "");

        try {
            data[CardColumn.Number] = card.development.number.toString();
            data[CardColumn.Version] = card.development.versions.current.toString();
            data[CardColumn.Faction] = card.faction.toString();
            data[CardColumn.Name] = card.name;
            data[CardColumn.Type] = CardType[card.type];
            data[CardColumn.Loyal] = card.loyal !== undefined ? (card.loyal ? "Loyal" : "Non-Loyal") : "-";
            data[CardColumn.Traits] = card.traits.length > 0 ? card.traits.map(t => t + ".").join(" ") : "-";
            data[CardColumn.Textbox] = card.text;
            data[CardColumn.Flavor] = card.flavor || "";
            data[CardColumn.Limit] = card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? card.deckLimit.toString() : "";
            data[CardColumn.Designer] = card.designer || "";
            data[CardColumn.Illustrator] = card.illustrator !== "?" ? card.illustrator : "";
            data[CardColumn.NoteType] = card.development.note ? NoteType[card.development.note.type] : "";
            data[CardColumn.NoteText] = card.development.note?.text || "";
            data[CardColumn.PlaytestVersion] = card.development.versions.playtesting?.toString() || "";
            data[CardColumn.GithubIssue] = card.development.github ? `<a href="${card.development.github.issueUrl}">${card.development.github.status}</a>` : "";
            data[CardColumn.PackShort] = card.development.final?.packShort || "";
            data[CardColumn.ReleaseNumber] = card.development.final?.number.toString() || "";

            switch (card.type) {
                case CardType.Character:
                    data[CardColumn.Strength] = card.strength?.toString() || "-";
                    const iconLetters = [
                        ... card.icons?.military ? ["M"] : [],
                        ... card.icons?.intrigue ? ["I"] : [],
                        ... card.icons?.power ? ["P"] : []
                    ];
                    data[CardColumn.Icons] = iconLetters.join(" / ");
                case CardType.Attachment:
                case CardType.Location:
                    data[CardColumn.Unique] = card.unique ? "Unique" : "Non-Unique";
                case CardType.Event:
                    data[CardColumn.Cost] = card.cost?.toString() || "-";
                    break;
                case CardType.Plot:
                    data[CardColumn.Income] = (card.plotStats?.income || 0).toString();
                    data[CardColumn.Initiative] = (card.plotStats?.initiative || 0).toString();
                    data[CardColumn.Claim] = (card.plotStats?.claim || 0).toString();
                    data[CardColumn.Reserve] = (card.plotStats?.reserve || 0).toString();
                case CardType.Agenda:
                // Nothing to set
            }
        } catch (err) {
            throw Error(`Failed to serialise card: ${err}`);
        }

        return data;
    }

    toString() {
        return this.name + " (v" + this.development.versions.current.toString() + ")";
    }

    clone() {
        const code = this.code;
        const development = {
            id: new CardId(this.development.number, this.development.versions.current.toString()),
            number: this.development.number,
            project: this.development.project,
            versions: {
                current: new SemVer(this.development.versions.current),
                playtesting: !this.development.versions.playtesting ? this.development.versions.playtesting : new SemVer(this.development.versions.playtesting)
            },
            note: !this.development.note ? this.development.note : {
                type: this.development.note.type,
                text: this.development.note.text
            },
            github: !this.development.github ? this.development.github : {
                status: this.development.github.status,
                issueUrl: this.development.github.issueUrl
            },
            final: !this.development.final ? this.development.final : {
                packShort: this.development.final.packShort,
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
        const clone = new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor,
            designer, loyal, strength, icons, unique, cost, plotStats);
        return clone;
    }

    get imageUrl() {
        if (!this.isReleasable) {
            return encodeURI(`${Server.apiUrl}/img/${this.development.project.short}/${this.development.id.toString()}.png`);
        }
        const project = this.development.project.short;
        const number = this.development.final?.number;
        const name = this.name.replace(/[<>:"/\\|?*']/g, "").replace(/\s/g, "_");
        return encodeURI(`https://throneteki.ams3.cdn.digitaloceanspaces.com/packs/${project}/${number}_${name}.png`);
    }

    /**
     * @returns True if this card is the initial 0.0.0 version
     */
    get isInitial() {
        return Ver.eq(this.development.versions.current, "0.0.0");
    }
    /**
     * @returns True if the card is in a draft state (eg. it is currently being edited, but not pushed to playtesting yet)
     */
    get isDraft() {
        return this.isInitial || (this.development.note && this.isPlaytesting);
    }
    /**
     * @returns True if this card is currently the version being playtested
     */
    get isPlaytesting() {
        return this.development.versions.playtesting && Ver.eq(this.development.versions.current, this.development.versions.playtesting);
    }
    // /**
    //  *  @returns True if this card is being or needs to be implemented online
    //  */
    // get requiresImplementation() {
    //     return this.development.github ? this.development.github.status !== "closed" : this.isInitial || this.isChanged;
    // }
    /**
     *  @returns True if this card has been implemented online
     */
    get isImplemented() {
        return this.development.github ? this.development.github.status === "closed" : this.isPlaytesting;
    }
    // /**
    //  * @returns True if this card has been implemented online after the previous playtesting update
    //  */
    // get isNewlyImplemented() {
    //     return this.development.github?.status === "closed";
    // }
    // /**
    //  * @returns True if this card is currently the version being playtested
    //  */
    // get isBeingPlaytested() {
    //     return this.development.versions.playtesting && eq(this.development.versions.current, this.development.versions.playtesting);
    // }
    // /**
    //  * @returns True if this card is the pre 0.0.0 version
    //  */
    // get isPreview() {
    //     return eq(this.development.versions.current, "0.0.0");
    // }
    // /**
    //  *  @returns True if this card has been changed (eg. not in its initial or currently playtested state)
    //  */
    // get isChanged() {
    //     return this.development.note && this.development.note.type !== NoteType.Implemented;
    // }

    /***
     * @returns True if this card has all data ready to be released
     */
    get isReleasable() {
        return this.development.final && this.development.final.packShort && this.development.final.number;
    }
}

interface Development {
    id: CardId,
    number: number,
    project: Project,
    versions: {
        current: SemVer,
        playtesting?: SemVer
    },
    note?: {
        type: NoteType,
        text: string
    },
    github?: {
        status: "open" | "closed",
        issueUrl: string
    },
    final?: {
        packShort: string,
        number: number
    }
};

interface Icons {
    military: boolean,
    intrigue: boolean,
    power: boolean
}

interface PlotStats {
    income: number | "X",
    initiative: number | "X",
    claim: number | "X",
    reserve: number | "X"
}

interface CardJSON {
    code: string,
    workInProgress?: boolean,
    type: string,
    name: string,
    octgnId?: string,
    quantity: number,
    unique?: boolean,
    faction: string,
    plotStats?: PlotStats,
    loyal?: boolean,
    cost?: number | "X" | "-",
    icons?: Icons,
    strength?: number | "X",
    traits: string[],
    text: string,
    flavor?: string,
    deckLimit: number,
    illustrator: string,
    designer?: string,
    imageUrl: string
}

export default Card;