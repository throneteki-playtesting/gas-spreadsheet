/* eslint-disable @typescript-eslint/no-unused-vars */
import { AutocompleteInteraction, CommandInteraction, SlashCommandBuilder } from "discord.js";

export async function data() {
    return new SlashCommandBuilder()
        .setName("info")
        .setDescription("Info on the current project");
}
export async function execute(interaction: CommandInteraction) {
    // const latestProject = service.data.getSettings();
    // await interaction.reply(`Current project is ${Project.name}, ${Project.version}`);
}
export async function autocomplete(interaction: AutocompleteInteraction) {
    // Empty
}