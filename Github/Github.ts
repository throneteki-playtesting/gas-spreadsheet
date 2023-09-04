import { Endpoints } from "@octokit/types";
import { Card } from "../DataLayer/Models/Card";
import { Settings } from "../DataLayer/Settings";
import { Issue, PullRequest } from "./Issues";
import { Project } from "../DataLayer/Models/Project";
import { Data } from "../DataLayer/Data";
import { Log } from "../Common/Logger";

class Github {
    static getIssues(card?: Card) {
        return GithubAPI.getIssues(card);
    }

    static getPullRequests() {
        return GithubAPI.getPullRequests();
    }

    static addIssue(issue: Issue) {
        return GithubAPI.addIssue(issue);
    }
    static syncIssues(project: Project, cards: Card[]) {
        const currentIssues = GithubAPI.getIssues();

        let changed: string[] = [];
        for (const card of cards) {
            try {
                const action = card.syncIssue(project, currentIssues)
                if (action) {
                    changed.push(card.toString() + " [" + action + "]");
                }
            } catch (e) {
                Log.error("Failed to sync issue for card '" + card.toString() + "': " + e);
            }
        }

        return changed;
    }

    static syncPullRequest(finalise = false) {
        const cards = Data.instance.getPlaytestingUpdateCards();
        if (cards.length > 0) {
            Log.verbose("Syncing pull request for " + cards.length + " cards...");
            const pullRequests = GithubAPI.getPullRequests();
            const potentialPullRequest = PullRequest.forPlaytestingUpdate(finalise);
            const currentPullRequest = pullRequests.find(pullRequest => pullRequest.title === potentialPullRequest.title);
    
            if (currentPullRequest) {
                if(currentPullRequest.state === "closed") {
                    return null;
                }
                if (potentialPullRequest.body !== currentPullRequest.body) {
                    potentialPullRequest.number = currentPullRequest.number;
                    return GithubAPI.updatePullRequest(potentialPullRequest).html_url;
                }
            } else {
                const pr = GithubAPI.addPullRequest(potentialPullRequest);
                potentialPullRequest.number = pr.number;
                GithubAPI.addLabels(potentialPullRequest, potentialPullRequest.labels);
                return pr.html_url;
            }
        }

        return null;
    }

    static githubify(text: string) {
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
            .replace(/  /g, " &nbsp;")
            // Absolutely no idea why, but the HTMLOutput builder is adding an extra line. ????
            .replace(/\n\n/g, "\n");
    }
}

class GithubAPI {
    static getIssues(card?: Card) {
        /** https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests */
        let searchQuery = "repo:throneteki-playtesting/throneteki is:issue label:automated project:throneteki-playtesting/" + Settings.getDocumentProperty("github_projectId");
        if (card) {
            // Get all issues with that card code & version in title
            // eg. "250001 in:title v1.0 in:title"
            searchQuery += " " + card.code + " in:title v" + card.development.version + " in:title";
        }

        return this.searchIssues(searchQuery);
    }

    static getPullRequests() {
        /** https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests */
        let searchQuery = "repo:throneteki-playtesting/throneteki is:pr label:automated project:throneteki-playtesting/" + Settings.getDocumentProperty("github_projectId");

        return this.searchIssues(searchQuery);
    }

    private static searchIssues(query: string) {
        Log.verbose("Attempting to search all Github Issues matching the following query: " + query);
        let results: Endpoints["GET /search/issues"]["response"]["data"]["items"] = [];
        let page = 0;
        let total = 0;
        do {
            page++;
            const url = "https://api.github.com/search/issues?page=" + page + "&q=" + query;
            const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
                method: "get",
                headers: {
                    accept: 'application/vnd.github+json',
                    authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
                },
                muteHttpExceptions: true
            }

            Log.verbose("Fetching page " + page + " of issues...");
            const response = UrlFetchApp.fetch(url, params);
            const json = JSON.parse(response.getContentText());
            if (json.errors?.length > 0) {
                throw new Error("Failed to getIssues: " + json.errors.map(e => e.message).join(", "));
            }
            Log.verbose("Fetched " + json.items.length + " items");
            results = results.concat(...json.items);
            total = json.total_count;
        } while (results.length < total);

