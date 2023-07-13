import { Endpoints } from "@octokit/types";
import { Card } from "../DataLayer/Models/Card";
import { Settings } from "../DataLayer/Settings";
import { Issue } from "./Issues";
import { Project } from "../DataLayer/Models/Project";
import { NoteType } from "../Common/Enums";

class Github {
    static getIssues(card?: Card) {
        return GithubAPI.getIssues(card);
    }

    static addIssue(issue: Issue) {
        return GithubAPI.addIssue(issue);
    }
    static syncIssues(project: Project, cards: Card[]) {
        const issues = GithubAPI.getIssues();
        let dataChanged = false;

        for (const card of cards) {
            const currentIssue = issues.find(issue => issue.title.includes(card.code.toString()) && issue.title.includes("v" + card.development.version.toString()));
            if (card.requiresIssue()) {
                if (currentIssue) {
                    // Check & Update issue if body is different
                    const potentialIssue = Issue.for(card);
                    if(potentialIssue.body !== currentIssue.body) {
                        potentialIssue.number = currentIssue.number;
                        GithubAPI.updateIssue(potentialIssue);
                    }

                    // Sync existing github issue
                    card.development.githubIssue = {
                        status: currentIssue.state,
                        url: currentIssue.html_url
                    };
                    dataChanged = true;
                } else {
                    // Sync image before pushing new issue
                    card.syncImage(project);
                    // Create new issue
                    const newIssue = GithubAPI.addIssue(Issue.for(card));
                    // Sync new github issue
                    card.development.githubIssue = {
                        status: newIssue.state,
                        url: newIssue.html_url
                    };
                    dataChanged = true;
                }
            } else {
                if (currentIssue && currentIssue.state !== "closed") {
                    // TODO: Delete issue (since it's not required)
                    // GithubAPI.deleteIssue(issue.number);
                }
            }

            // Implemented cards need note updated programatically
            if (card.requiresImplementation() && card.development.githubIssue?.status === "closed") {
                card.development.note = {
                    type: NoteType.Implemented
                }
                dataChanged = true;
            }
        }

        return dataChanged;
    }
}

class GithubAPI {
    static getIssues(card?: Card): Endpoints["GET /search/issues"]["response"]["data"]["items"] {
        /** https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests */
        let searchQuery = "repo:throneteki-playtesting/throneteki is:issue label:automated project:throneteki-playtesting/" + Settings.getDocumentProperty("github_projectId");
        if (card) {
            // Get all issues with that card code & version in title
            // eg. "250001 in:title v1.0 in:title"
            searchQuery += card.code + " in:title v" + card.development.version + " in:title";
        }

        const url = "https://api.github.com/search/issues?q=" + searchQuery;
        const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
            method: "get",
            headers: {
                accept: 'application/vnd.github+json',
                authorization: "Bearer " + Settings.getUserProperty("github_apiKey")
            },
            muteHttpExceptions: true
        }

        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to getIssues: " + json.errors.map(e => e.message).join(", "));
        }
        return json.items;
    }

    static addIssue(issue: Issue): Endpoints["POST /repos/{owner}/{repo}/issues"]["response"]["data"] {
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

        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to addIssue: " + json.errors.map(e => e.message).join(", "));
        }
        return json;
    }

    static updateIssue(issue: Issue): Endpoints["PATCH /repos/{owner}/{repo}/issues/{issue_number}"]["response"]["data"] {
        if(issue.number === undefined) {
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

        const response = UrlFetchApp.fetch(url, params);
        const json = JSON.parse(response.getContentText());
        if (json.errors?.length > 0) {
            throw new Error("Failed to updateIssue: " + json.errors.map(e => e.message).join(", "));
        }
        return json;
    }
}

export { Github }