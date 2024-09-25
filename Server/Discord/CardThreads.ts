import { BaseMessageOptions, EmbedBuilder, ForumChannel, Guild, GuildForumTag, Message, Role, ThreadChannel } from "discord.js";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import Card from "../Data/Models/Card";
import Project from "../Data/Models/Project";
import { emojis, icons, discordify, colors, cardAsAttachment } from "./Utilities";
import { fileURLToPath } from "url";
import { Cards } from "@/Common/Models/Cards";
import { groupCardHistory } from "../Data/Repositories/CardsRepository";
import { discordService, logger } from "../Services";

export default class CardThreads {
    public static async sync(guild: Guild, canCreate: boolean, ...cards: Card[]) {
        // TODO: Add option for historical updating? (eg. update threads that are not latest)
        const succeeded: Message<true>[] = [];
        const failed: Card[] = [];
        const titleFunc = (card: Card) => `${card.number}. ${card.toString()}`;
        try {
            const { channel, taggedRole, projectTags, factionTags, latestTag } = await CardThreads.validateGuild(guild, ...cards.map((card) => card.project));

            // Collect all cards which should have threads on discord
            const discordReady = cards.filter((card) => card.isPreview || card.isInitial || card.isChanged);

            const ptArray = Object.values(projectTags);
            const existingThreads = (await discordService.fetchThreads(channel)).filter((thread) => thread.appliedTags.some((tag) => ptArray.some((pt) => pt.id === tag)));

            const groups = groupCardHistory(discordReady);
            for (const group of groups) {
                const latest = group.latest;
                const previous = group.previous[0];
                const project = latest.project;

                try {
                    const title = titleFunc(latest);
                    const latestTags = [projectTags[project._id].id, factionTags[latest.faction].id, latestTag.id];
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
                            const previousTags = [projectTags[project._id].id, factionTags[previous.faction].id];
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

        return { succeeded, failed };
    }

    private static async validateGuild(guild: Guild, ...projects: Project[]) {
        const forumName = "card-forum";

        const errors = [];
        // Check forum channel exists
        const channel = guild.channels.cache.find((c) => c instanceof ForumChannel && c.name.endsWith(forumName)) as ForumChannel;
        if (!channel) {
            errors.push(`"${forumName}" channel does not exist or is not a forum`);
        }

        // Check DT role exists
        const taggedRole = guild.roles.cache.find((r) => r.name === "Design Team");
        if (!taggedRole) {
            errors.push("\"Design Team\" role does not exist");
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

        // Check "latest" tag exists
        const latestTag = channel?.availableTags.find((t) => t.name === "Latest");
        if (!latestTag) {
            errors.push(`"Latest" tag is missing on forum "${channel?.name}"`);
        }

        if (errors.length > 0) {
            throw Error(`Guild validation failed: ${errors.join(", ")}`);
        }

        return { channel, taggedRole, projectTags, factionTags, latestTag };
    }

    private static generate(taggedRole: Role, latest: Card, previousUrl: string, project: Project) {
        const type = latest.isPreview ? "Preview" : (latest.isInitial ? "Initial" : latest.note.type);
        const content = CardThreads.renderTemplate({ type, card: latest, previousUrl, project, role: taggedRole });
        const image = cardAsAttachment(latest);
        const allowedMentions = { parse: ["roles"] };
        const changeNote = latest.note ? new EmbedBuilder()
            .setColor(colors[latest.faction as string])
            .setTitle(`${emojis["ChangeNotes"]} Change Notes`)
            .addFields(
                { name: `${emojis[latest.note.type]} ${latest.note.type}`, value: latest.note.text }
            ) : undefined;

        return {
            content,
            files: [image],
            allowedMentions,
            ...(changeNote && { embeds: [changeNote] })
        } as BaseMessageOptions;
    }

    private static renderTemplate(data: ejs.Data) {
        const { type, ...restData } = data;
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = `${__dirname}/Templates/CardThreads/${type}.ejs`;
        const file = fs.readFileSync(filePath).toString();

        const render = ejs.render(file, { filename: filePath, emojis, icons, ...restData });

        return discordify(render);
    }
}