import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { service } from "../..";
import { CardId } from "../../../GoogleAppScript/Spreadsheets/CardInfo";

export async function data() {
    return new SlashCommandBuilder()
        .setName("sync")
        .setDescription("Syncs card between all services")
        .addStringOption(option =>
            option.setName("project")
                .setDescription("Project for card")
                .setRequired(true)
                .setChoices([
                    // { name: "Mists of Memory", value: "MoM" },
                    { name: "Sea of Shadow", value: "SoS" }
                ])
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
        );
}
export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const guild = interaction.guild;
        const projectShort = interaction.options.getString("project");
        const numberString = interaction.options.getString("card");
        const canCreate = interaction.options.getBoolean("create");

        const ids = numberString ? [new CardId(parseInt(numberString))] : undefined;
        const cards = await service.data.readCards({ projectShort, ids, refresh: true });
        const { succeeded, failed } = await service.discord.syncCardThreads(cards, [guild], canCreate);

        let content = `:white_check_mark: ${succeeded.length === 1 ? `Successfully synced card: ${succeeded[0].url}` : `${succeeded.length} cards synced.`}`;
        if (failed.length > 0) {
            content += `\n:exclamation: Failed to process the following: ${failed.map((card) => card.toString()).join(", ")}`;
        }
        await interaction.followUp({ content, ephemeral: true });
    } catch (err) {
        console.error(err);
        await interaction.followUp({
            content: ":exclamation: Failed to sync card(s). Error has been logged.",
            ephemeral: true
        }).catch(console.error);
    }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const projectShort = interaction.options.getString("project");
    const focusedValue = interaction.options.getFocused().trim();
    if (!projectShort.trim()) {
        await interaction.respond([]);
    }
    let cards = await service.data.readCards({ projectShort });
    if (cards.length === 0) {
        cards = await service.data.readCards({ projectShort, refresh: true });
    }
    const choices = cards.filter((card) => card.isBeingPlaytested || card.isPreview);
    const filtered = choices.filter((choice) => `${choice.development.number} - ${choice.name}`.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
    await interaction.respond(
        filtered.map(choice => ({ name: `${choice.development.number} - ${choice.name}`, value: `${choice.development.number}` }))
    ).catch(console.error);
}