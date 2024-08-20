import { logger, service } from "@/Server";
import { Command } from "../DeployCommands";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import Project from "@/Server/Data/Models/Project";

const refresh = {
    async data(projects: Project[]) {
        if (projects.length === 0) {
            throw Error("Requires 1 or more active projects");
        }
        return new SlashCommandBuilder()
            .setName("refresh")
            .setDescription("Clears cached data, and force-updates data from spreadsheet")
            .addStringOption(option =>
                option.setName("project")
                    .setDescription("Project to clear data for")
                    .setRequired(true)
                    .setChoices(projects.map((project) => ({
                        name: project.name, value: project.code.toString()
                    })))
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
                    await service.data.cards.database.destroy({ matchers: [{ project }] });
                    await service.data.cards.read({ matchers: [{ project }] });
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
    }
} as Command;

export default refresh;