import React, { useState, useEffect } from "react";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Assignment, MilestoneStep } from "../types";
import { ListTodo, CheckSquare, Square, Sparkles, Calendar, Plus, Trash2, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AssignmentPlannerProps {
  userId: string | null;
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  initialExpandedId?: string | null;
}

export default function AssignmentPlanner({ userId, assignments, setAssignments, initialExpandedId }: AssignmentPlannerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (initialExpandedId) {
      setExpandedAssignmentId(initialExpandedId);
      setTimeout(() => {
        const el = document.getElementById(`assignment-card-${initialExpandedId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [initialExpandedId]);

  const generateActionPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError("Please fill in the project title and due date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/gemini/breakdown-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, dueDate }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate roadmap.");
      }

      const data = await response.json();
      if (data && Array.isArray(data.steps)) {
        const newAssignment: Assignment = {
          id: `assignment-${Date.now()}`,
          title,
          description,
          dueDate,
          steps: data.steps,
          completed: false,
          createdAt: new Date().toISOString(),
        };

        setAssignments((prev) => [newAssignment, ...prev]);
        setExpandedAssignmentId(newAssignment.id);

        if (userId) {
          await setDoc(doc(db, "users", userId, "assignments", newAssignment.id), newAssignment);
        }

        // Reset fields
        setTitle("");
        setDescription("");
        setDueDate("");
      } else {
        throw new Error("Invalid output format returned by Gemini.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = async (assignmentId: string, stepIndex: number) => {
    setAssignments((prev) =>
      prev.map((item) => {
        if (item.id === assignmentId) {
          const updatedSteps = item.steps.map((step, idx) =>
            idx === stepIndex ? { ...step, completed: !step.completed } : step
          );

          const allCompleted = updatedSteps.every((s) => s.completed);
          const updatedItem = { ...item, steps: updatedSteps, completed: allCompleted };

          if (userId) {
            updateDoc(doc(db, "users", userId, "assignments", assignmentId), {
              steps: updatedSteps,
              completed: allCompleted,
            }).catch((err) => console.error("Error updating step:", err));
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this action plan?")) return;

    setAssignments((prev) => prev.filter((item) => item.id !== assignmentId));

    if (userId) {
      try {
        await deleteDoc(doc(db, "users", userId, "assignments", assignmentId));
      } catch (err) {
        console.error("Error deleting assignment:", err);
      }
    }
  };

  return (
    <div className="space-y-8" id="assignment-planner-view">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 1 Column: Form to enter Project details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Assignment Planner</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Turn overwhelming assignments into bite-sized daily milestones.
              </p>
            </div>
          </div>

          <form onSubmit={generateActionPlan} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Project/Assignment Title
              </label>
              <input
                type="text"
                required
                className="w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Senior Capstone Research Paper"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Project Description / Rubric Guidelines
              </label>
              <textarea
                className="w-full h-24 p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans resize-none placeholder:text-slate-400"
                placeholder="e.g., Write a 10-page paper on artificial intelligence safety. Must include at least 5 citations, introduction, core review, and conclusion."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Final Submission Due Date
              </label>
              <input
                type="date"
                required
                className="w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                {error}
              </p>
            )}

            <button
              id="generate-roadmap-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Rubric...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Break Down with Gemini
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 2 Columns: List of Roadmaps / Active checksheets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-500" />
              Active Project Roadmaps
            </h3>
            <span className="text-xs text-slate-400">
              {assignments.length} Projects Tracked
            </span>
          </div>

          {assignments.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <ListTodo className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4 animate-bounce" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No active roadmap plan</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Enter your upcoming project or essay details on the left, and Gemini will lay out a robust milestone checklist.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const completedSteps = assignment.steps.filter((s) => s.completed).length;
                const totalSteps = assignment.steps.length;
                const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                const isExpanded = expandedAssignmentId === assignment.id;

                return (
                  <div
                    key={assignment.id}
                    id={`assignment-card-${assignment.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div
                      className="p-5 cursor-pointer flex justify-between items-start gap-4"
                      onClick={() => setExpandedAssignmentId(isExpanded ? null : assignment.id)}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                            {assignment.title}
                          </h4>
                          {assignment.completed ? (
                            <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                              Completed
                            </span>
                          ) : (
                            <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                              In Progress ({pct}%)
                            </span>
                          )}
                        </div>
                        {assignment.description && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                            {assignment.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                            Due: {assignment.dueDate}
                          </span>
                          <span>
                            Milestones: {completedSteps} / {totalSteps}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar visual circle */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAssignment(assignment.id);
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress slider bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-1.5 transition-all duration-500 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Collapsible Steps list */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="p-5 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3"
                      >
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Daily Milestone Roadmap & Action Items
                        </h5>

                        <div className="space-y-2">
                          {assignment.steps.map((step, idx) => (
                            <div
                              key={idx}
                              onClick={() => toggleStep(assignment.id, idx)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                step.completed
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-900/20 opacity-75"
                                  : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900"
                              }`}
                            >
                              <button className="mt-0.5 text-slate-400 dark:text-slate-500 shrink-0">
                                {step.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-indigo-500" />
                                )}
                              </button>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                    {step.day} ({step.date})
                                  </span>
                                  <h6
                                    className={`text-sm font-bold ${
                                      step.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                                    }`}
                                  >
                                    {step.task}
                                  </h6>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {step.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
