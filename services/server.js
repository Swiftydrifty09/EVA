require("dotenv").config();

const express = require("express");
const cors = require("cors");

const chatRoute = require("./routes/chat");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use("/chat", chatRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`JARVIS running on port ${PORT}`);
});