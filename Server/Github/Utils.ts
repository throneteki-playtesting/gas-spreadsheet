export const emojis = {
    Playtesting: ":dart:",
    PhysicalPlaytesting: ":flower_playing_cards:",
    DigitalPlaytesting: ":computer:",
    ChangeLog: ":memo:",
    ChangeNotes: ":card_file_box:",
    Implemented: ":white_check_mark:",
    NotImplemented: ":no_entry_sign:",
    Replaced: ":twisted_rightwards_arrows:",
    Reworked: ":arrows_clockwise:",
    Updated: ":arrow_double_up:",
    Bugfixed: ":wrench:",
    Other: ":eight_spoked_asterisk:"
} as { [emoji: string]: string };

export function githubify(text: string) {
    // Html Converting
    return text
        .replace(/<i>|<\/i>/g, "***")
        .replace(/<b>|<\/b>/g, "**")
        .replace(/<em>|<\/em>/g, "_")
        .replace(/<s>|<\/s>/g, "~~")
        .replace(/<cite>/g, "-")
        .replace(/<\/cite>/g, "")
        .replace(/<br>/g, "\n")
        .replace(/<h1>/g, "# ")
        .replace(/<\/h1>/g, "")
        .replace(/<h2>/g, "## ")
        .replace(/<\/h2>/g, "")
        .replace(/<h3>/g, "### ")
        .replace(/<\/h3>/g, "")
        .replace(/ {2}/g, " &nbsp;");
}