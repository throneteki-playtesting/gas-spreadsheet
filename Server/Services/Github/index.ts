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
        cards = cards || await dataService.cards.read({ matchers: [{ project: project.code }] });
        const changes = cards.filter((card) => card.isChanged || card.isNewlyImplemented || card.isPreRelease);
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
                    // head: `development-${project.short}`
                    head: "development-MoM" // TEMPORARY
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

    //     static syncPullRequest(finalise = false) {
    //         const cards = Data.instance.getPlaytestingUpdateCards();
    //         if (cards.length > 0) {
    //             Log.verbose("Syncing pull request for " + cards.length + " cards...");
    //             const pullRequests = GithubAPI.getPullRequests();
    //             const potentialPullRequest = PullRequest.forPlaytestingUpdate(finalise);
    //             const currentPullRequest = pullRequests.find(pullRequest => pullRequest.title === potentialPullRequest.title);

    //             if (currentPullRequest) {
    //                 if (currentPullRequest.state === "closed") {
    //                     return null;
    //                 }
    //                 if (potentialPullRequest.body !== currentPullRequest.body) {
    //                     potentialPullRequest.number = currentPullRequest.number;
    //                     return GithubAPI.updatePullRequest(potentialPullRequest).html_url;
    //                 }
    //             } else {
    //                 const pr = GithubAPI.addPullRequest(potentialPullRequest);
    //                 potentialPullRequest.number = pr.number;
    //                 GithubAPI.addLabels(potentialPullRequest, potentialPullRequest.labels);
    //                 return pr.html_url;
    //             }
    //         }
    //         return null;
    //     }

    public static githubify(text: string) {
        // Html Converting
        return text
            .replace(/<i>/g, "***")
            .replace(/<\/i>/g, "***")
            .replace(/<b>|<\/b>/g, "**")
            .replace(/<em>|<\/em>/g, "_")
            .replace(/<s>|<\/s>/g, "~~")
            .replace(/<cite>/g, "-")
            .replace(/<\/cite>/g, "")
            .replace(/<nl>/g, "")
            .replace(/<h1>/g, "# ")
            .replace(/<\/h1>/g, "")
            .replace(/<h2>/g, "## ")
            .replace(/<\/h2>/g, "")
            .replace(/<h3>/g, "### ")
            .replace(/<\/h3>/g, "")
            .replace(/ {2}/g, " &nbsp;");
    }
}

// class GithubAPI {
//     static getIssues(card?: Card) {
//         /** https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests */
//         let searchQuery = "repo:throneteki-playtesting/throneteki is:issue label:automated project:throneteki-playtesting/" + Settings.getProperty(GooglePropertiesType.Document, "github_projectId");
//         if (card) {
//             // Get all issues with that card code & version in title
//             // eg. "250001 in:title v1.0 in:title"
//             searchQuery += " " + card.code + " in:title v" + card.development.version + " in:title";
//         }

//         return this.searchIssues(searchQuery);
//     }

//     static getPullRequests() {
//         /** https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests */
//         const searchQuery = "repo:throneteki-playtesting/throneteki is:pr label:automated project:throneteki-playtesting/" + Settings.getProperty(GooglePropertiesType.Document, "github_projectId");

//         return this.searchIssues(searchQuery);
//     }

//     private static searchIssues(query: string) {
//         Log.verbose("Attempting to search all Github Issues matching the following query: " + query);
//         let results: Endpoints["GET /search/issues"]["response"]["data"]["items"] = [];
//         let page = 0;
//         let total = 0;
//         do {
//             page++;
//             const url = "https://api.github.com/search/issues?page=" + page + "&q=" + query;
//             const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//                 method: "get",
//                 headers: {
//                     accept: "application/vnd.github+json",
//                     authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//                 },
//                 muteHttpExceptions: true
//             };

//             const response = UrlFetchApp.fetch(url, params);
//             const json = JSON.parse(response.getContentText());
//             if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//                 throw Error("Failed to getIssues: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//             }
//             results = results.concat(...json.items);
//             total = json.total_count;
//         } while (results.length < total);

//         Log.verbose("Fetched " + total + " items from " + page + " page(s)");
//         return results;
//     }

//     static addIssue(issue: Issue): Endpoints["POST /repos/{owner}/{repo}/issues"]["response"]["data"] {
//         const url = "https://api.github.com/repos/" + issue.owner + "/" + issue.repo + "/issues";

//         const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//             method: "post",
//             payload: JSON.stringify(issue),
//             headers: {
//                 accept: "application/vnd.github+json",
//                 authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//             },
//             muteHttpExceptions: true
//         };

//         const response = UrlFetchApp.fetch(url, params);
//         const json = JSON.parse(response.getContentText());
//         if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//             throw Error("Failed to addIssue: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//         }
//         Log.verbose("Added Issue #" + json.number + " on Github (" + issue.title + ")");
//         return json;
//     }

