require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/campusconnect";
const JWT_SECRET = process.env.JWT_SECRET;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, enum: ["Electronics", "Documents", "Bags", "Clothing", "Keys", "Books", "Accessories", "Other"] },
  type: { type: String, required: true, enum: ["lost", "found"] },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  date: { type: Date, default: Date.now },
  imageUrl: { type: String, default: "", trim: true },
  status: { type: String, enum: ["open", "claimed", "returned"], default: "open" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Item = mongoose.model("Item", itemSchema);

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please login to continue." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

app.get("/api/health", (req, res) => res.json({
  message: "CampusConnect REST API is running",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
}));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "This email is already registered. Please login." });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: "1d" });
    res.status(201).json({ message: "Account created successfully!", token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Register:", err.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) return res.status(400).json({ message: "Email and password are required." });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid email or password." });
    const token = jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login successful!", token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login:", err.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("name email");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user });
});

app.get("/api/items", async (req, res) => {
  try {
    const filter = {};
    if (["lost", "found"].includes(req.query.type)) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status && ["open", "claimed", "returned"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search?.trim()) {
      const term = req.query.search.trim().slice(0, 80);
      filter.$or = [
        { title: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } }
      ];
    }
    const items = await Item.find(filter).populate("owner", "name email").sort({ createdAt: -1 }).limit(100);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Could not load items." });
  }
});

app.get("/api/items/mine", auth, async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ items });
  } catch {
    res.status(500).json({ message: "Could not load your items." });
  }
});

app.post("/api/items", auth, async (req, res) => {
  try {
    const { title, description, category, type, location, date, imageUrl } = req.body || {};
    if (!title?.trim() || !description?.trim() || !category || !type || !location?.trim()) {
      return res.status(400).json({ message: "Please fill in all required fields." });
    }
    const item = await Item.create({ title, description, category, type, location, date: date || Date.now(), imageUrl: imageUrl || "", owner: req.user.id });
    res.status(201).json({ message: "Item reported successfully!", item });
  } catch (err) {
    res.status(400).json({ message: err.message || "Could not report item." });
  }
});

app.patch("/api/items/:id", auth, async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.user.id });
    if (!item) return res.status(404).json({ message: "Item not found or you do not own it." });
    const allowed = ["title", "description", "category", "type", "location", "date", "imageUrl", "status"];
    for (const key of allowed) if (req.body[key] !== undefined) item[key] = req.body[key];
    await item.save();
    res.json({ message: "Item updated.", item });
  } catch {
    res.status(400).json({ message: "Could not update item." });
  }
});

app.delete("/api/items/:id", auth, async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!item) return res.status(404).json({ message: "Item not found or you do not own it." });
    res.json({ message: "Item deleted." });
  } catch {
    res.status(400).json({ message: "Could not delete item." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found", path: req.originalUrl }));
app.get("*splat", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing. Add it to your .env file.");
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully!");
    app.listen(PORT, () => console.log(`CampusConnect running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("Check that the MongoDB Windows service is running.");
    process.exit(1);
  }
}
start();
