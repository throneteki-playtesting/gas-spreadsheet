import ejs from "ejs";
import fs from "fs";
import { CardType, DefaultDeckLimit, Faction } from "../../Common/Enums";
import Card from "../../Models/Card";
import Project from "../../Models/Project";

class RenderingService {
    public single(card: Card) {
        return this.renderTemplate({ type: "Single", card: this.prepareCard(card) });
    }

    public batch(cards: Card[], options?: { copies: number, perPage: number }) {
        options = { ... { copies: 3, perPage: 9 }, ...options };
        return this.renderTemplate({ type: "Batch", cards: cards.map((card) => this.prepareCard(card)), ...options });
    }

    private prepareCard(card: Card) {
        return {
            ...card,
            ... {
                type: CardType[card.type],
                traits: card.traits.map((t: string) => t + ".").join(" "),
                faction: Object.keys(Faction)[Object.values(Faction).indexOf(card.faction)].toLowerCase(),
                text: card.text
                    .replace(/\[([^\]]+)\]/g, "<span class=\"icon-$1\"></span>")
                    .replace(/\n/g, "<br>")
                    // If any plot modifiers are detected, create the plot-modifiers class...
                    .replace(/\n*((?:\s*[+-]\d+ (?:Income|Initiative|Claim|Reserve)\.?\s*)+)/gi, "<div class=\"plot-modifiers\">$1</div>")
                    // ...and wrap each plot modifier in a span within that class
                    .replace(/\s*([+-]\d+) (Income|Initiative|Claim|Reserve)\.?\s*/gi, (match: string, modifier: string, plotStat: string) => "<span class=\"plot-stat " + plotStat.toLowerCase() + " auto-size\">" + modifier + "</span>")
                    // If any lists are detected, create the ul...
                    .replace(/(<br>-\s*.*\.)/g, "<ul>$1</ul>")
                    // ... and wrap each line in li
                    .replace(/<br>-\s*(.*?\.)(?=<br>|<\/ul>)/g, "<li>$1</li>"),
                deckLimit: card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? "Deck Limit: " + card.deckLimit : ""
            }
        } as ejs.Data;
    }

    private renderTemplate(data: ejs.Data) {
        const filepath = `${__dirname}/Templates/Render.ejs`;
        const file = fs.readFileSync(filepath).toString();
        return ejs.render(file, { filename: filepath, name: "Render", options: { pack: Project, ...data } });
    }
}

export default RenderingService;