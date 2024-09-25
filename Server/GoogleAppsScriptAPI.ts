import { Projects } from "@/Common/Models/Projects";
import { Controller } from "@/GoogleAppScript/Controllers/Controller";
import { dataService } from "@/Server/Services";
import { JWT } from "google-auth-library";


export default class GoogleAppsScriptAPI {
    private readonly scriptSuffix: string;
    constructor(private clientEmail: string, private privateKey: string) {
        this.scriptSuffix = process.env.NODE_ENV !== "production" ? "dev" : "exec";
    }

    private async getAuthorization() {
        const client = new JWT({
            email: this.clientEmail,
            key: this.privateKey,
            scopes: [
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/script.processes",
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/script.external_request",
                "https://www.googleapis.com/auth/script.scriptapp"
            ]
        });
        const { token } = await client.getAccessToken();
        return `Bearer ${token}`;
    }

    private async fetch<T>(url: string, request: RequestInit) {
        if (!(request.headers && request.headers["Authorization"])) {
            request.headers = request.headers || {};
            request.headers["Authorization"] = await this.getAuthorization();
        }
        url = url.replace(/(script\.google\.com\/macros\/s\/[^/]+)/, `$1/${this.scriptSuffix}`);
        const response = await fetch(url, request);

        if (!response.ok) {
            throw Error(`Google App Script ${request.method} request failed`, { cause: { status: response.status, message: response.statusText } });
        }

        const json = await response.json() as Controller.GASResponse<T>;

        if (json.error) {
            throw Error(`Google App Script ${request.method} request successful, but returned error(s)`, { cause: json.error });
        }

        return json.data;
    }

    public async get<T>(url: string) {
        return await this.fetch<T>(url, { method: "GET" });
    }

    public async post<T>(url: string, body: BodyInit) {
        return await this.fetch<T>(url, { method: "POST", body });
    }

    public async getProject(projectId: Projects.Id) {
        const [project] = await dataService.projects.read({ codes: [projectId] });
        if (!project) {
            throw Error(`Missing project "${project}": Make sure it has been initialised!`);
        }
        return project;
    }
}