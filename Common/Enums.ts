export enum NoteType {
    Replaced,
    Reworked,
    Updated,
    Implemented,
    NotImplemented
}

export enum ProjectType {
    Pack,
    Cycle,
    Expansion
}

export enum FormQuestion {
    DiscordName,
    ReviewingCard,
    DeckLink,
    GamesPlayed,
    Rating,
    Reason,
    ReleaseReady,
    Additional
}

export enum Faction {
    Baratheon = "House Baratheon",
    Greyjoy = "House Greyjoy",
    Lannister = "House Lannister",
    Martell = "House Martell",
    TheNightsWatch = "The Night's Watch",
    Stark = "House Stark",
    Targaryen = "House Targaryen",
    Tyrell = "House Tyrell",
    Neutral = "Neutral"
}

export enum CardType {
    Character,
    Location,
    Attachment,
    Event,
    Plot,
    Agenda
}

export enum DefaultDeckLimit {
    Character = 3,
    Attachment = 3,
    Location = 3,
    Event = 3,
    Plot = 2,
    Agenda = 1
}

export enum RenderType {
    Single,
    Batch
}

export enum BatchType {
    All,
    Updated
}

export enum ResourceFormat {
    JSON,
    HTML,
    TEXT
}

export function maxEnum(o: unknown) {
    return Math.max(...Object.keys(o).filter(obj => !isNaN(parseInt(obj))).map(obj => parseInt(obj))) + 1;
}

export function getEnum<E>(o: unknown, val: string | number) {
    const e = Object.values(o).find((value) => value === val);
    return e as E;
}

export function getEnumName<E>(o: unknown, val: E) {
    return Object.keys(o)[Object.values(o).indexOf(val)];
}