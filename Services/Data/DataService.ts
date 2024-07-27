import { JWT } from "google-auth-library";
import Card from "../../Models/Card";
import { GASResponse } from "../../GoogleAppScript/Controller";
import { MongoClient } from "mongodb";
import { ExpandoObject } from "../../Common/Utils";
import Project from "../../Models/Project";
import semverCompareBuild from "semver/functions/compare-build";
import { service } from "..";
import { eq } from "semver";
import { AvailableSheetTypes } from "../../GoogleAppScript/Spreadsheets/Spreadsheet";
import { CardId } from "../../GoogleAppScript/Spreadsheets/CardInfo";

class DataService {
    private spreadsheet: GASDataSource;
    private database: MongoDataSource;

    constructor(env: string, databaseUrl: string, googleClientEmail: string, googlePrivateKey: string, private projects: ExpandoObject) {
        this.spreadsheet = new GASDataSource(env, googleClientEmail, googlePrivateKey, projects);
        this.database = new MongoDataSource(databaseUrl);
    }

    public async createCards({ projectShort, cards, filter }: { projectShort: string, cards: Card[], filter: AvailableSheetTypes[] }) {
        await this.database.createCards({ projectShort, cards });
        await this.spreadsheet.createCards({ projectShort, cards, filter });
    }

    public async readCards({ projectShort, ids, refresh, filter }: { projectShort: string, ids?: CardId[], refresh?: boolean, filter?: AvailableSheetTypes[] }) {
        // Force data to refresh from spreadsheet (slow)
        if (refresh) {
            const fetched = await this.spreadsheet.readCards({ projectShort, ids, filter });
            await this.database.updateCards({ projectShort, cards: fetched });
            return fetched;
        }
        // Otherwise, use database (fast)...
        const cards = await this.database.readCards({ projectShort, ids });
        const missing = ids?.filter((id) => !cards.some((card) => card.development.number === id.number && (!id.version || eq(card.development.versions.current, id.version)))) || [];
        // ... but fetch any which are missing (unlikely)
        if (missing.length > 0) {
            const fetched = await this.spreadsheet.readCards({ projectShort, ids: missing, filter });
            await this.database.createCards({ projectShort, cards: fetched });
            return cards.concat(fetched);
        }
        return cards;
    }

    public async updateCards({ cards }: { cards: Card[] }) {
        const groups = Map.groupBy(cards, (card) => card.development.project.short);
        for (const [projectShort, cardGroup ] of Array.from(groups.entries())) {
            await this.database.updateCards({ projectShort, cards: cardGroup });
            await this.spreadsheet.updateCards({ projectShort, cards: cardGroup });
        }
    }

    public async deleteCards({ projectShort, ids }: { projectShort: string, ids?: CardId[]}) {
        await this.database.deleteCards({ projectShort, ids });
        //TODO await this.spreadsheet.deleteCards(options);
    }

    public async cache({ type, projectShort, ids }: { type: string, projectShort: string, ids?: CardId[] }) {
        switch (type) {
            case "card":
                const fetched = await this.spreadsheet.readCards({ projectShort, ids });
                return await this.database.updateCards({ projectShort, cards: fetched });
            default:
                throw Error(`"${type}" is not a valid type to cache`);
        }
    }

    public async clearCache({ type, projectShort, ids }: { type: string, projectShort: string, ids?: CardId[] }) {
        switch (type) {
            case "card":
                return await this.database.deleteCards({ projectShort, ids });
            default:
                throw Error(`"${type}" is not a valid type to clear`);
        }
    }

    // TODO: Refine this closer to playtesting release time
    public async publishCards(projectShort: string, numbers: number[] = []) {
        const toUpdate = new Set<Card>();
        const toArchive = new Set<Card>();
        const implemented = new Set<Card>();

        const cards = await this.readCards({ projectShort, ids: numbers.map((number) => ({ number })), refresh: true });
        const groups = this.groupCardHistory(cards);
        for (const group of groups) {
            // Sync card image
            if (group.latest.isOutdatedImage) {
                await service.imaging.update([group.latest]);
                toUpdate.add(group.latest);
            }

            // If card has a marked change
            if (group.latest.isChanged) {
                if (group.latest.development.versions.current !== group.latest.development.versions.playtesting) {
                    toArchive.add(group.latest.clone());
                    group.latest.development.versions.playtesting = group.latest.development.versions.current;
                }

                delete group.latest.development.note;
                toUpdate.add(group.latest);
            }

            if (group.latest.isImplemented) {
                delete group.latest.development.github;
                implemented.add(group.latest);
            }
        }

        service.data.updateCards({ cards: Array.from(toUpdate) });
        service.data.createCards({ projectShort, cards: Array.from(toArchive), filter: ["archive"] });
        // TODO: Something with "Implemented"?
        return {
            archived: Array.from(toArchive),
            updated: Array.from(toUpdate)
        };
    }

    public groupCardHistory(cards: Card[]) {
        const groups = Map.groupBy(cards, (card) => card.development.number);

        return Array.from(groups.entries()).map(([number, c]) => {
            const previous = c.sort((a, b) => -semverCompareBuild(a.development.versions.current, b.development.versions.current));
            const latest = previous.shift();

            return { number, latest, previous };
        });
    }
}

class GASDataSource {
    private readonly scriptSuffix: string;

    constructor(env: string, private clientEmail: string, private privateKey: string, private projects: ExpandoObject) {
        this.scriptSuffix = env === "development" ? "dev" : "exec";
    }

