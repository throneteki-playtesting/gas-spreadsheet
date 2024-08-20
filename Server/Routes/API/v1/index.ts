import express from "express";
import cards from "./Cards";
import projects from "./Projects";

const router = express.Router();
router.use("/cards", cards);
router.use("/projects", projects);
router.get("*", (req, res) => {
    res.json({ message: "Connected with API v1!" });
});

export default router;