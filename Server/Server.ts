import express, { NextFunction, Request, Response } from "express";
import partials from "express-partials";
import compression from "compression";
import { logger } from ".";
import cards from "./Controllers/CardController";
import { errors } from "celebrate";

export default class ServerService {
    public static initialise(port: number) {
        // Add express
        const app = express();

        // Add middleware
        app.use(partials());
        app.use(compression());
        app.use(express.static("public"));

        app.use(errors());
        app.use(this.errorHandler);

        // Register routes
        app.use("/cards", cards);

        app.use(errors());
        app.use((req, res) => {
            res.status(404).send("Route does not exist");
        });

        app.listen(port, () => {
            logger.info(`Server running on port ${port}`);
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