import config from "config";
import DataService from "./Data";
import DiscordService from "./Discord";
import GithubService from "./Github";
import RenderingService from "./Rendering";
import LoggerService from "./Logger";
import GoogleAppsScriptAPI from "./GoogleAppsScriptAPI";

export const logger = LoggerService.initialise(config.get("verbose") as boolean);

export const dataService = new DataService(config.get("database.url"));
export const GASAPI = new GoogleAppsScriptAPI(config.get("google.clientEmail"), config.get("google.privateKey"));
export const renderService = new RenderingService();
export const discordService = new DiscordService(config.get("discord.token"), config.get("discord.clientId"), config.has("discord.developmentGuildId") ? config.get("discord.developmentGuildId") : undefined);
export const githubService = new GithubService(config.get("github.owner"), config.get("github.repository"), config.get("github.appId"), config.get("github.privateKey"));