import { BaseMessageOptions, EmbedBuilder, ForumChannel, Guild, GuildForumTag, GuildMember } from "discord.js";
import Review from "../Data/Models/Review";
import Project from "../Data/Models/Project";
import { Cards } from "@/Common/Models/Cards";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { cardAsAttachment, colors, discordify, emojis, icons } from "./Utilities";
import ejs from "ejs";
import { discordService, logger } from "../Services";
import { Reviews } from "@/Common/Models/Reviews";

export default class ReviewThreads {
    public static async sync(guild: Guild, canCreate: boolean, ...reviews: Review[]) {
        const created: Review[] = [];
        const updated: Review[] = [];
        const failed: Review[] = [];
        const titleFunc = (review: Review) => `${review.card.number} | ${review.card.toString()} - ${review.reviewer}`;
        try {
            const { channel, projectTags, factionTags } = await ReviewThreads.validateGuild(guild, ...reviews.map((review) => review.card.project));

            const findReviewThreadFor = async (review: Review) => await discordService.findForumThread(channel, (thread) => thread.appliedTags.some((tag) => projectTags[review.card.project._id].id === tag) && thread.name === titleFunc(review));
            const autoArchiveDuration = channel.defaultAutoArchiveDuration;

            for (const review of reviews) {
                const project = review.card.project;

                try {
                    let thread = await findReviewThreadFor(review);
                    const threadTitle = titleFunc(review);
                    const tags = [projectTags[project._id].id, factionTags[review.card.faction].id];
                    const member = await discordService.findMemberByName(guild, review.reviewer);

                    if (!thread) {
                        // Prevent review thread from being created, but warn it was attempted
                        if (!canCreate) {
                            logger.warning(`Review thread missing for ${review._id}, but thread creation not allowed`);
                            continue;
                        }

                        const reason = `Playtesting Review by ${review.reviewer} for ${review.card.toString()}`;
                        const message = ReviewThreads.generateInitial(review, member);
                        thread = await channel.threads.create({
                            name: threadTitle,
                            reason,
                            message,
                            appliedTags: tags,
                            autoArchiveDuration
                        });

                        // Pin the first message of the newly-created thread
                        const starterMessage = await thread.fetchStarterMessage();
                        await starterMessage.pin();

                        created.push(review);
                    } else {
                        let starter = await thread.fetchStarterMessage();
                        const message = ReviewThreads.generateInitial(review, member);

                        const promises: Map<string, Promise<unknown>> = new Map();
                        // Edit message regardless, as we must compare the resulting embeds for changes
                        // This comparison cannot be done on a BaseMessageOptions (eg. "message" object),
                        // but can be done on discord Messages
                        promises.set("Message content", starter.edit(message));
                        // Update Title
                        if (thread.name !== threadTitle) {
                            promises.set("Title", thread.setName(threadTitle));
                        }
                        // Update pinned-ness
                        if (!starter.pinned && starter.pinnable) {
                            // Accounting for a possible Discord bug here: for some unknown reason, starter.pin() is causing an exception
                            // to be thrown below at "await thread.setArchived(false)" saying it cannot pin as the thread is archived.
                            // This is happening prior to this promise actually running, but re-fetching the starter message and pinning
                            // that seems to resolve it. Strange, but it works.
                            promises.set("Pinned", thread.fetchStarterMessage().then((msg) => msg.pin()));
                        }
                        // Update tags
                        if (thread.appliedTags.length !== tags.length || tags.some((lt) => !thread.appliedTags.includes(lt))) {
                            promises.set("Tags", thread.setAppliedTags(tags));
                        }
                        // Update auto archive duration
                        if (autoArchiveDuration && thread.autoArchiveDuration !== autoArchiveDuration) {
                            promises.set("Auto Archive Duration", thread.setAutoArchiveDuration(autoArchiveDuration));
                        }

                        if (promises.size > 0) {
                            // If thread is currently archived, unarchive & re-archive before/after adjustments are made
                            if (thread.archived) {
                                await thread.setArchived(false);
                                await Promise.allSettled(promises.values());
                                await thread.setArchived(true);
                            } else {
                                await Promise.allSettled(promises.values());
                            }

                            const oldStarter = starter;
                            starter = await thread.fetchStarterMessage();

                            const changed: string[] = [];
                            // IMPORTANT: If the structure of a review is to change, this needs to be updated!!!
                            const decks1 = oldStarter.embeds[0].fields[0].value;
                            const decks2 = starter.embeds[0].fields[0].value;
                            if (decks1 !== decks2) {
                                changed.push(`ThronesDB Deck(s): <i>${decks1} -> ${decks2}</i>`);
                            }
                            const played1 = oldStarter.embeds[0].fields[1].value;
                            const played2 = starter.embeds[0].fields[1].value;
                            if (played1 !== played2) {
                                changed.push(`Games Played: <i>${played1} -> ${played2}</i>`);
                            }
                            const statements1 = oldStarter.embeds[0].fields[3].value;
                            const statements2 = starter.embeds[0].fields[3].value;
                            if (statements1 !== statements2) {
                                changed.push("Statements (agree/disagree): <i>Changed</i>");
                            }
                            const additional1 = oldStarter.embeds[0].fields.length > 4 ? oldStarter.embeds[0].fields[4].value : oldStarter.embeds[1].fields[0].value;
                            const additional2 = starter.embeds[0].fields.length > 4 ? starter.embeds[0].fields[4].value : starter.embeds[1].fields[0].value;
                            if (additional1 !== additional2) {
                                changed.push("Additional Comments: <i>Changed</i>");
                            }

                            if (changed.length > 0) {
                                const updatedMessage = ReviewThreads.generateUpdated(review, changed, member);
                                await thread.send(updatedMessage);
                            }
                            updated.push(review);
                            logger.verbose(`Updated the following for ${review._id} review thread: ${Array.from(promises.keys()).join(", ")}`);
                        }
                    }
                } catch (err) {
                    logger.error(err);
                    failed.push(review);
                }
            }
        } catch (err) {
            throw Error(`Failed to sync card threads for forum "${guild.name}"`, { cause: err });
        }

        return { created, updated, failed };
    }

