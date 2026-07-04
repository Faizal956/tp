export interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  days: string[];
  time: string;
  instructor: string;
  room: string;
  attended: number;
  total: number;
}

export interface MilestoneStep {
  day: string;
  date: string;
  task: string;
  description: string;
  completed: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  steps: MilestoneStep[];
  completed: boolean;
  createdAt: string;
}

export interface ClubMatch {
  id: string;
  name: string;
  category: string;
  matchPercentage: number;
  reason: string;
}

export interface Internship {
  id: string;
  title: string;
  company: string;
  type: "engineering" | "business";
  description: string;
  skillsRequired: string[];
  fitScore: number;
}

export interface ResumeReview {
  id: string;
  critique: string;
  internships: Internship[];
  fileName?: string;
  createdAt: string;
}

export interface CertificateSubmission {
  id: string;
  certificateName: string;
  skillCategory: "Technical" | "Business" | "Creative" | "Leadership" | "Communication";
  pointsAwarded: number;
  feedback: string;
  badgeId: string;
  createdAt: string;
  status?: "pending" | "approved" | "rejected";
  studentName?: string;
  studentId?: string;
  rejectionReason?: string;
}

export interface UserReputation {
  Technical: number;
  Business: number;
  Creative: number;
  Leadership: number;
  Communication: number;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  reputation: UserReputation;
  badges: { id: string; name: string; icon: string; category: string; description: string; dateEarned: string }[];
}
