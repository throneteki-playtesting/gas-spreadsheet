import { buildCommands, deployCommands } from "./DeployCommands";
import { commands } from "./Commands";
import Card from "../Data/Models/Card";
import { groupCardHistory } from "../Data/Repositories/CardsRepository";
import Project from "../Data/Models/Project";
import { logger } from "../Services";
import { Client, Guild, Message, ThreadChannel } from "discord.js";
import CardThreads from "./CardThreads";

class DiscordService {
    private client: Client;
    constructor(private token: string, private clientId: string) {
        this.client = new Client({
            intents: ["Guilds", "GuildMessages", "DirectMessages"],
            allowedMentions: { parse: ["users", "roles"], repliedUser: true }
        });

        this.client.once("ready", () => {
            logger.info(`Discord connected with ${this.client.user?.tag}`);
        });

        buildCommands().then((available) => {
            const deployOptions = { token: this.token, clientId: this.clientId };
            this.client.on("guildCreate", async (guild) => {
                await deployCommands(available, { ...deployOptions, guild });
            });

            if (process.env.NODE_ENV !== "production") {
                this.client.on("guildAvailable", async (guild) => {
                    await deployCommands(available, { ...deployOptions, guild });
                });
            }
        });

        this.client.on("interactionCreate", async (interaction) => {
            try {
                if (!(interaction.isCommand() || interaction.isAutocomplete())) {
                    return;
                }
                const command = commands[interaction.commandName as keyof typeof commands];

                if (interaction.isChatInputCommand()) {
                    command.execute(interaction);
                } else if (interaction.isAutocomplete() && command.autocomplete) {
                    command.autocomplete(interaction);
                }
            } catch (err) {
                logger.error(err);
            }
        });

        this.client.login(token);
    }

    public async syncCardThreads(project: Project, cards?: Card[], guilds?: Guild[], canCreate?: boolean) {
        // TODO: Add option for historical updating? (eg. update threads that are not latest)
        const sendTo = guilds || Array.from(this.client.guilds.cache.values());
        const succeeded: Message<true>[] = [];
        const failed: Card[] = [];
        const titleFunc = (card: Card) => `${card.number}. ${card.toString()}`;

        for (const guild of sendTo) {
            try {
                const { channel, taggedRole, projectTag, factionTags, latestTag } = await CardThreads.validateGuild(guild, project);

                // Collect all cards which should have threads on discord
                const discordReady = cards.filter((card) => card.isPreview || card.isInitial || card.isChanged);

                const existingThreads = await CardThreads.getExistingThreads(channel, projectTag);

                const groups = groupCardHistory(discordReady);
                for (const group of groups) {
                    const latest = group.latest;
                    const previous = group.previous[0];

                    try {
                        const title = titleFunc(latest);
                        const latestTags = [projectTag.id, factionTags[latest.faction].id, latestTag.id];
                        const autoArchiveDuration = channel.defaultAutoArchiveDuration;

                        // Handle logic for previous url
                        let previousUrl: string = undefined;
                        let previousThread: ThreadChannel<true> = undefined;
                        if (!(latest.isPreview || latest.isInitial)) {
                            if (!previous) {
                                throw Error(`Previous card for ${latest.toString()} could not be found`);
                            }
                            const previousTitle = titleFunc(previous);
                            previousThread = existingThreads.find((t) => t.name === previousTitle);
                            if (!previousThread) {
                                throw Error(`Failed to find previous thread for ${latest.toString()} named "${previousTitle}"`);
                            }

                            previousUrl = previousThread.url;
                        }

                        // Create new thread (if allowed), or update existing (either update starter msg, or send update msg)
                        const thread = existingThreads.find((t) => t.name === title || (latest.isInitial && t.name === `${latest.number}. ${latest.name}`/* Accounting for legacy names */));
                        if (!thread) {
                            if (!canCreate) {
                                continue;
                            }
                            const reason = `Design Team discussion for ${project.short} #${latest.number}, ${latest.toString()}`;
                            const message = CardThreads.generate(taggedRole, latest, previousUrl, project);

                            const newThread = await channel.threads.create({
                                name: title,
                                reason,
                                message,
                                appliedTags: latestTags,
                                autoArchiveDuration
                            });

                            const starter = await newThread.fetchStarterMessage();
                            await starter.pin();

                            // Check that previous thread has correct tags (eg. NOT "Latest")
                            if (previousThread.appliedTags.includes(latestTag.id)) {
                                const previousTags = [projectTag.id, factionTags[previous.faction].id];
                                await previousThread.setAppliedTags(previousTags);
                            }

                            succeeded.push(starter);
                        } else {
                            const wasArchived = thread.archived;
                            const starter = await thread.fetchStarterMessage();
                            const message = CardThreads.generate(taggedRole, latest, previousUrl, project);

                            if (wasArchived) {
                                await thread.setArchived(false);
                            }
                            const promises: Promise<unknown>[] = [
                                thread.setAppliedTags(latestTags),
                                thread.setAutoArchiveDuration(autoArchiveDuration),
                                thread.setName(title),
                                starter.edit(message),
                                ...(!starter.pinned ? [starter.pin()] : [])
                            ];

                            await Promise.all(promises);
                            if (wasArchived) {
                                await thread.setArchived(true);
                            }
                            succeeded.push(starter);
                        }
                    } catch (err) {
                        logger.error(err);
                        failed.push(latest);
                    }
                }
            } catch (err) {
                throw Error(`Failed to sync card threads for forum "${guild.name}"`, { cause: err });
            }
        }

        return { succeeded, failed };
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