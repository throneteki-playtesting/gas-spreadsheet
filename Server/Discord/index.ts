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

export default DiscordService;