const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const cakeRoutes = require("./routes/cakeRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const shopRoutes = require("./routes/shopRoutes");

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const parseAllowedOrigins = () => {
  const raw = (process.env.FRONTEND_ORIGIN || "").trim();
  if (!raw || raw === "*") return ["*"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const normalizeOrigin = (origin) => {
  if (!origin) return origin;
  return origin
    .replace("http://127.0.0.1", "http://localhost")
    .replace("https://127.0.0.1", "https://localhost");
};

app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = parseAllowedOrigins();
      if (allowed.includes("*")) return cb(null, true);
      if (!origin) return cb(null, true); // non-browser clients

      const normalized = normalizeOrigin(origin);
      const allowedNormalized = allowed.map(normalizeOrigin);
      if (allowedNormalized.includes(normalized)) return cb(null, true);

      return cb(new Error("Not allowed by CORS"));
    }
  })
);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", authRoutes);
app.use("/api", cakeRoutes);
app.use("/api", categoryRoutes);
app.use("/api", uploadRoutes);
app.use("/api", shopRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

module.exports = app;
