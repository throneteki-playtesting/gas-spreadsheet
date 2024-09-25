import express from "express";
import v1 from "./v1";

const router = express.Router();

router.use("/v1", v1);
router.get("*", (req, res) => {
    res.json({ message: "Invalid route for API v1" });
});

export default router;