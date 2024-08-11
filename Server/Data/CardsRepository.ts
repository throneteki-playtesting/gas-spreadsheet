import MongoDataSource from "./DataSources/MongoDataSource";
import GASDataSource from "./DataSources/GASDataSource";
import { AvailableSheetTypes } from "@/GoogleAppScript/Spreadsheets/Spreadsheet";
import semverCompareBuild from "semver/functions/compare-build";
import { eq, SemVer } from "semver";
import Card from "./Models/Card";
import Project from "./Models/Project";
import { logger, service } from "..";
import { MongoClient, WithId } from "mongodb";
import { ExpandoObject } from "@/Common/Utils";
import { CardId } from "@/Common/Identifiers";

interface IRepository<Id, Model> {
    database: MongoDataSource<Id, Model>
    spreadsheet: GASDataSource<Id, Model>
}

export default class CardsRepository implements IRepository<CardId, Card> {
    public database: CardMongoDataSource;
    public spreadsheet: CardGASDataSource;
    constructor(mongoClient: MongoClient, googleClientEmail: string, googlePrivateKey: string, projects: ExpandoObject) {
        this.database = new CardMongoDataSource(mongoClient.db().collection<Card>("cards"));
        this.spreadsheet = new CardGASDataSource(googleClientEmail, googlePrivateKey, projects);
    }
    public async create({ projectShort, cards, filter }: { projectShort: string, cards: Card[], filter: AvailableSheetTypes[] }) {
        await this.database.create({ values: cards });
        await this.spreadsheet.create({ projectShort, values: cards, filter });
    }

    public async read({ projectShort, ids, hard, filter }: { projectShort: string, ids?: CardId[], hard?: boolean, filter?: AvailableSheetTypes[] }) {
        let cards: Card[];
        // Force hard refresh from spreadsheet (slow)
        if (hard) {
            const fetched = await this.spreadsheet.read({ projectShort, ids, filter });
            await this.database.update({ projectShort, values: fetched });
            cards = fetched;
        } else {
            // Otherwise, use database (fast)...
            cards = await this.database.read({ projectShort, ids });
            const missing = ids?.filter((id) => !cards.some((card) => card.development.number === id.number && (!id.version || eq(card.development.versions.current, id.version)))) || [];
            // ... but fetch any which are missing (unlikely)
            if (missing.length > 0) {
                const fetched = await this.spreadsheet.read({ projectShort, ids: missing, filter });
                await this.database.create({ values: fetched });
                cards = cards.concat(fetched);
            }
        }
        return cards.sort((a, b) => a.development.number - b.development.number || semverCompareBuild(a.development.versions.current, b.development.versions.current));
    }

    public async update({ cards }: { cards: Card[] }) {
        const groups = Map.groupBy(cards, (card) => card.development.project.short);
        for (const [projectShort, cardGroup ] of Array.from(groups.entries())) {
            await this.database.update({ projectShort, values: cardGroup });
            await this.spreadsheet.update({ projectShort, values: cardGroup });
        }
    }

    public async destroy({ projectShort, ids }: { projectShort: string, ids?: CardId[]}) {
        await this.database.destroy({ projectShort, ids });
        // await this.database.destroy({ projectShort, ids });
    }

    // TODO: Refine this closer to playtesting release time
    // public async publishCards(projectShort: string, numbers: number[] = []) {
    //     const toUpdate = new Set<Card>();
    //     const toArchive = new Set<Card>();
    //     const implemented = new Set<Card>();

    //     const cards = await this.readCards({ projectShort, ids: numbers.map((number) => ({ number })), refresh: true });
    //     const groups = this.groupCardHistory(cards);
    //     for (const group of groups) {
    //         // If card has a marked change
    //         if (group.latest.isChanged) {
    //             if (group.latest.development.versions.current !== group.latest.development.versions.playtesting) {
    //                 toArchive.add(group.latest.clone());
    //                 group.latest.development.versions.playtesting = group.latest.development.versions.current;
    //             }

    //             delete group.latest.development.note;
    //             toUpdate.add(group.latest);
    //         }

    //         if (group.latest.isImplemented) {
    //             delete group.latest.development.github;
    //             implemented.add(group.latest);
    //         }
    //     }

    //     service.data.updateCards({ cards: Array.from(toUpdate) });
    //     service.data.createCards({ projectShort, cards: Array.from(toArchive), filter: ["archive"] });
    //     // TODO: Something with "Implemented"?
    //     return {
    //         archived: Array.from(toArchive),
    //         updated: Array.from(toUpdate)
    //     };
    // }
}

class CardMongoDataSource extends MongoDataSource<CardId, Card> {
    public async create({ values }: { values: Card[] }) {
        if (values.length === 0) {
            return;
        }
        await service.render.syncImages(values);
        return await this.collection.insertMany(values);
    }
    public async read({ projectShort, ids }: { projectShort: string, ids?: CardId[] }) {
        const mappedIds = ids?.map((id) => ({ "development.number": id.number, ...(id.version && { "development.versions.current": id.version }) }));
        const query = {
            "development.project.short": projectShort,
            ...(mappedIds && { "$or": mappedIds })
        };
        const result = await this.collection.find(query, { projection: { _id: 0 } }).toArray();
        return result.map((card) => this.deserialise(card));
    }

