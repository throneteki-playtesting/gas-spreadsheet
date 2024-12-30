import { Command } from "../DeployCommands";
import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { dataService, logger } from "../../Services";
import { AutoCompleteHelper, FollowUpHelper } from ".";
import { updateFormData } from "@/Server/Processing/Reviews";

const publish = {
    async data() {
        return new SlashCommandBuilder()
            .setName("finalise")
            .setDescription("Finalises a playtesting update which was recently merged")
            .addStringOption(option =>
                option.setName("project")
                    .setDescription("Project to finalise")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false);
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const projectId = parseInt(interaction.options.getString("project"));

            // Finalise card data
            await dataService.cards.finalise(projectId);
            // Then update relevant resources
            await updateFormData(projectId);

            await FollowUpHelper.success(interaction, "Successfully finalised cards!");
        } catch (err) {
            logger.error(err);
            FollowUpHelper.error(interaction, `Failed to finalise: ${err.message}`);
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        AutoCompleteHelper.complete(interaction);
    }
} as Command;

export default publish;

