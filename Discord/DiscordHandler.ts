import { ReleaseReady, Review } from "../DataLayer/Models/Review";
import { Forms } from "../Forms/Form";

class DiscordHandler {
  static Emojis = {
    CardIcons: {
      unique: "<:unique:701045474332770385>",
      military: "<:military:701045474291089460>",
      intrigue: "<:intrigue:701045474337226813>",
      power: "<:power:701045474433564712>",
      neutral: "<:neutral:701045474370781244>",
      baratheon: "<:baratheon:701045474332770344>",
      greyjoy: "<:greyjoy:701045474345353256>",
      lannister: "<:lannister:701045474290827306>",
      martell: "<:martell:701045474093826119>",
      thenightswatch: "<:nightswatch:701045474400141343>",
      stark: "<:stark:701045474370650112>",
      targaryen: "<:targaryen:701045474714452058>",
      tyrell: "<:tyrell:701045474374975528>",
    },
    white_check_mark: "\u2705",
    AuthorIcon: "https://cdn-icons-png.flaticon.com/128/6138/6138221.png",
    RatingEmoji: {
      1: ":one:",
      2: ":two:",
      3: ":three:",
      4: ":four:",
      5: ":five:",
      6: ":six:",
      7: ":seven:",
      8: ":eight:",
      9: ":nine:"
    },
    EmbedColor: 10053324
  }

  static sendReview(review: Review) {
    const webhook = PropertiesService.getScriptProperties().getProperty("discordReviewWebhook");
    if (!webhook) {
      throw new Error("Missing 'discordReviewWebhook' in script properties. Please add this property, and re-send reviews.")
    }

    const imageUrl = review.card.development.image?.url;
    if (!imageUrl) {
      throw new Error("Failed to send review as card image is missing for '" + review.card.toString() + "'.")
    }
    const imageObject = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });

    const payload = {
      file1: imageObject.getBlob(),
      payload_json: JSON.stringify({
        thread_name: review.card.toString() + " - " + review.reviewer,
        content: "*" + review.reviewer + "* has submitted a new review for **" + review.card.name + "**",
        embeds: [
          {
            author: {
              name: "Review by " + review.reviewer,
              icon_url: this.Emojis.AuthorIcon
            },
            color: this.Emojis.EmbedColor,
            fields: [
              {
                name: "✦ ThronesDB Deck",
                value: "[Click here to view](" + review.deck + ")",
                inline: true
              },
              {
                name: "✦ Date of Review",
                value: review.date.toLocaleDateString("en-GB"),
                inline: true
              },
              {
                name: "✦ Submit your own!",
                value: "[Click here to submit](" + Forms.url + ")",
                inline: true
              },
              {
                name: "➥ Weak (1) or strong (9)?",
                value: '1 2 3 4 5 6 7 8 9'.replace(review.rating.toString(), this.Emojis.RatingEmoji[review.rating.toString()]),
                inline: true
              },
              {
                name: "➥ How many played?",
                value: review.count + " Games",
                inline: true
              },
              {
                name: "➥ Could it be released?",
                value: ReleaseReady[review.release],
                inline: true
              },
              {
                name: "➥ Why would you consider this card that weak/strong?",
                value: review.reason ?? "*N/A*"
              },
              {
                name: "➥ Any additional comments?",
                value: review.additional ?? "*N/A*"
              }
            ]
          }
        ]
      })
    };

    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      payload,
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(webhook, params);
  }
}

export { DiscordHandler }