    public async update({ projectShort, values }: { projectShort: string, values: Card[] }) {
        if (values.length === 0) {
            return;
        }
        await service.render.syncImages(values, true);
        return await this.collection.bulkWrite(values.map((card) => ({
            replaceOne: {
                filter: {
                    "development.number": card.development.number,
                    "development.project.short": projectShort,
                    "development.versions.current": card.development.versions.current
                },
                replacement: card,
                upsert: true
            }
        })));
    }

    public async destroy({ projectShort, ids }: { projectShort: string, ids?: CardId[] }) {
        const mappedIds = ids?.map((id) => ({ "development.number": id.number, ...(id.version && { "development.versions.current": id.version }) }));
        const query = {
            "development.project.short": projectShort,
            ...(mappedIds && { "$or": mappedIds })
        };
        return await this.collection.deleteMany(query);
    }

    private deserialise(value: WithId<Card>) {
        const code = value.code;
        const development = {
            id: new CardId(value.development.number, value.development.versions.current.version.toString()),
            number: value.development.number,
            project: value.development.project,
            versions: {
                current: new SemVer(value.development.versions.current.version),
                playtesting: !value.development.versions.playtesting ? value.development.versions.playtesting : new SemVer(value.development.versions.playtesting.version)
            },
            note: !value.development.note ? value.development.note : {
                type: value.development.note.type,
                text: value.development.note.text
            },
            github: !value.development.github ? value.development.github : {
                status: value.development.github.status,
                issueUrl: value.development.github.issueUrl
            },
            final: !value.development.final ? value.development.final : {
                packShort: value.development.final.packShort,
                number: value.development.final.number
            }
        };
        const faction = value.faction;
        const name = value.name;
        const type = value.type;
        const traits = [...value.traits];
        const text = value.text;
        const illustrator = value.illustrator;
        const deckLimit = value.deckLimit;
        const quantity = value.quantity;
        const flavor = value.flavor;
        const designer = value.designer;
        const loyal = value.loyal;
        const strength = value.strength;
        const icons = !value.icons ? undefined : {
            military: value.icons.military,
            intrigue: value.icons.intrigue,
            power: value.icons.power
        };
        const unique = value.unique;
        const cost = value.cost;
        const plotStats = !value.plotStats ? value.plotStats : {
            income: value.plotStats.income,
            initiative: value.plotStats.initiative,
            claim: value.plotStats.claim,
            reserve: value.plotStats.reserve
        };
        const clone = new Card(code, development, faction, name, type, traits, text, illustrator, deckLimit, quantity, flavor,
            designer, loyal, strength, icons, unique, cost, plotStats);
        return clone;
    }
}

class CardGASDataSource extends GASDataSource<CardId, Card> {
    public async create({ projectShort, values, filter }: { projectShort: string, values: Card[], filter?: AvailableSheetTypes[] }) {
        const query = [
            ...(filter && filter.length > 0 && [ `filter=${filter.join(",")}` ])
        ];
        const url = `${this.getUrl(projectShort)}/cards/create${query.length > 0 ? `?${query.join("&")}` : ""}`;
        const body = JSON.stringify(values.map((card) => Card.serialise(card)));

        const data = await this.post(url, body);
        const created = data["created"];

        logger.verbose(`${created} ${projectShort} card(s) created in Google App Script`);
        return created > 0;
    }

    public async read({ projectShort, ids, filter }: { projectShort: string, ids?: CardId[], filter?: AvailableSheetTypes[] }) {
        // Converting to format "15" or "15@1.0.0"
        const cardIds = ids?.map((id) => `${id.number}${id.version ? `@${id.version}` : ""}`).join(",");
        const query = [
            ...(filter ? [ `format=${filter.join(",")}` ] : []),
            ...(cardIds ? [ `ids=${cardIds}` ] : [])
        ];
        const url = `${this.getUrl(projectShort)}/cards${query.length > 0 ? `?${query.join("&")}` : ""}`;

        const data = await this.get(url);

        const rawProject = data["project"];
        const project = Project.deserialise(rawProject);
        const rawCards = data["cards"] as unknown[][];
        const cards = rawCards.map((rawCard) => Card.deserialise(project, rawCard));

        logger.verbose(`${cards.length} ${projectShort} card(s) read from Google App Script`);
        return cards;
    }

    public async update({ projectShort, values }: { projectShort: string, values: Card[] }) {
        const url = `${this.getUrl(projectShort)}/cards/update`;
        const body = JSON.stringify(values.map((card) => Card.serialise(card)));

        const data = await this.post(url, body);
        const updated = data["updated"];
        logger.verbose(`${updated} ${projectShort} card(s) updated in Google App Script`);
        return updated > 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async destroy({ projectShort, ids, filter }: { projectShort: string, ids: CardId[], filter?: AvailableSheetTypes[] }) {
        // TODO Implement
        logger.error("Attempted to destroy for GAS Data Source; not implemented!");
        return false;
    }
}

export function groupCardHistory(cards: Card[]) {
    const groups = Map.groupBy(cards, (card) => card.development.number);

    return Array.from(groups.entries()).map(([number, c]) => {
        const previous = c.sort((a, b) => -semverCompareBuild(a.development.versions.current, b.development.versions.current));
        const latest = previous.shift();

        return { number, latest, previous };
    });
}