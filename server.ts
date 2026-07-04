import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parsing with a generous size limit
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with User-Agent header for telemetry as instructed
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper for calling Gemini
async function callGemini(systemPrompt: string, userPrompt: string, forceJson = true) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the backend environment.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: forceJson ? "application/json" : "text/plain",
      temperature: 0.2,
    },
  });

  return response.text;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Attendance / Syllabus Parser Endpoint
app.post("/api/gemini/parse-syllabus", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Syllabus/timetable text is required" });
    }

    const systemPrompt = `You are an expert academic organizer. Your task is to parse raw syllabus, timetable, or schedule text and convert it into a structured list of college courses.
Return ONLY a JSON object containing a "courses" array.
Each course MUST have the following fields:
- id: A short unique string (e.g., "cs101")
- courseCode: Code of the course (e.g., "CS 101", "ECON 202" or "N/A" if none)
- courseName: Full title of the course (e.g., "Introduction to Computer Science")
- days: Array of weekdays when the class occurs (e.g., ["Monday", "Wednesday"])
- time: Time range of the class (e.g., "10:00 AM - 11:30 AM")
- instructor: Name of the professor/instructor
- room: Room number or location (e.g., "Tech Hall 302")
- total: Integer representing estimated total classes in the term (default to 30)
- attended: Integer representing classes attended so far (default to 0)

Ensure the output is valid JSON and perfectly structured. Do not include markdown code block syntax around the JSON in your raw response (just pure JSON).`;

    const userPrompt = `Parse the following syllabus or timetable text:
${text}`;

    const resultText = await callGemini(systemPrompt, userPrompt, true);
    if (!resultText) {
      throw new Error("No response from Gemini");
    }
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Parse syllabus error:", error);
    res.status(500).json({ error: error.message || "Failed to parse syllabus" });
  }
});

// 2. Assignment Planner Endpoint
app.post("/api/gemini/breakdown-assignment", async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Assignment title is required" });
    }

    const systemPrompt = `You are an elite student success coach. Given a major project/assignment title, description, and due date, create a structured, day-by-day roadmap/checklist to complete the project incrementally.
Determine how many days are remaining between now (or the next 5 days if unspecified) and the due date. Provide a structured plan with up to 7 distinct milestones or daily tasks.
Return ONLY a JSON object containing a "steps" array.
Each step MUST have:
- day: String representing the step index or label (e.g., "Day 1", "Day 2" or "Milestone 1")
- date: Target date or timeline label (e.g., "Oct 12th" or "Stage 1")
- task: Concise title of the daily task (e.g., "Gather research sources")
- description: Detailed description of what to do (e.g., "Search Google Scholar for 3 peer-reviewed articles on neural networks")
- completed: Boolean (always false initially)

Ensure the output is valid JSON.`;

    const userPrompt = `Create a step-by-step action plan for:
Project Title: ${title}
Description: ${description || "None provided"}
Due Date: ${dueDate || "In 7 days"}`;

    const resultText = await callGemini(systemPrompt, userPrompt, true);
    if (!resultText) {
      throw new Error("No response from Gemini");
    }
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Breakdown assignment error:", error);
    res.status(500).json({ error: error.message || "Failed to break down assignment" });
  }
});

// 3. Club Discovery Endpoint
const COLLEGE_CLUBS = [
  {
    id: "code-coffee",
    name: "Code & Coffee Club",
    category: "Technical",
    description: "The ultimate coding community. We host weekend hackathons, interactive algorithm workshops, and relaxed coffee-and-coding sessions.",
    hobbiesMatched: ["programming", "coding", "software", "gaming", "computers", "hackathons", "ai"]
  },
  {
    id: "apex-consulting",
    name: "Apex Consulting Group",
    category: "Business",
    description: "A premier career preparation organization. We solve real-world business case competitions, offer interview prep, and network with consulting firms.",
    hobbiesMatched: ["business", "finance", "economics", "investing", "consulting", "entrepreneurship", "management"]
  },
  {
    id: "creative-canvas",
    name: "Creative Canvas Society",
    category: "Creative",
    description: "A vibrant space for painters, graphic designers, UI/UX enthusiasts, and digital artists to collaborate on gallery showcases and campus murals.",
    hobbiesMatched: ["painting", "drawing", "design", "art", "music", "crafts", "photography", "videography", "ux", "ui"]
  },
  {
    id: "student-senate",
    name: "Student Senate & Advocacy",
    category: "Leadership",
    description: "Formulate student government policies, organize campus-wide major events, advocate for student rights, and build outstanding leadership portfolios.",
    hobbiesMatched: ["leadership", "politics", "debating", "advocacy", "volunteering", "governance", "community"]
  },
  {
    id: "speakup-toastmasters",
    name: "SpeakUp Toastmasters",
    category: "Communication",
    description: "Master public speaking, speech writing, and professional communication in a warm, encouraging, peer-supported environment.",
    hobbiesMatched: ["speaking", "writing", "communication", "poetry", "acting", "languages", "socializing"]
  }
];

