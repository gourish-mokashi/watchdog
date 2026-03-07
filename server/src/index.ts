import "dotenv/config";
import express from "express";
import eventRouter from "./routes/eventRoute.js";
import generateRouter from "./routes/generateRoute.js";

const app = express();

app.use(express.json());
app.use("/events", eventRouter);
app.use("/generate", generateRouter);

app.get("/", (req, res) => {
  res.send("Hello, Watchdog!");
});

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
