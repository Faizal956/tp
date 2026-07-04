import React, { useState, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ResumeReview, Internship } from "../types";
import { FileText, UploadCloud, CheckCircle, Sparkles, AlertCircle, RefreshCw, Briefcase, Award, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ResumeReviewerProps {
  userId: string | null;
  reviews: ResumeReview[];
  setReviews: React.Dispatch<React.SetStateAction<ResumeReview[]>>;
}

export default function ResumeReviewer({ userId, reviews, setReviews }: ResumeReviewerProps) {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setResumeText(text);
    };
    reader.onerror = () => {
      setError("Failed to read the file. Please try pasting the text instead.");
    };

    // Since PDF parsing on the client is very heavy, we can read simple txt/md files.
    // For other file types, we can notify that we read the metadata, and pre-fill the raw text editor.
    if (file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
      reader.readAsText(file);
    } else {
      // Prompt student to review or paste text
      setResumeText(
        `[Uploaded: ${file.name}]\n\n* Please copy-paste your plain text resume content here for accurate Gemini review *`
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const submitResumeForReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim()) {
      setError("Please upload a file or paste your resume text first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/gemini/review-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse and evaluate resume.");
      }

      const data = await response.json();

      const newReview: ResumeReview = {
        id: `review-${Date.now()}`,
        critique: data.critique || "Critique analysis failed.",
        internships: data.internships || [],
        fileName: fileName || "Pasted Text",
        createdAt: new Date().toISOString(),
      };

      setReviews((prev) => [newReview, ...prev]);

      if (userId) {
        await setDoc(doc(db, "users", userId, "resume_reviews", newReview.id), newReview);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during critique.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" id="resume-reviewer-view">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left 2 Columns: File upload and Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Resume Reviewer & Recruiter</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Analyze your resume with Gemini for standard recruiter critiques.
                </p>
              </div>
            </div>

            <form onSubmit={submitResumeForReview} className="space-y-4">
              
              {/* Drag & Drop Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerUploadClick}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors relative flex flex-col items-center justify-center ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-indigo-400"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".txt,.md,.pdf,.docx"
                />

                <UploadCloud className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {fileName ? `Selected: ${fileName}` : "Drag & Drop Resume, or Browse"}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Supports .txt, .md, .pdf, or .docx
                </span>
              </div>

              {/* Editable Text Area for Resume Details */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Resume Content (Verify or paste details)
                </label>
                <textarea
                  className="w-full h-44 p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans resize-none placeholder:text-slate-400"
                  placeholder="e.g. John Doe - CS Student. Skills: React, Node.js, Git. Experience: None. Education: State Tech University..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="resume-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reviewing Resume with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Critique Resume & Match
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right 3 Columns: Active analysis / critique / Matched Internships */}
        <div className="lg:col-span-3 space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            Resume Critiques & Placements
          </h3>

          {reviews.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <UploadCloud className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4 animate-bounce" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No resume reviews found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Upload your latest resume document or paste your accomplishments on the left. Gemini will generate structured feedback and select top matched tech internships.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6"
                >
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                        Latest Critique
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-1">
                        File: {review.fileName}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Critique Section */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Constructive Review & Areas of Improvement
                    </h5>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {review.critique}
                    </div>
                  </div>

                  {/* Matched Internships Section */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-indigo-500" />
                      Matched Internship Placements (Curated for you)
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {review.internships.map((job) => (
                        <div
                          key={job.id}
                          className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-100 dark:hover:border-indigo-900 transition-all text-xs"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1 mb-2">
                              <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                {job.type}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3" />
                                {job.fitScore}% fit
                              </span>
                            </div>
                            <h6 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mb-0.5">
                              {job.title}
                            </h6>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mb-2">
                              {job.company}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mb-3">
                              {job.description}
                            </p>
                          </div>

                          <div>
                            <div className="flex flex-wrap gap-1 mt-auto">
                              {job.skillsRequired.map((s, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-100 dark:border-slate-800"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