    private async getAuthorization() {
        const client = new JWT({
            email: this.clientEmail,
            key: this.privateKey,
            scopes: [
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/script.processes",
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/script.external_request",
                "https://www.googleapis.com/auth/script.scriptapp"
            ]
        });
        const { token } = await client.getAccessToken();
        return `Bearer ${token}`;
    }

    public async createCards({ projectShort, cards, filter }: { projectShort: string, cards: Card[], filter?: AvailableSheetTypes[] }) {
        const scriptUrl = this.projects[projectShort]["script"] as string;
        if (!scriptUrl) {
            throw Error(`Missing project script for '${projectShort}' in config`);
        }
        const query = [
            ...(filter && filter.length > 0 && [ `filter=${filter.join(",")}` ])
        ];
        const url = `${scriptUrl}/${this.scriptSuffix}/cards/create${query.length > 0 ? `?${query.join("&")}` : ""}`;
        const fetchOptions = {
            method: "POST",
            headers: { Authorization: (await this.getAuthorization()) },
            body: JSON.stringify(cards.map((card) => Card.serialise(card)))
        } as RequestInit;

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw Error(`Google App Script fetch request failed: (${response.status}) ${response.statusText}`);
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error("Google App Script returned one or more errors", { cause: json.error });
        }

        console.log(`${json.data["created"]} ${projectShort} card(s) created in Google App Script`);
    }

    public async readCards({ projectShort, ids, filter }: { projectShort: string, ids?: CardId[], filter?: AvailableSheetTypes[] }) {
        const scriptUrl = this.projects[projectShort]["script"] as string;
        if (!scriptUrl) {
            throw Error(`Missing project script for '${projectShort}' in config`);
        }

        // Converting to format "15" or "15@1.0.0"
        const cardIds = ids?.map((id) => `${id.number}${id.version ? `@${id.version}` : ""}`).join(",");
        const query = [
            ...(filter ? [ `format=${filter.join(",")}` ] : []),
            ...(cardIds ? [ `ids=${cardIds}` ] : [])
        ];
        const url = `${scriptUrl}/${this.scriptSuffix}/cards${query.length > 0 ? `?${query.join("&")}` : ""}`;
        const fetchOptions = {
            method: "GET",
            headers: { Authorization: (await this.getAuthorization()) }
        } as RequestInit;

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw Error(`Google App Script fetch request failed: (${response.status}) ${response.statusText}`);
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error("Google App Script returned one or more errors", { cause: json.error });
        }
        const rawProject = json.data["project"];
        const project = Project.deserialise(rawProject);
        const rawCards = json.data["cards"] as unknown[][];
        const cards = rawCards.map((data) => Card.deserialise(project, data));

        console.log(`${cards.length} ${projectShort} card(s) read from Google App Script`);
        return cards;
    }

    public async updateCards({ projectShort, cards }: { projectShort: string, cards: Card[] }) {
        const scriptUrl = this.projects[projectShort]["script"] as string;
        if (!scriptUrl) {
            throw Error(`Missing project script for '${projectShort}' in config`);
        }

        const url = `${scriptUrl}/${this.scriptSuffix}/cards/update`;
        const fetchOptions = {
            method: "POST",
            headers: { Authorization: (await this.getAuthorization()) },
            body: JSON.stringify(cards.map((card) => Card.serialise(card)))
        } as RequestInit;

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw Error(`Google App Script fetch request failed: (${response.status}) ${response.statusText}`);
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error("Google App Script returned one or more errors", { cause: json.error });
        }

        console.log(`${json.data["updated"]} ${projectShort} card(s) updated in Google App Script`);
    }

    public async deleteCards() {
        // TODO: Delete from monogo & spreadsheet
        throw Error("NOT IMPLEMENTED");
    }
}

class MongoDataSource {
    private client: MongoClient;
    constructor(databaseUrl: string) {
        this.client = new MongoClient(databaseUrl);
        // Confirms that MongoDB is running
        this.client.db().command({ ping: 1 }).then(() => console.log("MongoDB successfully connected.")).catch(console.dir);
    }

    public async createCards({ projectShort, cards }: { projectShort: string, cards: Card[] }) {
        return await this.updateCards({ projectShort, cards });
    }

    public async readCards({ projectShort, ids }: { projectShort: string, ids?: CardId[] }) {
        const collection = this.client.db().collection<Card>("cards");
        const query = {
            "development.project.short": projectShort
        };
        if (ids && ids.length > 0) {
            query["$or"] = ids.map((id) => ({
                "development.number": id.number,
                ...(id.version && { "development.versions.current": id.version })
            }));
        }
        const result = await collection.find(query, { projection: { _id: 0 } }).toArray();
        return result.map((card) => Card.deserialiseFromDb(card));
    }

    public async updateCards({ projectShort, cards }: { projectShort: string, cards: Card[] }) {
        const collection = this.client.db().collection<Card>("cards");
        await collection.bulkWrite(cards.map((card) => ({
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

    public async deleteCards({ projectShort, ids }: { projectShort: string, ids?: CardId[] }) {
        const collection = this.client.db().collection<Card>("cards");
        const query = {
            "development.project.short": projectShort
        };
        if (ids && ids.length > 0) {
            query["$or"] = ids.map((id) => ({
                "development.number": id.number,
                ...(id.version && { "development.versions.current": id.version })
            }));
        }
        return await collection.deleteMany(query);
    }
}

export default DataService;