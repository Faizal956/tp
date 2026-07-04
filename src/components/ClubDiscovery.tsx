import React, { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ClubMatch } from "../types";
import { MessageSquare, Send, Sparkles, Compass, HelpCircle, GraduationCap, Users, HeartHandshake } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  matches?: ClubMatch[];
  timestamp: Date;
}

interface ClubDiscoveryProps {
  userId: string | null;
  clubs?: any[];
  highlightedClub?: any;
}

export default function ClubDiscovery({ userId, clubs, highlightedClub }: ClubDiscoveryProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "bot",
      text: "Hey there! I'm your Campus Life Guide. Type in your hobbies, interests, or career goals, and I'll match you with the best student clubs and organizations on campus!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (highlightedClub) {
      const systemMsg: Message = {
        id: `msg-highlight-${Date.now()}-${highlightedClub.id}`,
        sender: "bot",
        text: `Here are the details for "${highlightedClub.name}" that you searched for. Feel free to ask me for other recommendations or how to join!`,
        matches: [
          {
            id: highlightedClub.id,
            name: highlightedClub.name,
            category: highlightedClub.category || "General",
            matchPercentage: 100,
            reason: highlightedClub.description || "Active student organization.",
          }
        ],
        timestamp: new Date()
      };
      setMessages(prev => {
        if (prev.some(m => m.id.includes(highlightedClub.id))) {
          return prev;
        }
        return [...prev, systemMsg];
      });
    }
  }, [highlightedClub]);

  const quickHobbies = [
    "Programming & Game Dev",
    "Public Speaking & Debate",
    "Art, Sketching & UX",
    "Business Cases & Finance",
    "Volunteering & Community",
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/gemini/match-clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hobbies: textToSend, clubs }),
      });

      if (!response.ok) {
        throw new Error("Failed to match clubs.");
      }

      const data = await response.json();
      const matches: ClubMatch[] = data.matches || [];

      let botResponseText = "";
      if (matches.length > 0) {
        botResponseText = `I found some perfect club matches for your interests in "${textToSend}"! Check them out below:`;
      } else {
        botResponseText = "I couldn't find any direct matches for those hobbies. Could you try sharing other interests or academic topics you are curious about?";
      }

      const botMsg: Message = {
        id: `msg-${Date.now()}-bot`,
        sender: "bot",
        text: botResponseText,
        matches: matches,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Save to Firestore chat history if logged in
      if (userId) {
        await setDoc(doc(db, "users", userId, "clubs_chat", botMsg.id), {
          textToSend,
          matches,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}-err`,
        sender: "bot",
        text: "Oops, I encountered an issue analyzing the clubs. Please try sharing other hobbies!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="club-discovery-view">
      {/* Upper Description Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Compass className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Club Discovery Assistant</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your university experience isn't just about exams. Find your squad, participate in workshops, build professional portfolios, and make lifelong friends in campus clubs!
          </p>
        </div>

        {/* Short Quick Stat chips */}
        <div className="flex gap-4 border-l border-slate-100 dark:border-slate-800 pl-6 shrink-0">
          <div className="text-center">
            <span className="text-xs text-slate-400 block">Available Clubs</span>
            <strong className="text-lg font-bold text-indigo-600 dark:text-indigo-400">5+ Prime</strong>
          </div>
          <div className="text-center">
            <span className="text-xs text-slate-400 block">Match Score</span>
            <strong className="text-lg font-bold text-emerald-500">Up to 98%</strong>
          </div>
        </div>
      </div>

      {/* Main chat layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[550px]">
        {/* Hobbies suggestions sidebar (1 column) */}
        <div className="hidden lg:flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-500" />
              Suggested Hobbies
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Click any interest chip to instantly seek customized matches:
            </p>

            <div className="space-y-2">
              {quickHobbies.map((hobby, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(hobby)}
                  disabled={loading}
                  className="w-full text-left p-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-950 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors border border-slate-100 dark:border-slate-800 font-medium"
                >
                  {hobby}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/30 dark:border-indigo-900/10">
            <h4 className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
              <HeartHandshake className="w-3.5 h-3.5" />
              Co-Curricular Credit
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Joining a club awards you Leadership and Creative reputation points which unlock digital badges!
            </p>
          </div>
        </div>

        {/* Active conversation box (3 columns) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden h-full">
          {/* Chat Stream */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4 font-sans bg-slate-50/50 dark:bg-slate-950/10">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%] space-y-3">
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-slate-800 dark:text-slate-200 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* If bot response includes club matches, render them nicely! */}
                    {msg.sender === "bot" && msg.matches && msg.matches.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {msg.matches.map((club) => (
                          <div
                            key={club.id}
                            className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 p-4 rounded-xl shadow-sm space-y-2 relative overflow-hidden group hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 rounded">
                                {club.category}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-500">
                                {club.matchPercentage}% match
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                              {club.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {club.reason}
                            </p>
                            <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs text-slate-400 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>Matching with official campus register...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Chat Input Area */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 p-3 text-sm border border-slate-200 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Type hobbies, e.g. 'coding, graphic design, and starting a business'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage(input);
                }}
                disabled={loading}
              />
              <button
                id="send-chat-btn"
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
