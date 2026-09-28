import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js"

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get("api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
connectDB().then(() => 
    app.listen(PORT, () => console.log(`Server running on ${PORT}`))
);