        Log.verbose("Fetched a total of " + total + " search items");
        return results;
    }

    static addIssue(issue: Issue): Endpoints["POST /repos/{owner}/{repo}/issues"]["response"]["data"] {
        Log.verbose("Attempting to add new Github Issue with title: " + issue.title);
        const url = "https://api.github.com/repos/" + issue.owner + "/" + issue.repo + "/issues";

        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "post",
            payload: JSON.stringify(issue),
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        Log.verbose("Adding issue to github...");
        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to addIssue: " + json.errors.map(e => e.message).join(", "));
        }
        Log.verbose("Successfully added issue #" + json.number);
        return json;
    }

    static addPullRequest(pullRequest: PullRequest): Endpoints["POST /repos/{owner}/{repo}/pulls"]["response"]["data"] {
        Log.verbose("Attempting to add new Github Pull Request with title: " + pullRequest.title);
        const url = "https://api.github.com/repos/" + pullRequest.owner + "/" + pullRequest.repo + "/pulls";

        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "post",
            payload: JSON.stringify(pullRequest),
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        Log.verbose("Adding pull request to github...");
        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to addPullRequest: " + json.errors.map(e => e.message).join(", "));
        }
        Log.verbose("Successfully added pull request #" + json.number);
        return json;
    }

    static addLabels(object: Issue | PullRequest, labels: string[]) {
        Log.verbose("Attempting to add labels to Github Issue Object with title: " + object.title);
        const url = "https://api.github.com/repos/" + object.owner + "/" + object.repo + "/issues/" + object.number + "/labels";

        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "post",
            payload: JSON.stringify({ labels }),
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        Log.verbose("Adding labels to issue object in github...");
        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to addLabels: " + json.errors.map(e => e.message).join(", "));
        }
        Log.verbose("Successfully added labels to issue object");
        return json;
    }

    static updateIssue(issue: Issue): Endpoints["PATCH /repos/{owner}/{repo}/issues/{issue_number}"]["response"]["data"] {
        Log.verbose("Attempting to update Issue on Github with title: " + issue.title);
        if (issue.number === undefined) {
            throw Error("Cannot update Github issue without a number");
        }
        const url = "https://api.github.com/repos/" + issue.owner + "/" + issue.repo + "/issues/" + issue.number;

        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "patch",
            payload: JSON.stringify(issue),
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        Log.verbose("Updating issue in github...");
        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to updateIssue: " + json.errors.map(e => e.message).join(", "));
        }
        Log.verbose("Successfully updated issue #" + json.number);
        return json;
    }

    static updatePullRequest(pullRequest: PullRequest): Endpoints["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"] {
        Log.verbose("Attempting to update Pull Request on Github with title: " + pullRequest.title);
        if (pullRequest.number === undefined) {
            throw Error("Cannot update Github pull request without a number");
        }
        const url = "https://api.github.com/repos/" + pullRequest.owner + "/" + pullRequest.repo + "/pulls/" + pullRequest.number;

        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "patch",
            payload: JSON.stringify(pullRequest),
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        Log.verbose("Updating pull request in github...");
        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to updatePullRequest: " + json.errors.map(e => e.message).join(", "));
        }
        Log.verbose("Successfully updated pull request #" + json.number);
        return json;
    }
}

function syncPullRequests(finalise = false) {
    const latestPullRequest = Github.syncPullRequest(finalise);
    if (latestPullRequest) {
        PropertiesService.getDocumentProperties().setProperty("latest_pr", latestPullRequest);
        Log.information("Pull Request added or updated: " + latestPullRequest);
    } else {
        Log.information("No pull request is required");
    }
}

function syncIssues() {
    const data = Data.instance;
    Log.verbose("Collecting cards to check...");
    const checking = data.latestCards.concat(data.archivedCards.filter(card => card.development.githubIssue?.status !== 'closed'));
    Log.verbose("Checking " + checking.length + " cards...");
    const changed = Github.syncIssues(data.project, checking);

    const message = changed.length + " / " + checking.length + " cards required issue sync";
    if (changed.length > 0) {
        Log.information(message + ":\n- " + changed.join("\n- "));
        data.commit();
    } else {
        Log.information(message);
    }
}

function finalizePullRequest() {
    syncPullRequests(true);
}

function finalizeIssues() {
    syncIssues();
}

export { Github, GithubAPI }