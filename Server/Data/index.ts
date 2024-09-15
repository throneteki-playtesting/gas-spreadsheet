import CardsRepository from "./Repositories/CardsRepository";
import { MongoClient } from "mongodb";
import MongoDataSource from "./Repositories/DataSources/MongoDataSource";
import GASDataSource from "./Repositories/DataSources/GASDataSource";
import ProjectsRepository from "./Repositories/ProjectsRepository";
import { logger } from "../Services";

export interface IRepository<Model> {
    database?: MongoDataSource<Model>
    spreadsheet?: GASDataSource<Model>
}

class DataService {
    private client: MongoClient;

    private _projects: ProjectsRepository;
    private _cards: CardsRepository;

    constructor(databaseUrl: string, googleClientEmail: string, googlePrivateKey: string) {
        this.client = new MongoClient(databaseUrl);
        this.client.db().command({ ping: 1 })
            .then(() => {
                // Confirms that MongoDB is running
                logger.info(`MongoDB connected to ${this.client.db().databaseName}`);

                this._projects = new ProjectsRepository(this.client);
                this._cards = new CardsRepository(this.client, googleClientEmail, googlePrivateKey);
            })
            .catch(logger.error);
    }

    get projects() {
        if (!this._projects) {
            throw Error("Failed to connect to \"projects\" repository: MongoDB instance cannot be reached");
        }
        return this._projects;
    }

    get cards() {
        if (!this._cards) {
            throw Error("Failed to connect to \"cards\" repository: MongoDB instance cannot be reached");
        }
        return this._cards;
    }
}

export default DataService;