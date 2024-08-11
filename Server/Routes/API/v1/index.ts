import express from "express";
import cards from "./Cards";

const router = express.Router();
router.use("/cards", cards);
router.get("*", (req, res) => {
    res.json({ message: "Connected with API v1!" });
});

export default router;