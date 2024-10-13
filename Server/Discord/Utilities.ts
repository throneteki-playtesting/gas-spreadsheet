import { AttachmentBuilder, ColorResolvable } from "discord.js";
import path from "path";
import Card from "../Data/Models/Card";

export const emojis = {
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
    Playtesting: ":dart:",
    PhysicalPlaytesting: ":flower_playing_cards:",
    DigitalPlaytesting: ":computer:",
    ChangeLog: ":memo:",
    ChangeNotes: ":card_file_box:",
    Implemented: ":white_check_mark:",
    NotImplemented: ":no_entry_sign:",
    Replaced: ":twisted_rightwards_arrows:",
    Reworked: ":arrows_clockwise:",
    Updated: ":arrow_double_up:",
    Bugfixed: ":wrench:",
    Other: ":eight_spoked_asterisk:",
    "Strongly agree": ":thumbsup::thumbsup:",
    "Somewhat agree": ":thumbsup:",
    "Neither agree nor disagree": ":fist:",
    "Somewhat disagree": ":thumbsdown:",
    "Strongly disagree": ":thumbsdown::thumbsdown:",
    white_check_mark: "\u2705"
} as { [emoji: string]: string };

export const colors = {
    "Review": "#660087",
    "House Baratheon": "#e3d852",
    "House Greyjoy": "#1d7a99",
    "House Lannister": "#c00106",
    "House Martell": "#e89521",
    "House Stark": "#cfcfcf",
    "The Night's Watch": "#7a7a7a",
    "House Targaryen": "#1c1c1c",
    "House Tyrell": "#509f16",
    "Neutral": "#a99560"
} as { [color: string]: ColorResolvable };

export const icons = {
    reviewer: "https://cdn-icons-png.flaticon.com/128/6138/6138221.png"
} as { [icon: string]: string };

export function discordify(text: string) {
    // Html Converting
    return text
        .replace(/<i>|<\/i>/g, "*")
        .replace(/<b>|<\/b>/g, "**")
        .replace(/<em>|<\/em>/g, "*")
        .replace(/<s>|<\/s>/g, "~~")
        .replace(/<cite>/g, "-")
        .replace(/<\/cite>/g, "")
        .replace(/<br>/g, "")
        .replace(/ {2}/g, " &nbsp;");
}

export function cardAsAttachment(card: Card) {
    return new AttachmentBuilder(card.imageUrl)
        .setName(path.basename(card.imageUrl))
        .setDescription(`${card.toString()}`);
}