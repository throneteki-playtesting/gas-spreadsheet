import { SemanticVersion, Utils } from "@/Common/Utils";
import { Reviews } from "@/Common/Models/Reviews";
import { Cards } from "@/Common/Models/Cards";
import { GooglePropertiesType, Settings } from "../../Settings";
import { DataSerializer } from "./DataSerializer";

class ReviewSerializer extends DataSerializer<Reviews.Model> {
    richTextColumns: number[] = [ReviewColumn.Decks, ReviewColumn.Additional];
    public deserialize(values: string[]): Reviews.Model {
        const model = {
            reviewer: values[ReviewColumn.Reviewer],
            projectId: parseInt(Settings.getProperty(GooglePropertiesType.Script, "code")),
            number: parseInt(values[ReviewColumn.Number]),
            version: values[ReviewColumn.Version] as SemanticVersion,
            faction: values[ReviewColumn.Faction] as Cards.Faction,
            name: values[ReviewColumn.Name],
            decks: values[ReviewColumn.Decks].split("\n").map((deck) => this.extractLinkText(deck, (link) => link)),
            played: parseInt(values[ReviewColumn.Played]) as Reviews.PlayedRange,
            statements: {
                boring: values[ReviewColumn.Boring] as Reviews.StatementAnswer,
                competitive: values[ReviewColumn.Competitive] as Reviews.StatementAnswer,
                creative: values[ReviewColumn.Creative] as Reviews.StatementAnswer,
                balanced: values[ReviewColumn.Balanced] as Reviews.StatementAnswer,
                releasable: values[ReviewColumn.Releasable] as Reviews.StatementAnswer
            },
            additional: values[ReviewColumn.Additional] || undefined,
            epoch: new Date(values[ReviewColumn.Date]).getTime()
        } as Reviews.Model;

        return model;
    }

    public serialize(model: Reviews.Model) {
        const values: string[] = Array.from({ length: Utils.maxEnum(ReviewColumn) });
        values[ReviewColumn.Number] = model.number.toString();
        values[ReviewColumn.Version] = model.version;
        values[ReviewColumn.Faction] = model.faction;
        values[ReviewColumn.Name] = model.name;
        values[ReviewColumn.Date] = new Date(model.epoch).toLocaleString();
        values[ReviewColumn.Reviewer] = model.reviewer;
        values[ReviewColumn.Decks] = model.decks.map((deck, index) => `<a href="${deck}">Deck ${index + 1}</a>`).join("\n");
        values[ReviewColumn.Played] = model.played.toString();
        values[ReviewColumn.Boring] = model.statements.boring;
        values[ReviewColumn.Competitive] = model.statements.competitive;
        values[ReviewColumn.Creative] = model.statements.creative;
        values[ReviewColumn.Balanced] = model.statements.balanced;
        values[ReviewColumn.Releasable] = model.statements.releasable;
        values[ReviewColumn.Additional] = model.additional || "";

        return values;
    }

    public filter(values: string[], index: number, model?: Reviews.Model) {
        if (!model) {
            return true;
        }

        const { reviewer, number, version } = model._id ? Reviews.expandId(model._id) : { reviewer: model.reviewer, number: model.number, version: model.version };
        return (!reviewer || values[ReviewColumn.Reviewer] === model.reviewer)
            && (!number || values[ReviewColumn.Number].toString() === model.number.toString())
            && (!version || values[ReviewColumn.Version] === model.version);
    }
}

export enum ReviewColumn {
    Number,
    Version,
    Faction,
    Name,
    Date,
    Reviewer,
    Decks,
    Played,
    Boring,
    Competitive,
    Creative,
    Balanced,
    Releasable,
    Additional
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ReviewSerializer {
    export const instance = new ReviewSerializer();
}

export {
    ReviewSerializer
};