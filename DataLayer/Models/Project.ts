import { ProjectType } from "../../Common/Enums";
import { Settings } from "../Settings";

class Project {
  readonly name: string;
  readonly short: string;
  readonly code: number;
  readonly totalCards: number;
  readonly type: ProjectType;

  constructor(name?: string, short?: string, code?: number, totalCards?: number, type?: ProjectType) {
    // TODO: Convert into Document Property & create interface to edit those properties from spreadsheet menu
    this.name = name || Settings.getScriptProperty("name");
    this.short = short || Settings.getScriptProperty("short");
    this.code = code || parseInt(Settings.getScriptProperty("code"));
    this.totalCards = totalCards || parseInt(Settings.getScriptProperty("totalCards"));
    this.type = type || ProjectType[Settings.getScriptProperty("type")];
  }

  get version(): SemanticVersion {
    const str = PropertiesService.getScriptProperties().getProperty("playtestVersion");
    return SemanticVersion.fromString(str || this.code + ".0.0");
  }

  set version(value: SemanticVersion) {
    if (!value) {
      PropertiesService.getScriptProperties().deleteProperty("playtestVersion");
    } else {
      PropertiesService.getScriptProperties().setProperty("playtestVersion", value.toString());
    }
  }

  getCardCodeFor(cardNo: number): number {
    const offset = this.type === ProjectType.Cycle ? 500 : 0;
    const codeString = this.code.toString() + (cardNo + offset).toString().padStart(3, "0");
    return parseInt(codeString);
  }
}

class SemanticVersion {
  constructor(public major: number, public minor?: number, public patch?: number) { }

  toString() {
    return this.major + (this.minor !== undefined ? "." + this.minor : "") + (this.patch !== undefined ? "." + this.patch : "");
  }

  is(major: number, minor?: number, patch?: number) {
    return this.major === major && this.minor === minor && this.patch == patch;
  }
  equals(other?: SemanticVersion | null) {
    return other && this.major === other.major && this.minor === other.minor && this.patch === other.patch;
  }

  increment(major: number, minor?: number, patch?: number) {
    this.major += major;
    if (this.minor !== undefined && minor !== undefined) this.minor += minor;
    if (this.patch !== undefined && patch !== undefined) this.patch += patch;
    return this;
  }

  static fromString(string: string): SemanticVersion {
    let split = string.split(".").map(s => parseInt(s));
    if (!string || split.some(s => isNaN(s))) {
      throw new Error("Failed to create SemanticVersion for value: " + string);
    }
    return new SemanticVersion(split[0], split.length > 1 ? split[1] : undefined, split.length > 2 ? split[2] : undefined);
  }
}

export { Project, SemanticVersion }