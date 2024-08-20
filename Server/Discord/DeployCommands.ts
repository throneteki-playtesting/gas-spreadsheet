import { AutocompleteInteraction, ChatInputCommandInteraction, Guild, REST, Routes, SlashCommandOptionsOnlyBuilder } from "discord.js";
import { commands } from "./Commands";
import { logger, service } from "..";
import Project from "../Data/Models/Project";

export interface Command {
    data(projects?: Project[]): Promise<SlashCommandOptionsOnlyBuilder>,
    execute(interaction: ChatInputCommandInteraction): Promise<void>,
    autocomplete?(interaction: AutocompleteInteraction): Promise<void>
}

export async function deployCommands({ token, clientId, guild }: { token: string, clientId: string, guild: Guild }) {
    try {
        const rest = new REST({ version: "10" }).setToken(token);
        const projects = (await service.data.projects.read()).filter((project) => project.active);
        const body = await Promise.all(
            Object.entries(commands).map(([name, command]) =>
                command.data(projects)
                    .catch((err) => (logger.error(`Failed to generate ${name} command: ${err}`)))
            )
        );
        await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body });

        logger.info(`Reloaded (/) commands for "${guild.name}"`);
    }
    catch (err) {
        logger.error(err);
    }
}