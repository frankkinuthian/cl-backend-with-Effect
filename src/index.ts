import AgentApi from "apminsight";
AgentApi.config();

import express from "express";
import subjectsRouter from "./routes/subjects.js";
import departmentsRouter from "./routes/departments.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const PORT = process.env.PORT || 8000;

// Trust Render's (and other reverse proxies') X-Forwarded-For header
// so req.ip reflects the real client IP instead of 127.0.0.1.
app.set("trust proxy", 1);

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

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(securityMiddleware);

// Simple health/root endpoint.
app.get("/", (req, res) => {
  res.send("Hello, Welcome to the classroom API!");
});

app.use("/api/subjects", subjectsRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/classes", classesRouter);

// Bind to Railway-provided PORT in production; fallback to 8000 locally.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
