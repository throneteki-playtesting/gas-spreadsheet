import { Controller } from "./Controller";
import { Project } from "../Settings";
import { ProjectModel } from "@/Common/Models/Project";

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ProjectController {
    export interface GASGetProjectResponse { project: ProjectModel }
    export function doGet(path: string[], e: GoogleAppsScript.Events.DoGet) {
        const project = Project.get();
        return Controller.sendResponse({
            request: e,
            data: { project } as GASGetProjectResponse
        });
    }

    export interface GASSetProjectResponse { project: ProjectModel }
    export function doPost(path: string[], e: GoogleAppsScript.Events.DoPost) {
        const project = JSON.parse(e.postData.contents) as ProjectModel;
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