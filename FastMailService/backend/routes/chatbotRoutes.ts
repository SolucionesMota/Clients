import express from "express";
import { processChatbotMessage } from "../controllers/chatbotController";

const router = express.Router();

router.post("/", processChatbotMessage);

export default router;
