import { GASResponse } from "@/GoogleAppScript/Controller";
import { JWT } from "google-auth-library";
import { ExpandoObject } from "@/Common/Utils";
import { AvailableSheetTypes } from "@/GoogleAppScript/Spreadsheets/Spreadsheet";

export default abstract class GASDataSource<Id, Model> {
    private readonly scriptSuffix: string;
    constructor(private clientEmail: string, private privateKey: string, private projects: ExpandoObject) {
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

    private async fetch(url: string, request: RequestInit) {
        if (!(request.headers && request.headers["Authorization"])) {
            request.headers = request.headers || {};
            request.headers["Authorization"] = await this.getAuthorization();
        }

        const response = await fetch(url, request);

        if (!response.ok) {
            throw Error(`Google App Script ${request.method} request failed`, { cause: { status: response.status, message: response.statusText } });
        }

        const json = await response.json() as GASResponse;

        if (json.error) {
            throw Error(`Google App Script ${request.method} request successful, but returned error(s)`, { cause: json.error });
        }

        return json.data;
    }

    protected async get(url: string) {
        return await this.fetch(url, { method: "GET" });
    }

    protected async post(url: string, body: BodyInit) {
        return await this.fetch(url, { method: "POST", body });
    }

    protected getUrl(projectShort: string) {
        const scriptUrl = this.projects[projectShort]["script"] as string;
        if (!scriptUrl) {
            throw Error(`Missing project script for '${projectShort}' in config`);
        }
        return `${scriptUrl}/${this.scriptSuffix}`;
    }

    abstract create({ projectShort, values, filter }: { projectShort: string, values: Model[], filter?: AvailableSheetTypes[] }): Promise<boolean>;
    abstract read({ projectShort, ids, filter }: { projectShort: string, ids?: Id[], filter?: AvailableSheetTypes[] }): Promise<Model[]>
    abstract update({ projectShort, values }: { projectShort: string, values: Model[] }): Promise<boolean>
    abstract destroy({ projectShort, ids, filter }: { projectShort: string, ids: Id[], filter?: AvailableSheetTypes[] }): Promise<boolean>
}