import express, { NextFunction, Request, Response } from "express";
import partials from "express-partials";
import compression from "compression";
import cors from "cors";
import { logger } from ".";
import { errors } from "celebrate";
import api from "./API";

export default class Server {
    public static initialise(serverPort: number, clientPort: number) {
        // Add express
        const app = express();

        // Add middleware
        app.use(cors({
            origin: `http://localhost:${clientPort}`
        }));
        app.use(partials());
        app.use(compression());
        app.use(express.static("public"));

        app.use(errors());
        app.use(this.errorHandler);

        // Register api route
        app.use("/api", api);

        app.use(errors());
        app.use((req, res) => {
            res.status(404).send("Route does not exist");
        });

        app.listen(serverPort, () => {
            logger.info(`Server running on port ${serverPort}`);
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