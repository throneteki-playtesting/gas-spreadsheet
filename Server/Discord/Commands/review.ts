import { Command } from "../DeployCommands";
import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, CollectedInteraction, ComponentType, InteractionCollector, InteractionResponse, InteractionUpdateOptions, MessageComponentInteraction, SlashCommandBuilder } from "discord.js";
import { dataService, logger } from "../../Services";
import { AutoCompleteHelper, FollowUpHelper } from ".";
import { SemanticVersion } from "@/Common/Utils";
import { cardAsAttachment } from "../Utilities";
import Review from "@/Server/Data/Models/Review";
import ReviewPages from "../ReviewPages";

const review = {
    async data() {
        return new SlashCommandBuilder()
            .setName("review")
            .setDescription("Submits a card review")
            .addStringOption(option =>
                option.setName("project")
                    .setDescription("Project of card to review")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option.setName("card")
                    .setDescription("Card to review")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addStringOption(option =>
                option.setName("version")
                    .setDescription("Version of card to review")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
            .setDMPermission(true);
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const projectId = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card"));
            const version = interaction.options.getString("version") as SemanticVersion || undefined;
            // Always get first card on the list (either only one of that version, or latest if no version given)
            const [card] = await dataService.cards.read({ matchers: [{ projectId, number, version }] });
            const model = {
                card
            } as Review;

            const message = ReviewPages.renderTemplate({ template: "confirm", review: model });
            const image = cardAsAttachment(model.card);
            const actions = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("cancel")
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId("start")
                        .setLabel("Start")
                        .setStyle(ButtonStyle.Primary)
                );
            const response = await interaction.followUp({
                content: message,
                files: [image],
                components: [actions]
            });
            const startCollector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 });
            startCollector.on("collect", async (i) => {
                switch (i.customId) {
                    case "start":
                        const context = {
                            page: 1,
                            interaction: i,
                            model,
                            collectors: [startCollector]
                        } as PageContext;
                        await generatePage(context);
                        break;
                    case "cancel":
                        await i.update({
                            content: "Please try to command again, and supply the appropriate card version",
                            files: [],
                            components: []
                        });
                        break;
                }
            });
        } catch (err) {
            logger.error(err);
            FollowUpHelper.error(interaction, `Failed to submit review: ${err.message}`);
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        AutoCompleteHelper.complete(interaction);
    }
} as Command;