    private static async validateGuild(guild: Guild, ...projects: Project[]) {
        const forumName = "playtesting-reviews";

        const errors = [];
        // Check forum channel exists
        const channel = guild.channels.cache.find((c) => c instanceof ForumChannel && c.name.endsWith(forumName)) as ForumChannel;
        if (!channel) {
            errors.push(`"${forumName}" channel does not exist or is not a forum`);
        }

        const projectTags = {} as { [projectId: string]: GuildForumTag };
        for (const project of projects) {
            // Check project tag exists
            const projectTag = channel?.availableTags.find((t) => t.name === project.short);
            if (!projectTag) {
                errors.push(`"${project.short}" tag is missing on forum "${channel?.name}"`);
            } else {
                projectTags[project._id] = projectTag;
            }
        }

        const factionTags = {} as { [faction: string]: GuildForumTag };
        for (const faction of Cards.factions) {
            const factionTag = channel?.availableTags.find((t) => t.name === faction);
            if (!factionTag) {
                errors.push(`"${faction}" tag is missing on Forum channel "${channel?.name}"`);
            } else {
                factionTags[faction] = factionTag;
            }
        }

        if (errors.length > 0) {
            throw Error(`Guild validation failed: ${errors.join(", ")}`);
        }

        return { channel, projectTags, factionTags };
    }

    private static generateInitial(review: Review, member?: GuildMember) {
        try {
            const content = ReviewThreads.renderTemplate({ review, project: review.card.project, member, template: "Initial" });
            const allowedMentions = { parse: ["users"] };
            const image = cardAsAttachment(review.card);
            // Segments the decks string into rows of 3, separated by ", "
            const decksString = review.decks.map((deck, index, decks) => `[Deck ${index + 1}](${deck})${(index + 1) === decks.length ? "" : ((index + 1) % 3 ? ", " : "\n")}`).join("");
            // IMPORTANT: If the structure of these embeds is to change, review/update "getDetails" function
            const embeds = [
                new EmbedBuilder()
                    .setAuthor({ name: `Review by ${review.reviewer}`, iconURL: icons.reviewer })
                    .setColor(colors.Review)
                    .setFields([
                        {
                            name: "✦ ThronesDB Deck(s)",
                            value: decksString,
                            inline: true
                        },
                        {
                            name: "✦ Games played",
                            value: review.played.toString(),
                            inline: true
                        },
                        {
                            name: "✦ Submit your own!",
                            value: `[Click here](${review.card.project.formUrl})`,
                            inline: true
                        },
                        {
                            name: "✦ Statements (agree/disagree)",
                            value: discordify(Object.entries(review.statements).map(([statement, answer]) => `- <b>${Reviews.StatementQuestions[statement]}</b>: <i>${answer}</i> ${emojis[answer]}`).join("\n")),
                            inline: true
                        }
                    ])
            ];

            if (review.additional && review.additional.length > 1024) {
                embeds.push(new EmbedBuilder()
                    .setAuthor({ name: "✦ Additional Comments (extended)" })
                    .setColor(colors.Review)
                    .setDescription(review.additional));
            } else {
                embeds[0].addFields([{
                    name: "✦ Additional Comments",
                    value: review.additional || discordify("<i>None provided</i>")
                }]);
            }

            // Put timestamp on last embed
            embeds[embeds.length - 1].setTimestamp(review.date);

            return {
                content,
                files: [image],
                allowedMentions,
                embeds
            } as BaseMessageOptions;
        } catch (err) {
            throw new Error(`Failed to generate initial discord review message for ${review._id}`, { cause: err });
        }
    }

    private static generateUpdated(review: Review, changed: string[], member: GuildMember) {

        try {
            const content = ReviewThreads.renderTemplate({ review, project: review.card.project, member, changed, template: "Updated" });
            const allowedMentions = { parse: ["users"] };
            return {
                content,
                allowedMentions
            } as BaseMessageOptions;
        } catch (err) {
            throw new Error(`Failed to generate update discord review message for ${review._id}`, { cause: err });
        }
    }

    private static renderTemplate(data: ejs.Data) {
        const { template, ...restData } = data;
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = `${__dirname}/Templates/ReviewThreads/${template}.ejs`;
        const file = fs.readFileSync(filePath).toString();

        const render = ejs.render(file, { filename: filePath, emojis, icons, ...restData });

        return discordify(render);
    }
}