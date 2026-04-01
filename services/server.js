import express from "express";
import dotenv from "dotenv";
import { chatHandler } from "./controllers/aiController.js";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/chat", chatHandler);

app.listen(3000, () => {
  console.log("JARVIS running on port 3000");
});