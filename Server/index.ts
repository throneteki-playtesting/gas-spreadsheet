import config from "config";
import express, { NextFunction, Request, Response } from "express";
import partials from "express-partials";
import compression from "compression";
import cors from "cors";
import { errors } from "celebrate";
import api from "./Routes/API";
import basicAuth from "express-basic-auth";
import { logger } from "./Services/Services";

export const apiUrl = config.get("server.host") || `http://localhost:${config.get("server.ports.api")}`;
function initialise(apiHost: string, serverPort: number, clientPort: number) {
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

    app.use(errors());
    app.use(errorHandler);

    // Register routes
    app.use("/api", basicAuth({
        users: config.get("server.auth"),
        challenge: true,
        unauthorizedResponse: "Unauthorized access. Please provide valid credentials."
    }), api);

    app.use(errors());
    app.use((req, res) => {
        res.status(404).send("Route does not exist");
    });

    app.listen(serverPort, () => {
        logger.info(`Server running on port ${serverPort}: ${apiUrl}`);
    });

    return app;
}

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(err);
    if (process.env.NODE_ENV !== "production") {
        res.status(500).send(err);
    } else {
        res.status(500).send("Internal Server Error");
    }
    next();
};

initialise(config.get("server.host"), config.get("server.ports.api"), config.get("server.ports.client"));