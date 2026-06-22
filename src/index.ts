import express from "express";
import subjectsRouter from "./routes/subjects";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Simple health/root endpoint.
app.get("/", (req, res) => {
  res.send("Hello, Welcome to the classroom API!");
});

app.use("/api/subjects", subjectsRouter);

// Bind to Railway-provided PORT in production; fallback to 8000 locally.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});