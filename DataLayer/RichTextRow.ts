abstract class RichTextRow {
    protected rowValues: GoogleAppsScript.Spreadsheet.RichTextValue[];

    abstract toRichTextValues(): GoogleAppsScript.Spreadsheet.RichTextValue[];

    getText(column: number, required: boolean = false) {
        const str = this.rowValues[column]?.getText();
        const text = !str || str === "-" ? "" : str;
        if (!text && required) {
            throw new Error("Failed to build required string from '" + str + "' for column index " + column + ". Full Row Data:\n" + this.rowValues.map(rtv => rtv.getText()));
        }
        return text;
    }

    hasText(column: number) {
        const str = this.getText(column);
        return !!str;
    }

    getNumber(column: number, required: boolean = false) {
        const str = this.getText(column, required);
        const number = parseInt(str);
        if (Number.isNaN(number) && required) {
            throw new Error("Failed to build required number from '" + str + "' for column index " + column + ". Full Row Data:\n" + this.rowValues.map(rtv => rtv.getText()))
        }
        return parseInt(str);
    }

    getEnumFromValue<E>(enumType: any, column: number, required: boolean = false): E {
        const str = this.getText(column, required);
        const e = Object.entries(enumType).find(([key, value]) => value === str)?.[1];
        if (!e && required) {
            throw new Error("Failed to find required '" + enumType + "' enum of value '" + str + "' for column index " + column + ". Full Row Data:\n" + this.rowValues.map(rtv => rtv.getText()));
        }
        return e as E;
    }

    getValue(column: number, required: boolean = false) {
        const rtv = this.rowValues[column];
        if (!rtv && required) {
            throw new Error("Failed to find required value for column index " + column + ". Full Row Data:\n" + this.rowValues.map(rtv => rtv.getText()));
        }
        return rtv;
    }

    getAsHtml(column: number) {
        let htmlString = "";
        const isTrait = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
            ts.isBold()
            && ts.isItalic()
            && !ts.isStrikethrough()
            && !ts.isUnderline()

        const isTriggeredAbility = (ts: GoogleAppsScript.Spreadsheet.TextStyle) =>
            ts.isBold()
            && !ts.isItalic()
            && !ts.isStrikethrough()
            && !ts.isUnderline()

        for (let run of this.rowValues[column]?.getRuns() ?? []) {
            let text = run.getText();
            const style = run.getTextStyle();

            // Regex to gather only the text portion of the string, whilst leaving the trim/newlines untouched
            const regex = /([^ \n]+(?: [^ \n]+)*)/g;
            if (isTrait(style)) {
                text = text.replace(regex, "<i>$1</i>");
            } else if (isTriggeredAbility(style)) {
                text = text.replace(regex, "<b>$1</b>");
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

    setFromHtml(column: number, html: string) {
        const regex = /(?:<([^>]+)>)?(?<!<)([^<>]+)?(?!>)(?:<\/[^>]+>)?/gm;
        const textStyles: {
            startOffset: number,
            endOffset: number,
            textStyle: GoogleAppsScript.Spreadsheet.TextStyle
        }[] = [];
        let fullText = "";

        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            const element = match[1];
            const text = match[2] || "";
            let textStyle: GoogleAppsScript.Spreadsheet.TextStyle | null = null;
            switch (element) {
                case "i":
                    textStyle = SpreadsheetApp.newTextStyle().setBold(true).setItalic(true).build();
                case "b":
                    textStyle = textStyle || SpreadsheetApp.newTextStyle().setBold(true).build();
                    textStyles.push({
                        startOffset: fullText.length,
                        endOffset: fullText.length + text.length,
                        textStyle
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
        for (let ts of textStyles) {
            builder = builder.setTextStyle(ts.startOffset, ts.endOffset, ts.textStyle);
        }

        const richTextValue = builder.build();
        this.rowValues[column] = richTextValue;
    }

    setText(column: number, text: string | number) {
        const rtv = this.rowValues[column]?.copy() ?? SpreadsheetApp.newRichTextValue();
        this.rowValues[column] = rtv.setText(text.toString()).build();
    }
}

export { RichTextRow }