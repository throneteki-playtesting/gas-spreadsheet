import { REST, Routes } from "discord.js";
import { commands } from "./Commands";

type DeployCommandsProps = {
    token: string,
    clientId: string,
    guildId: string;
};

export async function deployCommands({ token, clientId, guildId }: DeployCommandsProps) {
    try {
        const rest = new REST({ version: "10" }).setToken(token);
        const body = await Promise.all(Object.values(commands).map((command) => command.data()));
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });

        console.log("Successfully reloaded (/) commands.");
    }
    catch (error) {
        console.error(error);
    }
}