import MongoDataSource from "./DataSources/MongoDataSource";
import Project from "../Models/Project";
import { IRepository } from "..";
import { MongoClient } from "mongodb";
import { logger } from "../../Services";

export default class ProjectsRepository implements IRepository<Project> {
    public database: ProjectMongoDataSource;
    constructor(mongoClient: MongoClient) {
        this.database = new ProjectMongoDataSource(mongoClient.db().collection<Project>("projects"));
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

class ProjectMongoDataSource extends MongoDataSource<Project> {
    public async create({ projects }: { projects: Project[] }) {
        if (projects.length === 0) {
            return;
        }
        const results = await this.collection.insertMany(projects);

        logger.verbose(`Inserted ${results.insertedCount} values into project collection`);
        return results.insertedCount;
    }

    public async read({ codes }: { codes?: number[] } = {}) {
        const mappedCodes = codes?.map((code) => ({ "code": code }));
        const query = {
            ...(mappedCodes && { "$or": mappedCodes })
        };
        const result = await this.collection.find(query, { projection: { _id: 0 } }).toArray();

        logger.verbose(`Read ${result.length} values from project collection`);
        return result as Project[];
    }

    public async update({ projects }: { projects: Project[] }) {
        if (projects.length === 0) {
            return;
        }
        const results = await this.collection.bulkWrite(projects.map((project) => ({
            replaceOne: {
                filter: {
                    "code": project.code
                },
                replacement: project,
                upsert: true
            }
        })));

        logger.verbose(`Upserted ${results.upsertedCount} values into project collection`);
        return results.upsertedCount;
    }

    public async destroy({ codes }: { codes?: number[] } = {}) {
        const mappedCodes = codes?.map((code) => ({ "code": code }));
        const query = {
            ...(mappedCodes && { "$or": mappedCodes })
        };
        const results = await this.collection.deleteMany(query);

        logger.verbose(`Deleted ${results.deletedCount} values from project collection`);
        return results.deletedCount;
    }
}