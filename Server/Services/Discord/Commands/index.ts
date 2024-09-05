import { ChatInputCommandInteraction } from "discord.js";
import refresh from "./refresh";
import sync from "./sync";
import { logger } from "../../Services";

export const commands = {
    sync,
    refresh
};

export class FollowUpHelper {
    static async information(interaction: ChatInputCommandInteraction, message: string) {
        await interaction.followUp({
            content: message,
            ephemeral: true
        }).catch(logger.error);
    }
    static async warning(interaction: ChatInputCommandInteraction, message: string) {
        await interaction.followUp({
            content: `:grey_exclamation: ${message}`,
            ephemeral: true
        }).catch(logger.error);
    }
    static async error(interaction: ChatInputCommandInteraction, message: string) {
        await interaction.followUp({
            content: `:exclamation: ${message}`,
            ephemeral: true
        }).catch(logger.error);
    }
    static async success(interaction: ChatInputCommandInteraction, message: string) {
        await interaction.followUp({
            content: `:white_check_mark: ${message}`,
            ephemeral: true
        }).catch(logger.error);
    }
}