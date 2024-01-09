class UIHelper {
    static get() {
        return SpreadsheetApp.getUi();
    }

    static openDialogWindow(title: string, html: string, width = 600, height = 500) {
        let output = HtmlService.createHtmlOutput(html);
        output.setWidth(width);
        output.setHeight(height);

        this.get().showModalDialog(output, title);
    }

    static openMultiWindow(options: Array<String> | Object, title = "Please provide input", width = 600, height = 500, submitText = "Submit") {
        var template = HtmlService.createTemplateFromFile('Spreadsheet/Templates/Multiform');
        options = UIHelper.objectifyFields(options);
        template.inputFieldsHTML = UIHelper.renderInputFields(options);
        template.submitText = submitText;
        const uuid = Utilities.getUuid();
        template.uuid = uuid;
        const key = uuid + "_RESPONSE";

        var html = template.evaluate().setWidth(width).setHeight(height);

        CacheService.getUserCache().put(key, "AWAITING");
        SpreadsheetApp.getUi().showModalDialog(html, title);
        while (CacheService.getUserCache().get(key) === "AWAITING" && !isTimeout(uuid)) { }

        const rawResponse = CacheService.getUserCache().get(key);
        if (rawResponse && rawResponse !== "AWAITING") {
            CacheService.getUserCache().remove(key);
            return JSON.parse(rawResponse);
        }
        return undefined;
    }

    private static objectifyFields(fields: Object | Array<String>) {
        if (Array.isArray(fields)) {
            let temp = {};
            for (let field of fields) {
                temp[field] = undefined;
            }
            return temp;
        }
        return fields;
    }

    private static renderInputFields(options: Object) {
        var html = '';
        for (let prop in options) {
            html += `
            <div class="form-group" style="width: 100%; padding-bottom: 5px;">
                <label for="${prop}">${prop}</label>
                <input type="text" name="${prop}" id="${prop}" ${options[prop] ? "value=" + options[prop] : ""} style="width: 100%;">
            </div>
        `;
        }
        return html;
    }

    public static getResponseKey(uuid: String) {
        return uuid + "_RESPONSE";
    }
}

function processUserInput(uuid: String, inputValues: Object) {
    CacheService.getUserCache().put(uuid + "_RESPONSE", JSON.stringify(inputValues));
}

const TIMEOUT = 5000;
function refreshTimeout(uuid: String) {
    // Refreshes every 1000ms on client side
    let timeout = new Date(Date.now() + TIMEOUT);
    CacheService.getUserCache().put(uuid + "_TIMEOUT", timeout.getTime().toString());
    return timeout;
}

function isTimeout(uuid: String) {
    // Responsible for catching whether the user has closed the popup (since closing events cannot be bound to modal popup)
    let timeString = CacheService.getUserCache().get(uuid + "_TIMEOUT");
    let timeout: Date = timeString ? new Date(parseInt(timeString)) : refreshTimeout(uuid);
    
    return timeout.getTime() <= Date.now();
}

export { UIHelper }