app.post("/api/gemini/match-clubs", async (req, res) => {
  try {
    const { hobbies, clubs } = req.body;
    if (!hobbies || hobbies.trim().length === 0) {
      return res.status(400).json({ error: "Hobbies text is required" });
    }

    const targetClubs = clubs && Array.isArray(clubs) && clubs.length > 0 ? clubs : COLLEGE_CLUBS;

    const systemPrompt = `You are a warm, supportive student life advisor. You are given a list of official college clubs:
${JSON.stringify(targetClubs)}

Your job is to read the student's hobbies and interests, select the top 2 or 3 clubs that match best, and write a custom matching description for each club explaining why it fits their specific hobbies.
Return ONLY a JSON object containing a "matches" array.
Each match MUST have:
- id: Matches the id from the official club list
- name: Full name of the club
- category: The club's category
- matchPercentage: Integer between 0 and 100 representing how well it matches
- reason: A personalized, friendly 2-3 sentence explanation connecting their hobbies to the club's activities

Ensure the output is valid JSON.`;

    const userPrompt = `The student has these hobbies and interests: ${hobbies}`;

    const resultText = await callGemini(systemPrompt, userPrompt, true);
    if (!resultText) {
      throw new Error("No response from Gemini");
    }
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Match clubs error:", error);
    res.status(500).json({ error: error.message || "Failed to match clubs" });
  }
});

// 4. Internship & Resume Reviewer
app.post("/api/gemini/review-resume", async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: "Resume text is required" });
    }

    const systemPrompt = `You are an elite corporate recruiter and career advisor. You will evaluate a student's resume text and return a constructive critique and exactly 3 matched internships (under either Engineering or Business).
Return ONLY a JSON object containing:
- critique: A detailed, highly constructive review of the resume in Markdown format. Outline key Strengths, Areas for Improvement (formatting, action verbs, metrics), and an overall recommendation.
- internships: An array of exactly 3 matched internship listings. Each internship MUST have:
  - id: A unique string (e.g., "int-1")
  - title: Position title (e.g., "Frontend Engineering Intern", "Marketing Analyst Intern")
  - company: Company name (e.g., "Google", "Stripe", "McKinsey", "Tesla")
  - type: Either "engineering" or "business"
  - description: Brief description of the role and what they'll work on
  - skillsRequired: Array of 3-4 key skills needed
  - fitScore: Integer between 60 and 100 based on their resume alignment

Ensure the output is valid JSON with no markdown wrapping around the outer JSON response.`;

    const userPrompt = `Evaluate the following resume text:
${resumeText}`;

    const resultText = await callGemini(systemPrompt, userPrompt, true);
    if (!resultText) {
      throw new Error("No response from Gemini");
    }
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Review resume error:", error);
    res.status(500).json({ error: error.message || "Failed to review resume" });
  }
});

// 5. Achievement Wallet & Certificate Analyzer
app.post("/api/gemini/analyze-certificate", async (req, res) => {
  try {
    const { certName, textContent } = req.body;
    if (!certName) {
      return res.status(400).json({ error: "Certificate name is required" });
    }

    const systemPrompt = `You are a digital credential evaluator. Your job is to analyze an uploaded certificate of completion (name and optionally parsed text content) and map it to college skill categories.
Determine which ONE of the following 5 core skill categories fits the certificate best:
- "Technical" (Programming, Cloud, Data Science, IT)
- "Business" (Finance, Economics, Marketing, Strategy)
- "Creative" (Design, Arts, UI/UX, Video production)
- "Leadership" (Student Government, Management, Organization)
- "Communication" (Speaking, Languages, Writing, Debating)

Return ONLY a JSON object with the following fields:
- certificateName: Official name of the certificate
- skillCategory: One of: "Technical", "Business", "Creative", "Leadership", "Communication"
- pointsAwarded: Integer representing points earned (award between 15 and 30 based on the difficulty or depth)
- feedback: A fun, encouraging 2-sentence congratulatory message highlighting the value of this skill on their resume.
- badgeId: A unique string for the awarded digital badge (e.g., "badge-tech-expert", "badge-biz-strat")

Ensure the output is valid JSON.`;

    const userPrompt = `Analyze this certificate:
Name: ${certName}
Extracted Content: ${textContent || "None provided"}`;

    const resultText = await callGemini(systemPrompt, userPrompt, true);
    if (!resultText) {
      throw new Error("No response from Gemini");
    }
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Analyze certificate error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze certificate" });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE & STATIC ASSET HANDLERS
// ----------------------------------------------------

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
