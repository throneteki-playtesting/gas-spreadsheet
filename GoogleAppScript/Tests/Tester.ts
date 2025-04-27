import { Forms } from "../Forms/Form";
import { Trigger } from "../Spreadsheets/Listeners";

const defaultDoGet = {
    parameters: {},
    contextPath: null,
    queryString: ""
};
const defaultDoPost = {
    parameters: {},
    contextPath: null,
    queryString: ""
};

function createCardsTest() {
    const contents = "[{\"project\":26,\"number\":1,\"version\":\"9.9.9\",\"faction\":\"House Baratheon\",\"name\":\"Melisandre\",\"type\":\"Character\",\"traits\":[\"Lady\",\"R'hllor\"],\"text\":\"Shadow (5).\\n<b>Reaction:</b> After you win a challenge in which Melisandre is attacking, choose and reveal a card in shadows controlled by the losing opponent. If that card is a character, you may kneel your faction card to put it into play under your control.\",\"deckLimit\":3,\"loyal\":true,\"cost\":6,\"unique\":true,\"strength\":5,\"icons\":{\"military\":false,\"intrigue\":true,\"power\":true},\"note\":{\"type\":\"Updated\",\"text\":\"Raised cost to 7\"},\"playtesting\":\"9.9.9\",\"id\":\"1@9.9.9\"}]";
    const e = {
        ...defaultDoPost,
        contentLength: contents.length,
        ...{
            pathInfo: "cards/create",
            parameter: {},
            postData: {
                name: "",
                type: "application/json",
                length: contents.length,
                contents
            }
        }
    } as GoogleAppsScript.Events.DoPost;
    this.doPost(e);
}
function readCardsTest() {
    const e = {
        ...defaultDoGet,
        contentLength: 0,
        pathInfo: "cards",
        parameter: {
            ids: "1@1.0.0"
        }
    } as GoogleAppsScript.Events.DoGet;
    this.doGet(e);
}
function updateCardsTest() {
    const contents = "[{\"project\":26,\"number\":1,\"version\":\"9.9.8\",\"faction\":\"House Baratheon\",\"name\":\"Melisandre\",\"type\":\"Character\",\"traits\":[\"Lady\",\"R'hllor\"],\"text\":\"Shadow (5).\\n<b>Reaction:</b> After you win a challenge in which Melisandre is attacking, choose and reveal a card in shadows controlled by the losing opponent. If that card is a character, you may kneel your faction card to put it into play under your control.\",\"deckLimit\":3,\"loyal\":true,\"cost\":6,\"unique\":true,\"strength\":5,\"icons\":{\"military\":false,\"intrigue\":true,\"power\":true},\"note\":{\"type\":\"Updated\",\"text\":\"Raised cost to 7\"},\"playtesting\":\"9.9.9\",\"id\":\"1@9.9.9\"}]";
    const e = {
        ...defaultDoPost,
        contentLength: contents.length,
        ...{
            pathInfo: "cards/update",
            parameter: {},
            postData: {
                name: "",
                type: "application/json",
                length: contents.length,
                contents
            }
        }
    } as GoogleAppsScript.Events.DoPost;
    this.doPost(e);
}
function destroyCardsTest() {
    const contents = "[{\"id\":\"1@9.9.9\"},{\"id\":\"2@9.9.9\"}]";
    const e = {
        ...defaultDoPost,
        contentLength: contents.length,
        ...{
            pathInfo: "cards/destroy",
            parameter: {},
            postData: {
                name: "",
                type: "application/json",
                length: contents.length,
                contents
            }
        }
    } as GoogleAppsScript.Events.DoPost;
    this.doPost(e);
}
function onEditTest() {
    const e = {
        range: SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Latest Cards").getRange(5, 13)
    } as GoogleAppsScript.Events.SheetsOnEdit;
    Trigger.edit(e);
}

function updateReviewsTest() {
    const contents = "[{\"reviewer\":\"Deathlysteve\",\"projectId\":27,\"number\":1,\"version\":\"1.0.0\",\"faction\":\"House Baratheon\",\"name\":\"Melisandre\",\"epoch\":1727062520571,\"decks\":[\"https://thronesdb.com/test1\",\"https://thronesdb.com/test2\",\"https://thronesdb.com/test3\",\"https://thronesdb.com/test4\",\"https://thronesdb.com/test5\",\"https://thronesdb.com/test6\",\"https://thronesdb.com/test7\"],\"games\":\"3 or less\",\"rating\":5,\"releasable\":\"Unsure\",\"reasoning\":\"This is my reason!!!\"}]";
    const e = {
        ...defaultDoPost,
        contentLength: contents.length,
        ...{
            pathInfo: "reviews/update",
            parameter: {
                upsert: "true"
            },
            postData: {
                name: "",
                type: "application/json",
                length: contents.length,
                contents
            }
        }
    } as GoogleAppsScript.Events.DoPost;
    this.doPost(e);
}

function submitReviewTest() {
    const response = Forms.get().getResponses()[0];
    Forms.submit(response);
}

export {
    createCardsTest,
    readCardsTest,
    updateCardsTest,
    destroyCardsTest,
    onEditTest,
    updateReviewsTest,
    submitReviewTest
};