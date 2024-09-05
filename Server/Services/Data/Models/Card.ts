import * as Ver from "semver";
import { CardModel, CardId, Faction, NoteType, Type } from "@/Common/Models/Card.js";
import { SemanticVersion, Utils } from "@/Common/Utils.js";
import { Joi } from "celebrate";
import { apiUrl } from "@/Server";


class Card implements CardModel {
    public _id: CardId;
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
        public deckLimit: number = Utils.DefaultDeckLimit[type],
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
        this._id = `${number}@${version}`;
    }

    get id() {
        return this._id;
    }
    get code() {
        // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
        const codeString = this.project.toString() + (this.number + 500).toString().padStart(3, "0");
        return parseInt(codeString);
    }

    toJSON() {
        const obj = {
            code: this.isReleasable ? this.project + this.release.number.toString().padStart(3, "0") : this.code.toString(),
            ...(!this.isReleasable && { version: this.version }),
            type: this.type.toLowerCase(),
            name: this.name,
            octgnId: null,
            quantity: this.quantity,
            ...(this.unique !== undefined && { unique: this.unique }),
            faction: this.faction.toLowerCase().replaceAll(/[\s']|(?:house)/gi, ""),
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

    static fromModel(model: CardModel) {
        return new Card(model.project, model.number, model.version, model.faction, model.name, model.type, model.traits, model.text, model.illustrator, model.deckLimit, model.loyal, model.flavor,
            model.designer, model.cost, model.unique, model.strength, model.icons, model.plotStats, model.note, model.playtesting, model.github, model.release);
    }

    static toModel(card: Card) {
        return { ...card } as CardModel;
    }

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
        return encodeURI(`${apiUrl}/img/${project}/${number}@${version}.png`);
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
     * @returns True if this card has not been pushed to playtesting yet at all
     */
    get isPreRelease() {
        return Ver.lte(this.version, "1.0.0") && !this.playtesting;
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
        return !!this.playtesting && Ver.eq(this.version, this.playtesting);
    }
    /**
     *  @returns True if this card is being or needs to be implemented online
     */
    get requiresImplementation() {
        return this.github ? this.github.status !== "closed" : this.isPreRelease || this.isChanged;
    }
    /**
     *  @returns True if this card has been implemented online
     */
    get isImplemented() {
        return this.github ? this.github.status === "closed" : this.isPlaytesting;
    }
    /**
     * @returns True if this card has been implemented online after the previous playtesting update
     */
    get isNewlyImplemented() {
        return this.github?.status === "closed";
    }
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
        return !this.github && (this.isPreRelease || this.isChanged);
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