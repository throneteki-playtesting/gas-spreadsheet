import { Controller } from "@/GoogleAppScript/Controllers/Controller";
import { dataService } from "@/Server/Services/Services";
import { JWT } from "google-auth-library";


export default abstract class GASDataSource<Model> {
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

    protected async get<T>(url: string) {
        return await this.fetch<T>(url, { method: "GET" });
    }

    protected async post<T>(url: string, body: BodyInit) {
        return await this.fetch<T>(url, { method: "POST", body });
    }

    protected async getProject(project: number) {
        const proj = (await dataService.projects.read({ codes: [project] }))[0];
        if (!proj) {
            throw Error(`Missing project "${project}": Make sure it has been initialised!`);
        }
        proj.script = `${proj.script}/${this.scriptSuffix}`;
        return proj;
    }

    abstract create(model?: object): Promise<number>;
    abstract read(model?: object): Promise<Model[]>
    abstract update(model?: object): Promise<number>
    abstract destroy(model?: object): Promise<number>
}