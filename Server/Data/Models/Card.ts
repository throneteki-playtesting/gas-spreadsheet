import * as Ver from "semver";
import Server from "@/Server/Server.js";
import { CardModel, CardId, DefaultDeckLimit, Faction, NoteType, Type } from "@/Common/Models/Card.js";
import { SemanticVersion } from "@/Common/Utils.js";
import { Joi } from "celebrate";


class Card implements CardModel {
    public id: CardId;
    public code: number;
    public quantity: 3;
    constructor(
        public project: number,
        public number: number,
        public version: SemanticVersion,
        public faction: Faction,
        public name: string,
        public type: Type,
        public traits: string[],
        public text: string,
        public illustrator: string,
        public deckLimit: number = DefaultDeckLimit[type],
        public loyal?: boolean,
        public flavor?: string,
        public designer?: string,
        public cost?: number | "X" | "-",
        public unique?: boolean,
        public strength?: number | "X",
        public icons?: {
            military: boolean,
            intrigue: boolean,
            power: boolean
        },
        public plotStats?: {
            income: number | "X",
            initiative: number | "X",
            claim: number | "X",
            reserve: number | "X"
        },
        public note?: {
            type: NoteType,
            text: string
        },
        public playtesting?: SemanticVersion,
        public github?: {
            status: string,
            issueUrl: string
        },
        public release?: {
            short: string,
            number: number
        }
    ) {
        this.id = `${number}@${version}`;
        // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
        const codeString = this.project.toString() + (number + 500).toString().padStart(3, "0");
        this.code = parseInt(codeString);
    }

    public get typeLower() {
        return this.type.toLowerCase();
    }

