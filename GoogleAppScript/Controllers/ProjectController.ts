import { Controller } from "./Controller";
import { Project } from "../Settings";
import { Projects } from "@/Common/Models/Projects";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ProjectController {
    export interface GASGetProjectResponse { project: Projects.Model }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const project = Project.get();
        const response = { request: e, data: { project } } as Controller.GASResponse<GASGetProjectResponse>;
        return Controller.sendResponse(response);
    }

    export interface GASSetProjectResponse { project: Projects.Model }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const project = JSON.parse(e.postData.contents) as Projects.Model;
        Project.set(project);
        const response = { request: e, data: { project } } as Controller.GASResponse<GASSetProjectResponse>;
        return Controller.sendResponse(response);
    }
}

export {
    ProjectController
};