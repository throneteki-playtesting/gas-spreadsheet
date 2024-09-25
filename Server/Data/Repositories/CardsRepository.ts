import MongoDataSource from "./DataSources/MongoDataSource";
import GASDataSource from "./DataSources/GASDataSource";
import { compareBuild } from "semver";
import { Collection, MongoClient } from "mongodb";
import Card from "../Models/Card";
import { IRepository } from "..";
import { CardsController } from "@/GoogleAppScript/Controllers/CardsController";
import { GASAPI, logger, renderService } from "../../Services";
import { Utils } from "@/Common/Utils";
import { Cards } from "@/Common/Models/Cards";

export default class CardsRepository implements IRepository<Card> {
    public database: CardMongoDataSource;
    public spreadsheet: CardGASDataSource;
    constructor(mongoClient: MongoClient) {
        this.database = new CardMongoDataSource(mongoClient);
        this.spreadsheet = new CardGASDataSource();
    }
    public async create({ cards }: { cards: Card[] }) {
        await this.database.create({ cards });
        await this.spreadsheet.create({ cards });
    }

    public async read({ matchers, hard }: { matchers: Cards.Matcher[], hard?: boolean }) {
        let cards: Card[];
        // Force hard refresh from spreadsheet (slow)
        if (hard) {
            const fetched = await this.spreadsheet.read({ matchers });
            await this.database.update({ cards: fetched });
            cards = fetched;
        } else {
            // Otherwise, use database (fast)...
            cards = await this.database.read({ matchers });
            const missing = matchers?.filter((matcher) => !cards.some((card) => card.project._id === matcher.projectId && (!matcher.number || card.number === matcher.number) && (!matcher.version || (card.version === matcher.version)))) || [];
            // ... but fetch any which are missing (unlikely)
            if (missing.length > 0) {
                const fetched = await this.spreadsheet.read({ matchers: missing });
                await this.database.create({ cards: fetched });
                cards = cards.concat(fetched);
            }
        }
        return cards.sort((a, b) => a.number - b.number || compareBuild(a.version, b.version));
    }
    public async update({ cards, upsert }: { cards: Card[], upsert?: boolean }) {
        await this.database.update({ cards, upsert });
        await this.spreadsheet.update({ cards, upsert });
    }

    public async destroy({ matchers }: { matchers: Cards.Matcher[] }) {
        await this.database.destroy({ matchers });
        await this.spreadsheet.destroy({ matchers });
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

class CardMongoDataSource implements MongoDataSource<Card> {
    private name = "cards";
    private collection: Collection<Cards.Model>;
    constructor(client: MongoClient) {
        this.collection = client.db().collection<Cards.Model>(this.name);
    }

    public async create({ cards }: { cards: Card[] }) {
        if (cards.length === 0) {
            return [];
        }
        await renderService.syncImages(cards);
        const models = await Card.toModels(...cards);
        const results = await this.collection.insertMany(models);

        logger.verbose(`Inserted ${results.insertedCount} values into ${this.name} collection`);
        const insertedIds = Object.values(results.insertedIds);
        return cards.filter((card) => insertedIds.includes(card._id));
    }

    public async read({ matchers }: { matchers: Cards.Matcher[] }) {
        const query = { ...(matchers?.length > 0 && { "$or": matchers.map(Utils.cleanObject) }) };
        const result = await this.collection.find(query).toArray();

        logger.verbose(`Read ${result.length} values from ${this.name} collection`);
        return await Card.fromModels(...result);
    }

    public async update({ cards, upsert = true }: { cards: Card[], upsert?: boolean }) {
        if (cards.length === 0) {
            return [];
        }
        await renderService.syncImages(cards, true);
        const models = await Card.toModels(...cards);
        const results = await this.collection.bulkWrite(models.map((model) => ({
            replaceOne: {
                filter: { "_id": model._id },
                replacement: model,
                upsert
            }
        })));

        logger.verbose(`${upsert ? "Upserted" : "Updated"} ${results.modifiedCount + results.upsertedCount} values into ${this.name} collection`);
        const updatedIds = Object.values(results.insertedIds).concat(Object.values(results.upsertedIds));
        return cards.filter((card) => updatedIds.includes(card._id));
    }

    public async destroy({ matchers }: { matchers?: Cards.Matcher[] }) {
        const query = { ...(matchers?.length > 0 && { "$or": matchers.map(Utils.cleanObject) }) };
        // Collect all which are to be deleted
        const deleting = await Card.fromModels(...(await this.collection.find(query).toArray()));
        const results = await this.collection.deleteMany(query);

        logger.verbose(`Deleted ${results.deletedCount} values from ${this.name} collection`);
        return deleting;
    }
}

class CardGASDataSource implements GASDataSource<Card> {
    public async create({ cards }: { cards: Card[] }) {
        const groups = Map.groupBy(cards, (card) => card.project);
        const created: Card[] = [];
        for (const [project, pCards] of groups.entries()) {
            const url = `${project.script}/cards/create`;
            const models = await Card.toModels(...pCards);
            const body = JSON.stringify(models);

            const response = await GASAPI.post<CardsController.GASCreateCardsResponse>(url, body);
            created.push(...await Card.fromModels(...response.created));
            logger.verbose(`${created.length} card(s) created in Google App Script (${project.name})`);
        }
        return created;
    }

    public async read({ matchers }: { matchers: Cards.Matcher[] }) {
        const groups = Map.groupBy(matchers.map(Utils.cleanObject), (matcher) => matcher.projectId);
        const read: Card[] = [];
        for (const [projectId, pModels] of groups.entries()) {
            const project = await GASAPI.getProject(projectId);
            const ids = pModels.filter((has) => has.number).map((pm) => !pm.version ? `${pm.number}` : `${pm.number}@${pm.version}` as Cards.Id);
            const url = `${project.script}/cards${ids.length > 0 ? `?ids=${ids.join(",")}` : ""}`;

            const response = await GASAPI.get<CardsController.GASReadCardsResponse>(url);
            read.push(...await Card.fromModels(...response.cards));
            logger.verbose(`${read.length} card(s) read from Google App Script (${project.name})`);
        }
        return read;
    }

    public async update({ cards, upsert = true }: { cards: Card[], upsert?: boolean }) {
        const groups = Map.groupBy(cards, (card) => card.project);
        const updated: Card[] = [];
        for (const [project, pCards] of groups.entries()) {
            const url = `${project.script}/cards/update?upsert=${upsert ? "true" : "false"}`;
            const models = await Card.toModels(...pCards);
            const body = JSON.stringify(models);

            const response = await GASAPI.post<CardsController.GASUpdateCardsResponse>(url, body);
            updated.push(...await Card.fromModels(...response.updated));
            logger.verbose(`${updated.length} card(s) updated in Google App Script (${project.name})`);
        }
        return updated;
    }

    public async destroy({ matchers }: { matchers: Cards.Matcher[] }) {
        const groups = Map.groupBy(matchers.map(Utils.cleanObject), (matcher) => matcher.projectId);
        const destroyed: Card[] = [];
        for (const [projectId, pModels] of groups.entries()) {
            const project = await GASAPI.getProject(projectId);
            // TODO: Alter parameters to allow for any CardModel values to be provided & filtered
            const ids = pModels.filter((has) => has.number).map((pm) => !pm.version ? `${pm.number}` : `${pm.number}@${pm.version}` as Cards.Id);
            const url = `${project.script}/cards/destroy${ids ? `?ids=${ids.join(",")}` : ""}`;

            const response = await GASAPI.get<CardsController.GASDestroyCardsResponse>(url);
            destroyed.push(...await Card.fromModels(...response.destroyed));
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