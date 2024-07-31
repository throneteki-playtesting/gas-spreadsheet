import { Guild, REST, Routes } from "discord.js";
import { commands } from "./Commands";
import { logger } from "..";

export async function deployCommands({ token, clientId, guild }: { token: string, clientId: string, guild: Guild }) {
    try {
        const rest = new REST({ version: "10" }).setToken(token);
        const body = await Promise.all(Object.values(commands).map((command) => command.data()));
        await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body });

        logger.info(`Successfully reloaded (/) commands for guild "${guild.name}".`);
    }
    catch (error) {
        console.error(error);
    }
}