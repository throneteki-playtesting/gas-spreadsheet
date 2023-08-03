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
    Additional,
    ResponseId
}

class Columns {
    static getAmount(o: {}) {
        return Math.max(...Object.keys(o).filter(obj => !isNaN(parseInt(obj))).map(obj => parseInt(obj))) + 1;
    }
}

export {
    CardColumn,
    ReviewColumn,
    Columns
}