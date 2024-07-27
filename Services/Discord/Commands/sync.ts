import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { service } from "../..";

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
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addBooleanOption(option =>
            option.setName("refreshimage")
                .setDescription("Refresh latest image for this card (delete in spreadsheet for previous)")
                .setRequired(false)
        );
}
export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const guild = interaction.guild;
        const projectShort = interaction.options.getString("project");
        const number = parseInt(interaction.options.getString("card"));
        const refreshImage = interaction.options.getBoolean("refreshimage");

        const id = { number };
        await service.data.clearCache({ type: "card", projectShort, ids: [id] });
        await service.data.cache({ type: "card", projectShort, ids: [id] });
        if (refreshImage) {
            const latest = await service.data.readCards({ projectShort, ids: [{ number }], filter: ["latest"] });
            await service.imaging.update(latest);
            await service.data.updateCards({ cards: latest });
        }
        const focusedMessages = await service.discord.syncCardThreads(projectShort, [number], [guild]);

        await interaction.followUp({
            content: `Successfully synced card: ${focusedMessages.map((m) => m.url).join(", ")}`,
            ephemeral: true
        }).catch(console.error);
    } catch (err) {
        console.error(err);
        await interaction.followUp({
            content: `Failed to sync card: ${err.message}`,
            ephemeral: true
        }).catch(console.error);
    }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const projectShort = interaction.options.getString("project");
    const focusedValue = interaction.options.getFocused().trim();
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