import { buildCommands, deployCommands } from "./DeployCommands";
import { commands } from "./Commands";
import { logger } from "../Services";
import { Client, ForumChannel, ForumThreadChannel, Guild, ThreadChannel, Events } from "discord.js";
import { updateFormData } from "../Processing/Reviews";

class DiscordService {
    private client: Client;
    private isDevelopment: boolean;
    constructor(private token: string, private clientId: string, private primaryGuildId: string, private developmentGuildId: string) {
        // When in development, primaryGuildId is assumed to be development guild's id
        this.isDevelopment = process.env.NODE_ENV !== "production";

        this.client = new Client({
            intents: ["Guilds", "GuildMessages", "DirectMessages", "GuildPresences"],
            allowedMentions: { parse: ["users", "roles"], repliedUser: true }
        });

        this.client.once(Events.ClientReady, () => {
            logger.info(`Discord connected with ${this.client.user?.tag}`);
        });

        buildCommands().then((available) => {
            const deployOptions = { token: this.token, clientId: this.clientId };
            this.client.on(Events.GuildCreate, async (guild) => {
                if (this.isValidGuild(guild)) {
                    await deployCommands(available, { ...deployOptions, guild });
                }
            });
            this.client.on(Events.GuildAvailable, async (guild) => {
                if (this.isValidGuild(guild)) {
                    await deployCommands(available, { ...deployOptions, guild });
                }
            });
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (!this.isValidGuild(interaction.guild)) {
                    return;
                }
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

        this.client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
            if (!this.isValidGuild(newMember.guild)) {
                return;
            }
            const playtesterRole = await this.findRoleByName(newMember.guild, "Playtesting Team");
            if (!playtesterRole) {
                logger.error(`Detected user "${newMember.nickname || newMember.displayName}" has been updated in guild "${newMember.guild.name}", but "Playtesting Team" role is missing`);
                return;
            }
            const oldHas = oldMember.roles.cache.has(playtesterRole.id);
            const newHas = newMember.roles.cache.has(playtesterRole.id);
            // If user lost or gained role
            if ((oldHas !== newHas)) {
                logger.info(`Detected user "${newMember.nickname || newMember.displayName}" has ${newHas ? "gained" : "lost"} the "Playtesting Team" role. Updating form names...`);
                await updateFormData();
            }
        });

        this.client.login(token);
    }

    private isValidGuild(guild: Guild) {
        return this.isDevelopment === (guild.id === this.developmentGuildId);
    }

    get primaryGuild() {
        return this.client.guilds.cache.find((guild) => guild.id = this.primaryGuildId);
    }

    public async getGuilds() {
        return this.client.guilds.cache.filter((guild) => this.isValidGuild(guild)).values();
    }

    /**
     * Finds a forum thread through a function
     * @param forum Forum to check for threads
     * @param threadFunc Function to match thread on
     * @returns The found thread, or null if none can be found within the given Forum Channel
     */
    public async findForumThread(forum: ForumChannel, threadFunc: (thread: ThreadChannel) => boolean) {
        let result = forum.threads.cache.find(threadFunc);
        // If thread is not found in cache, refresh cache & check again
        let before = undefined;
        if (!result) {
            do {
                const batch = await forum.threads.fetch({ archived: { fetchAll: true, before } }, { cache: true });
                before = batch.hasMore ? Math.min(...batch.threads.map(t => t.archivedAt.getTime())) : undefined;

                result = batch.threads.find(threadFunc) as ForumThreadChannel;

                // Continue if result has no been found, or if "before" is present (eg. batch.hasMore == true)
            } while (!result && before);
        }

        return result;
    }

    /**
     * Finds a guild member by name
     * @param guild Guild to search
     * @param name Name of member
     * @returns The found GuildMember, or null if none can be found within the given Guild
     */
    public async findMemberByName(guild: Guild, name: string) {
        let result = guild.members.cache.find((m) => m.nickname === name || m.displayName === name);
        if (!result) {
            const fetched = await guild.members.fetch({ query: name, limit: 1 });
            result = fetched.first();
        }
        return result || null;
    }

    /**
     * Finds a guild role by name
     * @param guild Guild to search
     * @param name Name of role
     * @returns The found Role, or null if none can be found within the given Guild
     */
    public async findRoleByName(guild: Guild, name: string) {
        let result = guild.roles.cache.find((r) => r.name === name);
        if (!result) {
            const fetched = await guild.roles.fetch();
            result = fetched.find((r) => r.name === name);
        }
        return result || null;
    }
}

export default DiscordService;