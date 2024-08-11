import config from "config";
import RenderingService from "./Rendering/RenderingService";
import DiscordService from "./Discord/DiscordService";
import DataService from "./Data/DataService";
import Logger from "./Logger";
import Server from "./Server";

// Establish services
export const service = {
    data: new DataService(config.get("database.url"), config.get("google.clientEmail"), config.get("google.privateKey"), config.get("projects")),
    render: new RenderingService(),
    discord: new DiscordService(config.get("discord.token"), config.get("discord.clientId"))
};
export const logger = Logger.initialise();
export const host = config.has("apiHost") ? config.get("apiHost") : `localhost:${config.get("ports.server")}`;
export const server = Server.initialise(config.get("server.host"), config.get("server.ports.api"), config.get("server.ports.client"));