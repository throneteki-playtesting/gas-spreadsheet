import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { service } from "../..";

export async function data() {
    return new SlashCommandBuilder()
        .setName("push")
        .setDescription("Pushes a card update for a specific card (done automatically when a playtesting update is generated)")
        .addStringOption(option =>
            option.setName("project")
                .setDescription("Project for card")
                .setChoices([
                    // { name: "Mists of Memory", value: "MoM" },
                    { name: "Sea of Shadow", value: "SoS" }
                ])
        )
        .addStringOption(option =>
            option.setName("card")
                .setDescription("Card to push")
                .setAutocomplete(true)
        );
}
export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        // TODO: Implement
        // const projectShort = interaction.options.getString("project");
        // const number = parseInt(interaction.options.getString("card"));

        // const response = await service.data.pushCardUpdate(projectShort, [number]);

        // await interaction.followUp({ content: `Successfully pushed: \n- Archived(${response.archived.length}): ${response.archived.map((a) => a.toString()).join(", ")}\n- Updated(${response.updated.length}): ${response.updated.map((a) => a.toString()).join(", ")}\n- Messages(${response.discord.length}): ${response.discord.map((d) => d.url).join(", ")}`, ephemeral: true });
    } catch (err) {
        console.error(err);
        await interaction.followUp({ content: `Error: ${err.message}`, ephemeral: true });
    }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const projectShort = interaction.options.getString("project");
    const focusedValue = interaction.options.getFocused().trim();
    const choices = await service.data.readCards({ ids: [], projectShort });
    const filtered = choices.filter((choice) => `${choice.development.number} - ${choice.name}`.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
    await interaction.respond(
        filtered.map(choice => ({ name: `${choice.development.number} - ${choice.name}`, value: `${choice.development.number}` }))
    );
}