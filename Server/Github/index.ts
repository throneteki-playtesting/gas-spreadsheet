import { App, RequestError } from "octokit";
import { OctokitResponse } from "@octokit/types";
import { components } from "@octokit/openapi-types";
import { Octokit } from "@octokit/core";
import { Issue } from "./Issues";
import Card from "../Data/Models/Card";
import { dataService, logger } from "../Services";
import Project from "../Data/Models/Project";

export type IssueDetail = { number: number, state: string, html_url: string, body: string };
export type PullRequestDetail = { number: number, state: string, html_url: string, body: string };

class GithubService {
    private client: Octokit & { paginate: import("@octokit/plugin-paginate-rest").PaginateInterface; } & import("@octokit/plugin-paginate-graphql").paginateGraphQLInterface & import("@octokit/plugin-rest-endpoint-methods").Api & { retry: { retryRequest: (error: RequestError, retries: number, retryAfter: number) => RequestError; }; };
    private repoDetails: { owner: string, repo: string };
    constructor(owner: string, repository: string, appId: string, privateKey: string) {
        this.repoDetails = { owner, repo: repository };

        this.getClient(appId, privateKey).then((octokit) => {
            this.client = octokit;
        });
    }

    private async getClient(appId: string, privateKey: string) {
        const app = new App({
            appId,
            privateKey
        });
        const { data: installation } = await app.octokit.rest.apps.getOrgInstallation({ org: this.repoDetails.owner });
        logger.info(`GitHub connected with ${installation.app_slug}`);
        return app.getInstallationOctokit(installation.id);
    }

    public async syncIssues(project: Project, cards: Card[]): Promise<IssueDetail[]> {
        const issues = await this.getIssues(project);

        const promises: { card: Card, promise: Promise<IssueDetail> }[] = [];

        for (const card of cards) {
            try {
                const generated = Issue.forCard(project, card);
                if (!generated) {
                    continue;
                }
                const found = issues.find((issue) => generated.title === issue.title);

                // Issue exists for card
                if (found) {
                    const { number, state, html_url, body } = found;
                    // Open issues should have their body checked.
                    // If the body needs to change, update issue...
                    if (state === "open" && generated.body !== body) {
                        const promise = this.client.rest.issues.update({
                            ...this.repoDetails,
                            issue_number: number,
                            body: generated.body
                        })
                            .then(({ data }) => {
                                logger.info(`Successfully updated issue #${data.number} for ${card.toString()}`);
                                return { number: data.number, state: data.state, html_url: data.html_url, body: data.body };
                            })
                            .catch((err) => {
                                // Response failed
                                if (err.response?.data?.errors?.length > 0) {
                                    const errors = err.response.data?.errors?.map((e: { message: string; }) => e?.message).join(", ");
                                    logger.error(errors);
                                } else {
                                    logger.error(err);
                                }
                                return null;
                            });

                        promises.push({ card, promise });
                    }
                    // ...otherwise, simply pass through the existing IssueDetail
                    else {
                        promises.push({ card, promise: Promise.resolve<IssueDetail>({ number, state, html_url, body }) });
                    }
                }
                // New issue needs to be created for card
                else {
                    const promise = this.client.rest.issues.create({
                        ...this.repoDetails,
                        ...generated
                    })
                        .then(({ data }) => {
                            logger.info(`Successfully created issue #${data.number} for ${card.toString()}`);
                            return { number: data.number, state: data.state, html_url: data.html_url, body: data.body };
                        })
                        .catch((err) => {
                            // Response failed
                            if (err.response?.data?.errors?.length > 0) {
                                const errors = err.response.data?.errors?.map((e: { message: string; }) => e?.message).join(", ");
                                logger.error(`Failed to create issue for ${card.toString()}: ${errors}`);
                            } else {
                                logger.error(err);
                            }
                            return null;
                        });
                    promises.push({ card, promise });
                }
            } catch (err) {
                logger.error(`Failed to generate issue for ${card.toString()}: ${err}`);
            }
        }

        // Send all promises (update, create, existing); keeps all bound to original card
        const responses = await Promise.all(promises.map(({ card, promise }) => promise.then((response) => ({ card, response }))));

        const needsUpdate = [];
        for (const { card, response } of responses) {
            // Response threw an error, which was already caught & logged; can continue
            if (!response) {
                continue;
            }
            let updated = false;
            // Issue state & card github status are not matching, or URL is different? Update!
            if (card.github?.status !== response.state || card.github.issueUrl !== response.html_url) {
                card.github = { status: response.state, issueUrl: response.html_url };
                updated = true;
            }

            // Unimplemented card has been implemented? Mark as implemented!
            if (card.isImplemented && !card.note && response.state === "closed") {
                card.note.type = "Implemented";
                updated = true;
            }

            if (updated) {
                needsUpdate.push(card);
            }
        }

        if (needsUpdate.length > 0) {
            await dataService.cards.update({ cards: needsUpdate });
        }

        return responses.map((r) => r.response).filter((r) => r);
    }

