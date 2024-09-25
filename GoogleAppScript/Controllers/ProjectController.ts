import { Controller } from "./Controller";
import { Project } from "../Settings";
import { Projects } from "@/Common/Models/Projects";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ProjectController {
    export interface GASGetProjectResponse { project: Projects.Model }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const project = Project.get();
        return Controller.sendResponse({
            request: e,
            data: { project } as GASGetProjectResponse
        });
    }

    export interface GASSetProjectResponse { project: Projects.Model }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const project = JSON.parse(e.postData.contents) as Projects.Model;
        Project.set(project);
        return Controller.sendResponse({
            request: e,
            data: { project } as GASSetProjectResponse
        });
    }
}

export {
    ProjectController
};