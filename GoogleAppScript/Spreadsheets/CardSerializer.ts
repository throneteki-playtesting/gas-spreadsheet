import { Utils } from "@/Common/Utils";
import * as Model from "../../Common/Models/Card";
import { GooglePropertiesType, Settings } from "../Settings";
import { DataSerializer } from "./DataSheets";

class CardSerializer implements DataSerializer<Model.CardModel> {
    public richTextColumns: Column[] = [Column.Textbox, Column.Flavor, Column.NoteText, Column.GithubIssue];
    private static stripHTML(value: string) {
        return value.replace(/<[^>]*>/g, "");
    }
    private static deserializeTypedNumber<T>(value: string) {
        try {
            const number = parseInt(value);
            return Number.isNaN(number) ? value as T : number;
        } catch {
            throw Error(`Invalid value '${value}' cannot be cast to Number or special type`);
        }
    }
    private static extractLinkText<T>(value: string, mappingFunc: (link: string, text: string) => T) {
        if (!value) {
            return null;
        }

        const regex = /<a\s+href="(.+)">([^<]*)<\/a>/gm;
        const groups = regex.exec(value);
        if (groups === null) {
            throw Error(`Failed to extract link/text from "${value}"`);
        }
        return mappingFunc(groups[1], groups[2]);
    }

    public deserialize(values: string[]): Model.CardModel {
        const model = {
            _id: `${values[Column.Number]}@${values[Column.Version]}`,
            project: parseInt(Settings.getProperty(GooglePropertiesType.Script, "code")),
            number: parseInt(values[Column.Number]),
            version: values[Column.Version],
            faction: values[Column.Faction] as Model.Faction,
            name: values[Column.Name],
            type: values[Column.Type] as Model.Type,
            traits: values[Column.Traits].split(".").map(t => t.trim()).filter(t => t && t != "-"),
            text: values[Column.Textbox],
            flavor: values[Column.Flavor] || undefined,
            illustrator: values[Column.Illustrator] || undefined,
            designer: values[Column.Designer] || undefined,
            loyal: (values[Column.Faction] as Model.Faction) !== "Neutral" ? values[Column.Loyal].toLowerCase() === "loyal" : undefined,
            note: values[Column.NoteType] ? {
                type: values[Column.NoteType] as Model.NoteType,
                text: values[Column.NoteText]
            } : undefined,
            playtesting: values[Column.PlaytestVersion] || undefined,
            github: CardSerializer.extractLinkText(values[Column.GithubIssue], (link, text) => ({ status: text, issueUrl: link })) || undefined,
            release: values[Column.PackShort] ? {
                short: values[Column.PackShort],
                number: parseInt(values[Column.ReleaseNumber])
            } : undefined
        } as Model.CardModel;
        switch (model.type) {
            case "Character":
                model.strength = CardSerializer.deserializeTypedNumber(values[Column.Strength]);
                const iconsString = values[Column.Icons];
                model.icons = {
                    military: iconsString.includes("M"),
                    intrigue: iconsString.includes("I"),
                    power: iconsString.includes("P")
                };
            case "Attachment":
            case "Location":
                model.unique = values[Column.Unique] === "Unique";
            case "Event":
                model.cost = CardSerializer.deserializeTypedNumber(values[Column.Cost] !== undefined ? values[Column.Cost] : "-");
                break;
            case "Plot":
                model.plotStats = {
                    income: CardSerializer.deserializeTypedNumber(values[Column.Income]),
                    initiative: CardSerializer.deserializeTypedNumber(values[Column.Initiative]),
                    claim: CardSerializer.deserializeTypedNumber(values[Column.Claim]),
                    reserve: CardSerializer.deserializeTypedNumber(values[Column.Reserve])
                };
            case "Agenda":
                // Nothing additional to add
                break;
        }
        return model;
    }

    public serialize(model: Model.CardModel) {
        // Initialise "empty" values, with dashes for all dashable columns (eg. Loyal, Unique, ...)
        const values: string[] = Array.from({ length: Utils.maxEnum(Column) }, (v, i) => [Column.Loyal, Column.Unique, Column.Cost, Column.Strength, Column.Icons, Column.Traits].includes(i) ? "-" : "");
        values[Column.Number] = model.number.toString();
        values[Column.Version] = model.version;
        values[Column.Faction] = model.faction;
        values[Column.Name] = model.name;
        values[Column.Type] = model.type;
        values[Column.Loyal] = model.loyal !== undefined ? (model.loyal ? "Loyal" : "Non-Loyal") : "-";
        values[Column.Traits] = model.traits.length > 0 ? model.traits.map(t => t + ".").join(" ") : "-";
        values[Column.Textbox] = model.text;
        values[Column.Flavor] = model.flavor || "";
        values[Column.Limit] = model.deckLimit !== Utils.DefaultDeckLimit[model.type] ? model.deckLimit.toString() : "";
        values[Column.Designer] = model.designer || "";
        values[Column.Illustrator] = model.illustrator || "";
        values[Column.NoteType] = model.note ? model.note.type as string : "";
        values[Column.NoteText] = model.note?.text || "";
        values[Column.PlaytestVersion] = model.playtesting || "";
        values[Column.GithubIssue] = model.github ? `<a href="${model.github.issueUrl}">${model.github.status}</a>` : "";
        values[Column.PackShort] = model.release?.short || "";
        values[Column.ReleaseNumber] = model.release?.number.toString() || "";

        switch (model.type) {
            case "Character":
                values[Column.Strength] = model.strength?.toString() || "-";
                const iconLetters = [
                    ... model.icons?.military ? ["M"] : [],
                    ... model.icons?.intrigue ? ["I"] : [],
                    ... model.icons?.power ? ["P"] : []
                ];
                values[Column.Icons] = iconLetters.join(" / ");
            case "Attachment":
            case "Location":
                values[Column.Unique] = model.unique ? "Unique" : "Non-Unique";
            case "Event":
                values[Column.Cost] = model.cost?.toString() || "-";
                break;
            case "Plot":
                values[Column.Income] = model.plotStats?.income.toString();
                values[Column.Initiative] = model.plotStats?.initiative.toString();
                values[Column.Claim] = model.plotStats?.claim.toString();
                values[Column.Reserve] = model.plotStats?.reserve.toString();
            case "Agenda":
            // Nothing to set
        }

        return values;
    }

    public filter(values: string[], index: number, model?: Model.CardModel) {
        if (!model) {
            return true;
        }
        const [number, version] = model._id?.split("@") || [model.number.toString(), model.version];
        return parseInt(values[Column.Number]) === parseInt(number) && (!version || values[Column.Version] === version);
    }
}

enum Column {
    Number,
    Version,
    Faction,
    Name,
    Type,
    Loyal,
    Unique,
    Income = Unique,
    Cost,
    Initiative = Cost,
    Strength,
    Claim = Strength,
    Icons,
    Reserve = Icons,
    Traits,
    Textbox,
    Flavor,
    Limit,
    Designer,
    Illustrator,
    NoteType,
    NoteText,
    PlaytestVersion,
    GithubIssue,
    PackShort,
    ReleaseNumber
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace CardSerializer {
    export const instance = new CardSerializer();
}

export {
    CardSerializer
};