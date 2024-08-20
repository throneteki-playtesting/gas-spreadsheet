class UIHelper {
    static safelyGet(): GoogleAppsScript.Base.Ui | null {
        try {
            return SpreadsheetApp.getUi();
        } catch {
            return null;
        }
    }

    static openDialogWindow(title: string, html: string, width = 600, height = 500) {
        const ui = this.safelyGet();
        if (ui) {
            const output = HtmlService.createHtmlOutput(html);
            output.setWidth(width);
            output.setHeight(height);

            ui.showModalDialog(output, title);
        }
    }

    static openMultiWindow(options: InputOptions, title = "Please provide input", width = 600, height = 500, submitText = "Submit") {
        const ui = this.safelyGet();
        if (ui) {
            const template = HtmlService.createTemplateFromFile("Spreadsheet/Templates/Multiform");
            options = UIHelper.objectifyFields(options);
            template.inputFieldsHTML = UIHelper.renderInputFields(options);
            template.submitText = submitText;
            const uuid = Utilities.getUuid();
            template.uuid = uuid;
            const key = uuid + "_RESPONSE";

            const html = template.evaluate().setWidth(width).setHeight(height);

            CacheService.getUserCache().put(key, "AWAITING");
            ui.showModalDialog(html, title);
            while (CacheService.getUserCache().get(key) === "AWAITING" && !isTimeout(uuid)) {
                // TODO?
            }

            const rawResponse = CacheService.getUserCache().get(key);
            if (rawResponse && rawResponse !== "AWAITING") {
                CacheService.getUserCache().remove(key);
                return JSON.parse(rawResponse);
            }
        }
        return undefined;
    }

    private static objectifyFields(fields: InputOptions) {
        if (Array.isArray(fields)) {
            const temp = {};
            for (const field of fields) {
                temp[field] = undefined;
            }
            return temp;
        }
        return fields;
    }

    private static renderInputFields(options: InputOptions) {
        let html = "";
        for (const prop in options) {
            // Defaults to text
            if (!options[prop] || typeof options[prop] === "string") {
                options[prop] = {
                    type: "text",
                    value: options[prop]
                };
            }
            let inputHtml = "";
            if (options[prop].type === "select" && Array.isArray(options[prop].options)) {
                inputHtml += `<select name="${prop}" id="${prop}" style="width: 100%;">
                    ${options[prop].options.map((s: string) => `<option value="${s}">${s}</option>`).join("\n")}
                </select>`;
            } else if (options[prop].type === "date") {
                inputHtml += `<input type="date" name="${prop}" id="${prop}" style="width: 100%;">`;
            } else {
                inputHtml += `<input type="text" name="${prop}" id="${prop}" ${options[prop].value ? "value=" + options[prop].value : ""} style="width: 100%;">`;
            }

            html += `
            <div class="form-group" style="width: 100%; padding-bottom: 5px;">
                <label for="${prop}">${prop}</label>
                ${inputHtml}
            </div>`;
        }
        return html;
    }

    public static getResponseKey(uuid: string) {
        return uuid + "_RESPONSE";
    }
}

function processUserInput(uuid: string, inputValues: { [key: string]: string }) {
    CacheService.getUserCache().put(uuid + "_RESPONSE", JSON.stringify(inputValues));
}

const TIMEOUT = 5000;
function refreshTimeout(uuid: string) {
    // Refreshes every 1000ms on client side
    const timeout = new Date(Date.now() + TIMEOUT);
    CacheService.getUserCache().put(uuid + "_TIMEOUT", timeout.getTime().toString());
    return timeout;
}

function isTimeout(uuid: string) {
    // Responsible for catching whether the user has closed the popup (since closing events cannot be bound to modal popup)
    const timeString = CacheService.getUserCache().get(uuid + "_TIMEOUT");
    const timeout: Date = timeString ? new Date(parseInt(timeString)) : refreshTimeout(uuid);

    return timeout.getTime() <= Date.now();
}

export interface InputOptions {
    type?: string,
    value?: string,
    options?: string[]
}

export { UIHelper, processUserInput };