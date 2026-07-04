import React, { useState } from "react";
import { doc, setDoc, collection, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Course } from "../types";
import { Calendar, Check, AlertCircle, Sparkles, BookOpen, Plus, Minus, Trash2, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AttendanceDashboardProps {
  userId: string | null;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
}

export default function AttendanceDashboard({ userId, courses, setCourses }: AttendanceDashboardProps) {
  const [syllabusText, setSyllabusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual course creation state
  const [showManual, setShowManual] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [newInstructor, setNewInstructor] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [newTotal, setNewTotal] = useState(30);

  const toggleDaySelection = (day: string) => {
    if (newDays.includes(day)) {
      setNewDays(newDays.filter((d) => d !== day));
    } else {
      setNewDays([...newDays, day]);
    }
  };

  const parseSyllabus = async () => {
    if (!syllabusText.trim()) {
      setError("Please paste some text first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/gemini/parse-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: syllabusText }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse syllabus");
      }

      const data = await response.json();
      if (data && Array.isArray(data.courses)) {
        const parsedCourses: Course[] = data.courses.map((c: any, i: number) => ({
          id: c.id || `course-${Date.now()}-${i}`,
          courseCode: c.courseCode || "N/A",
          courseName: c.courseName || "Untitled Course",
          days: Array.isArray(c.days) ? c.days : ["Monday"],
          time: c.time || "TBA",
          instructor: c.instructor || "Professor",
          room: c.room || "TBA",
          attended: Number(c.attended) || 0,
          total: Number(c.total) || 30,
        }));

        // Update state
        setCourses((prev) => {
          const merged = [...prev];
          parsedCourses.forEach((pc) => {
            if (!merged.some((m) => m.courseCode === pc.courseCode && m.courseName === pc.courseName)) {
              merged.push(pc);
            }
          });
          return merged;
        });

        // Save to Firestore if user is authenticated
        if (userId) {
          for (const c of parsedCourses) {
            await setDoc(doc(db, "users", userId, "schedule", c.id), c);
          }
        }

        setSuccessMsg(`Successfully parsed and added ${parsedCourses.length} courses!`);
        setSyllabusText("");
      } else {
        throw new Error("Invalid output format returned by Gemini.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while parsing.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCourse: Course = {
      id: `course-${Date.now()}`,
      courseCode: newCode || "N/A",
      courseName: newName,
      days: newDays.length > 0 ? newDays : ["Monday"],
      time: newTime || "TBA",
      instructor: newInstructor || "TBA",
      room: newRoom || "TBA",
      attended: 0,
      total: newTotal,
    };

    setCourses((prev) => [...prev, newCourse]);

    if (userId) {
      try {
        await setDoc(doc(db, "users", userId, "schedule", newCourse.id), newCourse);
      } catch (err) {
        console.error("Error saving manual course:", err);
      }
    }

    // Reset Form
    setNewCode("");
    setNewName("");
    setNewDays([]);
    setNewTime("");
    setNewInstructor("");
    setNewRoom("");
    setNewTotal(30);
    setShowManual(false);
  };

  const handleUpdateAttendance = async (courseId: string, delta: number) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id === courseId) {
          const updatedAttended = Math.max(0, Math.min(c.total, c.attended + delta));
          const updated = { ...c, attended: updatedAttended };

          if (userId) {
            updateDoc(doc(db, "users", userId, "schedule", courseId), {
              attended: updatedAttended,
            }).catch((err) => console.error("Error updating attendance:", err));
          }

          return updated;
        }
        return c;
      })
    );
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    setCourses((prev) => prev.filter((c) => c.id !== courseId));

    if (userId) {
      try {
        await deleteDoc(doc(db, "users", userId, "schedule", courseId));
      } catch (err) {
        console.error("Error deleting course:", err);
      }
    }
  };

  // Quick helper to render custom SVG attendance rings
  const renderProgressRing = (attended: number, total: number) => {
    const percentage = total > 0 ? (attended / total) * 100 : 0;
    const radius = 34;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Define colors depending on target thresholds (75% standard attendance requirement)
    const strokeColor = percentage >= 75 ? "stroke-emerald-500" : percentage >= 50 ? "stroke-amber-500" : "stroke-rose-500";
    const bgRingColor = percentage >= 75 ? "stroke-emerald-100 dark:stroke-emerald-950" : percentage >= 50 ? "stroke-amber-100 dark:stroke-amber-950" : "stroke-rose-100 dark:stroke-rose-950";

    return (
      <div className="relative flex items-center justify-center" id={`progress-ring-${radius}`}>
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            className={`${bgRingColor} transition-colors duration-300`}
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            className={`${strokeColor} transition-all duration-500 ease-out`}
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{Math.round(percentage)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8" id="attendance-view-container">
      {/* Upper Grid - Text Parsing and Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Pasting Syllabus / timetable */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Timetable & Syllabus Parser</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste course tables, email timetables, or raw syllabus schedules. Gemini will auto-generate class details.
                </p>
              </div>
            </div>

            <textarea
              className="w-full h-44 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans resize-none placeholder:text-slate-400"
              placeholder={`Example:
CS 312 Intro to AI | Tuesdays & Thursdays 11:00 AM - 12:30 PM | Prof. Johnson | room 405
MATH 291 Linear Algebra - MWF 9:00 AM | Hall B | TA Smith
Syllabus rules: Total classes: 32...`}
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              disabled={loading}
            />

            {error && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              id="parse-syllabus-btn"
              onClick={parseSyllabus}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Timetable with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Parse Timetable
                </>
              )}
            </button>
            <button
              onClick={() => setShowManual(!showManual)}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {showManual ? "Cancel" : "Add Course"}
            </button>
          </div>
        </div>

        {/* Right 1 Column: Manual Addition Form or Core Requirement Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <AnimatePresence mode="wait">
            {showManual ? (
              <motion.form
                key="manual-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleAddManualCourse}
                className="space-y-4"
              >
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-100">Add Custom Class</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Course Code"
                    className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Course Name"
                    required
                    className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Class Schedule Days</span>
                  <div className="flex gap-1">
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => {
                      const isSel = newDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => toggleDaySelection(day)}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors ${
                            isSel ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Time (e.g., 2:00 PM - 3:30 PM)"
                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Instructor"
                    className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Room (e.g. Hall 4)"
                    className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Total Classes in Term ({newTotal})</label>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    className="w-full accent-indigo-600"
                    value={newTotal}
                    onChange={(e) => setNewTotal(Number(e.target.value))}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-xl transition-all"
                >
                  Save Class
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="insight-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 h-full flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-md font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-emerald-500" />
                    Attendance Rules
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Most institutions require at least <strong className="text-slate-700 dark:text-slate-300">75% attendance</strong> to remain eligible for term examinations. Keep your rings green!
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Classes Loaded:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{courses.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Green Rings (&gt;75%):</span>
                    <span className="font-bold text-emerald-500">
                      {courses.filter((c) => c.total > 0 && (c.attended / c.total) >= 0.75).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Critically Low (&lt;50%):</span>
                    <span className="font-bold text-rose-500">
                      {courses.filter((c) => c.total > 0 && (c.attended / c.total) < 0.5).length}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 text-center leading-relaxed italic">
                  "Syllabus parse details are synchronized securely to Firestore."
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Courses Schedule Attendance Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Interactive Attendance Sheets & Rings
          </h2>
          <span className="text-xs text-slate-400">
            {courses.length} Classes Tracked
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4 animate-bounce" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No classes loaded yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Paste your raw term timetable or syllabus into the textbox above, or manually add a class to begin monitoring your attendance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const attendancePercent = course.total > 0 ? (course.attended / course.total) * 100 : 0;
              return (
                <motion.div
                  key={course.id}
                  layoutId={course.id}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1 pr-4">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-md">
                        {course.courseCode}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
                        {course.courseName}
                      </h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <span className="font-semibold">{course.room}</span> • {course.instructor}
                      </p>
                    </div>
                    {/* Visual Progress ring */}
                    {renderProgressRing(course.attended, course.total)}
                  </div>

                  <div className="border-t border-slate-50 dark:border-slate-800 pt-4 flex justify-between items-center text-xs">
                    <div className="text-slate-500 dark:text-slate-400">
                      Sessions: <strong className="text-slate-800 dark:text-slate-200 font-bold">{course.attended}</strong> / {course.total}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateAttendance(course.id, -1)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors border border-slate-100 dark:border-slate-800"
                        title="Mark Absent"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUpdateAttendance(course.id, 1)}
                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-lg transition-colors border border-slate-100 dark:border-slate-800"
                        title="Mark Attended"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 rounded-lg transition-colors border border-slate-100 dark:border-slate-800 ml-1"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Day schedule chips */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {course.days.map((d, index) => (
                      <span
                        key={index}
                        className="text-[10px] bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-medium"
                      >
                        {d}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1.5 py-0.5 ml-auto">
                      {course.time}
                    </span>
                  </div>

                  {/* Attendance status banner */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-600" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
