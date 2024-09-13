import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../DeployCommands";
import { dataService, discordService, githubService, logger, renderService } from "../../Services";
import { FollowUpHelper } from ".";

const sync = {
    async data() {
        return new SlashCommandBuilder()
            .setName("sync")
            .setDescription("Sync specific data for a project")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("cards")
                    .setDescription("Sync card data for a project")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project for card")
                            .setRequired(true)
                            .setAutocomplete(true)
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
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("issues")
                    .setDescription("Sync Github issues with cards which require changes")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project for card")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("card")
                            .setDescription("Card to push")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("pullrequests")
                    .setDescription("Sync Github pull requests with the latest card changes")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project for card")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("images")
                    .setDescription("Sync card images")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project for images")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("card")
                            .setDescription("Card image to sync")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
                    .addBooleanOption(option =>
                        option.setName("override")
                            .setDescription("Whether to override existing images")
                            .setRequired(false)
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false);
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const subcommand = interaction.options.getSubcommand() as "cards" | "issues" | "pullrequests" | "images";

            switch (subcommand) {
                case "cards":
                    return await cardsCommand.execute(interaction);
                case "issues":
                    return await issuesCommand.execute(interaction);
                case "pullrequests":
                    return await pullRequestCommand.execute(interaction);
                case "images":
                    return await imagesCommand.execute(interaction);
            }
        } catch (err) {
            logger.error(err);
            await FollowUpHelper.error(interaction, "Failed to sync card(s). Error has been logged.");
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        // Selecting project
        const project = parseInt(interaction.options.getString("project"));
        if (Number.isNaN(project)) {
            const projects = await dataService.projects.read();
            const choices = projects.filter((p) => p.active).map((p) => ({ name: p.name, value: p.code.toString() }));
            await interaction.respond(choices).catch(logger.error);
            return;
        }
        // Selecting card
        const focusedValue = interaction.options.getFocused().trim();

        const cards = await dataService.cards.database.read({ matchers: [{ project }] });
        const choices = cards.filter((card) => card.isPreRelease || card.isPlaytesting).map((card) => ({ name: `${card.number} - ${card.name}`, value: card.number.toString() }));
        // Only get first 25 (limit by discord)
        const filtered = choices.filter((choice) => choice.name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
        await interaction.respond(filtered).catch(logger.error);
    }
} as Command;

const cardsCommand = {
    async execute(interaction: ChatInputCommandInteraction) {
        const guild = interaction.guild;
        const project = parseInt(interaction.options.getString("project"));
        const number = parseInt(interaction.options.getString("card")) || undefined;
        const canCreate = interaction.options.getBoolean("create");
        const hard = interaction.options.getBoolean("hard") || true;

        const cards = await dataService.cards.read({ matchers: [{ project, number }], hard });
        const proj = (await dataService.projects.read({ codes: [project] }))[0];
        await renderService.syncImages(cards, true);
        const { succeeded, failed } = await discordService.syncCardThreads(proj, cards, [guild], canCreate);

        let content = succeeded.length === 1 ? `Successfully synced card: ${succeeded[0].url}` : `${succeeded.length} cards synced.`;
        if (failed.length > 0) {
            content += `\n:exclamation: Failed to process the following: ${failed.map((card) => card.toString()).join(", ")}`;
        }
        await FollowUpHelper.success(interaction, content);
    }
};

const issuesCommand = {
    async execute(interaction: ChatInputCommandInteraction) {
        const project = parseInt(interaction.options.getString("project"));
        const number = parseInt(interaction.options.getString("card")) || undefined;

        const cards = await dataService.cards.read({ matchers: [{ project, number }] });
        const proj = (await dataService.projects.read({ codes: [project] }))[0];
        const issues = await githubService.syncIssues(proj, cards);

        const content = issues.length === 1 ? `Successfully synced issue: [#${issues[0].number}](${issues[0].html_url})` : `${issues.length} issues synced.`;
        await FollowUpHelper.success(interaction, content);
    }
};

const pullRequestCommand = {
    async execute(interaction: ChatInputCommandInteraction) {
        const project = parseInt(interaction.options.getString("project"));

        const cards = await dataService.cards.read({ matchers: [{ project }] });
        const proj = (await dataService.projects.read({ codes: [project] }))[0];
        await renderService.syncPDFs(proj, cards);
        try {
            const pullRequest = await githubService.syncPullRequest(proj, cards);
            const content = `Successfully synced pull request: [#${pullRequest.number}](${pullRequest.html_url})`;
            await FollowUpHelper.success(interaction, content);
        } catch (err) {
            const content = `Failed to sync pull request: ${err.message}`;
            await FollowUpHelper.error(interaction, content);
        }
    }
};

const imagesCommand = {
    async execute(interaction: ChatInputCommandInteraction) {
        const project = parseInt(interaction.options.getString("project"));
        const number = parseInt(interaction.options.getString("card")) || undefined;
        const override = interaction.options.getBoolean("override") || true;

        const cards = await dataService.cards.read({ matchers: [{ project, number }] });

        await renderService.syncImages(cards, override);

        const content = `Successfully synced ${cards.length} card images`;
        await FollowUpHelper.success(interaction, content);
    }
};

export default sync;