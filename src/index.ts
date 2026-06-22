import express from "express";
import subjectsRouter from "./routes/subjects";
import departmentsRouter from "./routes/departments";
import cors from "cors";
import securityMiddleware from "./middleware/security";

const app = express();
const PORT = process.env.PORT || 8000;

if (!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is not set in .env file");
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(securityMiddleware)

// Simple health/root endpoint.
app.get("/", (req, res) => {
  res.send("Hello, Welcome to the classroom API!");
});

app.use("/api/subjects", subjectsRouter);
app.use("/api/departments", departmentsRouter);

// Bind to Railway-provided PORT in production; fallback to 8000 locally.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
