import MongoDataSource from "./DataSources/MongoDataSource";
import Project from "../Models/Project";
import { IRepository } from "..";
import { Collection, MongoClient } from "mongodb";
import { logger } from "../../Services";
import { Projects } from "@/Common/Models/Projects";

export default class ProjectsRepository implements IRepository<Project> {
    public database: ProjectMongoDataSource;
    constructor(mongoClient: MongoClient) {
        this.database = new ProjectMongoDataSource(mongoClient);
    }

    public async create({ projects }: { projects: Project[] }) {
        return this.database.create({ projects });
    }

    public async read({ codes }: { codes?: number[] } = {}) {
        return this.database.read({ codes });
    }

    public async update({ projects }: { projects: Project[] }) {
        return this.database.update({ projects });
    }

    public async destroy({ codes }: { codes?: number[] } = {}) {
        return this.database.destroy({ codes });
    }
}

class ProjectMongoDataSource implements MongoDataSource<Project> {
    private name = "projects";
    private collection: Collection<Projects.Model>;
    constructor(client: MongoClient) {
        this.collection = client.db().collection<Projects.Model>(this.name);
    }

    public async create({ projects }: { projects: Project[] }) {
        if (projects.length === 0) {
            return [];
        }

        const models = await Project.toModels(...projects);
        const results = await this.collection.insertMany(models);

        logger.verbose(`Inserted ${results.insertedCount} values into ${this.name} collection`);
        const insertedIds = Object.values(results.insertedIds);
        return projects.filter((project) => insertedIds.includes(project._id));
    }

    public async read({ codes }: { codes?: number[] } = {}) {
        const mappedCodes = codes?.map((code) => ({ "code": code }));
        const query = { ...(mappedCodes && { "$or": mappedCodes }) };
        const result = await this.collection.find(query).toArray();

        logger.verbose(`Read ${result.length} values from ${this.name} collection`);
        return await Project.fromModels(...result);
    }

    public async update({ projects, upsert = true }: { projects: Project[], upsert?: boolean }) {
        if (projects.length === 0) {
            return [];
        }

        const models = await Project.toModels(...projects);
        const results = await this.collection.bulkWrite(models.map((model) => ({
            replaceOne: {
                filter: { "_id": model._id },
                replacement: model,
                upsert
            }
        })));

        logger.verbose(`${upsert ? "Upserted" : "Updated"} ${results.modifiedCount + results.upsertedCount} values into ${this.name} collection`);
        const updatedIds = Object.values(results.insertedIds).concat(Object.values(results.upsertedIds));
        return projects.filter((project) => updatedIds.includes(project._id));
    }

    public async destroy({ codes }: { codes?: number[] } = {}) {
        const mappedCodes = codes?.map((code) => ({ "code": code }));
        const query = { ...(mappedCodes && { "$or": mappedCodes }) };
        // Collect all which are to be deleted
        const deleting = await Project.fromModels(...(await this.collection.find(query).toArray()));
        const results = await this.collection.deleteMany(query);

        logger.verbose(`Deleted ${results.deletedCount} values from ${this.name} collection`);
        return deleting;
    }
}