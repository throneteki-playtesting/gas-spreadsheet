import { CardType, DefaultDeckLimit, Faction, NoteType } from "../Common/Enums";

class HTMLRenderEngine {
  static single(project: any, card: any) {
    const singleTemplate = HtmlService.createTemplateFromFile("Imaging/Templates/single");
    singleTemplate.pack = project;
    singleTemplate.card = card;
    const singleHtml = singleTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Imaging/Templates/render");
    renderHtml.body = singleHtml;

    return renderHtml.evaluate().getContent().replace(/\n\n/g, "\n");
  }

  static batch(project: any, cards: any[]) {
    const batchTemplate = HtmlService.createTemplateFromFile("Imaging/Templates/batch");
    batchTemplate.pack = project;
    batchTemplate.cards = cards;
    const batchHtml = batchTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Imaging/Templates/render");
    renderHtml.body = batchHtml;

    return renderHtml.evaluate().getContent().replace(/\n\n/g, "\n");
  }

  static card(project: any, card: any) {
    var cardTemplate = HtmlService.createTemplateFromFile("Imaging/Templates/CardTypes/" + CardType[card.type]);
    cardTemplate.pack = project;

    card = card.clone();
    // Prepare specifically formatted values
    card.traits = card.traits.map((t: string) => t + ".").join(" ");
    card.faction = Object.keys(Faction)[Object.values(Faction).indexOf(card.faction)].toLowerCase();
    card.text = card.text.replace(/\[([^\]]+)\]/g, "<span class=\"icon-$1\"></span>");
    card.text = card.text.replace(/\n/g, "<br>");
    // If any plot modifiers are detected, create the plot-modifiers class...
    card.text = card.text.replace(/\n*((?:\s*[+-]\d+ (?:Income|Initiative|Claim|Reserve)\.?\s*)+)/gi, "<div class=\"plot-modifiers\">$1</div>");
    // ...and wrap each plot modifier in a span within that class
    card.text = card.text.replace(/\s*([+-]\d+) (Income|Initiative|Claim|Reserve)\.?\s*/gi, (match: string, modifier: string, plotStat: string) => "<span class=\"plot-stat " + plotStat.toLowerCase() + " auto-size\">" + modifier + "</span>");
    // If any lists are detected, create the ul...
    card.text = card.text.replace(/(<br>-\s*.*\.)/g, "<ul>$1</ul>");
    // ... and wrap each line in li
    card.text = card.text.replace(/<br>-\s*(.*?\.)(?=<br>|<\/ul>)/g, "<li>$1</li>");

    card.deckLimit = card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? "Deck Limit: " + card.deckLimit : "";

    cardTemplate.card = card;

    return cardTemplate.evaluate().getContent().replace(/\n\n/g, "\n");
  }
}

export { HTMLRenderEngine }