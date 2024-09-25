import { buildCommands, deployCommands } from "./DeployCommands";
import { commands } from "./Commands";
import { logger } from "../Services";
import { Client, ForumChannel, Guild } from "discord.js";

class DiscordService {
    private client: Client;
    private isDevelopment: boolean;
    constructor(private token: string, private clientId: string, private developerGuildId: string) {
        this.isDevelopment = process.env.NODE_ENV !== "production";
        this.client = new Client({
            intents: ["Guilds", "GuildMessages", "DirectMessages"],
            allowedMentions: { parse: ["users", "roles"], repliedUser: true }
        });

        this.client.once("ready", () => {
            logger.info(`Discord connected with ${this.client.user?.tag}`);
        });

        buildCommands().then((available) => {
            const deployOptions = { token: this.token, clientId: this.clientId };
            if (this.isDevelopment && !developerGuildId) {
                throw Error("Missing \"developerGuildId\" in config for development discord integration");
            }
            this.client.on("guildCreate", async (guild) => {
                if (this.isValidGuild(guild)) {
                    await deployCommands(available, { ...deployOptions, guild });
                }
            });
            this.client.on("guildAvailable", async (guild) => {
                if (this.isValidGuild(guild)) {
                    await deployCommands(available, { ...deployOptions, guild });
                }
            });
        });

        this.client.on("interactionCreate", async (interaction) => {
            try {
                if (interaction.isCommand() || interaction.isAutocomplete()) {
                    const command = commands[interaction.commandName as keyof typeof commands];
                    if (interaction.isChatInputCommand()) {
                        await command.execute(interaction);
                    } else if (interaction.isAutocomplete() && command.autocomplete) {
                        await command.autocomplete(interaction);
                    }
                }
            } catch (err) {
                logger.error(err);
            }
        });

        this.client.on("guildMemberUpdate", (oldMember, newMember) => {
            const playtesterRole = newMember.guild.roles.cache.find((role) => role.name === "Playtester");
            const oldHas = oldMember.roles.cache.has(playtesterRole.id);
            const newHas = newMember.roles.cache.has(playtesterRole.id);
            // If user lost or gained role
            if ((oldHas && !newHas) || (!oldHas && newHas)) {
                // Get all projects
                // Get cards for each projectr
                // Get all playtesters
                // Post all relevant project cards & playtesters to that script
            }
        });

        this.client.login(token);
    }

    private isValidGuild(guild: Guild) {
        return this.isDevelopment ? guild.id === this.developerGuildId : guild.id !== this.developerGuildId;
    }

    public async getGuilds() {
        return this.client.guilds.cache.filter((guild) => this.isValidGuild(guild));
    }
    /**
     * Gets existing threads
     * @param channel Forum channel to check
     * @param withTags Tags to filer by
     * @returns List of ThreadChannel's for that Channel & Tags
     */
    public async fetchThreads(channel: ForumChannel) {
        let before = undefined;
        do {
            // Caches all fetched to be used later
            const batch = await channel.threads.fetch({ archived: { fetchAll: true, before } }, { cache: true });
            before = batch.hasMore ? Math.min(...batch.threads.map(t => t.archivedAt.getTime())) : undefined;
        } while (before);

        return channel.threads.cache;
    }
}

// static sendReview(review: Review) {
//     const webhook = PropertiesService.getScriptProperties().getProperty("discordReviewWebhook");
//     if (!webhook) {
//         throw Error("Missing 'discordReviewWebhook' in script properties. Please add this property, and re-send reviews.");
//     }

//     const imageUrl = review.card.development.image?.url;
//     if (!imageUrl) {
//         throw Error("Failed to send review as card image is missing for '" + review.card.toString() + "'.");
//     }
//     const imageObject = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });

//     const payload = {
//         file1: imageObject.getBlob(),
//         payload_json: JSON.stringify({
//             thread_name: review.card.toString() + " - " + review.reviewer,
//             content: "*" + review.reviewer + "* has submitted a new review for **" + review.card.name + "**",
//             embeds: [
//                 {
//                     author: {
//                         name: "Review by " + review.reviewer,
//                         icon_url: this.Emojis.AuthorIcon
//                     },
//                     color: this.Emojis.EmbedColor,
//                     fields: [
//                         {
//                             name: "✦ ThronesDB Deck",
//                             value: "[Click here to view](" + review.deck + ")",
//                             inline: true
//                         },
//                         {
//                             name: "✦ Date of Review",
//                             value: review.date.toLocaleDateString("en-GB"),
//                             inline: true
//                         },
//                         {
//                             name: "✦ Submit your own!",
//                             value: "[Click here to submit](" + Forms.url + ")",
//                             inline: true
//                         },
//                         {
//                             name: "➥ Weak (1) or strong (9)?",
//                             value: "1 2 3 4 5 6 7 8 9".replace(review.rating.toString(), this.Emojis.RatingEmoji[review.rating.toString()]),
//                             inline: true
//                         },
//                         {
//                             name: "➥ How many played?",
//                             value: review.count + " Games",
//                             inline: true
//                         },
//                         {
//                             name: "➥ Could it be released?",
//                             value: ReleaseReady[review.release],
//                             inline: true
//                         },
//                         {
//                             name: "➥ Why would you consider this card that weak/strong?",
//                             value: review.reason ?? "*N/A*"
//                         },
//                         {
//                             name: "➥ Any additional comments?",
//                             value: review.additional ?? "*N/A*"
//                         }
//                     ]
//                 }
//             ]
//         })
//     };

//     const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//         method: "post",
//         payload,
//         muteHttpExceptions: true
//     };

//     UrlFetchApp.fetch(webhook, params);
// }

export default DiscordService;