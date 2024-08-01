import config from "config";
import RenderingService from "./Rendering/RenderingService";
import DiscordService from "./Discord/DiscordService";
import DataService from "./Data/DataService";
import ImageService from "./Rendering/ImageService";
import Logger from "./Logger";
import Server from "./Server";

// Establish services
export const service = {
    data: new DataService(config.get("database.url"), config.get("google.clientEmail"), config.get("google.privateKey"), config.get("projects")),
    rendering: new RenderingService(),
    imaging: new ImageService(config.get("htmlcsstoimage.apiKey"), config.get("htmlcsstoimage.userId")),
    discord: new DiscordService(config.get("discord.token"), config.get("discord.clientId"))
};
export const logger = Logger.initialise();
export const server = Server.initialise(config.get("port"));