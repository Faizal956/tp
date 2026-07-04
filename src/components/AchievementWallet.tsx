import React, { useState, useRef, useEffect } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CertificateSubmission, UserReputation, UserProfile } from "../types";
import {
  Award,
  UploadCloud,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Trophy,
  Zap,
  Compass,
  Wallet,
  Coins,
  Globe,
  ExternalLink,
  ShieldCheck,
  Check,
  Send,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { mintReputationProof, hasMetaMask } from "../lib/web3";

interface AchievementWalletProps {
  userId: string | null;
  reputation: UserReputation;
  setReputation: React.Dispatch<React.SetStateAction<UserReputation>>;
  badges: any[];
  setBadges: React.Dispatch<React.SetStateAction<any[]>>;
  isDark: boolean;
  submissions: CertificateSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<CertificateSubmission[]>>;

  // Web3 state passing
  walletAddress: string | null;
  walletBalance: string | null;
  isWalletConnected: boolean;
  isMonadTestnet: boolean;
  handleConnectWallet: () => Promise<void>;
  handleDisconnectWallet: () => void;
  handleSwitchNetwork: () => Promise<void>;
  isSimulatedWallet: boolean;
  setWalletBalance: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function AchievementWallet({
  userId,
  reputation,
  setReputation,
  badges,
  setBadges,
  isDark,
  submissions,
  setSubmissions,
  walletAddress,
  walletBalance,
  isWalletConnected,
  isMonadTestnet,
  handleConnectWallet,
  handleDisconnectWallet,
  handleSwitchNetwork,
  isSimulatedWallet,
  setWalletBalance,
}: AchievementWalletProps) {
  const [certName, setCertName] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAward, setSuccessAward] = useState<any | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Web3 Monad states
  const [mintingId, setMintingId] = useState<string | null>(null);
  const [mintedTxns, setMintedTxns] = useState<{ [subId: string]: string }>({});
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState(false);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  // Load previously minted transaction hashes from localStorage to persist them
  useEffect(() => {
    const cached = localStorage.getItem("monad_minted_txns");
    if (cached) {
      try {
        setMintedTxns(JSON.parse(cached));
      } catch (err) {
        console.error("Error reading cached minted transactions:", err);
      }
    }
  }, []);

  const saveMintedTx = (id: string, hash: string) => {
    const updated = { ...mintedTxns, [id]: hash };
    setMintedTxns(updated);
    localStorage.setItem("monad_minted_txns", JSON.stringify(updated));
  };

  const requestMonadFaucet = async () => {
    if (!isWalletConnected) {
      setFaucetError("Please connect your wallet first.");
      return;
    }
    setFaucetLoading(true);
    setFaucetError(null);
    setFaucetSuccess(false);

    try {
      // Simulate block mining interval
      await new Promise(resolve => setTimeout(resolve, 1800));
      const currentBalance = walletBalance ? parseFloat(walletBalance) : 0;
      const newBal = (currentBalance + 10.0).toFixed(4);
      setWalletBalance(newBal);
      setFaucetSuccess(true);
      setTimeout(() => setFaucetSuccess(false), 4000);
    } catch (err: any) {
      setFaucetError("Failed to claim testnet MON tokens from faucet.");
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleMintCertificate = async (sub: CertificateSubmission) => {
    if (!isWalletConnected) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!isMonadTestnet) {
      alert("Please switch your network to Monad Testnet to proceed.");
      return;
    }

    setMintingId(sub.id);
    try {
      if (isSimulatedWallet) {
        await new Promise(resolve => setTimeout(resolve, 2200));
        const mockHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
        saveMintedTx(sub.id, mockHash);
      } else {
        const result = await mintReputationProof(sub.certificateName, sub.skillCategory, sub.pointsAwarded);
        if (result) {
          saveMintedTx(sub.id, result.txHash);
        }
      }
    } catch (err: any) {
      console.error("Minting failed:", err);
      alert(err?.message || "Minting transaction was rejected or failed.");
    } finally {
      setMintingId(null);
    }
  };

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
    if (!certName) {
      // Pre-fill certificate name with clean file name
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setCertName(cleanName);
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

  const submitCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certName.trim()) {
      setError("Please specify the Certificate Name.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessAward(null);

    try {
      const response = await fetch("/api/gemini/analyze-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certName, textContent: `File: ${fileName}` }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze the certificate document.");
      }

      const data = await response.json();
      const cat = data.skillCategory as any;
      const pts = Number(data.pointsAwarded) || 20;

      // In a moderated 2-sided student & admin flow, we submit this as a "pending" claim for Admin approval
      const newSubmission: CertificateSubmission = {
        id: `sub-${Date.now()}`,
        certificateName: data.certificateName || certName,
        skillCategory: cat,
        pointsAwarded: pts,
        feedback: data.feedback || "Verified co-curricular competency.",
        badgeId: data.badgeId || "badge-expert",
        createdAt: new Date().toISOString(),
        status: "pending",
        studentId: userId || "guest-alex",
        studentName: "Alex Carter"
      };

      // Add to shared memory submissions list
      setSubmissions(prev => [newSubmission, ...prev]);

      // Save to Firestore if authenticated
      if (userId) {
        await setDoc(doc(db, "certificate_submissions", newSubmission.id), {
          certificateName: newSubmission.certificateName,
          skillCategory: newSubmission.skillCategory,
          pointsAwarded: newSubmission.pointsAwarded,
          feedback: newSubmission.feedback,
          badgeId: newSubmission.badgeId,
          createdAt: newSubmission.createdAt,
          status: "pending",
          studentId: userId,
          studentName: "Alex Carter"
        });
      }

      setSuccessAward({
        name: newSubmission.certificateName,
        category: cat,
        points: pts,
        feedback: "Your co-curricular claim has been sent to the Administration Desk for official verification. It will be awarded upon approval!",
        isPending: true
      });

      // Clear input fields
      setCertName("");
      setFileName("");
    } catch (err: any) {
      setError(err.message || "An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  // Prepare radar chart data
  const radarData = [
    { subject: "Technical", value: reputation.Technical, fullMark: 100 },
    { subject: "Business", value: reputation.Business, fullMark: 100 },
    { subject: "Creative", value: reputation.Creative, fullMark: 100 },
    { subject: "Leadership", value: reputation.Leadership, fullMark: 100 },
    { subject: "Communication", value: reputation.Communication, fullMark: 100 },
  ];

  return (
    <div className="space-y-8" id="achievement-wallet-view">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left 2 Columns: Reputation Stats Card & Radar Chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-1.5">
              <Trophy className="w-5 h-5 text-indigo-500" />
              Five-Dimensional Skill Reputation
            </h3>

            {/* Recharts Radar Chart */}
            <div className="w-full flex justify-center py-2">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 11, fontWeight: "semibold" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 9 }}
                  />
                  <Radar
                    name="Student"
                    dataKey="value"
                    stroke="#5a6a50"
                    fill="#a5b69c"
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Individual category scorebars */}
            <div className="space-y-3 mt-4">
              {Object.entries(reputation).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{key}</span>
                    <span className="text-slate-400 font-bold">{value} pts</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Cert submit & badge display */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Certificate Submit Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Upload Certificate of Completion</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submit certifications. Gemini validates difficulty to award Skill Points & badges.
                </p>
              </div>
            </div>

            <form onSubmit={submitCertificate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Certification Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., Intro to Machine Learning with Python"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                  />
                </div>

                {/* Mini Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${
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
                    accept="image/*,.pdf,.txt"
                  />
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-[10px] text-slate-500 line-clamp-1">
                    {fileName ? `File: ${fileName}` : "Drag & Drop Certificate or PDF"}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="submit-cert-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Credential with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Verify and Claim Points
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Award Popups & Badge Vault */}
          {/* Award Popups & Badge Vault */}
          <AnimatePresence>
            {successAward && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`border p-5 rounded-2xl flex items-start gap-4 ${
                  successAward.isPending
                    ? "bg-amber-50/70 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                    : "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30"
                }`}
              >
                <div className={`p-3 rounded-xl ${
                  successAward.isPending
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                }`}>
                  <Zap className="w-6 h-6 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {successAward.isPending ? "Claim Submitted for Verification!" : "Points Awarded successfully!"}
                    </h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${
                      successAward.isPending ? "bg-amber-600" : "bg-emerald-600"
                    }`}>
                      {successAward.isPending ? "Estimated" : ""} +{successAward.points} pts {successAward.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    {successAward.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                    "{successAward.feedback}"
                  </p>
                  <button
                    onClick={() => setSuccessAward(null)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Dismiss Notification
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Co-Curricular Claims Tracker */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2.5 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              My Certificate Verification Requests
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Track your pending, approved, or rejected credentials moderated by the Administration Desk.
            </p>

            {submissions.filter(s => s.studentId === (userId || "guest-alex")).length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                You haven't submitted any co-curricular certificate claims yet. Upload a certificate above to start earning digital badges!
              </div>
            ) : (
              <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                {submissions.filter(s => s.studentId === (userId || "guest-alex")).map((sub) => (
                  <div 
                    key={sub.id} 
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/50 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">
                          {sub.certificateName}
                        </span>
                        <span className="text-[8px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                          {sub.skillCategory}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Recommended Award: <strong className="text-slate-600 dark:text-slate-300">+{sub.pointsAwarded} pts</strong>
                      </p>
                      {sub.rejectionReason && (
                        <p className="text-[10px] text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900/30">
                          <strong>Admin Feedback:</strong> {sub.rejectionReason}
                        </p>
                      )}
                    </div>
                    
                    <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                      {sub.status === "approved" && (
                        <>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                            ● Verified by Admin
                          </span>
                          {mintedTxns[sub.id] ? (
                            <a
                              href={`https://testnet.monadexplorer.com/tx/${mintedTxns[sub.id]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] font-bold text-violet-400 dark:text-violet-300 hover:underline flex items-center gap-1 mt-1"
                            >
                              <ShieldCheck className="w-3 h-3 text-violet-500" />
                              View NFT Proof
                            </a>
                          ) : isWalletConnected ? (
                            isMonadTestnet ? (
                              <button
                                onClick={() => handleMintCertificate(sub)}
                                disabled={mintingId === sub.id}
                                className="mt-1 text-[9px] font-extrabold bg-violet-600 hover:bg-violet-500 text-white px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1"
                              >
                                {mintingId === sub.id ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-2.5 h-2.5" />
                                )}
                                Mint NFT Proof
                              </button>
                            ) : (
                              <button
                                onClick={handleSwitchNetwork}
                                className="mt-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors cursor-pointer"
                              >
                                Switch network to Mint
                              </button>
                            )
                          ) : (
                            <button
                              onClick={handleConnectWallet}
                              className="mt-1 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                            >
                              Connect Wallet to Mint
                            </button>
                          )}
                        </>
                      )}
                      {sub.status === "rejected" && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-full border border-rose-100 dark:border-rose-900/30">
                          ● Rejected
                        </span>
                      )}
                      {sub.status === "pending" && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-900/30 animate-pulse">
                          ● Awaiting Admin
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monad Testnet Blockchain Dashboard */}
          <div className="bg-slate-900 text-slate-100 border border-violet-500/30 rounded-2xl p-6 shadow-xl shadow-violet-950/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-500/15 rounded-xl text-violet-400 border border-violet-500/20">
                  <Coins className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    Monad Testnet Academic Ledger
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded text-violet-300">
                      L1 EVM
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sovereign, ultra-high-speed cryptographic credential settlement.
                  </p>
                </div>
              </div>

              <div>
                {isWalletConnected ? (
                  <button
                    id="disconnect-web3-wallet"
                    onClick={handleDisconnectWallet}
                    className="text-xs font-semibold bg-slate-800 hover:bg-slate-700/80 text-rose-400 border border-rose-950/30 rounded-xl px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Disconnect Ledger
                  </button>
                ) : (
                  <button
                    id="connect-web3-wallet"
                    onClick={handleConnectWallet}
                    className="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 rounded-xl px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Connect MetaMask
                  </button>
                )}
              </div>
            </div>

            {isWalletConnected ? (
              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Address Box */}
                  <div className="bg-slate-950/75 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-violet-400" />
                      Sovereign Address
                    </span>
                    <p className="text-xs font-mono font-semibold text-slate-200 truncate" title={walletAddress || ""}>
                      {walletAddress}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {isSimulatedWallet ? "Sandbox Dev Account" : "MetaMask Web3 Node"}
                    </p>
                  </div>

                  {/* Balance Box */}
                  <div className="bg-slate-950/75 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-violet-400" />
                      Testnet Fuel
                    </span>
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-bold text-white font-mono">
                        {walletBalance}
                      </p>
                      <span className="text-[10px] font-bold text-violet-400">MON</span>
                    </div>
                    <p className="text-[9px] text-slate-500">
                      Required for contract gas fees
                    </p>
                  </div>

                  {/* Network Status Box */}
                  <div className="bg-slate-950/75 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-violet-400" />
                        Network Integrity
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${isMonadTestnet ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                        <span className="text-xs font-bold text-slate-200">
                          {isMonadTestnet ? "Monad Testnet" : "Incorrect Chain"}
                        </span>
                      </div>
                    </div>
                    {!isMonadTestnet && (
                      <button
                        onClick={handleSwitchNetwork}
                        className="mt-2 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] py-1 px-2 rounded-lg transition-colors cursor-pointer"
                      >
                        Switch to Monad Testnet (Chain 10143)
                      </button>
                    )}
                  </div>
                </div>

                {/* Monad Testnet Faucet */}
                <div className="bg-violet-950/15 border border-violet-500/15 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-violet-400 animate-spin-slow" />
                      Monad Devnet Gas Faucet
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Need gas for minting? Instantly request 10.0 testnet MON gas tokens into your connected account.
                    </p>
                  </div>
                  <div className="shrink-0 w-full sm:w-auto">
                    <button
                      onClick={requestMonadFaucet}
                      disabled={faucetLoading}
                      className="w-full sm:w-auto bg-violet-600/25 hover:bg-violet-600/40 text-violet-300 hover:text-white border border-violet-500/30 font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {faucetLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Settling block...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Claim 10.0 MON
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {faucetSuccess && (
                  <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px] p-3 rounded-xl flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Transaction finalized successfully! <strong>+10.0 MON</strong> added to your ledger state on Monad.</span>
                  </div>
                )}

                {/* Academic Proof NFT Minter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-violet-400" />
                      Approved Credentials Eligible for NFT Minting
                    </h4>
                    <span className="text-[9px] text-slate-500">
                      Standard ERC-721 Schema
                    </span>
                  </div>

                  {submissions.filter(s => s.status === "approved" && s.studentId === (userId || "guest-alex")).length === 0 ? (
                    <div className="p-6 text-center bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-[10px] text-slate-500">
                      No approved co-curricular claims found. Upload a certificate above and wait for Admin Desk approval to enable sovereign on-chain minting on Monad!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {submissions.filter(s => s.status === "approved" && s.studentId === (userId || "guest-alex")).map((sub) => {
                        const txHash = mintedTxns[sub.id];
                        const isMinting = mintingId === sub.id;

                        return (
                          <div
                            key={sub.id}
                            className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-violet-500/25"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white">
                                  {sub.certificateName}
                                </span>
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded">
                                  {sub.skillCategory}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                Earning <strong className="text-violet-400 font-semibold">+{sub.pointsAwarded} pts</strong> skill credibility on the Monad ledger.
                              </p>
                              {txHash && (
                                <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400 mt-1">
                                  <span>Tx:</span>
                                  <span className="text-violet-300 font-semibold truncate max-w-[120px] sm:max-w-xs">{txHash}</span>
                                  <a
                                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 hover:bg-slate-800 text-violet-400 hover:text-violet-300 rounded transition-colors inline-flex items-center gap-0.5 shrink-0"
                                    title="Verify on Block Explorer"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    Explorer
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 w-full sm:w-auto">
                              {txHash ? (
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-3 py-1.5 rounded-xl">
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  On-Chain Verified
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleMintCertificate(sub)}
                                  disabled={isMinting || !isMonadTestnet}
                                  className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl shadow-md shadow-violet-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  {isMinting ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      Minting NFT...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Mint Reputation Proof
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-850 py-10 space-y-4">
                <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Wallet className="w-6 h-6 animate-pulse" />
                </div>
                <div className="max-w-sm mx-auto space-y-1">
                  <h4 className="text-sm font-bold text-white">Connect Sovereign Web3 Wallet</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Unlock on-chain sovereign reputation. Link your MetaMask to request devnet gas faucet fuel, mint immutable NFT proofs, and anchor your academic badges permanently onto the Monad Testnet.
                  </p>
                </div>
                <button
                  onClick={handleConnectWallet}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow-lg shadow-violet-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet (MetaMask or Sandbox)
                </button>
              </div>
            )}
          </div>

          {/* Badge Vault (Digital Credentials Showcase) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-500" />
              Digital Badge Vault ({badges.length})
            </h3>

            {badges.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No digital badges claimed yet</h4>
                <p className="text-[10px] text-slate-400">
                  Earn points by uploading certificates or joining co-curricular clubs!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {badges.map((badge, index) => (
                  <div
                    key={index}
                    className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 flex items-start gap-3 relative overflow-hidden"
                  >
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                          {badge.category}
                        </span>
                        <span className="text-[10px] text-slate-400">{badge.dateEarned}</span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-1">
                        {badge.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
