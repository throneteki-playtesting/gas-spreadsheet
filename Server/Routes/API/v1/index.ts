import express from "express";
import cards from "./Cards";
import projects from "./Projects";
import packs from "./Packs";

const router = express.Router();
router.use("/cards", cards);
router.use("/projects", projects);
router.use("/packs", packs);
router.get("*", (req, res) => {
    res.json({ message: "Connected with API v1!" });
});

export default router;