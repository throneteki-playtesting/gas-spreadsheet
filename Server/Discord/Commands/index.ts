import { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { dataService, logger } from "../../Services";
import refresh from "./refresh";
import sync from "./sync";

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

export class AutoCompleteHelper {
    static async complete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        const focusedValue = focusedOption.value.trim().toLowerCase();
        const projectId = interaction.options.getString("project") ? parseInt(interaction.options.getString("project")) : undefined;
        let choices = undefined;
        switch (focusedOption.name) {
            case "project":
                if (!projectId) {
                    const projects = await dataService.projects.read();
                    choices = projects
                        .filter((p) => p.active && p.name.toLowerCase().includes(focusedValue))
                        .map((p) => ({ name: p.name, value: p.code.toString() }));
                }
                break;
            case "card":
                if (projectId) {
                    // Choices should be cards
                    const cards = await dataService.cards.database.read({ matchers: [{ projectId }] });
                    // Reverse to ensure the latest cards are added first
                    choices = cards.reverse().reduce((chs, card) => {
                        const name = `${card.number} - ${card.name}`;
                        const value = card.number.toString();

                        // Only fetch if it matches the focused value, and wasn't already added (as a later version)
                        if (name.toLowerCase().includes(focusedValue.toLowerCase()) && !chs.some((c) => c.value === value)) {
                            chs.push({ name, value });
                        }
                        return chs;
                    }, [] as { name: string, value: string }[]).sort((a, b) => parseInt(a.value) - parseInt(b.value));
                }
                break;
            case "version":
                if (projectId) {
                    const number = parseInt(interaction.options.getString("card"));
                    const cards = await dataService.cards.database.read({ matchers: [{ projectId, number }] });
                    choices = cards.map((card) => ({ name: card.version, value: card.version }));
                }
                break;
        }

        // Only get first 25 (limit by discord)
        const filtered = choices.slice(0, 25);
        await interaction.respond(filtered).catch(logger.error);
    }
}