    private async getIssues(project: Project) {
        const results: components["schemas"]["issue-search-result-item"][] = [];
        const query = `repo:${this.repoDetails.owner}/${this.repoDetails.repo} is:issue label:automated ${project.short} in:title milestone:"${project.name} Development"`;

        const perPage = 100;
        let page = 1;
        let response: OctokitResponse<{ total_count: number; incomplete_results: boolean; items: components["schemas"]["issue-search-result-item"][]; }, 200>;
        do {
            response = await this.client.rest.search.issuesAndPullRequests({
                q: query,
                per_page: perPage,
                page
            });
            results.push(...response.data.items);
            page++;
        } while (response.data.incomplete_results);

        return results;
    }

    public async syncPullRequest(project: Project, cards?: Card[]): Promise<PullRequestDetail> {
        cards = cards || await dataService.cards.read({ matchers: [{ projectId: project.code }] });
        const changes = cards.filter((card) => card.isChanged || card.isNewlyImplemented || card.isInitial);
        const prs = await this.getPullRequests(project);

        const generated = Issue.forUpdate(project, changes);
        if (!generated) {
            return;
        }
        const found = prs.find((pr) => generated.title === pr.title);

        if (found) {
            const { number, state, html_url, body } = found;
            if (state === "open" && generated.body !== body) {
                try {
                    const { data } = await this.client.rest.pulls.update({
                        ...this.repoDetails,
                        pull_number: number,
                        body: generated.body
                    });
                    logger.info(`Successfully updated pull request #${data.number} for ${project.name}`);
                    return { number: data.number, state: data.state, html_url: data.html_url, body: data.body };
                } catch (err) {
                    // Response failed
                    if (err.response?.data?.errors?.length > 0) {
                        const errors = err.response.data.errors.map((e: { message: string; }) => e.message).join(", ");
                        logger.error(`Failed to update pull request #${number} for ${project.name}: ${errors}`);
                    } else {
                        throw err;
                    }
                }
            } else {
                return { number, state, html_url, body };
            }
        } else {
            try {
                const { data } = await this.client.rest.pulls.create({
                    ...this.repoDetails,
                    ...generated,
                    base: "playtesting",
                    head: "development"
                });
                logger.info(`Successfully created pull request #${data.number} for ${project.name}`);
                return { number: data.number, state: data.state, html_url: data.html_url, body: data.body };
            } catch (err) {
                // Response failed
                if (err.response?.data?.errors?.length > 0) {
                    const errors = err.response.data.errors.map((e: { message: string; }) => e.message).join(", ");
                    throw new Error(errors);
                }
                throw err;
            }
        }
        return null;
    }

    private async getPullRequests(project: Project) {
        const results: components["schemas"]["issue-search-result-item"][] = [];
        const query = `repo:${this.repoDetails.owner}/${this.repoDetails.repo} is:pr label: automated milestone:"${project.name} Development"`;

        const perPage = 100;
        let page = 1;
        let response: OctokitResponse<{ total_count: number; incomplete_results: boolean; items: components["schemas"]["issue-search-result-item"][]; }, 200>;
        do {
            response = await this.client.rest.search.issuesAndPullRequests({
                q: query,
                per_page: perPage,
                page
            });
            results.push(...response.data.items);
            page++;
        } while (response.data.incomplete_results);

        return results;
    }
}

export default GithubService;