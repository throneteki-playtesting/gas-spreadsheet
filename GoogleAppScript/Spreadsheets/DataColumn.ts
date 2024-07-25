export class DataColumn {
    public static serialise(value: GoogleAppsScript.Spreadsheet.RichTextValue): string {
        try {
            return this.parseToHTML(value);
        } catch (err) {
            throw Error(`Failed to serialise column with value "${value.getText()}": ${err}`);
        }
    }

    public static deserialise(value: string): GoogleAppsScript.Spreadsheet.RichTextValue {
        const richTextValue = this.parseFromHTML(value);
        return richTextValue;
    }

    private static parseToHTML(richTextValue: GoogleAppsScript.Spreadsheet.RichTextValue): string {
        let htmlString = "";

        const isTrait = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
            ts.isBold()
        && ts.isItalic()
        && !ts.isStrikethrough()
        && !ts.isUnderline();

        const isTriggeredAbility = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
            ts.isBold()
        && !ts.isItalic()
        && !ts.isStrikethrough()
        && !ts.isUnderline();

        const hasLink = (rtv: GoogleAppsScript.Spreadsheet.RichTextValue) =>
            rtv.getLinkUrl() !== null;

        for (const run of richTextValue.getRuns() ?? []) {
            let text = run.getText();
            const style = run.getTextStyle();

            // Regex to gather only the text portion of the string, whilst leaving the trim/newlines untouched
            const regex = /([^ \n]+(?: [^ \n]+)*)/g;
            if (isTrait(style)) {
                text = text.replace(regex, "<i>$1</i>");
            } else if (isTriggeredAbility(style)) {
                text = text.replace(regex, "<b>$1</b>");
            }
            // Adding link (alongside styling)
            if (hasLink(run)) {
                text = text.replace(regex, `<a href="${run.getLinkUrl()}">$1</a>`);
            }

            // // Replacing new-line with break
            // text = text.replace(/\n/g, "<br>");
            // Replacing icons
            text = text.replace(/:(\w+):/g, "[$1]");
            // Replacing citing
            text = text.replace(/(?<=" )[-~]\s+([\w ]+)/g, "<cite>$1</cite>");
            htmlString += text;
        }

        return htmlString;
    }

    private static parseFromHTML(value: string): GoogleAppsScript.Spreadsheet.RichTextValue {
        const regex = /(?:<\s*([^\s>]+)(?:\s+href="([^"]+)")?\s*>)?(?<!<)([^<>]+)?(?!>)(?:<\s*\/[^>]+\s*>)?/gm;
        const textStyles: {
            startOffset: number,
            endOffset: number,
            textStyle: GoogleAppsScript.Spreadsheet.TextStyle | null,
            link: string | null
        }[] = [];
        let fullText = "";

        let groups: RegExpExecArray | null;
        while ((groups = regex.exec(value)) !== null) {
            if (groups.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            const element = groups[1];
            const href = groups[2];
            const text = groups[3] || "";
            switch (element) {
                case "a":
                    textStyles.push({
                        startOffset: fullText.length,
                        endOffset: fullText.length + text.length,
                        textStyle: null,
                        link: href
                    });
                    fullText += text;
                    break;
                case "i":
                    textStyles.push({
                        startOffset: fullText.length,
                        endOffset: fullText.length + text.length,
                        textStyle: SpreadsheetApp.newTextStyle().setBold(true).setItalic(true).build(),
                        link: null
                    });
                    fullText += text;
                    break;
                case "b":
                    textStyles.push({
                        startOffset: fullText.length,
                        endOffset: fullText.length + text.length,
                        textStyle: SpreadsheetApp.newTextStyle().setBold(true).build(),
                        link: null
                    });
                    fullText += text;
                    break;
                case "cite":
                    fullText += "- " + text;
                    break;
                default:
                    fullText += text;
            }
        }

        // Converts all [icons] into :icons:
        fullText = fullText.replace(/\[([^\]]+)\]/g, ":$1:");

        let builder = SpreadsheetApp.newRichTextValue().setText(fullText);
        for (const ts of textStyles) {
            if (ts.textStyle) {
                builder = builder.setTextStyle(ts.startOffset, ts.endOffset, ts.textStyle);
            }
            if (ts.link) {
                builder = builder.setLinkUrl(ts.startOffset, ts.endOffset, ts.link);
            }
        }

        return builder.build();
    }
}