import config from "config";
import RenderingService from "./Rendering";
import DiscordService from "./Discord";
import DataService from "./Data";
import Logger from "./Logger";
import Server from "./Server";
import GithubService from "./Github";

// Establish services
export const service = {
    data: new DataService(config.get("database.url"), config.get("google.clientEmail"), config.get("google.privateKey")),
    render: new RenderingService(),
    discord: new DiscordService(config.get("discord.token"), config.get("discord.clientId")),
    github: new GithubService(config.get("github.owner"), config.get("github.repository"), config.get("github.appId"), config.get("github.privateKey"))
};
export const logger = Logger.initialise();
export const server = Server.initialise(config.get("server.host"), config.get("server.ports.api"), config.get("server.ports.client"));