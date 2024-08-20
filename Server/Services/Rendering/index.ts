import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer, { Viewport } from "puppeteer";
import Card from "../Data/Models/Card";
import { BufferCollection } from "buffer-collection";
import Project from "../Data/Models/Project";
import { dataService } from "../Services";
import { Utils } from "@/Common/Utils";

export type RenderType = "Single" | "Batch";

class RenderingService {
    public async syncImages(cards: Card[], override = false) {
        const filePathFunc = (card: Card) => `./public/img/${card.project}/${card.number}@${card.version}.png`;
        const syncing = override ? [...cards] : cards.filter((card) => !fs.existsSync(filePathFunc(card)));

        const imgBuffers = await this.asPNG(syncing);

        while (syncing.length > 0)
        {
            const card = syncing.shift();
            const imgBuffer = imgBuffers.shiftBuffer();
            const filePath = filePathFunc(card);
            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) {
                await fs.promises.mkdir(dirPath, { recursive: true });
            }
            await fs.promises.writeFile(filePath, imgBuffer);
        }
    }

    public async asPNG(cards: Card[]) {
        const width = 240;
        const height = 333;
        const browser = await this.launchPuppeteer();
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            const style = document.createElement("style");
            style.innerHTML = fs.readFileSync("./public/css/Render.css").toString();
            const script = document.createElement("script");
            script.innerHTML = fs.readFileSync("./public/js/Render.js").toString();
            document.getElementsByTagName("head")[0].appendChild(style);
            document.getElementsByTagName("head")[0].appendChild(script);
        });
        const buffers = new BufferCollection();
        for (const card of cards) {
            page.setViewport({
                width: card.type === "Plot" ? height : width,
                height: card.type === "Plot" ? width : height,
                deviceScaleFactor: 1.25
            });
            const htmlContent = await this.asHtml("Single", card, { includeCSS: true, includeJS: true });
            await page.setContent(htmlContent);
            const buffer = await page.screenshot({ optimizeForSpeed: true, type: "png" });
            buffers.push(buffer);
        }
        await page.close();
        await browser.close();
        return buffers;
    }

    public async asPDF(cards: Card[], options? : { copies: number, perPage: number }) {
        if (cards.length === 0) {
            throw Error("Cannot render PDF with no cards");
        }
        const browser = await this.launchPuppeteer({
            width: 794,
            height: 1124 // For some reason, puppeteer wants this as 1124, rather than the 1122 that it SHOULD be for A4 *shrug*
        });
        const htmlContent = await this.asHtml("Batch", cards, { ...options, includeCSS: true, includeJS: true });
        const page = await browser.newPage();
        await page.addStyleTag({ path: "./public/css/Render.css" });
        await page.addScriptTag({ path: "./public/js/Render.js" });
        await page.setContent(htmlContent, { waitUntil: "load" });
        const buffer = await page.pdf({ printBackground: true, format: "A4" });
        await page.close();
        await browser.close();
        return buffer;
    }

    public async asHtml(mode: RenderType, cards: Card | Card[], options?: { copies?: number, perPage?: number, includeCSS?: boolean, includeJS?: boolean }) {
        const projects = await dataService.projects.read();
        switch (mode) {
            case "Single":
                const single = Array.isArray(cards) ? cards[0] : cards as Card;
                options = { ...{ includeCSS: false, includeJS: false }, ...options };
                return RenderingService.renderTemplate({ type: mode, card: this.prepareCard(projects, single), ...options });
            case "Batch":
                const batch = Array.isArray(cards) ? cards : [cards];
                options = { ... { includeCSS: false, includeJS: false, copies: 3, perPage: 9 }, ...options };
                return RenderingService.renderTemplate({ type: mode, cards: batch.map((card) => this.prepareCard(projects, card)), ...options });
        }
    }

    private prepareCard(projects: Project[], card: Card) {
        const project = projects.find((p) => p.code === card.project);
        const jCard = card.toJSON();
        return {
            ...jCard,
            ...{
                type: jCard.type,
                traits: jCard.traits.map((t: string) => `${t}.`).join(" "),
                faction: jCard.faction,
                text: jCard.text
                    .replace(/\[([^\]]+)\]/g, "<span class=\"icon-$1\"></span>")
                    .replace(/\n/g, "<br>")
                    // If any plot modifiers are detected, create the plot-modifiers class...
                    .replace(/\n*((?:\s*[+-]\d+ (?:Income|Initiative|Claim|Reserve)\.?\s*)+)/gi, "<div class=\"plot-modifiers\">$1</div>")
                    // ...and wrap each plot modifier in a span within that class
                    .replace(/\s*([+-]\d+) (Income|Initiative|Claim|Reserve)\.?\s*/gi, (match: string, modifier: string, plotStat: string) => `<span class="plot-stat ${plotStat.toLowerCase()} auto-size">${modifier}</span>`)
                    // If any lists are detected, create the ul...
                    .replace(/(<br>-\s*.*\.)/g, "<ul>$1</ul>")
                    // ... and wrap each line in li
                    .replace(/<br>-\s*(.*?\.)(?=<br>|<\/ul>)/g, "<li>$1</li>"),
                deckLimit: jCard.deckLimit !== Utils.DefaultDeckLimit[jCard.type] ? `Deck Limit: ${jCard.deckLimit}` : ""
            },
            ...{
                project: {
                    short: project?.short || "?",
                    code: project?.code || "?"
                }
            }
        } as ejs.Data;
    }

    private static renderTemplate(data: ejs.Data) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filepath = `${__dirname}/Templates/Render.ejs`;
        const file = fs.readFileSync(filepath).toString();
        const { includeCSS, includeJS, ...restData } = data;
        const css = includeCSS ? fs.readFileSync(path.resolve(__dirname, "../../../public/css/Render.css")).toString() : undefined;
        const js = includeJS ? fs.readFileSync(path.resolve(__dirname, "../../../public/js/Render.js")).toString() : undefined;
        return ejs.render(file, { filename: filepath, name: "Render", css, js, options: { ...restData } });
    }

    private async launchPuppeteer(defaultViewport?: Viewport) {
        return await puppeteer.launch({
            ...(defaultViewport ? { defaultViewport } : {}),
            args: [
                "--disable-features=IsolateOrigins",
                "--disable-site-isolation-trials",
                "--autoplay-policy=user-gesture-required",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-breakpad",
                "--disable-client-side-phishing-detection",
                "--disable-component-update",
                "--disable-default-apps",
                "--disable-dev-shm-usage",
                "--disable-domain-reliability",
                "--disable-extensions",
                "--disable-features=AudioServiceOutOfProcess",
                "--disable-hang-monitor",
                "--disable-ipc-flooding-protection",
                "--disable-notifications",
                "--disable-offer-store-unmasked-wallet-cards",
                "--disable-popup-blocking",
                "--disable-print-preview",
                "--disable-prompt-on-repost",
                "--disable-renderer-backgrounding",
                "--disable-setuid-sandbox",
                "--disable-speech-api",
                "--disable-sync",
                "--hide-scrollbars",
                "--ignore-gpu-blacklist",
                "--metrics-recording-only",
                "--mute-audio",
                "--no-default-browser-check",
                "--no-first-run",
                "--no-pings",
                "--no-sandbox",
                "--no-zygote",
                "--password-store=basic",
                "--use-gl=swiftshader",
                "--use-mock-keychain"
            ]
        });
    }
}

export default RenderingService;