const pages = {
    // TODO: Update to new questions
    // 1: {
    //     next: {
    //         disabledFunc: (model) => !model.games || !model.rating || !model.releasable
    //     },
    //     back: {
    //         disabledFunc: () => true
    //     },
    //     message: (context) => {
    //         const content = ReviewPages.renderTemplate({ template: "Page1", review: context.model });
    //         const gamesRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    //             .addComponents(
    //                 new StringSelectMenuBuilder()
    //                     .setCustomId("games")
    //                     .setPlaceholder("How many games have you playtested?")
    //                     .addOptions(
    //                         Reviews.gamesOptions.map((range) =>
    //                             new StringSelectMenuOptionBuilder()
    //                                 .setLabel(range)
    //                                 .setValue(range)
    //                                 .setDefault(context.model.games === range)
    //                         )
    //                     )
    //             );
    //         const ratingRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    //             .addComponents(
    //                 new StringSelectMenuBuilder()
    //                     .setCustomId("rating")
    //                     .setPlaceholder("What would you rate this card?")
    //                     .addOptions(
    //                         Object.entries(Reviews.ratings).map(([rating, description]) =>
    //                             new StringSelectMenuOptionBuilder()
    //                                 .setLabel(rating)
    //                                 .setDescription(description)
    //                                 // .setEmoji(emojis[rating])
    //                                 .setValue(rating)
    //                                 .setDefault(context.model.rating?.toString() === rating)
    //                         )
    //                     )
    //             );

    //         const releaseRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    //             .addComponents(
    //                 new StringSelectMenuBuilder()
    //                     .setCustomId("releasable")
    //                     .setPlaceholder("Do you think this card is ready for release?")
    //                     .addOptions(
    //                         Reviews.releasableOptions.map((answer) =>
    //                             new StringSelectMenuOptionBuilder()
    //                                 .setLabel(answer)
    //                                 // .setEmoji(emojis[rating])
    //                                 .setValue(answer)
    //                                 .setDefault(context.model.releasable === answer)
    //                         )
    //                     )
    //             );
    //         return {
    //             content,
    //             components: [
    //                 gamesRow,
    //                 ratingRow,
    //                 releaseRow
    //             ],
    //             files: []
    //         } as InteractionUpdateOptions;
    //     },
    //     customCollectors: (context) => {
    //         const { response, ...pageContext } = context;
    //         const selectCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3600000 });
    //         selectCollector.on("collect", async (i) => {
    //             if (["games", "rating", "releasable"].includes(i.customId)) {
    //                 const val = i.values[0];
    //                 switch (i.customId) {
    //                     case "games":
    //                         pageContext.model.games = val as Reviews.GamesOptions;
    //                         break;
    //                     case "rating":
    //                         pageContext.model.rating = parseInt(val) as Reviews.RatingOptions;
    //                         break;
    //                     case "releasable":
    //                         pageContext.model.releasable = val as Reviews.ReleasableOptions;
    //                         break;
    //                 }
    //                 pageContext.interaction = i;
    //                 await generatePage(pageContext);
    //             }
    //         });

    //         return [selectCollector];
    //     }
    // },
    // 2: {
    //     message: (context) => {
    //         const content = ReviewPages.renderTemplate({ template: "Page2", review: context.model });
    //         const editRow = new ActionRowBuilder<ButtonBuilder>()
    //             .addComponents(
    //                 new ButtonBuilder()
    //                     .setCustomId("edit")
    //                     .setLabel("Add/Edit Answers")
    //                     .setStyle(ButtonStyle.Secondary)
    //             );

    //         return {
    //             content,
    //             components: [
    //                 editRow
    //             ],
    //             files: []
    //         };
    //     },
    //     customCollectors: (context) => {
    //         const { response } = context;
    //         const editCollector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 });
    //         editCollector.on("collect", async (i) => {
    //             if (i.customId === "edit") {
    //                 const decksRow = new ActionRowBuilder<TextInputBuilder>()
    //                     .addComponents(
    //                         new TextInputBuilder()
    //                             .setCustomId("decks")
    //                             .setMaxLength(1000)
    //                             .setLabel("What deck(s) did you use?")
    //                             .setPlaceholder("1 deck per line...")
    //                             .setStyle(TextInputStyle.Paragraph)
    //                             .setRequired(true)
    //                     );
    //                 const reasoningRow = new ActionRowBuilder<TextInputBuilder>()
    //                     .addComponents(
    //                         new TextInputBuilder()
    //                             .setCustomId("reasoning")
    //                             .setMaxLength(1000)
    //                             .setLabel(`Why do you consider this card a "${context.model.rating}"?`)
    //                             .setPlaceholder("Please provide...")
    //                             .setStyle(TextInputStyle.Paragraph)
    //                             .setRequired(true)
    //                     );
    //                 const notesRow = new ActionRowBuilder<TextInputBuilder>()
    //                     .addComponents(
    //                         new TextInputBuilder()
    //                             .setCustomId("notes")
    //                             .setMaxLength(1000)
    //                             .setLabel("Any additional notes?")
    //                             .setPlaceholder("Please provide...")
    //                             .setStyle(TextInputStyle.Paragraph)
    //                             .setRequired(false)
    //                     );
    //                 const modal = new ModalBuilder()
    //                     .setCustomId("editModal")
    //                     .setTitle(`${context.model.card.project} Card Review - Page 2/2`)
    //                     .setComponents(decksRow, reasoningRow, notesRow);

    //                 await i.showModal(modal);
    //                 const submitted = await i.awaitModalSubmit({ time: 3600000, filter: int => int.user.id === i.user.id, dispose: true });

    //                 if (submitted) {
    //                     context.model.decks = submitted.fields.getTextInputValue("decks")?.split("\n");
    //                     context.model.reasoning = submitted.fields.getTextInputValue("reasoning");
    //                     context.model.notes = submitted.fields.getTextInputValue("notes");
    //                     const deferedInteraction = await submitted.deferUpdate();
    //                     const component = await deferedInteraction.awaitMessageComponent();
    //                     context.interaction = component;
    //                     await generatePage(context);
    //                 }
    //             }
    //         });

    //         return [editCollector];
    //     }
    // }
} as { [page: string]: { next?: ButtonOptions, back?: ButtonOptions, message: (context: PageContext) => InteractionUpdateOptions, customCollectors?: (context: PageContext & { response: InteractionResponse }) => InteractionCollector<CollectedInteraction>[] }};

type ButtonOptions = { label?: string, disabledFunc?: (model: Review) => boolean };
type PageContext = {
    page: number,
    interaction: MessageComponentInteraction,
    model: Review,
    collectors?: InteractionCollector<CollectedInteraction>[]
};

async function generatePage(context: PageContext) {
    try {
        const options = pages[context.page];
        if (!options) {
            throw Error(`Attempted to reach page ${context.page} of review, which does not exist`);
        }
        context.collectors?.forEach((collector) => collector.stop());
        context.collectors = [];
        const navRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("back")
                    .setLabel(options.back?.label || "Back")
                    .setDisabled(options.back?.disabledFunc ? options.back.disabledFunc(context.model) : false)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("next")
                    .setLabel(options.next?.label || "Next")
                    .setDisabled(options.next?.disabledFunc ? options.next.disabledFunc(context.model) : false)
                    .setStyle(ButtonStyle.Secondary)
            );

        const msgOptions = options.message(context);
        msgOptions.components = [...msgOptions.components, navRow];
        const response = await context.interaction.update(msgOptions as InteractionUpdateOptions);

        if (options.customCollectors) {
            context.collectors.push(...options.customCollectors({ ...context, response }));
        }
        const navCollector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 });
        context.collectors.push(navCollector);
        navCollector.on("collect", async (i) => {
            if (["next", "back"].includes(i.customId)) {
                context.page = i.customId === "next" ? context.page + 1 : context.page - 1;
                context.interaction = i;
                await generatePage(context);
            }
        });
    } catch (err) {
        logger.error(err);
    }
}

export default review;