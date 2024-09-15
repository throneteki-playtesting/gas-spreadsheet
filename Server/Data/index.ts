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

    public projects: ProjectsRepository;
    public cards: CardsRepository;

    constructor(databaseUrl: string, googleClientEmail: string, googlePrivateKey: string) {
        this.client = new MongoClient(databaseUrl);
        this.client.db().command({ ping: 1 })
            .then(() => {
                // Confirms that MongoDB is running
                logger.info(`MongoDB connected to ${this.client.db().databaseName}`);

                this.projects = new ProjectsRepository(this.client);
                this.cards = new CardsRepository(this.client, googleClientEmail, googlePrivateKey);
            })
            .catch(logger.error);
    }
}

export default DataService;