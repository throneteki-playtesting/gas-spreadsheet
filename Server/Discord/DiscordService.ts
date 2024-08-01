import ejs from "ejs";
import fs from "fs";
import { AttachmentBuilder, BaseMessageOptions, Client, EmbedBuilder, ForumChannel, Guild, Message, Role, ThreadChannel } from "discord.js";
import { deployCommands } from "./DeployCommands";
import { commands } from "./Commands";
import Card from "../../Models/Card";
import { Discord } from "../../Common/Emojis";
import { getEnumName, NoteType } from "../../Common/Enums";
import { logger, service } from "..";

class DiscordService {
    private client: Client;
    constructor(private token: string, private clientId: string) {
        this.client = new Client({
            intents: ["Guilds", "GuildMessages", "DirectMessages"],
            allowedMentions: { parse: ["users", "roles"], repliedUser: true }
        });

        this.client.once("ready", () => {
            logger.info(`${this.client.user?.tag} logged in & ready!`);
        });

        const deployOptions = { token: this.token, clientId: this.clientId };
        this.client.on("guildCreate", async (guild) => {
            await deployCommands({ ...deployOptions, guild });
        });

        if (process.env.NODE_ENV !== "production") {
            this.client.on("guildAvailable", async (guild) => {
                await deployCommands({ ...deployOptions, guild });
            });
        }

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
                console.error(err);
            }
        });

        this.client.login(token);
    }

    public async syncCardThreads(cards?: Card[], guilds?: Guild[], canCreate?: boolean) {
        const sendTo = guilds || Array.from(this.client.guilds.cache.values());
        const succeeded: Message<true>[] = [];
        const failed: Card[] = [];
        for (const guild of sendTo) {
            const forumName = "card-forum";
            const forumChannel = guild.channels.cache.find((channel) => channel instanceof ForumChannel && channel.name.endsWith(forumName)) as ForumChannel;
            if (!forumChannel) {
                throw Error(`Forum channel "${forumName}" does not exist`);
            }

            const designTeamRole = guild.roles.cache.find((role) => role.name === "Design Team");
            if (!designTeamRole) {
                throw Error("'Design Team' role does not exist");
            }

            const discordReady = cards.filter((card) => card.isBeingPlaytested || card.isPreview);
            let groups = service.data.groupCardHistory(discordReady);
            const existingThreads = this.getCardThreads(forumChannel, groups.map((group) => group.latest));
            groups = groups.filter((group) => canCreate || existingThreads.has(group.latest));

            // Update all relevant images which are outdated
            const outdatedImages = groups.reduce((all: Card[], { latest, previous }) => all.concat([latest, ...previous].filter((card) => card.isOutdatedImage)), []);
            if (outdatedImages.length > 0) {
                await service.imaging.update(outdatedImages);
                await service.data.updateCards({ cards: outdatedImages });
            }

            for (const group of groups) {
                const latest = group.latest;
                const previous = group.previous;
                const prefix = `${latest.development.number}. `;
                try {

                    // Validation
                    const projectTag = forumChannel.availableTags.find((t) => t.name === latest.development.project.short);
                    if (!projectTag) {
                        throw Error(`"${latest.development.project.short}" tag is missing on Forum channel "${forumChannel.name}" for ${prefix}${latest.name}`);
                    }
                    const factionTag = forumChannel.availableTags.find((t) => t.name === latest.faction);
                    if (!factionTag) {
                        throw Error(`"${latest.faction}" tag is missing on Forum channel "${forumChannel.name}" for ${prefix}${latest.name}`);
                    }

                    // Create new thread (if allowed), or update existing (either update starter msg, or send update msg)
                    let thread = existingThreads.get(latest);
                    if (!thread) {
                        const name = `${prefix}${latest.name}`;
                        const reason = `Design Team discussion for ${latest.development.project.short} card #${latest.development.number}`;
                        thread = await forumChannel.threads.create({
                            name,
                            reason,
                            message: this.generatePrimaryMessage(designTeamRole, latest, previous),
                            appliedTags: [projectTag.id, factionTag.id],
                            autoArchiveDuration: forumChannel.defaultAutoArchiveDuration
                        });
                        succeeded.push(await thread.fetchStarterMessage());
                    } else {
                        // Ensure correct tags are applied
                        await thread.setAppliedTags([projectTag.id, factionTag.id]);
                        // Ensure archive duration is respected
                        await thread.setAutoArchiveDuration(forumChannel.defaultAutoArchiveDuration);
                        // Ensure name is up to date
                        await thread.setName(`${prefix}${latest.name}`);
                        // Update initial message
                        const starter = await thread.fetchStarterMessage();
                        const requiresUpdateMessage = previous.length > 0 && !starter.attachments.some((attachment) => attachment.description === this.generateAttachment(latest).description);
                        await starter.edit(this.generatePrimaryMessage(designTeamRole, latest, previous));
                        if (requiresUpdateMessage) {
                            const update = await thread.send(this.generateUpdateMessage(designTeamRole, latest, previous[0], starter));
                            succeeded.push(update);
                        } else {
                            succeeded.push(starter);
                        }
                    }
                } catch (err) {
                    console.error(err);
                    failed.push(latest);
                }
            }
        }

        return { succeeded, failed };
    }

    private getCardThreads(forumChannel: ForumChannel, cards: Card[]) {
        const prefix = (card: Card) => `${card.development.number}. `;
        const threadsCache = forumChannel.threads.cache;

        return cards.reduce((threads, card) => {
            const thread = threadsCache.find((t) => t.name.startsWith(prefix(card)));
            if (thread) {
                threads.set(card, thread);
            }
            return threads;
        }, new Map<Card, ThreadChannel<true>>());
    }

    private generatePrimaryMessage(taggedRole: Role, latest: Card, previous: Card[]) {
        const content = this.renderTemplate("CardThreadPrimary", { role: taggedRole, card: latest });
        const files = [this.generateAttachment(latest)];
        const allowedMentions = { parse: ["roles"] };

        const embeds = previous.map((pCard) => {
            const embedBuilder = new EmbedBuilder()
                .setColor(Discord.EmbedColor.Review) // TODO: Update this to faction color
                .setTitle(pCard.toString())
                .setURL(pCard.development.imageUrl)
                .setThumbnail(pCard.development.imageUrl);
            if (pCard.development.note) {
                embedBuilder.addFields(
                    { name: getEnumName(NoteType, pCard.development.note.type), value: pCard.development.note.text }
                );
            }
            return embedBuilder;
        });

        return {
            content,
            files,
            allowedMentions,
            embeds
        } as BaseMessageOptions;
    }

    private generateUpdateMessage(taggedRole: Role, latest: Card, previous: Card, firstMessage: Message<true>) {
        const content = this.renderTemplate("CardThreadUpdate", { role: taggedRole, card: latest, previous, firstMessage });
        const files = [this.generateAttachment(previous), this.generateAttachment(latest)];
        const allowedMentions = { parse: ["roles"] };

        return {
            content,
            files,
            allowedMentions
        } as BaseMessageOptions;
    }

    private generateAttachment(card: Card) {
        return new AttachmentBuilder(card.development.imageUrl)
            .setName(`${card.development.project.short}_${card.development.number}_${card.development.versions.current.toString().replaceAll(".", "_")}.png`)
            .setDescription(`${card.toString()}`);
    }

    // public async pushCardUpdateThread(card: Card) {
    //     try {
    //         const prefix = `${card.development.number}. `;
    //         const factionName = getEnumName(Faction, card.faction).toLowerCase();

    //         const factionChannel = this.client.channels.cache.find((channel) => channel instanceof TextChannel && channel.name.includes(factionName)) as TextChannel;
    //         if (!factionChannel) {
    //             throw Error(`Faction channel for ${factionName} does not exist`);
    //         }
    //         const designTeamRole = factionChannel.guild.roles.cache.find((role) => role.name === "Design Team");
    //         if (!designTeamRole) {
    //             throw Error("'Design Team' role does not exist");
    //         }

    //         // Find thread, or create new thread
    //         let thread = factionChannel.threads.cache.find((channel) => channel.name.startsWith(prefix) /*TODO: check first message for SoS && channel.messageCount > 0 && channel.messages.cache.first().content.includes(card.development.project.short)*/);
    //         if (!thread) {
    //             thread = await factionChannel.threads.create({
    //                 name: `${prefix}${card.name}`,
    //                 reason: `Design Team discussion for ${card.development.project.short} card #${card.development.number}`
    //             });
    //             const content = this.renderTemplate("CardThreadPrimary", { role: designTeamRole, card });
    //             thread.send({
    //                 content,
    //                 files: [{
    //                     attachment: "https://hcti.io/v1/image/276640f6-28f4-4b02-aca7-a1db8fab4709",
    //                     name: `${card.development.project.short}_${card.development.number}_${card.development.versions.current.toString().replaceAll(".", "-")}.png`
    //                 }],
    //                 allowedMentions: { parse: ["roles"] }
    //             });
    //         } else {
    //             // TODO:
    //             // - When fetching cards from GAS API, if no version or "latest" is given, then it should fetch all versions of that card no/
    //             // - Check if version in post is outdated (using the above list). If outdated, send new "card has been updated to..." message & update original message
    //         }
    //     } catch(err) {
    //         throw Error(`Failed to push card update for ${card}`, { cause: err });
    //     }
    // }

    private renderTemplate(fileName: string, data: ejs.Data) {
        const filepath = `${__dirname}/Templates/${fileName}.ejs`;
        const file = fs.readFileSync(filepath).toString();
        return ejs.render(file, { filename: filepath, ...data });
    }
}

// const forum = interaction.client.channels.cache.get("1224653993947693117") as ForumChannel;
// const post = await forum.threads.create({
//     name: "This is a test",
//     message: {
//         content: "This is also a test"
//     }
// });

// const channel = interaction.client.channels.cache.get("1224600517469016125") as TextChannel;
// const thread = await channel.threads.create({
//     name: "This is a test",
//     reason: "Discussions for SoS Card #25"
// });

// const role = channel.guild.roles.cache.get("1240862138793197588") as Role;

// thread.send({
//     content: `<@&${role.id}> This is a message on the thread!`,
//     allowedMentions: { parse: ["roles"] }
// });
// await interaction.reply({ content: "ForumPostId: " + post.id + " | ThreadId: " + thread.id });


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