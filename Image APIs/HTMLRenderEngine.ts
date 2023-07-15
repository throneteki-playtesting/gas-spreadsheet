import { CardType, DefaultDeckLimit, Faction, NoteType } from "../Common/Enums";

class HTMLRenderEngine {
  static single(project: any, card: any) {
    const singleTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/single");
    singleTemplate.pack = project;
    singleTemplate.card = card;
    const singleHtml = singleTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Image APIs/Templates/render");
    renderHtml.body = singleHtml;

    return renderHtml.evaluate().getContent().replace(/\n\n/g, "\n");
  }

  static batch(project: any, cards: any[]) {
    const batchTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/batch");
    batchTemplate.pack = project;
    batchTemplate.cards = cards;
    const batchHtml = batchTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Image APIs/Templates/render");
    renderHtml.body = batchHtml;

    return renderHtml.evaluate().getContent().replace(/\n\n/g, "\n");
  }

  static card(project: any, card: any) {
    var cardTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/CardTypes/" + CardType[card.type]);
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

    card.deckLimit = card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? "Deck Limit: " + card.deckLimit : "";

    cardTemplate.card = card;

    return cardTemplate.evaluate().getContent().replace(/\n\n/g, "\n");
  }
}

export { HTMLRenderEngine }