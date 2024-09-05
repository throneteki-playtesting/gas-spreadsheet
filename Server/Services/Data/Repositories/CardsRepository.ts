import MongoDataSource from "./DataSources/MongoDataSource";
import GASDataSource from "./DataSources/GASDataSource";
import { compareBuild } from "semver";
import { MongoClient } from "mongodb";
import Card from "../Models/Card";
import { IRepository } from "..";
import { CardId, CardMatcher, CardModel } from "@/Common/Models/Card";
import { CardsController } from "@/GoogleAppScript/Controllers/CardsController";
import { logger, renderService } from "../../Services";

export default class CardsRepository implements IRepository<Card> {
    public database: CardMongoDataSource;
    public spreadsheet: CardGASDataSource;
    constructor(mongoClient: MongoClient, googleClientEmail: string, googlePrivateKey: string) {
        this.database = new CardMongoDataSource(mongoClient.db().collection<Card>("cards"));
        this.spreadsheet = new CardGASDataSource(googleClientEmail, googlePrivateKey);
    }
    public async create({ cards }: { cards: Card[] }) {
        await this.database.create({ cards });
        await this.spreadsheet.create({ cards });
    }

    public async read({ matchers, hard }: { matchers: CardMatcher[], hard?: boolean }) {
        let cards: Card[];
        // Force hard refresh from spreadsheet (slow)
        if (hard) {
            const fetched = await this.spreadsheet.read({ matchers });
            await this.database.update({ cards: fetched });
            cards = fetched;
        } else {
            // Otherwise, use database (fast)...
            cards = await this.database.read({ matchers });
            const missing = matchers?.filter((matcher) => !cards.some((card) => card.project === matcher.project && (!matcher.number || card.number === matcher.number) && (!matcher.version || (card.version === matcher.version)))) || [];
            // ... but fetch any which are missing (unlikely)
            if (missing.length > 0) {
                const fetched = await this.spreadsheet.read({ matchers: missing });
                await this.database.create({ cards: fetched });
                cards = cards.concat(fetched);
            }
        }
        return cards.sort((a, b) => a.number - b.number || compareBuild(a.version, b.version));
    }

    public async update({ cards }: { cards: Card[] }) {
        await this.database.update({ cards });
        await this.spreadsheet.update({ cards });
    }

    public async destroy({ matchers }: { matchers: CardMatcher[] }) {
        await this.database.destroy({ matchers });
        await this.database.destroy({ matchers });
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

    //     dataService.updateCards({ cards: Array.from(toUpdate) });
    //     dataService.createCards({ projectShort, cards: Array.from(toArchive), filter: ["archive"] });
    //     // TODO: Something with "Implemented"?
    //     return {
    //         archived: Array.from(toArchive),
    //         updated: Array.from(toUpdate)
    //     };
    // }
}

class CardMongoDataSource extends MongoDataSource<Card> {
    public async create({ cards }: { cards: Card[] }) {
        if (cards.length === 0) {
            return 0;
        }
        await renderService.syncImages(cards);
        const results = await this.collection.insertMany(cards);

        logger.verbose(`Inserted ${results.insertedCount} values into card collection`);
        return results.insertedCount;
    }
    public async read({ matchers }: { matchers?: CardMatcher[] }) {
        const query = { ...(matchers && { "$or": matchers }) };
        const result = await this.collection.find(query, { projection: { _id: 0 } }).toArray();

        logger.verbose(`Read ${result.length} values from card collection`);
        return result.map(Card.fromModel);
    }

    public async update({ cards }: { cards: Card[] }) {
        if (cards.length === 0) {
            return 0;
        }
        await renderService.syncImages(cards, true);
        const results = await this.collection.bulkWrite(cards.map((card) => ({
            replaceOne: {
                filter: { "_id": card._id },
                replacement: card,
                upsert: true
            }
        })));

        logger.verbose(`Modified ${results.modifiedCount} & Inserted ${results.insertedCount} values into card collection`);
        return results.modifiedCount + results.upsertedCount;
    }

    public async destroy({ matchers }: { matchers?: CardMatcher[] }) {
        const query = { ...(matchers && { "$or": matchers }) };
        const results = await this.collection.deleteMany(query);

        logger.verbose(`Deleted ${results.deletedCount} values from card collection`);
        return results.deletedCount;
    }
}

class CardGASDataSource extends GASDataSource<Card> {
    public async create({ cards }: { cards: Card[] }) {
        const groups = Map.groupBy(cards, (card) => card.project);
        const created: Card[] = [];
        for (const [p, c] of groups.entries()) {
            const project = await this.getProject(p);
            const url = `${project.script}/cards/create`;
            const body = JSON.stringify(c as CardModel[]);

            const response = await this.post<CardsController.GASCreateCardsResponse>(url, body);
            created.push(...response.created.map(Card.fromModel));
            logger.verbose(`${created.length} card(s) created in Google App Script (${project.name})`);
        }
        return created;
    }

    public async read({ matchers }: { matchers: CardMatcher[] }) {
        const groups = Map.groupBy(matchers, (matcher) => matcher.project);
        const read: Card[] = [];
        for (const [p, m] of groups.entries()) {
            const project = await this.getProject(p);
            const ids = m.filter((m1) => m1.number).map((m2) => !m2.version ? `${m2.number}` : `${m2.number}@${m2.version}` as CardId);
            const url = `${project.script}/cards${ids.length > 0 ? `?ids=${ids.join(",")}` : ""}`;

            const response = await this.get<CardsController.GASReadCardsResponse>(url);
            read.push(...response.cards.map(Card.fromModel));
            logger.verbose(`${read.length} card(s) read from Google App Script (${project.name})`);
        }
        return read;
    }

    public async update({ cards }: { cards: Card[] }) {
        const groups = Map.groupBy(cards, (card) => card.project);
        const updated: Card[] = [];
        for (const [p, c] of groups.entries()) {
            const project = await this.getProject(p);
            const url = `${project.script}/cards/update`;
            const models = c.map(Card.toModel);
            const body = JSON.stringify(models);

            const response = await this.post<CardsController.GASUpdateCardsResponse>(url, body);
            updated.push(...response.updated.map(Card.fromModel));
            logger.verbose(`${updated.length} card(s) updated in Google App Script (${project.name})`);
        }
        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async destroy({ matchers }: { matchers: CardMatcher[] }) {
        const groups = Map.groupBy(matchers, (matcher) => matcher.project);
        const destroyed: Card[] = [];
        for (const [p, m] of groups.entries()) {
            const project = await this.getProject(p);
            const ids = m.filter((m1) => m1.number).map((m2) => !m2.version ? `${m2.number}` : `${m2.number}@${m2.version}` as CardId);
            const url = `${project.script}/cards/destroy${ids ? `?ids=${ids.join(",")}` : ""}`;

            const response = await this.get<CardsController.GASDestroyCardsResponse>(url);
            destroyed.push(...response.destroyed.map(Card.fromModel));
            logger.verbose(`${destroyed.length} card(s) deleted in Google App Script (${project.name})`);
        }
        return destroyed;
    }
}

// TODO: Update everything to return a "CardCollection" to mimic this methods behaviour
export function groupCardHistory(cards: Card[]) {
    const groups = Map.groupBy(cards, (card) => card.number);

    return Array.from(groups.entries()).map(([number, c]) => {
        const previous = c.sort((a, b) => -compareBuild(a.version, b.version));
        const latest = previous.shift();

        return { number, latest, previous };
    });
}