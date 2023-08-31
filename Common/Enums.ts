enum NoteType {
    Updated,
    Reworked,
    Replaced,
    Implemented,
    NotImplemented
}

enum ProjectType {
    Pack,
    Cycle,
    Expansion
}

enum FormQuestion {
    DiscordName,
    ReviewingCard,
    DeckLink,
    GamesPlayed,
    Rating,
    Reason,
    ReleaseReady,
    Additional
}

enum Faction {
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

enum CardType {
    Character,
    Location,
    Attachment,
    Event,
    Plot,
    Agenda
}

enum DefaultDeckLimit {
    Character = 3,
    Attachment = 3,
    Location = 3,
    Event = 3,
    Plot = 2,
    Agenda = 1
}

enum RenderType {
    Single,
    Batch
}

enum BatchType {
    All,
    Updated
}

export {
    NoteType,
    ProjectType,
    FormQuestion,
    Faction,
    CardType,
    DefaultDeckLimit,
    RenderType,
    BatchType
}