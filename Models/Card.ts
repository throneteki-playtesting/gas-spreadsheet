import { eq, SemVer } from "semver";
import Project from "./Project.js";
import { CardType, DefaultDeckLimit, Faction, NoteType, getEnum, getEnumName, maxEnum } from "../Common/Enums.js";
import { Column } from "../GoogleAppScript/Spreadsheets/CardInfo.js";
import { WithId } from "mongodb";

class Card {
    constructor(public code: number, public development: Development, public faction: Faction, public name: string,
        public type: CardType, public traits: string[], public text: string, public illustrator: string, public deckLimit: number,
        public quantity: number, public flavor?: string, public designer?: string, public loyal?: boolean, public strength?: xnumber,
        public icons?: Icons, public unique?: boolean, public cost?: xnumber | dashnumber, public plotStats?: PlotStats) {
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

    // syncImage() {
    //     if (this.development.versions.image !== this.development.versions.current) {
    //         this.development.imageUrl = ImageAPI.generateCard(this);
    //         this.development.versions.image = new SemVer(this.development.versions.current);
    //     }
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
            imageUrl: workInProgress ? this.development.imageUrl || "" : this.releaseUrl
        };
        return obj;
    }

    static deserialise(project: Project, data: unknown[]): Card {
        const stripHTML = (str: string) => str.replace(/<[^>]*>/g, "");
        const htmlColumns = [Column.Textbox, Column.Flavor, Column.ImageUrl, Column.NoteText];
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
            const number = parseInt(sData[Column.Number]);
            // Cycles require ranges 0-499 for "live" cards, and 500-999 for "development" cards
            const code = project.getDevCardCodeFor(number);

            // Missing version should return a 'TBA' card
            if (!sData[Column.Version]) {
                const tbaDevelopment = {
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
                number: number,
                project,
                versions: {
                    current: new SemVer(sData[Column.Version]),
                    playtesting: sData[Column.PlaytestVersion] ? new SemVer(sData[Column.PlaytestVersion]) : undefined,
                    image: sData[Column.ImageUrl] ? new SemVer(extractLinkText(sData[Column.ImageUrl]).text) : undefined
                },
                note: sData[Column.NoteType] || sData[Column.NoteText] ? {
                    type: sData[Column.NoteType] ? NoteType[sData[Column.NoteType]] : undefined,
                    text: sData[Column.NoteText] ? sData[Column.NoteText] : undefined
                } : undefined,
                imageUrl: sData[Column.ImageUrl] ? extractLinkText(sData[Column.ImageUrl]).link || "" : undefined,
                github: sData[Column.GithubIssue] ? {
                    status: sData[Column.GithubIssue],
                    issueUrl: extractLinkText(sData[Column.GithubIssue]).link || ""
                } : undefined,
                final: sData[Column.PackShort] ? {
                    packShort: sData[Column.PackShort],
                    number: parseInt(sData[Column.ReleaseNumber])
                } : undefined
            } as Development;
            const faction = getEnum<Faction>(Faction, sData[Column.Faction]);
            const name = sData[Column.Name];
            const type = CardType[sData[Column.Type]];
            const traits = sData[Column.Traits] ? sData[Column.Traits].split(".").map(t => t.trim()).filter(t => t && t != "-") : [];
            const text = sData[Column.Textbox];
            const flavor = sData[Column.Flavor] ? sData[Column.Flavor] : undefined;
            const illustrator = sData[Column.Illustrator] ? sData[Column.Illustrator] : "?";
            const designer = sData[Column.Designer] ? sData[Column.Designer] : undefined;
            const loyal = faction !== Faction.Neutral ? sData[Column.Loyal].toLowerCase() === "loyal" : undefined;

            let strength: number | "X" | undefined;
            let icons: Icons | undefined;
            let unique: boolean | undefined;
            let cost: number | "X" | "-" | undefined;
            let plotStats: PlotStats | undefined;
            switch (type) {
                case CardType.Character:
                    strength = parseTypedNumber(sData[Column.Strength]);
                    const iconsString = sData[Column.Icons];
                    icons = {
                        military: iconsString.includes("M"),
                        intrigue: iconsString.includes("I"),
                        power: iconsString.includes("P")
                    } as Icons;
                case CardType.Attachment:
                case CardType.Location:
                    unique = sData[Column.Unique] === "Unique";
                case CardType.Event:
                    cost = parseTypedNumber(sData[Column.Cost] ? sData[Column.Cost] : "-");
                    break;
                case CardType.Plot:
                    plotStats = {
                        income: parseTypedNumber(sData[Column.Income]),
                        initiative: parseTypedNumber(sData[Column.Initiative]),
                        claim: parseTypedNumber(sData[Column.Claim]),
                        reserve: parseTypedNumber(sData[Column.Reserve])
                    } as PlotStats;
                case CardType.Agenda:
                    // Nothing additional to add
                    break;
            }

            const deckLimit = sData[Column.Limit] ? parseInt(sData[Column.Limit]) : DefaultDeckLimit[CardType[type]];
            const quantity = 3;

            return new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor, designer,
                loyal, strength, icons, unique, cost, plotStats);
        } catch (err) {
            throw Error(`Failed to deserialise ${sData[Column.Number] ? `card #${sData[Column.Number]}` : "card with unknown or invalid #"}`, { cause: err });
        }
    }

    static serialise(card: Card) {
        const data: string[] = Array.from({ length: maxEnum(Column) }, (v, i) => [Column.Loyal, Column.Unique, Column.Cost, Column.Strength, Column.Icons, Column.Traits].includes(i) ? "-" : "");

        try {
            data[Column.Number] = card.development.number.toString();
            data[Column.Version] = card.development.versions.current.toString();
            data[Column.Faction] = card.faction.toString();
            data[Column.Name] = card.name;
            data[Column.Type] = CardType[card.type];
            data[Column.Loyal] = card.loyal !== undefined ? (card.loyal ? "Loyal" : "Non-Loyal") : "-";
            data[Column.Traits] = card.traits.length > 0 ? card.traits.map(t => t + ".").join(" ") : "-";
            data[Column.Textbox] = card.text;
            data[Column.Flavor] = card.flavor || "";
            data[Column.Limit] = card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? card.deckLimit.toString() : "";
            data[Column.Designer] = card.designer || "";
            data[Column.Illustrator] = card.illustrator !== "?" ? card.illustrator : "";
            data[Column.ImageUrl] = card.development.imageUrl && card.development.versions.image ? `<a href="${card.development.imageUrl}">${card.development.versions.image}</a>` : "";
            data[Column.NoteType] = card.development.note ? NoteType[card.development.note.type] : "";
            data[Column.NoteText] = card.development.note?.text || "";
            data[Column.PlaytestVersion] = card.development.versions.playtesting?.toString() || "";
            data[Column.GithubIssue] = card.development.github ? `<a href="${card.development.github.issueUrl}">${card.development.github.status}</a>` : "";
            data[Column.PackShort] = card.development.final?.packShort || "";
            data[Column.ReleaseNumber] = card.development.final?.number.toString() || "";

            switch (card.type) {
                case CardType.Character:
                    data[Column.Strength] = card.strength?.toString() || "-";
                    const iconLetters = [
                        ... card.icons?.military ? ["M"] : [],
                        ... card.icons?.intrigue ? ["I"] : [],
                        ... card.icons?.power ? ["P"] : []
                    ];
                    data[Column.Icons] = iconLetters.join(" / ");
                case CardType.Attachment:
                case CardType.Location:
                    data[Column.Unique] = card.unique ? "Unique" : "Non-Unique";
                case CardType.Event:
                    data[Column.Cost] = card.cost?.toString() || "-";
                    break;
                case CardType.Plot:
                    data[Column.Income] = (card.plotStats?.income || 0).toString();
                    data[Column.Initiative] = (card.plotStats?.initiative || 0).toString();
                    data[Column.Claim] = (card.plotStats?.claim || 0).toString();
                    data[Column.Reserve] = (card.plotStats?.reserve || 0).toString();
                case CardType.Agenda:
                // Nothing to set
            }
        } catch (err) {
            throw Error(`Failed to serialise card: ${err}`);
        }

        return data;
    }

    static deserialiseFromDb(mongoCard: WithId<Card>) {
        const code = mongoCard.code;
        const development = {
            number: mongoCard.development.number,
            project: mongoCard.development.project,
            versions: {
                current: new SemVer(mongoCard.development.versions.current.version),
                playtesting: !mongoCard.development.versions.playtesting ? mongoCard.development.versions.playtesting : new SemVer(mongoCard.development.versions.playtesting.version),
                image: !mongoCard.development.versions.image ? mongoCard.development.versions.image : new SemVer(mongoCard.development.versions.image.version)
            },
            note: !mongoCard.development.note ? mongoCard.development.note : {
                type: mongoCard.development.note.type,
                text: mongoCard.development.note.text
            },
            github: !mongoCard.development.github ? mongoCard.development.github : {
                status: mongoCard.development.github.status,
                issueUrl: mongoCard.development.github.issueUrl
            },
            imageUrl: mongoCard.development.imageUrl,
            final: !mongoCard.development.final ? mongoCard.development.final : {
                packShort: mongoCard.development.final.packShort,
                number: mongoCard.development.final.number
            }
        };
        const faction = mongoCard.faction;
        const name = mongoCard.name;
        const type = mongoCard.type;
        const traits = [...mongoCard.traits];
        const text = mongoCard.text;
        const illustrator = mongoCard.illustrator;
        const deckLimit = mongoCard.deckLimit;
        const quantity = mongoCard.quantity;
        const flavor = mongoCard.flavor;
        const designer = mongoCard.designer;
        const loyal = mongoCard.loyal;
        const strength = mongoCard.strength;
        const icons = !mongoCard.icons ? undefined : {
            military: mongoCard.icons.military,
            intrigue: mongoCard.icons.intrigue,
            power: mongoCard.icons.power
        };
        const unique = mongoCard.unique;
        const cost = mongoCard.cost;
        const plotStats = !mongoCard.plotStats ? mongoCard.plotStats : {
            income: mongoCard.plotStats.income,
            initiative: mongoCard.plotStats.initiative,
            claim: mongoCard.plotStats.claim,
            reserve: mongoCard.plotStats.reserve
        };
        const clone = new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor,
            designer, loyal, strength, icons, unique, cost, plotStats);
        return clone;
    }

    toString() {
        return this.name + " (v" + this.development.versions.current.toString() + ")";
    }

    clone() {
        const code = this.code;
        const development = {
            number: this.development.number,
            project: this.development.project,
            versions: {
                current: new SemVer(this.development.versions.current),
                playtesting: !this.development.versions.playtesting ? this.development.versions.playtesting : new SemVer(this.development.versions.playtesting),
                image: !this.development.versions.image ? this.development.versions.image : new SemVer(this.development.versions.image)
            },
            note: !this.development.note ? this.development.note : {
                type: this.development.note.type,
                text: this.development.note.text
            },
            github: !this.development.github ? this.development.github : {
                status: this.development.github.status,
                issueUrl: this.development.github.issueUrl
            },
            imageUrl: this.development.imageUrl,
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
        return this.development.github ? this.development.github.status === "closed" : this.development.versions.playtesting && eq(this.development.versions.current, this.development.versions.playtesting);
    }
    // /**
    //  * @returns True if this card has been implemented online after the previous playtesting update
    //  */
    // get isNewlyImplemented() {
    //     return this.development.github?.status === "closed";
    // }
    /**
     * @returns True if this card is currently the version being playtested
     */
    get isBeingPlaytested() {
        return this.development.versions.playtesting && eq(this.development.versions.current, this.development.versions.playtesting);
    }
    /**
     * @returns True if this card is the pre 0.0.0 version
     */
    get isPreview() {
        return eq(this.development.versions.current, "0.0.0");
    }
    // /**
    //  * @returns True if this card is the initial 1.0.0 version
    //  */
    // get isInitial() {
    //     return eq(this.development.versions.current, "1.0.0");
    // }
    /**
     *  @returns True if this card has been changed (eg. not in its initial or currently playtested state)
     */
    get isChanged() {
        return this.development.note && this.development.note.type !== NoteType.Implemented;
    }

    /***
     * @returns True if this card has all data ready to be released
     */
    get isReleasable() {
        return this.development.final && this.development.final.packShort && this.development.final.number;
    }

    /***
     * @returns The url for this card, ready for release
     */
    get releaseUrl() {
        if (!this.isReleasable) {
            return "";
        }
        const urlNumber = this.development.final?.number;
        const name = encodeURI(this.name.replace(/[<>:"/\\|?*']/g, "").replace(/\s/g, "_"));
        return "https://throneteki.ams3.cdn.digitaloceanspaces.com/packs/" + this.development.final?.packShort + "/" + urlNumber + "_" + name + ".png";
    }

    /***
     * @returns Whether the current image is outdated
     */
    get isOutdatedImage() {
        return this.development.versions.current !== this.development.versions.image;
    }
}

type xnumber = number | "X";
type dashnumber = number | "X" | "-";

interface Development {
    number: number,
    project: Project,
    versions: {
        current: SemVer,
        playtesting?: SemVer,
        image?: SemVer
    },
    note?: {
        type: NoteType,
        text: string
    },
    github?: {
        status: "open" | "closed",
        issueUrl: string
    },
    imageUrl?: string,
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
    income: xnumber,
    initiative: xnumber,
    claim: xnumber,
    reserve: xnumber
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
    cost?: xnumber | dashnumber,
    icons?: Icons,
    strength?: xnumber,
    traits: string[],
    text: string,
    flavor?: string,
    deckLimit: number,
    illustrator: string,
    designer?: string,
    imageUrl: string
}

export default Card;