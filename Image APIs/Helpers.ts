import { CardType, DefaultDeckLimit, Faction, NoteType } from "../Common/Enums";

class HtmlHelper {
  static renderSingle(project: any, card: any) {
    const singleTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/single");
    singleTemplate.pack = project;
    singleTemplate.card = card;
    const singleHtml = singleTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Image APIs/Templates/render");
    renderHtml.body = singleHtml;

    return renderHtml.evaluate().getContent();
  }

  static renderBatch(project: any, cards: any[]) {
    const batchTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/batch");
    batchTemplate.pack = project;
    batchTemplate.cards = cards;
    const batchHtml = batchTemplate.evaluate().getContent();

    const renderHtml = HtmlService.createTemplateFromFile("Image APIs/Templates/render");
    renderHtml.body = batchHtml;

    return renderHtml.evaluate().getContent();
  }

  static renderCard(project: any, card: any) {
    var cardTemplate = HtmlService.createTemplateFromFile("Image APIs/Templates/CardTypes/" + CardType[card.type]);
    cardTemplate.pack = project;

    card = card.clone();
    // Prepare specifically formatted values
    card.traits = card.traits.map(t => t + ".").join(" ");
    card.faction = Object.keys(Faction)[Object.values(Faction).indexOf(card.faction)].toLowerCase();
    card.text = card.text.replace(/\[([^\]]+)\]/g, "<span class=\"icon-$1\"></span>");
    card.text = card.text.replace(/\n/g, "<br>");
    card.deckLimit = card.deckLimit !== DefaultDeckLimit[CardType[card.type]] ? "Deck Limit: " + card.deckLimit : "";

    cardTemplate.card = card;

    return cardTemplate.evaluate().getContent();
  }
}

export { HtmlHelper }