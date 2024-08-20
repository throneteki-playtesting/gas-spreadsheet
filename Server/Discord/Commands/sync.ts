import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { logger, service } from "../..";
import Project from "@/Server/Data/Models/Project";
import { Command } from "../DeployCommands";

const sync = {
    async data(projects: Project[]) {
        if (projects.length === 0) {
            throw Error("Requires 1 or more active projects");
        }
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName("project")
                    .setDescription("Project for card")
                    .setRequired(true)
                    .setChoices(projects.map((project) => ({
                        name: project.name, value: project.code.toString()
                    })))
            )
            .addStringOption(option =>
                option.setName("card")
                    .setDescription("Card to push")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
            .addBooleanOption(option =>
                option.setName("create")
                    .setDescription("Whether sync should create new threads if it does not already exist")
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option.setName("hard")
                    .setDescription("Whether sync should pull latest data from spreadsheet (will be slower)")
                    .setRequired(false)
            );
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const guild = interaction.guild;
            const project = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card"));
            const canCreate = interaction.options.getBoolean("create");
            const hard = interaction.options.getBoolean("hard") || true;

            const cards = await service.data.cards.read({ matchers: [{ project, number }], hard });
            const proj = (await service.data.projects.read({ codes: [project] }))[0];
            const { succeeded, failed } = await service.discord.syncCardThreads(proj, cards, [guild], canCreate);

            let content = `:white_check_mark: ${succeeded.length === 1 ? `Successfully synced card: ${succeeded[0].url}` : `${succeeded.length} cards synced.`}`;
            if (failed.length > 0) {
                content += `\n:exclamation: Failed to process the following: ${failed.map((card) => card.toString()).join(", ")}`;
            }
            await interaction.followUp({ content, ephemeral: true });
        } catch (err) {
            logger.error(err);
            await interaction.followUp({
                content: ":exclamation: Failed to sync card(s). Error has been logged.",
                ephemeral: true
            }).catch(logger.error);
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.options.getString("project").trim()) {
            await interaction.respond([]);
        }
        const project = parseInt(interaction.options.getString("project"));
        const focusedValue = interaction.options.getFocused().trim();

        const cards = await service.data.cards.database.read({ matchers: [{ project }] });
        const choices = cards.filter((card) => card.isPreRelease || card.isInitial || card.isPlaytesting).map((card) => ({ name: `${card.number} - ${card.name}`, value: `${card.number}` }));
        // Only get first 25 (limit by discord)
        const filtered = choices.filter((choice) => choice.name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
        await interaction.respond(filtered).catch(logger.error);
    }
} as Command;

export default sync;