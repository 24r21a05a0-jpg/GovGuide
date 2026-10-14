
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
  new mongoose.Schema(
    {
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
      category: { type: String, default: "All" },
      categories: {
        type: [String],
        default: []
      },
      startDate: { type: Date, default: null },
      lastDate: { type: Date, required: true },
      examDate: { type: Date, default: null },
      allotmentDate: { type: Date, default: null },
      description: { type: String, required: true },
      officialLink: { type: String, default: "" }
    },
    { timestamps: true }
  )
);

const Profile = mongoose.model(
  "Profile",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      age: { type: Number, required: true },
      qualification: { type: String, required: true },
      branch: { type: String, default: "" },
      percentage: { type: Number, required: true },
      state: { type: String, required: true },
      category: { type: String, required: true }
    },
    { timestamps: true }
  )
);

app.get("/", (req, res) => {
  res.json({ message: "GovGuide API is running!" });
});

app.get("/opportunity", async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { organization: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } }
      ];
    }

    const opportunities = await Opportunity.find(filter).sort({
      lastDate: 1
    });

    res.json(opportunities);
  } catch (error) {
    console.error("Load opportunities error:", error.message);
    res.status(500).json({
      message: "Could not load opportunities."
    });
  }
});

app.post("/opportunity", async (req, res) => {
  try {
    const data = { ...req.body };

    if (Array.isArray(data.categories) && data.categories.length > 0) {
      data.category = data.categories[0];
    }

    const opportunity = new Opportunity(data);
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
    const { age, qualification, branch, state, category } = req.body;

    if (
      age === undefined ||
      age === null ||
      age === "" ||
      !Number.isFinite(Number(age)) ||
      Number(age) <= 0 ||
      !qualification ||
      !state ||
      !category
    ) {
      return res.status(400).json({
        message: "Age, qualification, state, and category are required."
      });
    }

    const levels = [
      "10th",
      "Intermediate",
      "Diploma",
      "B.Tech",
      "Degree",
      "M.Tech",
      "Post Graduation"
    ];

    const userLevel = levels.indexOf(qualification);

    if (userLevel === -1) {
      return res.status(400).json({
        message: "Invalid qualification."
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const all = await Opportunity.find({
      $and: [
        {
          $or: [
            { minAge: null },
            { minAge: { $exists: false } },
            { minAge: { $lte: Number(age) } }
          ]
        },
        {
          $or: [
            { maxAge: null },
            { maxAge: { $exists: false } },
            { maxAge: { $gte: Number(age) } }
          ]
        },
        {
          $or: [
            { state: { $regex: "^" + state.trim() + "$", $options: "i" } },
            { state: { $regex: "^Other$", $options: "i" } }
          ]
        },
        { lastDate: { $gte: today } }
      ]
    }).sort({ lastDate: 1 });

    const matches = all.filter(item => {
      const requiredLevel = levels.indexOf(item.qualification);

      if (requiredLevel === -1 || userLevel < requiredLevel) {
        return false;
      }

      const userCategory = category.trim().toLowerCase();
      const eligibleCategories =
        item.categories && item.categories.length
          ? item.categories
          : [item.category || "All"];

      const categoryMatches = eligibleCategories.some(value => {
        const required = value.trim().toLowerCase();

        return (
          required === userCategory ||
          ["all", "any", "other"].includes(required)
        );
      });

      if (!categoryMatches) {
        return false;
      }

      const requiredBranch = (item.branch || "").trim().toLowerCase();
      const userBranch = (branch || "").trim().toLowerCase();

      const anyBranchValues = [
        "",
        "any",
        "all",
        "all branches",
        "any branch",
        "open to all"
      ];

      if (
        !anyBranchValues.includes(requiredBranch) &&
        requiredBranch !== userBranch
      ) {
        return false;
      }

      return true;
    });

    res.json(matches);
  } catch (error) {
    console.error("Matching error:", error.message);
    res.status(500).json({
      message: "Could not find matches."
    });
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
