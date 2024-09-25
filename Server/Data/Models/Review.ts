import Card from "./Card";
import { Joi } from "celebrate";
import { Utils } from "@/Common/Utils";
import { dataService } from "@/Server/Services";
import { Reviews } from "@/Common/Models/Reviews";
import { Cards } from "@/Common/Models/Cards";

class Review {
    public _id: Reviews.Id;
    constructor(
        public reviewer: string,
        public card: Card,
        public decks: string[],
        public played: Reviews.PlayedRange,
        public statements: Reviews.Statements,
        public additional: string,
        public date: Date
    ) {
        this._id = Reviews.condenseId({ reviewer, projectId: card.project._id, number: card.number, version: card.version });
    }

    static async fromModels(...models: Reviews.Model[]) {
        if (models.length === 0) {
            return [];
        }
        const matchers = models.map((model) => ({ projectId: model.projectId, number: model.number, version: model.version }));
        const cards = await dataService.cards.read({ matchers });
        return models.map((model) => {
            const card = cards.find((c) => c.project._id === model.projectId && c.number === model.number && c.version === model.version);
            const date = new Date(model.epoch);
            return new Review(model.reviewer, card, model.decks, model.played, model.statements, model.additional, date);
        });
    }

    static async toModels(...reviews: Review[]) {
        return reviews.map((review) => ({
            _id: review._id,
            reviewer: review.reviewer,
            projectId: review.card.project._id,
            number: review.card.number,
            version: review.card.version,
            faction: review.card.faction,
            name: review.card.name,
            decks: review.decks,
            played: review.played,
            statements: review.statements,
            additional: review.additional,
            epoch: review.date.getTime()
        }) as Reviews.Model);
    }

    public static schema = {
        _id: Joi.string().regex(Utils.Regex.Review.id.full),
        reviewer: Joi.string().required(),
        projectId: Joi.number().required(),
        number: Joi.number().required(),
        version: Joi.string().required().regex(Utils.Regex.SemanticVersion),
        faction: Joi.string().valid(...Cards.factions),
        name: Joi.string(),
        decks: Joi.array().items(Joi.string()),
        played: Joi.string().required().valid(...Reviews.playedRange),
        statements: Joi.object({
            boring: Joi.string().required().valid(...Reviews.statementAnswer),
            competitive: Joi.string().required().valid(...Reviews.statementAnswer),
            creative: Joi.string().required().valid(...Reviews.statementAnswer),
            balanced: Joi.string().required().valid(...Reviews.statementAnswer),
            releasable: Joi.string().required().valid(...Reviews.statementAnswer)
        }).required(),
        additional: Joi.string(),
        epoch: Joi.number().required()
    };
}

export default Review;