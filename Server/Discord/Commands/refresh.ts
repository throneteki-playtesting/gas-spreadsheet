import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { service } from "../..";

export async function data() {
    return new SlashCommandBuilder()
        .setName("refresh")
        .setDescription("Clears cached data, and force-updates data from spreadsheet")
        .addStringOption(option =>
            option.setName("project")
                .setDescription("Project to clear data for")
                .setRequired(true)
                .setChoices([
                    // { name: "Mists of Memory", value: "MoM" },
                    { name: "Sea of Shadow", value: "SoS" }
                ])
        ).addStringOption(option =>
            option.setName("type")
                .setDescription("Type of data to clear")
                .setRequired(true)
                .setChoices([
                    { name: "Card", value: "card" },
                    { name: "Review", value: "review" }
                ])
        );
}
export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const projectShort = interaction.options.getString("project");
        const type = interaction.options.getString("type");

        switch (type) {
            case "card":
                await service.data.cards.database.destroy({ projectShort });
                await service.data.cards.read({ projectShort });
                break;
            case "review":
                throw Error("Review clear not implemented yet!");
        }

        await interaction.followUp({
            content: `:white_check_mark: Successfully refreshed ${type} cache!`,
            ephemeral: true
        });
    } catch (err) {
        console.error(err);
        await interaction.followUp({
            content: `:exclamation: Failed to clear cache: ${err.message}`,
            ephemeral: true
        }).catch(console.error);
    }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const projectShort = interaction.options.getString("project");
    const focusedValue = interaction.options.getFocused().trim();
    const cards = await service.data.cards.read({ ids: [], projectShort });
    const choices = cards.filter((card) => card.isPreRelease || card.isInitial || card.isPlaytesting);
    const filtered = choices.filter((choice) => `${choice.development.number} - ${choice.name}`.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
    await interaction.respond(
        filtered.map(choice => ({ name: `${choice.development.number} - ${choice.name}`, value: `${choice.development.number}` }))
    );
}