import express, { NextFunction, Request, Response } from "express";
import partials from "express-partials";
import compression from "compression";
import cors from "cors";
import { logger } from ".";
import { errors } from "celebrate";
import api from "./Routes/API";
import basicAuth from "express-basic-auth";

export default class Server {
    public static apiUrl: string;

    public static initialise(apiHost: string, serverPort: number, clientPort: number) {
        this.apiUrl = apiHost || `http://localhost:${serverPort}`;

        // Add express
        const app = express();

        // Add middleware
        app.use(cors({
            origin: `${apiHost}:${clientPort}`
        }));
        app.use(partials());
        app.use(compression());
        app.use(express.static("public"));
        app.use(express.json());
        app.use(basicAuth({
            users: { patane97: "qwerty123" },
            challenge: true,
            unauthorizedResponse: "Unauthorized access. Please provide valid credentials."
        }));

        app.use(errors());
        app.use(this.errorHandler);

        // Register routes
        app.use("/api", api);

        app.use(errors());
        app.use((req, res) => {
            res.status(404).send("Route does not exist");
        });

        app.listen(serverPort, () => {
            logger.info(`Server running at ${this.apiUrl}`);
        });

        return app;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error(err);
        if (process.env.NODE_ENV !== "production") {
            res.status(500).send(err);
        } else {
            res.status(500).send("Internal Server Error");
        }
    };
}