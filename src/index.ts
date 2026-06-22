import express from "express";

const app = express();
const PORT = process.env.PORT || 8000;

// Simple health/root endpoint.
app.get("/", (req, res) => {
  res.send("Hello, Welcome to the classroom API!");
});

// Bind to Railway-provided PORT in production; fallback to 8000 locally.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});