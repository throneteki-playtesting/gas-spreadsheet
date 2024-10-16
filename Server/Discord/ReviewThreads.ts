import { BaseMessageOptions, EmbedBuilder, ForumChannel, Guild, GuildForumTag, GuildMember, Message } from "discord.js";
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
        const succeeded: Message<true>[] = [];
        const failed: Review[] = [];
        const titleFunc = (review: Review) => `${review.card.number} | ${review.card.toString()} - ${review.reviewer}`;
        try {
            const { channel, projectTags, factionTags } = await ReviewThreads.validateGuild(guild, ...reviews.map((review) => review.card.project));

            const ptArray = Object.values(projectTags);
            const existingThreads = (await discordService.fetchThreads(channel)).filter((thread) => thread.appliedTags.some((tag) => ptArray.some((pt) => pt.id === tag)));

            for (const review of reviews) {
                const project = review.card.project;

                try {
                    const title = titleFunc(review);
                    const tags = [projectTags[project._id].id, factionTags[review.card.faction].id];
                    const member = (await guild.members.fetch({ query: review.reviewer, limit: 1 })).first();
                    const autoArchiveDuration = channel.defaultAutoArchiveDuration;
                    const message = ReviewThreads.generate(project, review, "Initial", member);

                    // Create new thread (if allowed), or update existing (either update starter msg, or send update msg)
                    const thread = existingThreads.find((t) => t.name === title);
                    if (!thread) {
                        if (!canCreate) {
                            continue;
                        }
                        const reason = `Playtesting Review by ${review.reviewer} for ${review.card.toString()}`;

                        const newThread = await channel.threads.create({
                            name: title,
                            reason,
                            message,
                            appliedTags: tags,
                            autoArchiveDuration
                        });

                        const starter = await newThread.fetchStarterMessage();
                        await starter.pin();

                        succeeded.push(starter);
                    } else {
                        const wasArchived = thread.archived;
                        const starter = await thread.fetchStarterMessage();
                        const oldContent = starter.content;
                        const oldEmbeds = starter.embeds;

                        if (wasArchived) {
                            await thread.setArchived(false);
                        }
                        const promises: Promise<unknown>[] = [
                            thread.setAppliedTags(tags),
                            thread.setAutoArchiveDuration(autoArchiveDuration),
                            thread.setName(title),
                            starter.edit(message),
                            ...(!starter.pinned ? [starter.pin()] : [])
                        ];

                        await Promise.all(promises);
                        if (wasArchived) {
                            await thread.setArchived(true);
                        }

                        const newStarter = await thread.fetchStarterMessage();
                        const newContent = newStarter.content;
                        const newEmbeds = newStarter.embeds;

                        // If the content has changed, or the embed fields have changed, send an update message
                        if (oldContent !== newContent || oldEmbeds.some((embed, ei) => embed.fields.some((field, fi) => field.value !== newEmbeds[ei].fields[fi].value))) {
                            // TODO: Collect what changed & present on update message; may need previous review
                            const content = ReviewThreads.renderTemplate({ review, project, member, template: "Updated" });
                            await thread.send({ content });
                        }
                        succeeded.push(starter);
                    }
                } catch (err) {
                    logger.error(err);
                    failed.push(review);
                }
            }
        } catch (err) {
            throw Error(`Failed to sync card threads for forum "${guild.name}"`, { cause: err });
        }

        return { succeeded, failed };
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

    private static generate(project: Project, review: Review, template: "Initial"|"Updated", member?: GuildMember) {
        try {
            const content = ReviewThreads.renderTemplate({ review, project, member, template });
            const image = cardAsAttachment(review.card);
            const allowedMentions = { parse: ["users"] };
            // Segments the decks string into rows of 3, separated by ", "
            const decksString = review.decks.map((deck, index, decks) => `[Deck ${index + 1}](${deck})${(index + 1) === decks.length ? "" : ((index + 1) % 3 ? ", " : "\n")}`).join("");
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
                            value: `[Click here](${project.formUrl})`,
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
            const error = JSON.stringify(err);
            throw new Error(`Failed to generate review message for discord: ${error}`);
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