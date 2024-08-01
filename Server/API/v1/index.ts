import express from "express";
import cards from "./Routes/Cards";


const router = express.Router();

router.use("/cards", cards);

export default router;