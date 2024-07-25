import { JWT } from "google-auth-library";
import Card from "../../Models/Card";
import { GASResponse } from "../../GoogleAppScript/Controller";
import { MongoClient } from "mongodb";
import { ExpandoObject } from "../../Common/Utils";
import Project from "../../Models/Project";
import semverCompareBuild from "semver/functions/compare-build";
import { service } from "..";
import { SemVer } from "semver";
import { AvailableSheetTypes } from "../../GoogleAppScript/Spreadsheets/Spreadsheet";
import { CardIdentifier } from "../../GoogleAppScript/Spreadsheets/CardInfo";
import { Message } from "discord.js";

class DataService {
    private spreadsheet: GASDataSource;
    private database: MongoDataSource;

    constructor(env: string, dbClient: MongoClient, gasOptions: GASOptions) {
        this.spreadsheet = new GASDataSource(env, gasOptions);
        this.database = new MongoDataSource(dbClient);
    }

    public async createCards(options: { projectShort: string, cards: Card[], filter: AvailableSheetTypes[] }) {
        await this.database.createCards(options);
        await this.spreadsheet.createCards(options);
    }

    public async readCards(options: { ids: CardIdentifier[], projectShort: string, refresh?: boolean, latestOnly?: boolean }) {
        // Force data to refresh from spreadsheet (slow)
        if (options.refresh) {
            const fetched = await this.spreadsheet.readCards(options);
            await this.database.updateCards({ projectShort: options.projectShort, cards: fetched });
            return fetched;
        }
        // Otherwise, use database (fast)...
        const cards = await this.database.readCards(options);
        const missing = options.ids.filter((id) => !cards.some((card) => card.development.number === id.number && (!id.version || card.development.versions.current === new SemVer(id.version))));
        // ... but fetch any which are missing (unlikely)
        if (missing.length > 0) {
            const fetched = await this.spreadsheet.readCards(options);
            await this.database.updateCards({ projectShort: options.projectShort, cards: fetched });
            return cards.concat(fetched);
        }
        return cards;
    }

    public async updateCards(options: { projectShort: string, cards: Card[] }) {
        await this.database.updateCards(options);
        await this.spreadsheet.updateCards(options);
    }

    public async pushCardUpdate(projectShort: string, numbers: number[] = []) {
        const ids = numbers.map((number) => ({ number }));
        const allCards = (await this.readCards({ projectShort, ids }));
        const groups = Map.groupBy(allCards, (card) => card.development.number);
        const toUpdate = new Set<Card>();
        const toArchive = new Set<Card>();
        const implemented = new Set<Card>();
        const discordResponses: Message<true>[] = [];

        for (const [, cards] of Array.from(groups.entries())) {
            const previous = cards.sort((a, b) => -semverCompareBuild(a.development.versions.current, b.development.versions.current));
            const latest = previous.shift();

            // Sync card image
            if (latest.isOutdatedImage) {
                await service.imaging.update(latest);
                toUpdate.add(latest);
            }

            // Check if needs to be archived
            if (latest.isChanged || latest.isNewlyImplemented || latest.isPreRelease) {
                if (latest.development.versions.current !== latest.development.versions.playtesting) {
                    toArchive.add(latest.clone());
                    latest.development.versions.playtesting = latest.development.versions.current;
                }

                delete latest.development.note;

                if (latest.isNewlyImplemented) {
                    delete latest.development.github;
                    implemented.add(latest);
                }
                toUpdate.add(latest);
            }
            const referenceMessage = await service.discord.syncCardThread(latest, ...previous);
            discordResponses.push(referenceMessage);
        }

        service.data.updateCards({ projectShort, cards: Array.from(toUpdate) });
        service.data.createCards({ projectShort, cards: Array.from(toArchive), filter: ["archive"] });
        // TODO: Something with "Implemented"?
        return {
            archived: Array.from(toArchive),
            updated: Array.from(toUpdate),
            discord: discordResponses
        };
    }
}

class GASDataSource {
    readonly scriptSuffix: string;

    constructor(env: string, private options: GASOptions) {
        this.scriptSuffix = env === "development" ? "dev" : "exec";
    }

