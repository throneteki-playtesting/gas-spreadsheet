import { ExpandoObject } from "../../Common/Utils";
import CardsRepository from "./CardsRepository";
import { MongoClient } from "mongodb";
import { logger } from "..";

class DataService {
    private client: MongoClient;
    public cards: CardsRepository;
    // public projects: ProjectsRepository;

    constructor(databaseUrl: string, googleClientEmail: string, googlePrivateKey: string, private projects: ExpandoObject) {
        this.client = new MongoClient(databaseUrl);
        this.client.db().command({ ping: 1 })
            .then(() => {
                // Confirms that MongoDB is running
                logger.info(`MongoDB connected to ${this.client.db().databaseName}`);

                this.cards = new CardsRepository(this.client, googleClientEmail, googlePrivateKey, projects);
                // this.projects = this.client.db().collection<Project>("projects");
                // this.reviews = this.client.db().collection<Review>("reviews");
            })
            .catch(console.dir);
    }
}

export default DataService;