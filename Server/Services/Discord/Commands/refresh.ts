import { Command } from "../DeployCommands";
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { dataService, logger } from "../../Services";

const refresh = {
    async data() {
        return new SlashCommandBuilder()
            .setName("refresh")
            .setDescription("Clears cached data, and force-updates data from spreadsheet")
            .addStringOption(option =>
                option.setName("project")
                    .setDescription("Project to clear data for")
                    .setRequired(true)
                    .setAutocomplete(true)
            ).addStringOption(option =>
                option.setName("type")
                    .setDescription("Type of data to clear")
                    .setRequired(true)
                    .setChoices([
                        { name: "Card", value: "card" },
                        { name: "Review", value: "review" }
                    ])
            );
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const project = parseInt(interaction.options.getString("project"));
            const type = interaction.options.getString("type") as "card" | "review";

            switch (type) {
                case "card":
                    await dataService.cards.database.destroy({ matchers: [{ project }] });
                    await dataService.cards.read({ matchers: [{ project }], hard: true });
                    break;
                case "review":
                    throw Error("Review clear not implemented yet!");
            }

            await interaction.followUp({
                content: `:white_check_mark: Successfully refreshed ${type} cache!`,
                ephemeral: true
            });
        } catch (err) {
            logger.error(err);
            await interaction.followUp({
                content: `:exclamation: Failed to clear cache: ${err.message}`,
                ephemeral: true
            }).catch(logger.error);
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        // Selecting project
        if (!interaction.options.getString("project").trim()) {
            const projects = await dataService.projects.read();
            const choices = projects.filter((project) => project.active).map((project) => ({ name: project.name, value: project.code.toString() }));
            await interaction.respond(choices).catch(logger.error);
            return;
        }
    }
} as Command;

export default refresh;