    private async getAuthorization() {
        const client = new JWT({
            email: this.options.clientEmail,
            key: this.options.privateKey,
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
    public async createCards(options: { projectShort: string, cards: Card[], filter: AvailableSheetTypes[] }) {
        const scriptUrl = this.options.scripts[options.projectShort];
        if (!scriptUrl) {
            throw Error(`Must provide google.script url for '${options.projectShort}' in config`);
        }
        const query = [
            ...(options.filter.length > 0 && [ `filter=${options.filter.join(",")}` ])
        ];
        const url = `${scriptUrl}/${this.scriptSuffix}/cards/create${query.length > 0 ? `?${query.join("&")}` : ""}`;
        const fetchOptions = {
            method: "POST",
            headers: { Authorization: (await this.getAuthorization()) },
            body: JSON.stringify(options.cards.map((card) => Card.serialise(card)))
        } as RequestInit;

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw Error(`Google App Script fetch request failed: (${response.status}) ${response.statusText}`);
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error("Google App Script returned one or more errors", { cause: json.error });
        }

        console.log(`${json.data["created"]} ${options.projectShort} card(s) created in Google App Script`);
    }

    public async readCards(options: { projectShort: string, ids: CardIdentifier[], latestOnly?: boolean }) {
        const scriptUrl = this.options.scripts[options.projectShort];
        if (!scriptUrl) {
            throw Error(`Must provide google.script url for '${options.projectShort}' in config`);
        }

        // Converting to format "15" or "15@1.0.0"
        const ids = options.ids.map((id) => `${id.number}${id.version ? `@${id.version}` : ""}`).join(",");
        const query = [
            ...(options.latestOnly && [ "format=latest" ]),
            ...(ids.length > 0 && [ `ids=${ids}` ])
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
        const rawProject = json.data["project"] as ExpandoObject;
        const project = Project.deserialise(rawProject);
        const rawCards = json.data["cards"] as string[][];
        const cards = rawCards.map((data) => Card.deserialise(project, data));

        console.log(`${cards.length} ${options.projectShort} card(s) read from Google App Script`);
        return cards;
    }

    public async updateCards(options: { projectShort: string, cards: Card[] }) {
        const scriptUrl = this.options.scripts[options.projectShort];
        if (!scriptUrl) {
            throw Error(`Must provide google.script url for '${options.projectShort}' in config`);
        }

        const url = `${scriptUrl}/${this.scriptSuffix}/cards/update`;
        const fetchOptions = {
            method: "POST",
            headers: { Authorization: (await this.getAuthorization()) },
            body: JSON.stringify(options.cards.map((card) => Card.serialise(card)))
        } as RequestInit;

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw Error(`Google App Script fetch request failed: (${response.status}) ${response.statusText}`);
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error("Google App Script returned one or more errors", { cause: json.error });
        }

        console.log(`${json.data["updated"]} ${options.projectShort} card(s) updated in Google App Script`);
    }

    public async deleteCards() {
        // TODO
        throw Error("NOT IMPLEMENTED");
    }
}

class MongoDataSource {
    constructor(private client: MongoClient) {
        // Confirms that MongoDB is running
        client.db().command({ ping: 1 }).then(() => console.log("MongoDB successfully connected.")).catch(console.dir);
    }

    public async createCards(options: { projectShort: string, cards: Card[] }) {
        return await this.updateCards(options);
    }

    public async readCards(options: { projectShort: string, ids: CardIdentifier[] }) {
        const collection = this.client.db().collection<Card>("cards");
        const query = {
            "development.project.short": options.projectShort
        };
        if (options.ids.length > 0) {
            query["$or"] = options.ids.map((id) => ({
                "development.number": id.number,
                ...(id.version && { "development.versions.current": id.version })
            }));
        }
        const result = await collection.find(query, { projection: { _id: 0 } }).toArray();
        return result.map((card) => Card.deserialiseFromDb(card));
    }

    public async updateCards(options: { projectShort: string, cards: Card[] }) {
        const collection = this.client.db().collection<Card>("cards");
        await collection.bulkWrite(options.cards.map((card) => ({
            replaceOne: {
                filter: {
                    "development.number": card.development.number,
                    "development.project.short": options.projectShort,
                    "development.versions.current": card.development.versions.current
                },
                replacement: card,
                upsert: true
            }
        })));
    }

    public async delete() {
        // TODO
    }
}

interface GASOptions {
    clientEmail: string,
    privateKey: string,
    scripts: {
        [key: string]: string
    }
}

export default DataService;