//     static addPullRequest(pullRequest: PullRequest): Endpoints["POST /repos/{owner}/{repo}/pulls"]["response"]["data"] {
//         const url = "https://api.github.com/repos/" + pullRequest.owner + "/" + pullRequest.repo + "/pulls";

//         const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//             method: "post",
//             payload: JSON.stringify(pullRequest),
//             headers: {
//                 accept: "application/vnd.github+json",
//                 authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//             },
//             muteHttpExceptions: true
//         };

//         const response = UrlFetchApp.fetch(url, params);
//         const json = JSON.parse(response.getContentText());
//         if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//             throw Error("Failed to addPullRequest: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//         }
//         Log.verbose("Added Pull Request #" + json.number + " on Github (" + pullRequest.title + ")");
//         return json;
//     }

//     static addLabels(object: Issue | PullRequest, labels: string[]) {
//         const url = "https://api.github.com/repos/" + object.owner + "/" + object.repo + "/issues/" + object.number + "/labels";

//         const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//             method: "post",
//             payload: JSON.stringify({ labels }),
//             headers: {
//                 accept: "application/vnd.github+json",
//                 authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//             },
//             muteHttpExceptions: true
//         };

//         const response = UrlFetchApp.fetch(url, params);
//         const json = JSON.parse(response.getContentText());
//         if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//             throw Error("Failed to addLabels: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//         }
//         Log.verbose("Added labels to issue #" + object.number + " on Github (" + labels.join(", ") + ")");
//         return json;
//     }

//     static updateIssue(issue: Issue): Endpoints["PATCH /repos/{owner}/{repo}/issues/{issue_number}"]["response"]["data"] {
//         if (issue.number === undefined) {
//             throw Error("Cannot update Github issue without a number");
//         }
//         const url = "https://api.github.com/repos/" + issue.owner + "/" + issue.repo + "/issues/" + issue.number;

//         const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//             method: "patch",
//             payload: JSON.stringify(issue),
//             headers: {
//                 accept: "application/vnd.github+json",
//                 authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//             },
//             muteHttpExceptions: true
//         };

//         const response = UrlFetchApp.fetch(url, params);
//         const json = JSON.parse(response.getContentText());
//         if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//             throw Error("Failed to updateIssue: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//         }
//         Log.verbose("Updated Issue #" + json.number + " on Github (" + issue.title + ")");
//         return json;
//     }

//     static updatePullRequest(pullRequest: PullRequest): Endpoints["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"] {
//         if (pullRequest.number === undefined) {
//             throw Error("Cannot update Github pull request without a number");
//         }
//         const url = "https://api.github.com/repos/" + pullRequest.owner + "/" + pullRequest.repo + "/pulls/" + pullRequest.number;

//         const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//             method: "patch",
//             payload: JSON.stringify(pullRequest),
//             headers: {
//                 accept: "application/vnd.github+json",
//                 authorization: "Bearer " + Settings.getProperty(GooglePropertiesType.User, "github_apiKey")
//             },
//             muteHttpExceptions: true
//         };

//         const response = UrlFetchApp.fetch(url, params);
//         const json = JSON.parse(response.getContentText());
//         if (response.getResponseCode() >= 400 && response.getResponseCode() < 600) {
//             throw Error("Failed to updatePullRequest: " + json.message + (json.errors ? " (" + json.errors.map(e => e.message).join(", ") + ")" : ""));
//         }
//         Log.verbose("Updated Pull Request #" + json.number + " on Github (" + pullRequest.title + ")");
//         return json;
//     }
// }

// function syncPullRequests(finalise = false) {
//     const latestPullRequest = Github.syncPullRequest(finalise);
//     if (latestPullRequest) {
//         PropertiesService.getDocumentProperties().setProperty("latest_pr", latestPullRequest);
//         Log.information("Pull Request added or updated: " + latestPullRequest);
//     } else {
//         Log.information("No pull request is required");
//     }
// }

// function syncIssues() {
//     Log.verbose("Starting Issues Sync...");
//     let start = new Date();
//     const data = Data.instance;
//     const checking = data.latestCards.concat(data.archivedCards.filter(card => card.development.githubIssue?.status !== "closed"));
//     let end = new Date();
//     Log.verbose("Collected " + checking.length + " cards in " + (end.getTime() - start.getTime()) + "ms");
//     start = new Date();
//     const changed = Github.syncIssues(data.project, checking);
//     end = new Date();
//     Log.verbose("Sync completed with Github in " + (end.getTime() - start.getTime()) + "ms");
//     const message = changed.length + " / " + checking.length + " cards required issue sync";
//     if (changed.length > 0) {
//         Log.information(message + ":\n- " + changed.join("\n- "));
//         data.commit();
//     } else {
//         Log.information(message);
//     }
// }

// function finalizePullRequest() {
//     syncPullRequests(true);
// }

// function finalizeIssues() {
//     syncIssues();
// }

// export { Github, GithubAPI };

export default GithubService;