    public get factionLower() {
        return this.faction.toLowerCase().replaceAll(/[\s']|(?:house)/gi, "");
    }

    toJSON() {
        const obj = {
            code: this.isReleasable ? this.project + this.release.number.toString().padStart(3, "0") : this.code.toString(),
            ...(!this.isReleasable && { version: this.version }),
            type: this.typeLower,
            name: this.name,
            octgnId: null,
            quantity: this.quantity,
            ...(this.unique !== undefined && { unique: this.unique }),
            faction: this.factionLower,
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

    // static deserialise(project: Project, data: unknown[]) {
    //     const stripHTML = (str: string) => str.replace(/<[^>]*>/g, "");
    //     const htmlColumns = [CardColumn.Textbox, CardColumn.Flavor, CardColumn.NoteText];
    //     const extractLinkText = (str: string) => {
    //         const regex = /<a\s+href="(.+)">([^<]*)<\/a>/gm;
    //         const groups = regex.exec(str);
    //         if (groups === null) {
    //             throw Error(`Failed to extract link/text from '${str}'`);
    //         }
    //         return {
    //             link: groups[1],
    //             text: groups[2]
    //         };
    //     };
    //     const parseTypedNumber = <T>(str: string) => {
    //         try {
    //             if (!Number.isNaN(parseInt(str))) {
    //                 return parseInt(str);
    //             }
    //             return str as T;
    //         } catch {
    //             throw Error(`Invalid value '${str}' cannot be cast to Number or special type`);
    //         }
    //     };

    //     const sData = data.map((value, index) => htmlColumns.includes(index) ? value.toString() : stripHTML(value.toString()));
    //     try {
    //         const number = parseInt(sData[CardColumn.Number]);
    //         // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
    //         const code = project.getDevCardCodeFor(number);

    //         // Missing version should return a 'TBA' card
    //         if (!sData[CardColumn.Version]) {
    //             const tbaDevelopment = {
    //                 id: new CardId(number),
    //                 number,
    //                 project,
    //                 versions: {
    //                     current: new SemVer("0.0.0"),
    //                     playtesting: new SemVer("0.0.0")
    //                 }
    //             };
    //             return new Card(code, tbaDevelopment, "Neutral", "TBA", "Character", [], "", "", 3, 3, undefined, undefined, undefined, 0, { military: false, intrigue: false, power: false }, false, 0, undefined);
    //         }
    //         const development = {
    //             id: new CardId(number, sData[CardColumn.Version]),
    //             number: number,
    //             project,
    //             versions: {
    //                 current: new SemVer(sData[CardColumn.Version]),
    //                 playtesting: sData[CardColumn.PlaytestVersion] ? new SemVer(sData[CardColumn.PlaytestVersion]) : undefined
    //             },
    //             note: sData[CardColumn.NoteType] || sData[CardColumn.NoteText] ? {
    //                 type: sData[CardColumn.NoteType] ? sData[CardColumn.NoteType] : undefined,
    //                 text: sData[CardColumn.NoteText] ? sData[CardColumn.NoteText] : undefined
    //             } : undefined,
    //             github: sData[CardColumn.GithubIssue] ? {
    //                 status: sData[CardColumn.GithubIssue],
    //                 issueUrl: extractLinkText(sData[CardColumn.GithubIssue]).link || ""
    //             } : undefined,
    //             final: sData[CardColumn.PackShort] ? {
    //                 packShort: sData[CardColumn.PackShort],
    //                 number: parseInt(sData[CardColumn.ReleaseNumber])
    //             } : undefined
    //         } as Development;
    //         const faction = sData[CardColumn.Faction] as Faction;
    //         const name = sData[CardColumn.Name];
    //         const type = sData[CardColumn.Type] as Type;
    //         const traits = sData[CardColumn.Traits] ? sData[CardColumn.Traits].split(".").map(t => t.trim()).filter(t => t && t != "-") : [];
    //         const text = sData[CardColumn.Textbox];
    //         const flavor = sData[CardColumn.Flavor] ? sData[CardColumn.Flavor] : undefined;
    //         const illustrator = sData[CardColumn.Illustrator] ? sData[CardColumn.Illustrator] : "?";
    //         const designer = sData[CardColumn.Designer] ? sData[CardColumn.Designer] : undefined;
    //         const loyal = faction !== "Neutral" ? sData[CardColumn.Loyal].toLowerCase() === "loyal" : undefined;

    //         let strength: number | "X" | undefined;
    //         let icons: Icons | undefined;
    //         let unique: boolean | undefined;
    //         let cost: number | "X" | "-" | undefined;
    //         let plotStats: PlotStats | undefined;
    //         switch (type) {
    //             case "Character":
    //                 strength = parseTypedNumber(sData[CardColumn.Strength]);
    //                 const iconsString = sData[CardColumn.Icons];
    //                 icons = {
    //                     military: iconsString.includes("M"),
    //                     intrigue: iconsString.includes("I"),
    //                     power: iconsString.includes("P")
    //                 } as Icons;
    //             case "Attachment":
    //             case "Location":
    //                 unique = sData[CardColumn.Unique] === "Unique";
    //             case "Event":
    //                 cost = parseTypedNumber(sData[CardColumn.Cost] ? sData[CardColumn.Cost] : "-");
    //                 break;
    //             case "Plot":
    //                 plotStats = {
    //                     income: parseTypedNumber(sData[CardColumn.Income]),
    //                     initiative: parseTypedNumber(sData[CardColumn.Initiative]),
    //                     claim: parseTypedNumber(sData[CardColumn.Claim]),
    //                     reserve: parseTypedNumber(sData[CardColumn.Reserve])
    //                 } as PlotStats;
    //             case "Agenda":
    //                 // Nothing additional to add
    //                 break;
    //         }

    //         const deckLimit = sData[CardColumn.Limit] ? parseInt(sData[CardColumn.Limit]) : DefaultDeckLimit[type];
    //         const quantity = 3;

    //         return new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor, designer,
    //             loyal, strength, icons, unique, cost, plotStats);
    //     } catch (err) {
    //         throw Error(`Failed to deserialise ${sData[CardColumn.Number] ? `card #${sData[CardColumn.Number]}` : "card with unknown or invalid #"}`, { cause: err });
    //     }
    // }

    // static serialise(card: Card) {
    //     const data: string[] = Array.from({ length: maxEnum(CardColumn) }, (v, i) => [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits].includes(i) ? "-" : "");

    //     try {
    //         data[CardColumn.Number] = card.development.number.toString();
    //         data[CardColumn.Version] = card.development.versions.current.toString();
    //         data[CardColumn.Faction] = card.faction.toString();
    //         data[CardColumn.Name] = card.name;
    //         data[CardColumn.Type] = card.type as string;
    //         data[CardColumn.Loyal] = card.loyal !== undefined ? (card.loyal ? "Loyal" : "Non-Loyal") : "-";
    //         data[CardColumn.Traits] = card.traits.length > 0 ? card.traits.map(t => t + ".").join(" ") : "-";
    //         data[CardColumn.Textbox] = card.text;
    //         data[CardColumn.Flavor] = card.flavor || "";
    //         data[CardColumn.Limit] = card.deckLimit !== DefaultDeckLimit[card.type] ? card.deckLimit.toString() : "";
    //         data[CardColumn.Designer] = card.designer || "";
    //         data[CardColumn.Illustrator] = card.illustrator !== "?" ? card.illustrator : "";
    //         data[CardColumn.NoteType] = card.development.note ? card.development.note.type as string : "";
    //         data[CardColumn.NoteText] = card.development.note?.text || "";
    //         data[CardColumn.PlaytestVersion] = card.development.versions.playtesting?.toString() || "";
    //         data[CardColumn.GithubIssue] = card.development.github ? `<a href="${card.development.github.issueUrl}">${card.development.github.status}</a>` : "";
    //         data[CardColumn.PackShort] = card.development.final?.packShort || "";
    //         data[CardColumn.ReleaseNumber] = card.development.final?.number.toString() || "";

    //         switch (card.type) {
    //             case "Character":
    //                 data[CardColumn.Strength] = card.strength?.toString() || "-";
    //                 const iconLetters = [
    //                     ... card.icons?.military ? ["M"] : [],
    //                     ... card.icons?.intrigue ? ["I"] : [],
    //                     ... card.icons?.power ? ["P"] : []
    //                 ];
    //                 data[CardColumn.Icons] = iconLetters.join(" / ");
    //             case "Attachment":
    //             case "Location":
    //                 data[CardColumn.Unique] = card.unique ? "Unique" : "Non-Unique";
    //             case "Event":
    //                 data[CardColumn.Cost] = card.cost?.toString() || "-";
    //                 break;
    //             case "Plot":
    //                 data[CardColumn.Income] = (card.plotStats?.income || 0).toString();
    //                 data[CardColumn.Initiative] = (card.plotStats?.initiative || 0).toString();
    //                 data[CardColumn.Claim] = (card.plotStats?.claim || 0).toString();
    //                 data[CardColumn.Reserve] = (card.plotStats?.reserve || 0).toString();
    //             case "Agenda":
    //             // Nothing to set
    //         }
    //     } catch (err) {
    //         throw Error(`Failed to serialise card: ${err}`);
    //     }

    //     return data;
    // }

    toString() {
        return this.name + " (v" + this.version + ")";
    }

    clone() {
        const project = this.project;
        const number = this.number;
        const version = this.version;
        const faction = this.faction;
        const name = this.name;
        const type = this.type;
        const traits = [...this.traits];
        const text = this.text;
        const illustrator = this.illustrator;
        const deckLimit = this.deckLimit;
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
        const note = !this.note ? undefined : {
            type: this.note.type,
            text: this.note.text
        };
        const playtesting = this.playtesting;
        const github = !this.github ? undefined : {
            status: this.github.status,
            issueUrl: this.github.issueUrl
        };
        const release = !this.release ? undefined : {
            short: this.release.short,
            number: this.release.number
        };

        const clone = new Card(project, number, version, faction, name, type, traits, text, illustrator, deckLimit, loyal, flavor,
            designer, cost, unique, strength, icons, plotStats, note, playtesting, github, release);
        return clone;
    }

    static generateDevImageUrl(project: number, number: number, version: string) {
        return encodeURI(`${Server.apiUrl}/img/${project}/${number}@${version}.png`);
    }

    get imageUrl() {
        if (!this.isReleasable) {
            return Card.generateDevImageUrl(this.project, this.number, this.version);
        }
        const pack = this.release.short;
        const number = this.release.number;
        const name = this.name.replace(/[<>:"/\\|?*']/g, "").replace(/\s/g, "_");
        return encodeURI(`https://throneteki.ams3.cdn.digitaloceanspaces.com/packs/${pack}/${number}_${name}.png`);
    }

    get previousImageUrl() {
        if (!this.playtesting) {
            return null;
        }
        return Card.generateDevImageUrl(
            this.project,
            this.number,
            this.playtesting
        );
    }

    /**
     * @returns True if this card is the pre-release 0.0.0 version
     */
    get isPreRelease() {
        return Ver.eq(this.version, "0.0.0");
    }

    /**
     * @returns True if this card is the initial 1.0.0 version
     */
    get isInitial() {
        return Ver.eq(this.version, "1.0.0");
    }
    /**
     * @returns True if the card is in a draft state (eg. it is currently being edited, but not pushed to playtesting yet)
     */
    get isDraft() {
        return this.isPreRelease || this.isChanged;
    }
    /**
     * @returns True if this card is currently the version being playtested
     */
    get isPlaytesting() {
        return this.playtesting && Ver.eq(this.version, this.playtesting);
    }
    /**
     *  @returns True if this card is being or needs to be implemented online
     */
    get requiresImplementation() {
        return this.github ? this.github.status !== "closed" : this.isInitial || this.isChanged;
    }
    /**
     *  @returns True if this card has been implemented online
     */
    get isImplemented() {
        return this.github ? this.github.status === "closed" : this.isPlaytesting;
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
    /**
     *  @returns True if this card has been changed (eg. not in its initial or currently playtested state)
     */
    get isChanged() {
        return this.note && this.note.type !== "Implemented";
    }

    get needsIssue() {
        return !this.github && (this.isInitial || this.isChanged);
    }

    /***
     * @returns True if this card has all data ready to be released
     */
    get isReleasable() {
        return this.release && this.release && this.release;
    }
}

export const ProjectCardSchema = Joi.object().keys({
    // TODO
});

export default Card;