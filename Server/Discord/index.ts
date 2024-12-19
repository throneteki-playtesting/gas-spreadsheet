import { buildCommands, deployCommands } from "./DeployCommands";
import { commands } from "./Commands";
import { logger } from "../Services";
import { Client, ForumChannel, ForumThreadChannel, Guild, ThreadChannel } from "discord.js";

class DiscordService {
    private client: Client;
    private isDevelopment: boolean;
    constructor(private token: string, private clientId: string, private developerGuildId: string) {
        this.isDevelopment = process.env.NODE_ENV !== "production";
        this.client = new Client({
            intents: ["Guilds", "GuildMessages", "DirectMessages", "GuildPresences"],
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

        this.client.on("guildMemberUpdate", (oldMember, newMember) => {
            if (!this.isValidGuild(newMember.guild)) {
                return;
            }
            const playtesterRole = newMember.guild.roles.cache.find((role) => role.name === "Playtester");
            const oldHas = oldMember.roles.cache.has(playtesterRole.id);
            const newHas = newMember.roles.cache.has(playtesterRole.id);
            // If user lost or gained role
            if ((oldHas && !newHas) || (!oldHas && newHas)) {
                // Get all projects
                // Get cards for each project
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
        const result = await guild.members.fetch({ query: name, limit: 1 });
        if (result.hasAny()) {
            return result.first();
        }
        return null;
    }
}

export default DiscordService;