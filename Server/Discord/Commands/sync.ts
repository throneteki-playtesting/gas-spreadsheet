import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../DeployCommands";
import { dataService, discordService, GASAPI, githubService, logger, renderService } from "../../Services";
import { AutoCompleteHelper, FollowUpHelper } from ".";
import { FormController } from "@/GoogleAppScript/Controllers/FormController";
import CardThreads from "../CardThreads";
import Review from "@/Server/Data/Models/Review";
import ReviewThreads from "../ReviewThreads";

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
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("cardforum")
                    .setDescription("Sync discord card forum data for a project")
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
            .addSubcommand(subcommand =>
                subcommand
                    .setName("pdfs")
                    .setDescription("Sync pdf print files")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project for pdf")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addBooleanOption(option =>
                        option.setName("override")
                            .setDescription("Whether to override existing pdfs")
                            .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("form")
                    .setDescription("Sync users & cards on form")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project form to sync")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("review")
                    .setDescription("Sync reviews from form")
                    .addStringOption(option =>
                        option.setName("project")
                            .setDescription("Project to sync")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("card")
                            .setDescription("Only sync reviews for this card")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("version")
                            .setDescription("Only sync reviews for this version of card")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
                    .addUserOption(option =>
                        option.setName("reviewer")
                            .setDescription("Only sync reviews from this user")
                            .setRequired(false)
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .setDMPermission(false);
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand() as "cards" | "cardforum" | "issues" | "pullrequests" | "images" | "pdfs" | "form";
        try {
            switch (subcommand) {
                case "cards":
                    return await command.cards.execute(interaction);
                case "cardforum":
                    return await command.cardforum.execute(interaction);
                case "issues":
                    return await command.issues.execute(interaction);
                case "pullrequests":
                    return await command.pullRequests.execute(interaction);
                case "images":
                    return await command.images.execute(interaction);
                case "pdfs":
                    return await command.pdfs.execute(interaction);
                case "form":
                    return await command.form.execute(interaction);
            }
        } catch (err) {
            logger.error(err);
            await FollowUpHelper.error(interaction, `Failed to sync ${subcommand}. Error has been logged.`);
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        AutoCompleteHelper.complete(interaction);
    }
} as Command;

const command = {
    cards: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card")) || undefined;

            if (number === undefined) {
                await dataService.cards.database.destroy({ matchers: [{ projectId }] });
            }
            const cards = await dataService.cards.read({ matchers: [{ projectId, number }], hard: true });

            const content = `Successfully synced ${cards.length} card(s)`;

            await FollowUpHelper.success(interaction, content);
        }
    },
    cardforum: {
        async execute(interaction: ChatInputCommandInteraction) {
            const guild = interaction.guild;
            const projectId = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card")) || undefined;
            const canCreate = interaction.options.getBoolean("create") || false;

            const cards = await dataService.cards.read({ matchers: [{ projectId, number }] });
            const { succeeded, failed } = await CardThreads.sync(guild, canCreate, ...cards);

            let content = succeeded.length === 1 ? `Successfully synced card: ${succeeded[0].url}` : `${succeeded.length} cards synced.`;
            if (failed.length > 0) {
                content += `\n:exclamation: Failed to process the following: ${failed.map((card) => card.toString()).join(", ")}`;
            }
            await FollowUpHelper.success(interaction, content);
        }
    },
    issues: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card")) || undefined;

            const cards = await dataService.cards.read({ matchers: [{ projectId, number }] });
            const [project] = await dataService.projects.read({ codes: [projectId] });
            const issues = await githubService.syncIssues(project, cards);

            const content = issues.length === 1 ? `Successfully synced issue: [#${issues[0].number}](${issues[0].html_url})` : `${issues.length} issues synced.`;
            await FollowUpHelper.success(interaction, content);
        }
    },
    pullRequests: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));

            const cards = await dataService.cards.read({ matchers: [{ projectId }] });
            const [project] = await dataService.projects.read({ codes: [projectId] });
            await renderService.syncPDFs(project, cards, true);
            try {
                const pullRequest = await githubService.syncPullRequest(project, cards);
                const content = `Successfully synced pull request: [#${pullRequest.number}](${pullRequest.html_url})`;
                await FollowUpHelper.success(interaction, content);
            } catch (err) {
                const content = `Failed to sync pull request: ${err.message}`;
                await FollowUpHelper.error(interaction, content);
            }
        }
    },
    images: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));
            const number = parseInt(interaction.options.getString("card")) || undefined;
            const override = interaction.options.getBoolean("override") || true;

            const cards = await dataService.cards.read({ matchers: [{ projectId, number }] });

            await renderService.syncImages(cards, override);

            const content = `Successfully synced ${cards.length} card images`;
            await FollowUpHelper.success(interaction, content);
        }
    },
    pdfs: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));
            const override = interaction.options.getBoolean("override") || true;

            const [project] = await dataService.projects.read({ codes: [projectId] });
            const cards = await dataService.cards.read({ matchers: [{ projectId }] });

            await renderService.syncPDFs(project, cards, override);

            const content = "Successfully synced pdfs";
            await FollowUpHelper.success(interaction, content);
        }
    },
    form: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));

            const playtesterRoleId = interaction.guild.roles.cache.find((role) => role.name === "Playtesting Team").id;
            const playtesterRole = await interaction.guild.roles.fetch(playtesterRoleId);
            if (!playtesterRole) {
                await FollowUpHelper.error(interaction, "\"Playtesting Team\" role is missing");
                throw Error("\"Playtesting Team\" role is missing");
            }
            const reviewers = [...new Set(playtesterRole.members.map((member) => member.nickname || member.displayName).sort())];

            const [project] = await dataService.projects.read({ codes: [projectId] });
            const cards = await dataService.cards.read({ matchers: [{ projectId }] });
            const cardNames = cards.map((card) => `${card.number} - ${card.toString()}`);

            const body = JSON.stringify({ reviewers, cards: cardNames });
            const response = await GASAPI.post<FormController.GASSetFormValuesResponse>(`${project.script}/form`, body);

            if (response.success) {
                const content = `Successfully synced ${reviewers.length} reviewers & ${cardNames.length} cards with form`;
                await FollowUpHelper.success(interaction, content);
            } else {
                const content = "Failed to sync form values";
                await FollowUpHelper.error(interaction, content);
            }
        }
    },
    reviews: {
        async execute(interaction: ChatInputCommandInteraction) {
            const projectId = parseInt(interaction.options.getString("project"));
            const reviewer = interaction.options.getMember("reviewer") || undefined;
            const number = parseInt(interaction.options.getString("card")) || undefined;
            const version = interaction.options.getString("version") || undefined;

            const params = [
                ...(reviewer ? [reviewer] : []),
                ...(number ? [number] : []),
                ...(version ? [version] : [])
            ];

            const [project] = await dataService.projects.read({ codes: [projectId] });
            const response = await GASAPI.get(`${project.script}/reviews${params.length > 0 ? `?${params.join("&")}` : ""}`) as FormController.GASReadFormReviews;
            const reviews = await Review.fromModels(...response.reviews);

            await dataService.reviews.update({ reviews, upsert: true });

            let allSucceeded: number;
            let allFailed: number;

            const guilds = await discordService.getGuilds();
            for (const [, guild] of guilds) {
                const { succeeded, failed } = await ReviewThreads.sync(guild, true, ...reviews);
                allSucceeded += succeeded.length;
                allFailed += failed.length;
            }

            await FollowUpHelper.information(interaction, `Successfully synced ${allSucceeded}, failed ${allFailed}`);
        }
    }
};

export default sync;