import express, { type Request, type Response } from "express";

const app = express();
const PORT = 8000;

// Middleware
app.use(express.json());

// Routes
app.get("/server", (req: Request, res: Response) => {
  console.log(`[${new Date().toISOString()}] GET /server - request received`);
  console.log(`  Headers: ${JSON.stringify(req.headers)}`);
  console.log(`  IP: ${req.ip}`);

  res.json({ message: "Classroom backend is up and running." });

  console.log(`[${new Date().toISOString()}] GET /server - response sent`);
});

// Start
app.listen(PORT, () => {
  console.log(
    `[${new Date().toISOString()}] Server started on http://localhost:${PORT}`,
  );
});
