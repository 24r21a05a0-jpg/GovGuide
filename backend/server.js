
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;

const Opportunity = mongoose.model(
  "Opportunity",
  new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Job", "Exam", "Scheme", "Scholarship"],
      required: true
    },
    organization: { type: String, required: true, trim: true },
    qualification: { type: String, required: true },
    branch: { type: String, default: "" },
    minAge: { type: Number, default: null },
    maxAge: { type: Number, default: null },
    state: { type: String, required: true },
    category: { type: String, required: true },
    lastDate: { type: Date, required: true },
    description: { type: String, required: true },
    officialLink: { type: String, default: "" }
  }, { timestamps: true })
);

const Profile = mongoose.model(
  "Profile",
  new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    qualification: { type: String, required: true },
    branch: { type: String, default: "" },
    percentage: { type: Number, required: true },
    state: { type: String, required: true },
    category: { type: String, required: true }
  }, { timestamps: true })
);

app.get("/", (req, res) => {
  res.json({ message: "GovGuide API is running!" });
});

app.get("/opportunity", async (req, res) => {
  try {
    const opportunities = await Opportunity.find().sort({ lastDate: 1 });
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ message: "Could not load opportunities." });
  }
});

app.post("/opportunity", async (req, res) => {
  try {
    const opportunity = new Opportunity(req.body);
    await opportunity.save();
    res.status(201).json({
      message: "Opportunity saved successfully!",
      opportunity
    });
  } catch (error) {
    res.status(400).json({
      message: "Could not save opportunity. Check all required fields.",
      error: error.message
    });
  }
});

app.post("/profile", async (req, res) => {
  try {
    const profile = new Profile(req.body);
    await profile.save();
    res.status(201).json({
      message: "Profile saved successfully!",
      profile
    });
  } catch (error) {
    res.status(400).json({
      message: "Could not save profile. Check all required fields.",
      error: error.message
    });
  }
});

app.post("/match", async (req, res) => {
  try {
    const { age, qualification, state } = req.body;

    if (!Number.isFinite(Number(age)) || !qualification || !state) {
      return res.status(400).json({
        message: "Age, qualification, and state are required."
      });
    }

    const levels = [
      "10th", "Intermediate", "Diploma",
      "B.Tech", "Degree", "M.Tech", "Post Graduation"
    ];
    const userLevel = levels.indexOf(qualification);

    const all = await Opportunity.find({
      $and: [
        { $or: [{ minAge: null }, { minAge: { $exists: false } }, { minAge: { $lte: Number(age) } }] },
        { $or: [{ maxAge: null }, { maxAge: { $exists: false } }, { maxAge: { $gte: Number(age) } }] },
        { $or: [{ state: state }, { state: "Other" }] }
      ]
    }).sort({ lastDate: 1 });

    const matches = all.filter(item => {
      const requiredLevel = levels.indexOf(item.qualification);
      return userLevel >= 0 && requiredLevel >= 0 && userLevel >= requiredLevel;
    });

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: "Could not find matches." });
  }
});

async function startServer() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GovGuide API listening on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start GovGuide:", error.message);
  process.exit(1);
});
