import MongoDataSource from "./DataSources/MongoDataSource";
import GASDataSource from "./DataSources/GASDataSource";
import { Collection, MongoClient } from "mongodb";
import { IRepository } from "..";
import { GASAPI, logger } from "../../Services";
import { Utils } from "@/Common/Utils";
import Review from "../Models/Review";
import { ReviewsController } from "@/GoogleAppScript/Controllers/ReviewsController";
import { Reviews } from "@/Common/Models/Reviews";

export default class ReviewsRepository implements IRepository<Review> {
    public database: ReviewMongoDataSource;
    public spreadsheet: ReviewGASDataSource;
    constructor(mongoClient: MongoClient) {
        this.database = new ReviewMongoDataSource(mongoClient);
        this.spreadsheet = new ReviewGASDataSource();
    }
    public async create({ reviews }: { reviews: Review[] }) {
        await this.database.create({ reviews });
        await this.spreadsheet.create({ reviews });
    }

    public async read({ matchers, hard }: { matchers: Reviews.Matcher[], hard?: boolean }) {
        let reviews: Review[];
        // Force hard refresh from spreadsheet (slow)
        if (hard) {
            const fetched = await this.spreadsheet.read({ matchers });
            await this.database.update({ reviews: fetched });
            reviews = fetched;
        } else {
            // Otherwise, use database (fast)...
            reviews = await this.database.read({ matchers });
            const missing = matchers?.filter((matcher) => !reviews.some((review) => {
                return matcher.projectId === review.card.project._id
                    && (!matcher.number || matcher.number === review.card.number)
                    && (!matcher.version || matcher.version === review.card.version);
            })) || [];
            // ... but fetch any which are missing (unlikely)
            if (missing.length > 0) {
                const fetched = await this.spreadsheet.read({ matchers: missing });
                await this.database.create({ reviews: fetched });
                reviews = reviews.concat(fetched);
            }
        }
        return reviews.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    public async update({ reviews, upsert }: { reviews: Review[], upsert?: boolean }) {
        await this.database.update({ reviews, upsert });
        await this.spreadsheet.update({ reviews, upsert });
    }

    public async destroy({ matchers }: { matchers: Reviews.Matcher[] }) {
        await this.database.destroy({ matchers });
        await this.spreadsheet.destroy({ matchers });
    }
}

class ReviewMongoDataSource implements MongoDataSource<Review> {
    private name = "reviews";
    private collection: Collection<Reviews.Model>;
    constructor(client: MongoClient) {
        this.collection = client.db().collection<Reviews.Model>(this.name);
    }
    public async create({ reviews }: { reviews: Review[] }) {
        if (reviews.length === 0) {
            return [];
        }
        const models = await Review.toModels(...reviews);
        const results = await this.collection.insertMany(models);

        logger.verbose(`Inserted ${results.insertedCount} values into ${this.name} collection`);
        const insertedIds = Object.values(results.insertedIds);
        return reviews.filter((review) => insertedIds.includes(review._id));
    }
    public async read({ matchers }: { matchers: Reviews.Matcher[] }) {
        const query = { ...(matchers?.length > 0 && { "$or": matchers.map(Utils.cleanObject) }) };
        const result = await this.collection.find(query).toArray();

        logger.verbose(`Read ${result.length} values from ${this.name} collection`);
        return await Review.fromModels(...result);
    }

    public async update({ reviews, upsert = true }: { reviews: Review[], upsert?: boolean }) {
        if (reviews.length === 0) {
            return [];
        }
        const models = await Review.toModels(...reviews);
        const results = await this.collection.bulkWrite(models.map((model) => ({
            replaceOne: {
                filter: { "_id": model._id },
                replacement: model,
                upsert
            }
        })));

        logger.verbose(`${upsert ? "Upserted" : "Updated"} ${results.modifiedCount + results.upsertedCount} values into ${this.name} collection`);
        const updatedIds = Object.values(results.insertedIds).concat(Object.values(results.upsertedIds));
        return reviews.filter((review) => updatedIds.includes(review._id));
    }

    public async destroy({ matchers }: { matchers: Reviews.Matcher[] }) {
        const query = { ...(matchers?.length > 0 && { "$or": matchers.map(Utils.cleanObject) }) };
        // Collect all which are to be deleted
        const deleting = await Review.fromModels(...(await this.collection.find(query).toArray()));
        const results = await this.collection.deleteMany(query);

        logger.verbose(`Deleted ${results.deletedCount} values from ${this.name} collection`);
        return deleting;
    }
}

class ReviewGASDataSource implements GASDataSource<Review> {
    public async create({ reviews }: { reviews: Review[] }) {
        const groups = Map.groupBy(reviews, (review) => review.card.project);
        const created: Review[] = [];
        for (const [project, pReviews] of groups.entries()) {
            const url = `${project.script}/reviews/create`;
            const models = await Review.toModels(...pReviews);
            const body = JSON.stringify(models);

            const response = await GASAPI.post<ReviewsController.GASCreateReviewsResponse>(url, body);
            created.push(...await Review.fromModels(...response.created));
            logger.verbose(`${created.length} review(s) created in Google App Script (${project.name})`);
        }
        return created;
    }

    public async read({ matchers }: { matchers: Reviews.Matcher[] }) {
        const groups = Map.groupBy(matchers.map(Utils.cleanObject), (matcher) => matcher.projectId);
        const read: Review[] = [];
        for (const [projectId, pModels] of groups.entries()) {
            const project = await GASAPI.getProject(projectId);
            const ids = pModels.filter((has) => has.number).map((pm) => `${pm.reviewer}@${pm.number}@${pm.version}` as Reviews.Id);
            const url = `${project.script}/reviews${ids.length > 0 ? `?ids=${ids.join(",")}` : ""}`;

            const response = await GASAPI.get<ReviewsController.GASReadReviewsResponse>(url);
            read.push(...await Review.fromModels(...response.reviews));
            logger.verbose(`${read.length} review(s) read from Google App Script (${project.name})`);
        }
        return read;
    }

    public async update({ reviews, upsert = true }: { reviews: Review[], upsert?: boolean }) {
        const groups = Map.groupBy(reviews, (review) => review.card.project);
        const updated: Review[] = [];
        for (const [project, pReviews] of groups.entries()) {
            const url = `${project.script}/reviews/update?upsert=${upsert ? "true" : "false"}`;
            const models = await Review.toModels(...pReviews);
            const body = JSON.stringify(models);

            const response = await GASAPI.post<ReviewsController.GASUpdateReviewsResponse>(url, body);
            updated.push(...await Review.fromModels(...response.updated));
            logger.verbose(`${updated.length} review(s) updated in Google App Script (${project.name})`);
        }
        return updated;
    }

    public async destroy({ matchers }: { matchers: Reviews.Matcher[] }) {
        const groups = Map.groupBy(matchers.map(Utils.cleanObject), (matcher) => matcher.projectId);
        const destroyed: Review[] = [];
        for (const [projectId, pModels] of groups.entries()) {
            const project = await GASAPI.getProject(projectId);
            const ids = pModels.filter((has) => has.number).map((pm) => `${pm.reviewer}@${pm.number}@${pm.version}` as Reviews.Id);
            const url = `${project.script}/reviews/destroy${ids ? `?ids=${ids.join(",")}` : ""}`;

            const response = await GASAPI.get<ReviewsController.GASDestroyReviewsResponse>(url);
            destroyed.push(...await Review.fromModels(...response.destroyed));
            logger.verbose(`${destroyed.length} review(s) deleted in Google App Script (${project.name})`);
        }
        return destroyed;
    }
}