import React, { useState } from "react";
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Search, 
  Award, 
  Sliders, 
  Sparkles, 
  Building2,
  Trash2,
  ShieldAlert,
  Calendar,
  Filter,
  Check,
  UserCheck
} from "lucide-react";
import { UserReputation, CertificateSubmission } from "../types";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// Mock Student Profile definition
export interface AdminStudentProfile {
  id: string;
  name: string;
  email: string;
  major: string;
  semester: string;
  reputation: UserReputation;
  badges: any[];
}

interface AdminPortalProps {
  userId: string | null;
  user: any;
  reputation: UserReputation;
  setReputation: React.Dispatch<React.SetStateAction<UserReputation>>;
  badges: any[];
  setBadges: React.Dispatch<React.SetStateAction<any[]>>;
  submissions: CertificateSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<CertificateSubmission[]>>;
  clubs: any[];
  setClubs: React.Dispatch<React.SetStateAction<any[]>>;
  isDark: boolean;
}

export default function AdminPortal({
  userId,
  user,
  reputation,
  setReputation,
  badges,
  setBadges,
  submissions,
  setSubmissions,
  clubs,
  setClubs,
  isDark
}: AdminPortalProps) {
  // 1. Local student directory state (seeded with current user + co-curricular peers)
  const [students, setStudents] = useState<AdminStudentProfile[]>([
    {
      id: userId || "guest-alex",
      name: user?.displayName || "Alex Carter",
      email: user?.email || "alex.carter@edu.gp",
      major: "Software Engineering",
      semester: "Sem 8",
      reputation: reputation,
      badges: badges
    },
    {
      id: "stud-2",
      name: "Sarah Lin",
      email: "sarah.lin@edu.gp",
      major: "Interactive UI/UX Design",
      semester: "Sem 6",
      reputation: { Technical: 50, Business: 65, Creative: 85, Leadership: 40, Communication: 75 },
      badges: [
        { id: "b1", name: "Figma Champion", category: "Creative", description: "Design Lead", dateEarned: "6/12/2026" }
      ]
    },
    {
      id: "stud-3",
      name: "Marcus Vance",
      email: "marcus.vance@edu.gp",
      major: "Business Economics & FinTech",
      semester: "Sem 8",
      reputation: { Technical: 45, Business: 80, Creative: 35, Leadership: 90, Communication: 85 },
      badges: [
        { id: "b2", name: "Case Study Winner", category: "Business", description: "1st Place Business Hack", dateEarned: "5/20/2026" }
      ]
    },
    {
      id: "stud-4",
      name: "Deepak Mehta",
      email: "deepak.mehta@edu.gp",
      major: "Data Science & AI",
      semester: "Sem 4",
      reputation: { Technical: 90, Business: 40, Creative: 30, Leadership: 50, Communication: 60 },
      badges: []
    }
  ]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(userId || "guest-alex");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<"moderation" | "students" | "clubs">("moderation");

  // Rejection explanation modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Create custom club form state
  const [newClubName, setNewClubName] = useState("");
  const [newClubCat, setNewClubCat] = useState("Technical");
  const [newClubDesc, setNewClubDesc] = useState("");
  const [newClubKeywords, setNewClubKeywords] = useState("");
  const [clubSuccessMsg, setClubSuccessMsg] = useState("");

  // Find currently selected student
  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // Helper to sync modified student reputation back to root states if editing current user
  const updateStudentReputation = (studentId: string, updatedRep: UserReputation) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, reputation: updatedRep } : s));
    if (studentId === (userId || "guest-alex")) {
      setReputation(updatedRep);
      if (userId) {
        updateDoc(doc(db, "users", userId), { reputation: updatedRep }).catch(console.error);
      }
    }
  };

  const updateStudentBadges = (studentId: string, updatedBadges: any[]) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, badges: updatedBadges } : s));
    if (studentId === (userId || "guest-alex")) {
      setBadges(updatedBadges);
      if (userId) {
        updateDoc(doc(db, "users", userId), { badges: updatedBadges }).catch(console.error);
      }
    }
  };

  // 2. Moderation Action: Approve Certificate Submission
  const handleApprove = async (sub: CertificateSubmission) => {
    // A. Update submission status in state
    setSubmissions(prev => prev.map(item => item.id === sub.id ? { ...item, status: "approved" } : item));

    // Update in Firestore
    if (userId) {
      await updateDoc(doc(db, "certificate_submissions", sub.id), { status: "approved" }).catch(console.error);
    }

    // B. Find target student profiles (especially the active user!) and award points
    const targetStudentId = sub.studentId || userId || "guest-alex";
    const targetStudent = students.find(s => s.id === targetStudentId);

    if (targetStudent) {
      const cat = sub.skillCategory;
      const pts = Number(sub.pointsAwarded) || 20;
      
      const newRep = {
        ...targetStudent.reputation,
        [cat]: Math.min(100, (targetStudent.reputation[cat] || 0) + pts)
      };

      // Create co-curricular badge
      const newBadge = {
        id: `badge-${Date.now()}`,
        name: sub.certificateName,
        category: cat,
        description: sub.feedback || "Verified co-curricular competency.",
        icon: sub.badgeId || "badge-expert",
        dateEarned: new Date().toLocaleDateString()
      };

      const newBadgesList = [newBadge, ...targetStudent.badges];

      updateStudentReputation(targetStudentId, newRep);
      updateStudentBadges(targetStudentId, newBadgesList);
    }
  };

  // 3. Moderation Action: Reject Certificate Submission
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;

    const currentRejectReason = rejectReason || "Credential image/information could not be validated.";

    // Update state
    setSubmissions(prev => prev.map(item => 
      item.id === rejectingId 
        ? { ...item, status: "rejected", rejectionReason: currentRejectReason } 
        : item
    ));

    // Update in Firestore
    if (userId) {
      await updateDoc(doc(db, "certificate_submissions", rejectingId), { 
        status: "rejected", 
        rejectionReason: currentRejectReason 
      }).catch(console.error);
    }

    setRejectingId(null);
    setRejectReason("");
  };

  // 4. Manual Score Overrides (by sliders in Student detail view)
  const handleManualScoreChange = (category: keyof UserReputation, val: number) => {
    const updatedRep = {
      ...activeStudent.reputation,
      [category]: val
    };
    updateStudentReputation(activeStudent.id, updatedRep);
  };

  // 5. Add Custom Official Campus Club
  const handleCreateClub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName.trim() || !newClubDesc.trim()) return;

    const keywordsArray = newClubKeywords
      .toLowerCase()
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const newClub = {
      id: `custom-club-${Date.now()}`,
      name: newClubName,
      category: newClubCat,
      description: newClubDesc,
      hobbiesMatched: keywordsArray.length > 0 ? keywordsArray : [newClubName.toLowerCase()]
    };

    setClubs(prev => [newClub, ...prev]);
    setClubSuccessMsg(`"${newClubName}" has been successfully added to the University Club Register!`);
    
    // Reset form
    setNewClubName("");
    setNewClubDesc("");
    setNewClubKeywords("");

    setTimeout(() => {
      setClubSuccessMsg("");
    }, 4000);
  };

  // Delete dynamic club
  const handleDeleteClub = (clubId: string) => {
    setClubs(prev => prev.filter(c => c.id !== clubId));
  };

  // Filter students based on search
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.major.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Recharts Radar Chart Setup
  const radarData = [
    { subject: "Technical", value: activeStudent.reputation.Technical, fullMark: 100 },
    { subject: "Business", value: activeStudent.reputation.Business, fullMark: 100 },
    { subject: "Creative", value: activeStudent.reputation.Creative, fullMark: 100 },
    { subject: "Leadership", value: activeStudent.reputation.Leadership, fullMark: 100 },
    { subject: "Communication", value: activeStudent.reputation.Communication, fullMark: 100 }
  ];

  return (
    <div className="space-y-8" id="admin-portal-dashboard">
      
      {/* 1. Admin Header Welcome */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <h2 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">
              Campus Administration Hub
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Welcome, System Administrator. Moderate incoming student academic claims, adjust student badge credentials in real-time, and manage the official college campus clubs catalog.
          </p>
        </div>

        {/* Dynamic Key Performance Indicators (KPIs) */}
        <div className="flex flex-wrap gap-4 border-t md:border-t-0 md:border-l border-slate-200/60 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Managed Roster</span>
            <strong className="text-lg font-bold text-slate-800 dark:text-slate-100 font-display">
              {students.length} Students
            </strong>
          </div>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Pending Claims</span>
            <strong className="text-lg font-bold text-amber-600 dark:text-amber-400 font-display">
              {submissions.filter(s => s.status === "pending").length} Claims
            </strong>
          </div>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Catalogued Clubs</span>
            <strong className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-display">
              {clubs.length} Clubs
            </strong>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex gap-2.5 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveAdminTab("moderation")}
          className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
            activeAdminTab === "moderation"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Credential Verification ({submissions.filter(s => s.status === "pending").length})
        </button>
        <button
          onClick={() => setActiveAdminTab("students")}
          className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
            activeAdminTab === "students"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Student Directory & Skills Slider
        </button>
        <button
          onClick={() => setActiveAdminTab("clubs")}
          className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
            activeAdminTab === "clubs"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Manage College Clubs
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        
        {/* PANEL 1: CREDENTIAL MODERATION */}
        {activeAdminTab === "moderation" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                Co-Curricular Claim verification queue
              </h3>

              {submissions.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Award className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Certifications Submitted Yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    When students upload co-curricular certificates from their dashboards, they will appear here in the moderation pool.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions.map((sub) => {
                    const studentProfile = students.find(s => s.id === sub.studentId) || students[0];
                    return (
                      <div key={sub.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                              {sub.skillCategory}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(sub.createdAt).toLocaleDateString()}
                            </span>
                            {sub.status === "approved" && (
                              <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5" /> Approved
                              </span>
                            )}
                            {sub.status === "rejected" && (
                              <span className="text-[9px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <XCircle className="w-2.5 h-2.5" /> Rejected
                              </span>
                            )}
                            {sub.status === "pending" && (
                              <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded animate-pulse">
                                Pending Verification
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {sub.certificateName}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Submitted by: <strong className="text-slate-600 dark:text-slate-300">{sub.studentName || studentProfile.name}</strong> ({studentProfile.major})
                          </p>
                          <p className="text-[10px] text-indigo-600/90 dark:text-indigo-400/90 italic">
                            Gemini AI Recommendation: Recommended <strong className="text-indigo-600 dark:text-indigo-300">+{sub.pointsAwarded} pts</strong> under {sub.skillCategory}
                          </p>
                          {sub.rejectionReason && (
                            <p className="text-[10px] text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900/30">
                              <strong>Rejection Reason:</strong> {sub.rejectionReason}
                            </p>
                          )}
                        </div>

                        {/* Verification Controls */}
                        {sub.status === "pending" && (
                          <div className="flex gap-2 shrink-0 self-start md:self-auto">
                            <button
                              onClick={() => setRejectingId(sub.id)}
                              className="px-2.5 py-1.5 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(sub)}
                              className="px-3 py-1.5 bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-colors shadow-sm"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve & Grant Badge
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reject Form Modal */}
            {rejectingId && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reject Co-Curricular Claim</h3>
                  <form onSubmit={handleRejectSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                        Reason for Rejection
                      </label>
                      <textarea
                        required
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 outline-none"
                        placeholder="e.g. Uploaded file is corrupt, or does not clearly display student name/completion date."
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-[10px] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-[10px] font-bold"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* PANEL 2: STUDENT DIRECTORY & LIVE OVERRIDES */}
        {activeAdminTab === "students" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Student list sidebar (Col 1-5) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col h-[550px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students or majors..."
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredStudents.map((stud) => {
                  const isSel = stud.id === selectedStudentId;
                  return (
                    <button
                      key={stud.id}
                      onClick={() => setSelectedStudentId(stud.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isSel 
                          ? "border-indigo-600 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20" 
                          : "border-slate-100 hover:border-slate-200 dark:border-slate-850 dark:hover:border-slate-800 bg-white dark:bg-slate-900/50"
                      }`}
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {stud.name}
                          {stud.id === (userId || "guest-alex") && (
                            <span className="text-[8px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </h4>
                        <p className="text-[9px] text-slate-400 block truncate max-w-[180px]">
                          {stud.major} • {stud.semester}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {Object.values(stud.reputation).reduce((a: number, b: number) => a + b, 0)} pts
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student detail & radar modifiers (Col 6-12) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[550px]">
              <div className="space-y-6">
                
                {/* Header profile info */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-display">
                      {activeStudent.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 block">
                      {activeStudent.email} • {activeStudent.major} ({activeStudent.semester})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {activeStudent.badges.map((b, idx) => (
                      <span 
                        key={idx} 
                        className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30 flex items-center justify-center text-xs text-amber-600"
                        title={b.name}
                      >
                        🏆
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Radar graph representing student scores */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Reputation Radar Shape
                    </span>
                    <div className="w-full h-44 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                          <PolarGrid stroke={isDark ? "#334155" : "#e2e8f0"} />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 9, fontWeight: "semibold" }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: "#64748b", fontSize: 8 }}
                          />
                          <Radar
                            name="Reputation"
                            dataKey="value"
                            stroke="#5a6a50"
                            fill="#a5b69c"
                            fillOpacity={0.4}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Slider Controls */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Edit Skill Points Weight
                    </span>
                    <div className="space-y-3">
                      {Object.entries(activeStudent.reputation).map(([category, value]) => {
                        const catKey = category as keyof UserReputation;
                        return (
                          <div key={category} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{category}</span>
                              <strong className="text-slate-500 dark:text-slate-400">{value} / 100</strong>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={value}
                              onChange={(e) => handleManualScoreChange(catKey, Number(e.target.value))}
                              className="w-full accent-indigo-600 bg-slate-100 dark:bg-slate-950 h-1 rounded-full cursor-pointer appearance-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

              {/* Special Badge awarding hub */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                  Award Special Honorary Badge
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const newB = { id: `badge-${Date.now()}`, name: "Dean's List Award", category: "Leadership", description: "Awarded by Administrator.", dateEarned: new Date().toLocaleDateString() };
                      updateStudentBadges(activeStudent.id, [newB, ...activeStudent.badges]);
                    }}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-all"
                  >
                    🏆 Dean's Scholar Badge
                  </button>
                  <button
                    onClick={() => {
                      const newB = { id: `badge-${Date.now()}`, name: "Hackathon Champion", category: "Technical", description: "Superlative tech mastery.", dateEarned: new Date().toLocaleDateString() };
                      updateStudentBadges(activeStudent.id, [newB, ...activeStudent.badges]);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-850 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-all"
                  >
                    💻 AI Innovation Badge
                  </button>
                  <button
                    onClick={() => {
                      const newB = { id: `badge-${Date.now()}`, name: "Public Speaking Laureate", category: "Communication", description: "Unrivaled oral communicator.", dateEarned: new Date().toLocaleDateString() };
                      updateStudentBadges(activeStudent.id, [newB, ...activeStudent.badges]);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-all"
                  >
                    🗣️ Master Orator Badge
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* PANEL 3: CLUB MANAGER */}
        {activeAdminTab === "clubs" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Club Register Form (Col 1-5) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-500" />
                Register New College Club
              </h3>

              {clubSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold rounded-xl border border-emerald-200/50 dark:border-emerald-900/40 animate-fade-in flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>{clubSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateClub} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Club Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Autonomous Robotics Society"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Primary Domain Category
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={newClubCat}
                    onChange={(e) => setNewClubCat(e.target.value)}
                  >
                    <option value="Technical">Technical</option>
                    <option value="Business">Business</option>
                    <option value="Creative">Creative</option>
                    <option value="Leadership">Leadership</option>
                    <option value="Communication">Communication</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Club Description
                  </label>
                  <textarea
                    required
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="Provide a compelling 2-3 sentence overview of the club goals, meeting days, and key events..."
                    rows={3}
                    value={newClubDesc}
                    onChange={(e) => setNewClubDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Match Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. robotics, programming, automation, electronics"
                    value={newClubKeywords}
                    onChange={(e) => setNewClubKeywords(e.target.value)}
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block">
                    These terms are used by the Gemini Matchmaker API to rank this club against student profiles.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
                >
                  Register Official Club
                </button>
              </form>
            </div>

            {/* Club Directory Table (Col 6-12) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[550px]">
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Official College Clubs Database ({clubs.length})
                </h3>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                  {clubs.map((c) => (
                    <div 
                      key={c.id} 
                      className="p-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-850 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {c.name}
                          </h4>
                          <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                            {c.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {c.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {c.hobbiesMatched.map((tag: string, tIdx: number) => (
                            <span 
                              key={tIdx} 
                              className="text-[8px] bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteClub(c.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                        title="Remove Club"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
