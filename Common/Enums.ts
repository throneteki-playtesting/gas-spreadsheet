enum CardColumn {
    Number,
    Version,
    Faction,
    Name,
    Type,
    Loyal,
    Unique,
    Income = Unique,
    Cost,
    Initiative = Cost,
    Strength,
    Claim = Strength,
    Icons,
    Reserve = Icons,
    Traits,
    Textbox,
    Flavor,
    Limit,
    Designer,
    Illustrator,
    ImageUrl,
    NoteType,
    NoteText,
    PlaytestVersion,
    GithubIssue
}

enum ReviewColumn {
    Number,
    Version,
    Faction,
    Name,
    Date,
    Reviewer,
    Deck,
    Count,
    Rating,
    Release,
    Reason,
    Additional
}

enum NoteType {
    Implemented,
    Replaced,
    Reworked,
    Updated,
    Bugfixed
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

class ColumnHelper {
    static getCount(o: {}) {
        return Math.max(...Object.keys(o).filter(obj => !isNaN(parseInt(obj))).map(obj => parseInt(obj))) + 1;
    }
}

export{
    CardColumn,
    ReviewColumn,
    NoteType,
    ProjectType,
    FormQuestion,
    Faction,
    CardType,
    DefaultDeckLimit,
    RenderType,
    BatchType,
    ColumnHelper
}