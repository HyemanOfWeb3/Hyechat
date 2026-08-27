import express from "express";
import { handleStreamWebhook } from "../controllers/streamWebhook.controller.js";

const router = express.Router();

router.post("/", handleStreamWebhook);

export default router;
