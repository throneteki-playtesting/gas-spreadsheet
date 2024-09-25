import { Utils } from "@/Common/Utils";
import { GooglePropertiesType, Settings } from "../../Settings";
import { Cards } from "@/Common/Models/Cards";
import { DataSerializer } from "./DataSerializer";

class CardSerializer extends DataSerializer<Cards.Model> {
    public richTextColumns = [CardColumn.Textbox, CardColumn.Flavor, CardColumn.NoteText, CardColumn.GithubIssue];
    private deserializeTypedNumber<T>(value: string) {
        try {
            const number = parseInt(value);
            return Number.isNaN(number) ? value as T : number;
        } catch {
            throw Error(`Invalid value '${value}' cannot be cast to Number or special type`);
        }
    }

    public deserialize(values: string[]): Cards.Model {
        const projectId = parseInt(Settings.getProperty(GooglePropertiesType.Script, "code"));
        const number = parseInt(values[CardColumn.Number]);
        const version = values[CardColumn.Version];
        const id = `${projectId.toString()}${(number + 500).toString()}@${version}`;
        const model = {
            _id: id,
            projectId,
            number,
            version,
            faction: values[CardColumn.Faction] as Cards.Faction,
            name: values[CardColumn.Name],
            type: values[CardColumn.Type] as Cards.Type,
            traits: values[CardColumn.Traits].split(".").map(t => t.trim()).filter(t => t && t != "-"),
            text: values[CardColumn.Textbox],
            flavor: values[CardColumn.Flavor] || undefined,
            illustrator: values[CardColumn.Illustrator] || undefined,
            designer: values[CardColumn.Designer] || undefined,
            loyal: (values[CardColumn.Faction] as Cards.Faction) !== "Neutral" ? values[CardColumn.Loyal].toLowerCase() === "loyal" : undefined,
            note: values[CardColumn.NoteType] ? {
                type: values[CardColumn.NoteType] as Cards.NoteType,
                text: values[CardColumn.NoteText]
            } : undefined,
            playtesting: values[CardColumn.PlaytestVersion] || undefined,
            github: this.extractLinkText(values[CardColumn.GithubIssue], (link, text) => ({ status: text, issueUrl: link })) || undefined,
            release: values[CardColumn.PackShort] ? {
                short: values[CardColumn.PackShort],
                number: parseInt(values[CardColumn.ReleaseNumber])
            } : undefined
        } as Cards.Model;
        switch (model.type) {
            case "Character":
                model.strength = this.deserializeTypedNumber(values[CardColumn.Strength]);
                const iconsString = values[CardColumn.Icons];
                model.icons = {
                    military: iconsString.includes("M"),
                    intrigue: iconsString.includes("I"),
                    power: iconsString.includes("P")
                };
            case "Attachment":
            case "Location":
                model.unique = values[CardColumn.Unique] === "Unique";
            case "Event":
                model.cost = this.deserializeTypedNumber(values[CardColumn.Cost] !== undefined ? values[CardColumn.Cost] : "-");
                break;
            case "Plot":
                model.plotStats = {
                    income: this.deserializeTypedNumber(values[CardColumn.Income]),
                    initiative: this.deserializeTypedNumber(values[CardColumn.Initiative]),
                    claim: this.deserializeTypedNumber(values[CardColumn.Claim]),
                    reserve: this.deserializeTypedNumber(values[CardColumn.Reserve])
                };
            case "Agenda":
                // Nothing additional to add
                break;
        }
        return model;
    }

    public serialize(model: Cards.Model) {
        // Initialise "empty" values, with dashes for all dashable columns (eg. Loyal, Unique, ...)
        const values: string[] = Array.from({ length: Utils.maxEnum(CardColumn) }, (v, i) => [CardColumn.Loyal, CardColumn.Unique, CardColumn.Cost, CardColumn.Strength, CardColumn.Icons, CardColumn.Traits].includes(i) ? "-" : "");
        values[CardColumn.Number] = model.number.toString();
        values[CardColumn.Version] = model.version;
        values[CardColumn.Faction] = model.faction;
        values[CardColumn.Name] = model.name;
        values[CardColumn.Type] = model.type;
        values[CardColumn.Loyal] = model.loyal !== undefined ? (model.loyal ? "Loyal" : "Non-Loyal") : "-";
        values[CardColumn.Traits] = model.traits.length > 0 ? model.traits.map(t => t + ".").join(" ") : "-";
        values[CardColumn.Textbox] = model.text;
        values[CardColumn.Flavor] = model.flavor || "";
        values[CardColumn.Limit] = model.deckLimit !== Cards.DefaultDeckLimit[model.type] ? model.deckLimit.toString() : "";
        values[CardColumn.Designer] = model.designer || "";
        values[CardColumn.Illustrator] = model.illustrator || "";
        values[CardColumn.NoteType] = model.note ? model.note.type as string : "";
        values[CardColumn.NoteText] = model.note?.text || "";
        values[CardColumn.PlaytestVersion] = model.playtesting || "";
        values[CardColumn.GithubIssue] = model.github ? `<a href="${model.github.issueUrl}">${model.github.status}</a>` : "";
        values[CardColumn.PackShort] = model.release?.short || "";
        values[CardColumn.ReleaseNumber] = model.release?.number.toString() || "";

        switch (model.type) {
            case "Character":
                values[CardColumn.Strength] = model.strength?.toString() || "-";
                const iconLetters = [
                    ... model.icons?.military ? ["M"] : [],
                    ... model.icons?.intrigue ? ["I"] : [],
                    ... model.icons?.power ? ["P"] : []
                ];
                values[CardColumn.Icons] = iconLetters.join(" / ");
            case "Attachment":
            case "Location":
                values[CardColumn.Unique] = model.unique ? "Unique" : "Non-Unique";
            case "Event":
                values[CardColumn.Cost] = model.cost?.toString() || "-";
                break;
            case "Plot":
                values[CardColumn.Income] = model.plotStats?.income.toString();
                values[CardColumn.Initiative] = model.plotStats?.initiative.toString();
                values[CardColumn.Claim] = model.plotStats?.claim.toString();
                values[CardColumn.Reserve] = model.plotStats?.reserve.toString();
            case "Agenda":
            // Nothing to set
        }

        return values;
    }

    // TODO: Allow filtering with a version of "latest", which will only look at Latest Cards
    public filter(values: string[], index: number, model?: Cards.Model) {
        if (!model) {
            return true;
        }
        const [number, version] = model._id?.split("@") || [model.number.toString(), model.version];
        return parseInt(values[CardColumn.Number]) === parseInt(number) && (!version || values[CardColumn.Version] === version);
    }
}

export enum CardColumn {
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