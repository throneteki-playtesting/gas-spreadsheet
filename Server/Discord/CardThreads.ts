import { factions } from "@/Common/Models/Card";
import { AttachmentBuilder, BaseMessageOptions, EmbedBuilder, ForumChannel, Guild, GuildForumTag, Role } from "discord.js";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import Card from "../Data/Models/Card";
import Project from "../Data/Models/Project";
import { emojis, icons, discordify, colors } from "./Utilities";
import { fileURLToPath } from "url";

export default class CardThreads {
    public static async validateGuild(guild: Guild, project: Project) {
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

        // Check project tag exists
        const projectTag = channel.availableTags.find((t) => t.name === project.short);
        if (!projectTag) {
            errors.push(`"${project.short}" tag is missing on forum "${channel.name}"`);
        }

        const factionTags = {} as { [faction: string]: GuildForumTag };

        for (const faction of factions) {
            const factionTag = channel.availableTags.find((t) => t.name === faction);
            if (!factionTag) {
                errors.push(`"${faction}" tag is missing on Forum channel "${channel.name}"`);
            } else {
                factionTags[faction] = factionTag;
            }
        }

        // Check "latest" tag exists
        const latestTag = channel.availableTags.find((t) => t.name === "Latest");
        if (!latestTag) {
            errors.push(`"Latest" tag is missing on forum "${channel.name}"`);
        }

        if (errors.length > 0) {
            throw Error(`Guild validation failed: ${errors.join(", ")}`);
        }

        return { channel, taggedRole, projectTag, factionTags, latestTag };
    }

    /**
     * Gets existing threads for the given project tag
     * @param channel Forum channel to check
     * @param projectTag Project tag to filter by
     * @returns List of ThreadChannel's for that project tag
     */
    public static async getExistingThreads(channel: ForumChannel, projectTag: GuildForumTag) {
        // TODO: Filter archived by when project started. Currently not an issue, but will be if we have multiple historical projects.
        let before = undefined;
        do {
            // Caches all fetched to be used later
            const batch = await channel.threads.fetch({ archived: { fetchAll: true, before } }, { cache: true });
            before = batch.hasMore ? Math.min(...batch.threads.map(t => t.archivedAt.getTime())) : undefined;
        } while (before);

        return channel.threads.cache.filter((thread) => thread.appliedTags.includes(projectTag.id));
    }

    public static generate(taggedRole: Role, latest: Card, previousUrl: string, project: Project) {
        const type = latest.isPreview ? "Preview" : (latest.isInitial ? "Initial" : latest.note.type);
        const content = CardThreads.renderTemplate({ type, card: latest, previousUrl, project, role: taggedRole });
        const image = new AttachmentBuilder(latest.imageUrl)
            .setName(path.basename(latest.imageUrl))
            .setDescription(`${latest.toString()}`);
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