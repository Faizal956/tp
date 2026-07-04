import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { auth, db, googleProvider } from "./lib/firebase";
import { Course, Assignment, ResumeReview, UserReputation, UserProfile, CertificateSubmission } from "./types";

// Import modular components
import AttendanceDashboard from "./components/AttendanceDashboard";
import AssignmentPlanner from "./components/AssignmentPlanner";
import ClubDiscovery from "./components/ClubDiscovery";
import ResumeReviewer from "./components/ResumeReviewer";
import AchievementWallet from "./components/AchievementWallet";
import AdminPortal from "./components/AdminPortal";

// Icons
import {
  CalendarRange,
  ListTodo,
  Compass,
  FileText,
  Award,
  Sun,
  Moon,
  LogIn,
  LogOut,
  User,
  GraduationCap,
  CloudLightning,
  ShieldAlert,
  Search,
  Wallet,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  hasMetaMask,
  connectWallet,
  switchToMonadTestnet,
} from "./lib/web3";

export default function App() {
  const [role, setRole] = useState<"student" | "admin">("student");
  const [activeTab, setActiveTab] = useState<"attendance" | "assignments" | "clubs" | "resume" | "reputation">("attendance");
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Custom Role Verification States
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminPasscodeError, setAdminPasscodeError] = useState("");

  // Web3 Monad states
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isMonadTestnet, setIsMonadTestnet] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSimulatedWallet, setIsSimulatedWallet] = useState(false);
  const [web3Error, setWeb3Error] = useState<string | null>(null);

  // Core synchronized states
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resumeReviews, setResumeReviews] = useState<ResumeReview[]>([]);
  const [reputation, setReputation] = useState<UserReputation>({
    Technical: 30,
    Business: 20,
    Creative: 25,
    Leadership: 15,
    Communication: 20,
  });
  const [badges, setBadges] = useState<any[]>([]);

  // System-wide co-curricular certificate claims (moderation queue)
  const [submissions, setSubmissions] = useState<CertificateSubmission[]>([]);

  // Shared clubs directory
  const [clubs, setClubs] = useState<any[]>([
    {
      id: "club-coding",
      name: "Turing Cryptography & Algorithms Club",
      category: "Technical",
      description: "Focuses on competitive programming, secure coding, web systems, and high-performance algorithms.",
      hobbiesMatched: ["programming", "coding", "software", "algorithms", "web", "hacking"]
    },
    {
      id: "club-entrepreneur",
      name: "Apex Venture & Consulting Group",
      category: "Business",
      description: "Mentoring student startups, business design planning, VC pitches, case studies, and corporate strategies.",
      hobbiesMatched: ["business", "startup", "entrepreneurship", "marketing", "finance", "strategy"]
    },
    {
      id: "club-design",
      name: "Sonder Interactive Design Hub",
      category: "Creative",
      description: "Exploring UI/UX systems, industrial models, graphic arts, generative motion, and architectural design styles.",
      hobbiesMatched: ["design", "art", "drawing", "illustration", "ui", "ux", "fashion"]
    },
    {
      id: "club-toastmasters",
      name: "Socrates Oratorical Forum",
      category: "Communication",
      description: "Improving public speaking, debate resolutions, persuasive pitches, speechcraft, and negotiation systems.",
      hobbiesMatched: ["debate", "speaking", "podcasting", "writing", "english", "pitching"]
    },
    {
      id: "club-rotary",
      name: "Pinnacle Leadership Council",
      category: "Leadership",
      description: "Student government, civic engagement systems, team management, and global diplomatic delegations.",
      hobbiesMatched: ["politics", "management", "organizing", "community", "leadership", "planning"]
    }
  ]);

  // Global search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<string | null>(null);
  const [highlightedClub, setHighlightedClub] = useState<any | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // 1. Theme handler
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  // Web3 MetaMask Listeners & Lifecycle handlers
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      
      const handleAccounts = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletAddress(null);
          setWalletBalance(null);
          setIsWalletConnected(false);
          setIsMonadTestnet(false);
          setIsSimulatedWallet(false);
        } else {
          setWalletAddress(accounts[0]);
          setIsWalletConnected(true);
          connectWallet()
            .then((res) => {
              setWalletBalance(res.balance);
              setWalletChainId(res.chainId);
              setIsMonadTestnet(res.isMonadTestnet);
            })
            .catch(console.error);
        }
      };

      const handleChain = (chainIdHex: string) => {
        const decId = parseInt(chainIdHex, 16);
        setWalletChainId(decId);
        setIsMonadTestnet(decId === 10143);
        connectWallet()
          .then((res) => {
            setWalletBalance(res.balance);
          })
          .catch(console.error);
      };

      ethereum.on("accountsChanged", handleAccounts);
      ethereum.on("chainChanged", handleChain);

      // Check if already authorized
      ethereum.request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            handleAccounts(accounts);
          }
        })
        .catch(console.error);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("accountsChanged", handleAccounts);
          ethereum.removeListener("chainChanged", handleChain);
        }
      };
    }
  }, []);

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setWeb3Error(null);
    try {
      if (hasMetaMask()) {
        const state = await connectWallet();
        setWalletAddress(state.address);
        setWalletBalance(state.balance);
        setWalletChainId(state.chainId);
        setIsWalletConnected(true);
        setIsMonadTestnet(state.isMonadTestnet);
        setIsSimulatedWallet(false);
        
        // Auto-switch to Monad Testnet if connected on incorrect chain
        if (!state.isMonadTestnet) {
          const switched = await switchToMonadTestnet();
          if (switched) {
            setIsMonadTestnet(true);
            setWalletChainId(10143);
            const updated = await connectWallet();
            setWalletBalance(updated.balance);
          }
        }
      } else {
        // High fidelity sandbox simulator
        setIsSimulatedWallet(true);
        setWalletAddress("0x7099...3913 (Sandbox)");
        setWalletBalance("45.2850");
        setWalletChainId(10143);
        setIsWalletConnected(true);
        setIsMonadTestnet(true);
      }
    } catch (err: any) {
      setWeb3Error(err?.message || "Wallet connection rejected.");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    setWalletChainId(null);
    setIsWalletConnected(false);
    setIsMonadTestnet(false);
    setIsSimulatedWallet(false);
    setWeb3Error(null);
  };

  const handleSwitchNetwork = async () => {
    if (isSimulatedWallet) {
      setIsMonadTestnet(true);
      setWalletChainId(10143);
      return;
    }
    const success = await switchToMonadTestnet();
    if (success) {
      setIsMonadTestnet(true);
      setWalletChainId(10143);
      if (hasMetaMask()) {
        const updated = await connectWallet();
        setWalletBalance(updated.balance);
      }
    }
  };

  const isAuthorizedAdmin = (u: any) => {
    if (!u) return false;
    return u.uid === "demo-admin-uid" || u.email === "admin@campushub.edu" || u.email === "shaikhfirdos357@gmail.com";
  };

  const handleTrySwitchAdmin = () => {
    if (isAuthorizedAdmin(user)) {
      setRole("admin");
    } else {
      setIsAdminModalOpen(true);
      setAdminPasscode("");
      setAdminPasscodeError("");
    }
  };

  // 2. Auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingUser(true);
      if (currentUser) {
        setUser(currentUser);
        // Fetch user document
        await loadUserData(currentUser.uid);
      } else {
        setUser(null);
        // Load fallback from localStorage if any
        loadLocalStorageData();
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Load user data from Firestore
  const loadUserData = async (uid: string) => {
    try {
      // Fetch reputation profile
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      const isSystemAdmin = auth.currentUser?.email === "shaikhfirdos357@gmail.com" || auth.currentUser?.email === "admin@campushub.edu" || uid === "demo-admin-uid";

      if (userSnap.exists()) {
        const udata = userSnap.data();
        if (udata.reputation) setReputation(udata.reputation);
        if (udata.badges) setBadges(udata.badges);
        
        // Auto-assign admin mode if system admin, or restore their role
        const assignedRole = isSystemAdmin ? "admin" : (udata.role || "student");
        setRole(assignedRole);
      } else {
        // Initialize user document in Firestore
        const initialProfile = {
          uid,
          displayName: auth.currentUser?.displayName || "Student",
          email: auth.currentUser?.email || "",
          photoURL: auth.currentUser?.photoURL || "",
          reputation: { Technical: 30, Business: 20, Creative: 25, Leadership: 15, Communication: 20 },
          badges: [],
          role: isSystemAdmin ? "admin" : "student",
        };
        await setDoc(userRef, initialProfile);
        setRole(isSystemAdmin ? "admin" : "student");
      }

      // Fetch schedules
      const schedRef = collection(db, "users", uid, "schedule");
      const schedSnap = await getDocs(schedRef);
      const schedList: Course[] = [];
      schedSnap.forEach((doc) => {
        schedList.push(doc.data() as Course);
      });
      setCourses(schedList);

      // Fetch assignments
      const assRef = collection(db, "users", uid, "assignments");
      const assSnap = await getDocs(assRef);
      const assList: Assignment[] = [];
      assSnap.forEach((doc) => {
        assList.push(doc.data() as Assignment);
      });
      // Sort assignments by date
      assList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssignments(assList);

      // Fetch reviews
      const revRef = collection(db, "users", uid, "resume_reviews");
      const revSnap = await getDocs(revRef);
      const revList: ResumeReview[] = [];
      revSnap.forEach((doc) => {
        revList.push(doc.data() as ResumeReview);
      });
      setResumeReviews(revList);

      // Fetch certificate submissions queue from root
      const subRef = collection(db, "certificate_submissions");
      const subSnap = await getDocs(subRef);
      const subList: CertificateSubmission[] = [];
      subSnap.forEach((doc) => {
        subList.push({ id: doc.id, ...doc.data() } as CertificateSubmission);
      });
      setSubmissions(subList);
    } catch (err) {
      console.error("Error loading user cloud details:", err);
      loadLocalStorageData();
    }
  };

  // Local storage fallback for guests
  const loadLocalStorageData = () => {
    const storedCourses = localStorage.getItem("ai_campus_courses");
    const storedAssignments = localStorage.getItem("ai_campus_assignments");
    const storedReviews = localStorage.getItem("ai_campus_reviews");
    const storedReputation = localStorage.getItem("ai_campus_reputation");
    const storedBadges = localStorage.getItem("ai_campus_badges");
    const storedSubmissions = localStorage.getItem("ai_campus_submissions");
    const storedClubs = localStorage.getItem("ai_campus_clubs");

    if (storedCourses) setCourses(JSON.parse(storedCourses));
    else setCourses([]);

    if (storedAssignments) setAssignments(JSON.parse(storedAssignments));
    else setAssignments([]);

    if (storedReviews) setResumeReviews(JSON.parse(storedReviews));
    else setResumeReviews([]);

    if (storedReputation) setReputation(JSON.parse(storedReputation));
    else setReputation({ Technical: 30, Business: 20, Creative: 25, Leadership: 15, Communication: 20 });

    if (storedBadges) setBadges(JSON.parse(storedBadges));
    else setBadges([]);

    if (storedSubmissions) setSubmissions(JSON.parse(storedSubmissions));
    else setSubmissions([]);

    if (storedClubs) setClubs(JSON.parse(storedClubs));
  };

  // Sync state back to local storage for offline support and persistence backup
  useEffect(() => {
    localStorage.setItem("ai_campus_courses", JSON.stringify(courses));
    localStorage.setItem("ai_campus_assignments", JSON.stringify(assignments));
    localStorage.setItem("ai_campus_reviews", JSON.stringify(resumeReviews));
    localStorage.setItem("ai_campus_reputation", JSON.stringify(reputation));
    localStorage.setItem("ai_campus_badges", JSON.stringify(badges));
    localStorage.setItem("ai_campus_submissions", JSON.stringify(submissions));
    localStorage.setItem("ai_campus_clubs", JSON.stringify(clubs));
  }, [courses, assignments, resumeReviews, reputation, badges, submissions, clubs]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Authentication popup aborted or blocked:", err);
      let errorMsg = err?.message || String(err);
      if (err?.code === "auth/popup-closed-by-user" || (err instanceof Error && err.message.includes("popup-closed-by-user"))) {
        errorMsg = "The Google sign-in popup was closed before completing authentication.";
      } else if (err?.code === "auth/popup-blocked" || (err instanceof Error && err.message.includes("popup-blocked"))) {
        errorMsg = "The Google sign-in popup was blocked by your browser settings.";
      }
      setAuthError(errorMsg);
    }
  };

  const handleDemoSignIn = async (roleType: "student" | "admin") => {
    setLoadingUser(true);
    setAuthError(null);
    const mockUid = roleType === "admin" ? "demo-admin-uid" : "demo-student-uid";
    const simulatedUser = {
      uid: mockUid,
      displayName: roleType === "admin" ? "Demo Admin Officer" : "Alex Rivers",
      email: roleType === "admin" ? "admin@campushub.edu" : "alex.rivers@campushub.edu",
      photoURL: "",
      isDemo: true,
    };
    setUser(simulatedUser);
    setRole(roleType);

    try {
      // Initialize or load demo profile in Firestore
      const userRef = doc(db, "users", mockUid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const initialProfile = {
          uid: mockUid,
          displayName: simulatedUser.displayName,
          email: simulatedUser.email,
          photoURL: "",
          reputation: roleType === "admin"
            ? { Technical: 50, Business: 40, Creative: 35, Leadership: 80, Communication: 75 }
            : { Technical: 30, Business: 20, Creative: 25, Leadership: 15, Communication: 20 },
          badges: roleType === "admin" ? ["Lead Organizer", "Dean's List"] : [],
          isDemo: true,
        };
        await setDoc(userRef, initialProfile);
      }
      await loadUserData(mockUid);
    } catch (err) {
      console.error("Error setting up demo user in Firestore:", err);
      loadLocalStorageData();
    }
    setLoadingUser(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
      loadLocalStorageData();
    } catch (err) {
      console.error("Error signing out:", err);
      setUser(null);
      setAuthError(null);
      loadLocalStorageData();
    }
  };

  const tabsConfig = [
    { id: "attendance", label: "Attendance Sheet", icon: CalendarRange },
    { id: "assignments", label: "Assignment Plans", icon: ListTodo },
    { id: "clubs", label: "Club Matchmaker", icon: Compass },
    { id: "resume", label: "Resume & Placement", icon: FileText },
    { id: "reputation", label: "Skills & Reputation", icon: Award },
  ] as const;

  const renderSearchDropdownContents = () => {
    const isQueryEmpty = !searchQuery.trim();
    
    const matchedTabs = tabsConfig.filter(tab => 
      tab.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchedAssignments = assignments.filter(assign => 
      assign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (assign.description && assign.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const matchedClubs = clubs.filter(club => 
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (club.description && club.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalMatches = (isQueryEmpty ? tabsConfig.length : matchedTabs.length) + matchedAssignments.length + matchedClubs.length;

    const handleSelectTab = (tabId: string) => {
      setRole("student");
      setActiveTab(tabId as any);
      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      setIsMobileSearchOpen(false);
    };

    const handleSelectAssignment = (assignId: string) => {
      setRole("student");
      setActiveTab("assignments");
      setHighlightedAssignmentId(assignId);
      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      setIsMobileSearchOpen(false);
    };

    const handleSelectClub = (club: any) => {
      setRole("student");
      setActiveTab("clubs");
      setHighlightedClub(club);
      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      setIsMobileSearchOpen(false);
    };

    if (totalMatches === 0) {
      return (
        <div className="py-6 text-center text-slate-400 dark:text-slate-500">
          <p className="text-xs font-semibold">No matches found</p>
          <p className="text-[10px] mt-0.5">Try searching with other keywords</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-left">
        {/* TABS SECTION */}
        {((isQueryEmpty && tabsConfig.length > 0) || matchedTabs.length > 0) && (
          <div className="py-2 first:pt-1">
            <h5 className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              {isQueryEmpty ? "Quick Jump Tabs" : "Matched Navigation"}
            </h5>
            <div className="space-y-0.5 mt-1">
              {(isQueryEmpty ? tabsConfig : matchedTabs).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ASSIGNMENTS SECTION */}
        {!isQueryEmpty && matchedAssignments.length > 0 && (
          <div className="py-2">
            <h5 className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Matched Assignments
            </h5>
            <div className="space-y-0.5 mt-1">
              {matchedAssignments.map(assign => (
                <button
                  key={assign.id}
                  onClick={() => handleSelectAssignment(assign.id)}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex flex-col transition-colors"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    {assign.title}
                  </span>
                  {assign.description && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 pl-3">
                      {assign.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CLUBS SECTION */}
        {!isQueryEmpty && matchedClubs.length > 0 && (
          <div className="py-2 last:pb-1">
            <h5 className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Matched Campus Clubs
            </h5>
            <div className="space-y-0.5 mt-1">
              {matchedClubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => handleSelectClub(club)}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex flex-col transition-colors"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {club.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 pl-3">
                    {club.category} • {club.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Backdrop for closing search when clicking outside */}
      {isSearchDropdownOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20"
          onClick={() => setIsSearchDropdownOpen(false)}
        />
      )}
      
      {/* Header bar */}
      <header className="border-b border-slate-200/60 dark:border-slate-850/40 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                AI Campus Assistant
              </h1>
              <span className="text-[10px] text-slate-400 font-medium block">
                Integrated Smart Student Portal
              </span>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className="relative flex-1 max-w-sm lg:max-w-md hidden md:block z-50">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search tabs, assignments, clubs..."
                className="w-full pl-10 pr-10 py-1.5 text-xs border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Search Dropdown Overlay */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-96 overflow-y-auto z-50 p-2 space-y-3">
                {renderSearchDropdownContents()}
              </div>
            )}
          </div>

          {/* Elegant Role Switcher Toggle */}
          <div className="hidden sm:flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setRole("student")}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                role === "student"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Student Portal
            </button>
            <button
              id="admin-portal-toggle"
              onClick={handleTrySwitchAdmin}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                role === "admin"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              Admin Desk
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => {
                setIsMobileSearchOpen(!isMobileSearchOpen);
                if (!isMobileSearchOpen) {
                  setIsSearchDropdownOpen(true);
                }
              }}
              className="md:hidden p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Mobile Role Switcher Icon */}
            <button
              onClick={() => {
                if (role === "admin") {
                  setRole("student");
                } else {
                  handleTrySwitchAdmin();
                }
              }}
              className="sm:hidden p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Toggle Student/Admin"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>

            {/* Monad Wallet Button */}
            {isWalletConnected ? (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 px-2.5 shrink-0 select-none">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isMonadTestnet ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : ""}
                  </span>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">
                    {walletBalance} MON
                  </span>
                </div>
                {!isMonadTestnet ? (
                  <button
                    onClick={handleSwitchNetwork}
                    className="ml-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[9px] rounded-lg transition-colors cursor-pointer"
                    title="Switch to Monad Testnet"
                  >
                    Switch Network
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectWallet}
                    className="ml-1.5 text-slate-400 hover:text-rose-500 text-[9px] font-bold p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Disconnect Wallet"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={isConnectingWallet}
                className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-semibold text-xs py-1.5 px-3 rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {isConnectingWallet ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : (
                  <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                )}
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}

            {/* Theme switcher */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Firebase Auth interface */}
            {loadingUser ? (
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-slate-900/80 p-1.5 pl-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                <div className="text-right hidden md:block">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    {user.displayName || "Verified Student"}
                  </span>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 block font-medium">
                    Cloud Connected
                  </span>
                </div>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt={user.displayName || "Profile"}
                    className="w-8 h-8 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  className="p-1.5 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-400 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="login-google-btn"
                onClick={handleGoogleSignIn}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-2 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>

        </div>

        {/* Mobile Search Bar Row */}
        {isMobileSearchOpen && (
          <div className="border-t border-slate-200/40 dark:border-slate-800/40 p-3 bg-white dark:bg-slate-900 md:hidden relative">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search tabs, assignments, clubs..."
                className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Mobile Dropdown Overlay */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto z-50 p-2 space-y-3">
                {renderSearchDropdownContents()}
              </div>
            )}
          </div>
        )}

      </header>

      {/* Auth Error Banner */}
      {authError && (
        <div className="bg-rose-500/10 dark:bg-rose-950/25 border-b border-rose-500/15 py-3 px-4 animate-fade-in">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-400 font-medium">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                <strong>Sign-In Interrupted:</strong> {authError} If popups are blocked by your browser or sandbox environment, you can allow popups, open the app in a new tab, or use a <strong>Demo Profile</strong> below to bypass and fully test database features instantly.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleDemoSignIn("student")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all shadow-sm"
              >
                Sign In as Student
              </button>
              <button
                onClick={() => handleDemoSignIn("admin")}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all shadow-sm"
              >
                Sign In as Admin
              </button>
              <button
                onClick={() => setAuthError(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold px-2 py-1 text-[11px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cloud Banner warning for Guests */}
      {!user && !loadingUser && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/15 py-2.5 px-4 text-center">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2 justify-center">
              <CloudLightning className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
              <span>
                Guest Mode: Sign in to sync your timetables, assignments, and skills permanently to Google Cloud!
              </span>
            </div>
            <div className="flex items-center gap-2 justify-center shrink-0">
              <span className="text-slate-400 dark:text-slate-500 text-xs hidden md:inline">Quick Test:</span>
              <button
                onClick={() => handleDemoSignIn("student")}
                className="bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-400 border border-indigo-600/20 px-2.5 py-1 rounded-lg text-[10px] transition-all"
              >
                Demo Student
              </button>
              <button
                onClick={() => handleDemoSignIn("admin")}
                className="bg-slate-500/15 hover:bg-slate-500/25 text-slate-700 dark:text-slate-300 border border-slate-500/20 px-2.5 py-1 rounded-lg text-[10px] transition-all"
              >
                Demo Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main navigation & views container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {role === "admin" ? (
          <AdminPortal
            userId={user?.uid || null}
            user={user}
            reputation={reputation}
            setReputation={setReputation}
            badges={badges}
            setBadges={setBadges}
            submissions={submissions}
            setSubmissions={setSubmissions}
            clubs={clubs}
            setClubs={setClubs}
            isDark={isDark}
          />
        ) : (
          <>
            {/* Horizontal Navigation tabs */}
            <div className="flex gap-2.5 border-b border-slate-200 dark:border-slate-850 overflow-x-auto pb-px scrollbar-none scroll-smooth">
              {tabsConfig.map((tab) => {
                const Icon = tab.icon;
                const isSel = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 border-b-2 ${
                      isSel
                        ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-white dark:bg-slate-900/40"
                        : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSel ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Dynamic active view content */}
            <div className="min-h-[450px]">
              {activeTab === "attendance" && (
                <AttendanceDashboard
                  userId={user?.uid || null}
                  courses={courses}
                  setCourses={setCourses}
                />
              )}

              {activeTab === "assignments" && (
                <AssignmentPlanner
                  userId={user?.uid || null}
                  assignments={assignments}
                  setAssignments={setAssignments}
                  initialExpandedId={highlightedAssignmentId}
                />
              )}

              {activeTab === "clubs" && (
                <ClubDiscovery
                  userId={user?.uid || null}
                  clubs={clubs}
                  highlightedClub={highlightedClub}
                />
              )}

              {activeTab === "resume" && (
                <ResumeReviewer
                  userId={user?.uid || null}
                  reviews={resumeReviews}
                  setReviews={setResumeReviews}
                />
              )}

              {activeTab === "reputation" && (
                <AchievementWallet
                  userId={user?.uid || null}
                  reputation={reputation}
                  setReputation={setReputation}
                  badges={badges}
                  setBadges={setBadges}
                  isDark={isDark}
                  submissions={submissions}
                  setSubmissions={setSubmissions}
                  walletAddress={walletAddress}
                  walletBalance={walletBalance}
                  isWalletConnected={isWalletConnected}
                  isMonadTestnet={isMonadTestnet}
                  handleConnectWallet={handleConnectWallet}
                  handleDisconnectWallet={handleDisconnectWallet}
                  handleSwitchNetwork={handleSwitchNetwork}
                  isSimulatedWallet={isSimulatedWallet}
                  setWalletBalance={setWalletBalance}
                />
              )}
            </div>
          </>
        )}

      </main>

      {/* Simple footer */}
      <footer className="border-t border-slate-200/40 dark:border-slate-900/60 py-8 text-center text-xs text-slate-400 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 AI Campus Assistant. Securely persisted on Firebase Cloud Firestore.</p>
        </div>
      </footer>

      {/* Elegant Admin Passcode Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Admin Passcode Required
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Authenticate to access student claims and modify clubs.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Enter Admin Code
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={adminPasscode}
                onChange={(e) => {
                  setAdminPasscode(e.target.value);
                  setAdminPasscodeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = adminPasscode.trim();
                    if (val === "admin123" || val === "CAMPUS-ADMIN") {
                      setRole("admin");
                      setIsAdminModalOpen(false);
                    } else {
                      setAdminPasscodeError("Incorrect passcode. Try 'admin123' to test.");
                    }
                  }
                }}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all font-mono"
                autoFocus
              />
              {adminPasscodeError && (
                <span className="text-[10px] text-rose-500 font-bold block">
                  {adminPasscodeError}
                </span>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 text-[10px] text-slate-400 dark:text-slate-500 space-y-1">
              <p>
                <strong>💡 Note:</strong> Registered administrator accounts (like yours: <strong>shaikhfirdos357@gmail.com</strong>) bypass this passcode automatically.
              </p>
              <p>
                For testing or guests, use the passcode <code className="text-indigo-500 dark:text-indigo-400 font-bold font-mono">admin123</code>.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const val = adminPasscode.trim();
                  if (val === "admin123" || val === "CAMPUS-ADMIN") {
                    setRole("admin");
                    setIsAdminModalOpen(false);
                  } else {
                    setAdminPasscodeError("Incorrect passcode. Try 'admin123' to test.");
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-colors"
              >
                Access Desk
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
