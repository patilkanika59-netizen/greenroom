import React, { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Mic, Square, Send, FileText, LayoutDashboard, MessageSquare,
  Settings as SettingsIcon, Download, Mail, Sparkles, TrendingUp,
  ChevronRight, X, Loader2, CheckCircle2, AlertCircle, Volume2, LogOut, Lock
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const C = {
  ink: "#14171F",
  panel: "#1B2029",
  panel2: "#232A38",
  border: "#2B3140",
  paper: "#EDEAE2",
  amber: "#E8A33D",
  amberDim: "#3A2F1C",
  teal: "#4FB0A5",
  tealDim: "#1B3430",
  coral: "#E2685A",
  coralDim: "#3A2119",
  text: "#EDEEF2",
  muted: "#8B90A0",
  mutedDark: "#5C6170",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

const CATEGORIES = ["Behavioral", "Technical", "System Design", "HR / Culture"];

const QUESTION_BANK = {
  Behavioral: [
    "Tell me about a time you disagreed with a teammate. How did you handle it?",
    "Describe a project that failed. What did you learn?",
    "Tell me about a time you had to meet a tight deadline.",
    "Describe a situation where you had to persuade someone to see things your way.",
  ],
  Technical: [
    "Explain the difference between processes and threads.",
    "How would you design a rate limiter?",
    "What happens when you type a URL into a browser and press enter?",
    "Explain how a hash table handles collisions.",
  ],
  "System Design": [
    "Design a URL shortener like bit.ly.",
    "How would you design the backend for a chat application?",
    "Design a notification system that scales to millions of users.",
    "How would you design a parking lot system?",
  ],
  "HR / Culture": [
    "Why do you want to work here?",
    "Where do you see yourself in five years?",
    "What's a weakness you're actively working on?",
    "How do you handle feedback you disagree with?",
  ],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object found in response.");
  return JSON.parse(text.slice(start, end + 1));
}

function friendlyGroqError(e) {
  const msg = e?.message || "";
  if (msg === "NO_KEY") return "No Groq key set.";
  if (msg.includes("Failed to generate JSON")) return "Groq's response got cut off mid-answer. Try again — it usually works on a retry.";
  if (msg.startsWith("GROQ_401")) return "Groq rejected the API key. Check it in Settings.";
  if (msg.startsWith("GROQ_429")) return "Groq rate limit hit — wait a moment and try again.";
  if (msg.startsWith("GROQ_")) return "Groq had trouble with that request. Try again in a moment.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Couldn't reach Groq — check your connection or try again.";
  return "Something went wrong talking to Groq. Try again.";
}

function useGroq(apiKey) {
  const call = useCallback(async (messages, { json = false, model = "llama-3.3-70b-versatile", maxTokens = 900 } = {}) => {
    if (!apiKey) throw new Error("NO_KEY");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`GROQ_${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }, [apiKey]);

  // Calls Groq expecting a JSON object back. Retries once in json mode, then
  // once more without strict json mode (extracting the object manually) —
  // Groq's json_object validator occasionally rejects a truncated or slightly
  // malformed response even when the model got the content right.
  const callJSON = useCallback(async (messages, opts = {}) => {
    try {
      const raw = await call(messages, { ...opts, json: true });
      return extractJSON(raw);
    } catch (e1) {
      try {
        const raw = await call(messages, { ...opts, json: true });
        return extractJSON(raw);
      } catch (e2) {
        const raw = await call(
          [...messages, { role: "user", content: "Respond with only the JSON object, no markdown fences, no commentary." }],
          { ...opts, json: false }
        );
        return extractJSON(raw);
      }
    }
  }, [call]);

  return { call, callJSON };
}

function Waveform({ active }) {
  const bars = 24;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: active ? C.coral : C.mutedDark,
            height: active ? 6 + Math.abs(Math.sin(Date.now() / 120 + i)) * 20 : 4,
            transition: "height 120ms ease",
            animation: active ? `wf 900ms ease-in-out ${i * 40}ms infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score }) {
  const color = score >= 75 ? C.teal : score >= 50 ? C.amber : C.coral;
  const r = 30, circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke={C.border} strokeWidth="6" />
      <circle
        cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="43" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="20" fontWeight="500" fill={C.text}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

function Badge({ children, tone = "muted" }) {
  const map = {
    muted: { bg: C.panel2, fg: C.muted },
    amber: { bg: C.amberDim, fg: C.amber },
    teal: { bg: C.tealDim, fg: C.teal },
    coral: { bg: C.coralDim, fg: C.coral },
  };
  const s = map[tone];
  return (
    <span style={{
      background: s.bg, color: s.fg, fontSize: 12, fontFamily: "Inter",
      padding: "3px 10px", borderRadius: 20, fontWeight: 500, letterSpacing: 0.2,
    }}>{children}</span>
  );
}

function Button({ children, onClick, variant = "secondary", disabled, style, type = "button" }) {
  const base = {
    fontFamily: "Inter", fontWeight: 500, fontSize: 14, borderRadius: 10,
    padding: "10px 18px", cursor: disabled ? "default" : "pointer",
    display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid transparent",
    opacity: disabled ? 0.5 : 1, transition: "transform 100ms ease, background 150ms ease",
  };
  const variants = {
    primary: { background: C.amber, color: "#241A08", border: `1px solid ${C.amber}` },
    secondary: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.muted, border: "1px solid transparent" },
    danger: { background: C.coral, color: "#2A0E0A", border: `1px solid ${C.coral}` },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%", background: C.panel2, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: 14, fontFamily: "Inter", fontSize: 14, lineHeight: 1.6,
        resize: "vertical", outline: "none", boxSizing: "border-box", ...props.style,
      }}
    />
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%", background: C.panel2, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "10px 14px", fontFamily: "Inter", fontSize: 14,
        outline: "none", boxSizing: "border-box", ...props.style,
      }}
    />
  );
}

function Card({ children, style, glow }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 24, position: "relative", overflow: "hidden", ...style,
    }}>
      {glow && (
        <div style={{
          position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)",
          width: 480, height: 320, borderRadius: "50%",
          background: `radial-gradient(closest-side, ${C.amberDim}, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
        borderRadius: 10, cursor: "pointer", fontFamily: "Inter", fontSize: 14,
        fontWeight: 500, color: active ? C.ink : C.muted,
        background: active ? C.amber : "transparent",
        marginBottom: 4, transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.panel2; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={17} />
      {label}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px", color: C.muted }}>
      <Icon size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
      <div style={{ fontFamily: "Fraunces", fontSize: 18, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

function KeyNotice({ apiKey, onOpenSettings }) {
  if (apiKey) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, background: C.amberDim,
      border: `1px solid ${C.amber}44`, borderRadius: 10, padding: "10px 14px",
      fontSize: 13, color: C.amber, marginBottom: 20, fontFamily: "Inter",
    }}>
      <AlertCircle size={15} />
      <span style={{ flex: 1 }}>No Groq key set. Running on the built-in question bank and a simple local scorer.</span>
      <span style={{ textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }} onClick={onOpenSettings}>Add key</span>
    </div>
  );
}

// ---------- local fallback scoring (no key) ----------
function localScore(answer) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const len = words.length;
  const hasNumbers = /\d/.test(answer);
  const hasStructure = /(first|then|because|result|so that|led to|therefore)/i.test(answer);
  let score = 35;
  score += Math.min(30, len * 0.6);
  if (hasNumbers) score += 12;
  if (hasStructure) score += 15;
  score = Math.max(10, Math.min(96, score));
  const strengths = [];
  const improvements = [];
  if (len > 60) strengths.push("Gave a well-developed, detailed answer.");
  else improvements.push("Add more detail — aim for at least a few full sentences.");
  if (hasStructure) strengths.push("Used clear structure to walk through the situation.");
  else improvements.push("Try structuring your answer, e.g. situation, action, result.");
  if (hasNumbers) strengths.push("Backed the answer up with concrete specifics.");
  else improvements.push("Add a concrete detail or measurable outcome if you can.");
  if (strengths.length === 0) strengths.push("You answered the question directly.");
  return { score: Math.round(score), strengths, improvements, summary: "Local scorer estimate — add a Groq key in Settings for real AI feedback." };
}

function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!supabase) {
    return (
      <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", color: C.text }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ maxWidth: 440, textAlign: "center", padding: 24 }}>
          <Lock size={28} style={{ color: C.amber, marginBottom: 14 }} />
          <div style={{ fontFamily: "Fraunces", fontSize: 22, marginBottom: 10 }}>Authentication isn't configured yet</div>
          <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
            Create a free project at supabase.com, then add its URL and anon key to a <code style={{ background: C.panel2, padding: "1px 6px", borderRadius: 4 }}>.env.local</code> file
            as <code style={{ background: C.panel2, padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_URL</code> and <code style={{ background: C.panel2, padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code>,
            then restart <code style={{ background: C.panel2, padding: "1px 6px", borderRadius: 4 }}>npm run dev</code>. See the README for the exact steps.
          </div>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Account created. Check your inbox to confirm your email, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", color: C.text }}>
      <style>{`${FONT_IMPORT} ::placeholder { color: ${C.mutedDark}; } input:focus { border-color: ${C.amber} !important; }`}</style>
      <div style={{ width: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, justifyContent: "center" }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.coral, boxShadow: `0 0 8px ${C.coral}` }} />
          <span style={{ fontFamily: "Fraunces", fontStyle: "italic", fontSize: 21 }}>AI-Interview Coach</span>
        </div>
        <Card>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            <div onClick={() => { setMode("signin"); setError(""); setNotice(""); }} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 500, background: mode === "signin" ? C.amber : "transparent", color: mode === "signin" ? "#241A08" : C.muted }}>Sign in</div>
            <div onClick={() => { setMode("signup"); setError(""); setNotice(""); }} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 500, background: mode === "signup" ? C.amber : "transparent", color: mode === "signup" ? "#241A08" : C.muted }}>Create account</div>
          </div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Email</div>
              <Input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Password</div>
              <Input type="password" required minLength={6} placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div style={{ color: C.coral, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {notice && <div style={{ color: C.teal, fontSize: 13, marginBottom: 12 }}>{notice}</div>}
            <Button type="submit" variant="primary" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Lock size={14} />}
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function InterviewApp({ user, onSignOut }) {
  const [view, setView] = useState("overview");
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const { call: groq, callJSON: groqJSON } = useGroq(apiKey);

  const [category, setCategory] = useState("Behavioral");
  const [question, setQuestion] = useState(pick(QUESTION_BANK.Behavioral));
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const recogRef = useRef(null);
  const [genLoading, setGenLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [sessions, setSessions] = useState([]);

  const [resumeText, setResumeText] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeResult, setResumeResult] = useState(null);

  const [chat, setChat] = useState([
    { role: "assistant", content: "I'm here for interview questions — nerves, phrasing, what a good STAR answer looks like, anything. What's on your mind?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Load this user's saved Groq key and practice history from Supabase.
  useEffect(() => {
    if (!supabase || !user) { setSyncing(false); return; }
    (async () => {
      const [{ data: settings }, { data: history }] = await Promise.all([
        supabase.from("user_settings").select("groq_api_key").eq("user_id", user.id).maybeSingle(),
        supabase.from("practice_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);
      if (settings?.groq_api_key) { setApiKey(settings.groq_api_key); setKeyDraft(settings.groq_api_key); }
      if (history) {
        setSessions(history.map(h => ({
          id: h.id, category: h.category, question: h.question, answer: h.answer,
          score: h.score, strengths: h.strengths || [], improvements: h.improvements || [],
          date: new Date(h.created_at),
        })));
      }
      setSyncing(false);
    })();
  }, [user]);

  const saveApiKey = async () => {
    setApiKey(keyDraft);
    if (supabase && user) {
      await supabase.from("user_settings").upsert({ user_id: user.id, groq_api_key: keyDraft, updated_at: new Date().toISOString() });
    }
  };

  const clearApiKey = async () => {
    setApiKey(""); setKeyDraft("");
    if (supabase && user) {
      await supabase.from("user_settings").upsert({ user_id: user.id, groq_api_key: "", updated_at: new Date().toISOString() });
    }
  };

  const newQuestion = async (cat) => {
    setCategory(cat);
    setAnswer("");
    setLastResult(null);
    if (!apiKey) { setQuestion(pick(QUESTION_BANK[cat])); return; }
    setGenLoading(true);
    try {
      const content = await groq([
        { role: "system", content: "You generate one realistic job interview question. Reply with only the question text, no preamble, no quotes." },
        { role: "user", content: `Give me one ${cat} interview question for a general professional role. Make it specific and realistic, not generic.` },
      ]);
      setQuestion(content.trim().replace(/^"|"$/g, ""));
    } catch (e) {
      setQuestion(pick(QUESTION_BANK[cat]));
    } finally {
      setGenLoading(false);
    }
  };

  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input isn't supported in this browser. Try Chrome, or just type your answer.");
      return;
    }
    if (recording) {
      recogRef.current?.stop();
      setRecording(false);
      return;
    }
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";
    let base = answer ? answer + " " : "";
    recog.onresult = (e) => {
      let text = base;
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
      setAnswer(text.trim());
    };
    recog.onend = () => setRecording(false);
    recog.start();
    recogRef.current = recog;
    setRecording(true);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setScoreLoading(true);
    let result;
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 500));
      result = localScore(answer);
    } else {
      try {
        result = await groqJSON([
          { role: "system", content: "You are an interview coach. Score the candidate's answer from 0-100 and give feedback. Respond with a JSON object only, in this exact shape: {\"score\": number, \"summary\": string (1 sentence), \"strengths\": string[] (2-3 short items), \"improvements\": string[] (2-3 short items)}. Keep every string under 20 words." },
          { role: "user", content: `Question: ${question}\n\nCandidate's answer: ${answer}` },
        ]);
      } catch (e) {
        result = { ...localScore(answer), summary: friendlyGroqError(e) + " Showing a local estimate instead." };
      }
    }
    setLastResult(result);
    const newSession = {
      id: Date.now(), category, question, answer, score: result.score,
      strengths: result.strengths, improvements: result.improvements, date: new Date(),
    };
    setSessions(s => [...s, newSession]);
    if (supabase && user) {
      const { data } = await supabase.from("practice_sessions").insert({
        user_id: user.id, category, question, answer, score: result.score,
        strengths: result.strengths, improvements: result.improvements,
      }).select().single();
      if (data) setSessions(s => s.map(x => x.id === newSession.id ? { ...x, id: data.id } : x));
    }
    setScoreLoading(false);
  };

  const analyzeResume = async () => {
    if (!resumeText.trim()) return;
    setResumeLoading(true);
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 500));
      const words = resumeText.split(/\s+/).length;
      setResumeResult({
        score: Math.min(90, 40 + Math.round(words / 15)),
        summary: "Local estimate — add a Groq key for a real AI resume review.",
        strengths: ["Resume text was received and readable."],
        improvements: ["Add a Groq key in Settings to get a detailed, role-aware review."],
        keywords: [],
      });
      setResumeLoading(false);
      return;
    }
    try {
      const result = await groqJSON([
        { role: "system", content: "You are a resume reviewer for job seekers. Respond with a JSON object only, in this exact shape: {\"score\": number (0-100), \"summary\": string, \"strengths\": string[], \"improvements\": string[], \"keywords\": string[] (skills/keywords found)}. Keep every string under 20 words." },
        { role: "user", content: `Review this resume:\n\n${resumeText}` },
      ]);
      setResumeResult(result);
    } catch (e) {
      setResumeResult({ score: 0, summary: friendlyGroqError(e), strengths: [], improvements: [], keywords: [] });
    }
    setResumeLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    const nextChat = [...chat, userMsg];
    setChat(nextChat);
    setChatInput("");
    if (!apiKey) {
      setChat(c => [...c, { role: "assistant", content: "Add a Groq key in Settings and I can answer this properly. In the meantime: breathe, use the STAR method (situation, task, action, result), and keep answers under two minutes." }]);
      return;
    }
    setChatLoading(true);
    try {
      const content = await groq([
        { role: "system", content: "You are a friendly, concise interview coach helping someone prepare. Keep answers under 120 words unless asked for more." },
        ...nextChat.map(m => ({ role: m.role, content: m.content })),
      ]);
      setChat(c => [...c, { role: "assistant", content }]);
    } catch (e) {
      setChat(c => [...c, { role: "assistant", content: friendlyGroqError(e) }]);
    }
    setChatLoading(false);
  };

  const downloadReport = () => {
    const win = window.open("", "_blank");
    const rows = sessions.map(s => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${new Date(s.date).toLocaleDateString()}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${s.category}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;">${s.question}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${s.score}</td>
      </tr>`).join("");
    const avg = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) : 0;
    win.document.write(`
      <html><head><title>Greenroom Report</title></head>
      <body style="font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#14171F;">
        <h1 style="font-size:24px;">Greenroom — Interview practice report</h1>
        <p style="color:#555;">Generated ${new Date().toLocaleString()}</p>
        <p><strong>Sessions completed:</strong> ${sessions.length} &nbsp; <strong>Average score:</strong> ${avg}/100</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead><tr style="text-align:left;background:#f0f0f0;">
            <th style="padding:8px;">Date</th><th style="padding:8px;">Category</th>
            <th style="padding:8px;">Question</th><th style="padding:8px;">Score</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="padding:8px;">No sessions yet.</td></tr>'}</tbody>
        </table>
        <script>window.print();</script>
      </body></html>`);
    win.document.close();
  };

  const sendEmail = (e) => {
    e.preventDefault();
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  const avgScore = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) : 0;
  const chartData = sessions.map((s, i) => ({ n: i + 1, score: s.score, label: s.category.slice(0, 4) }));
  const catCounts = CATEGORIES.map(c => ({
    category: c.split(" ")[0],
    count: sessions.filter(s => s.category === c).length,
  }));

  return (
    <div style={{ background: C.ink, minHeight: "100%", fontFamily: "Inter", color: C.text, display: "flex" }}>
      <style>{`
        ${FONT_IMPORT}
        @keyframes wf { from { height: 4px; } to { height: 26px; } }
        * { box-sizing: border-box; }
        ::placeholder { color: ${C.mutedDark}; }
        textarea:focus, input:focus { border-color: ${C.amber} !important; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 220, borderRight: `1px solid ${C.border}`, padding: 20, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, padding: "0 4px" }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.coral, boxShadow: `0 0 8px ${C.coral}` }} />
          <span style={{ fontFamily: "Fraunces", fontStyle: "italic", fontSize: 19, letterSpacing: 0.2 }}>AI-Interview Coach</span>
        </div>
        <NavItem icon={LayoutDashboard} label="Overview" active={view === "overview"} onClick={() => setView("overview")} />
        <NavItem icon={Mic} label="Practice" active={view === "practice"} onClick={() => setView("practice")} />
        <NavItem icon={FileText} label="Resume" active={view === "resume"} onClick={() => setView("resume")} />
        <NavItem icon={MessageSquare} label="Assistant" active={view === "chat"} onClick={() => setView("chat")} />
        <NavItem icon={Download} label="Reports" active={view === "reports"} onClick={() => setView("reports")} />
        <div style={{ flex: 1 }} />
        <NavItem icon={SettingsIcon} label="Settings" active={view === "settings"} onClick={() => setView("settings")} />
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: C.mutedDark, padding: "0 14px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
          <NavItem icon={LogOut} label="Sign out" onClick={onSignOut} />
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "28px 36px", maxWidth: 880 }}>

        {view === "overview" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Overview</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Your practice, at a glance.</div>
            </div>
            <KeyNotice apiKey={apiKey} onOpenSettings={() => setView("settings")} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ fontSize: 12.5, color: C.muted }}>Sessions completed</div>
                <div style={{ fontFamily: "IBM Plex Mono", fontSize: 28, marginTop: 6 }}>{sessions.length}</div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ fontSize: 12.5, color: C.muted }}>Average score</div>
                <div style={{ fontFamily: "IBM Plex Mono", fontSize: 28, marginTop: 6, color: avgScore >= 70 ? C.teal : avgScore >= 45 ? C.amber : C.coral }}>
                  {sessions.length ? avgScore : "—"}
                </div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ fontSize: 12.5, color: C.muted }}>Best category</div>
                <div style={{ fontFamily: "Fraunces", fontSize: 18, marginTop: 6 }}>
                  {sessions.length ? [...CATEGORIES].sort((a, b) =>
                    (sessions.filter(s => s.category === b).reduce((x, s) => x + s.score, 0) / (sessions.filter(s => s.category === b).length || 1)) -
                    (sessions.filter(s => s.category === a).reduce((x, s) => x + s.score, 0) / (sessions.filter(s => s.category === a).length || 1))
                  )[0] : "—"}
                </div>
              </Card>
            </div>

            {sessions.length > 0 ? (
              <Card style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} /> Score trend
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="n" stroke={C.mutedDark} fontSize={11} tickLine={false} axisLine={{ stroke: C.border }} />
                      <YAxis domain={[0, 100]} stroke={C.mutedDark} fontSize={11} tickLine={false} axisLine={{ stroke: C.border }} />
                      <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} />
                      <Line type="monotone" dataKey="score" stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <Card>
                <EmptyState icon={Mic} title="No sessions yet" body="Head to Practice and answer your first question — your trend line shows up here." />
              </Card>
            )}

            {sessions.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Practice by category</div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catCounts}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" stroke={C.mutedDark} fontSize={11} tickLine={false} axisLine={{ stroke: C.border }} />
                      <YAxis allowDecimals={false} stroke={C.mutedDark} fontSize={11} tickLine={false} axisLine={{ stroke: C.border }} />
                      <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.muted }} />
                      <Bar dataKey="count" fill={C.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>
        )}

        {view === "practice" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Practice</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Answer out loud or in writing. Get scored either way.</div>
            </div>
            <KeyNotice apiKey={apiKey} onOpenSettings={() => setView("settings")} />

            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {CATEGORIES.map(cat => (
                <div key={cat} onClick={() => newQuestion(cat)} style={{ cursor: "pointer" }}>
                  <Badge tone={cat === category ? "amber" : "muted"}>{cat}</Badge>
                </div>
              ))}
            </div>

            <Card glow style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontFamily: "Fraunces", fontSize: 21, lineHeight: 1.5, fontStyle: "italic" }}>
                  {genLoading ? "Thinking of a question…" : `"${question}"`}
                </div>
                <div onClick={() => newQuestion(category)} style={{ cursor: "pointer", color: C.muted, flexShrink: 0, marginTop: 4 }} title="New question">
                  {genLoading ? <Loader2 size={17} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={17} />}
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Your answer</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {recording && <Waveform active={recording} />}
                  <Button variant={recording ? "danger" : "secondary"} onClick={toggleRecording}>
                    {recording ? <Square size={14} /> : <Mic size={14} />}
                    {recording ? "Stop" : "Speak"}
                  </Button>
                </div>
              </div>
              <TextArea rows={6} placeholder="Type your answer, or hit Speak to talk it through." value={answer} onChange={e => setAnswer(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <Button variant="primary" onClick={submitAnswer} disabled={!answer.trim() || scoreLoading}>
                  {scoreLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                  {scoreLoading ? "Scoring…" : "Get feedback"}
                </Button>
              </div>
            </Card>

            {lastResult && (
              <Card>
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <ScoreRing score={lastResult.score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 14, color: C.text }}>{lastResult.summary}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.teal, fontWeight: 500, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircle2 size={13} /> Strengths
                        </div>
                        {(lastResult.strengths || []).map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>{s}</div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.coral, fontWeight: 500, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <ChevronRight size={13} /> Improve
                        </div>
                        {(lastResult.improvements || []).map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>{s}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {view === "resume" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Resume analyzer</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Paste your resume text for a quick review.</div>
            </div>
            <KeyNotice apiKey={apiKey} onOpenSettings={() => setView("settings")} />
            <Card style={{ marginBottom: 16 }}>
              <TextArea rows={10} placeholder="Paste your resume text here…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <Button variant="primary" onClick={analyzeResume} disabled={!resumeText.trim() || resumeLoading}>
                  {resumeLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                  {resumeLoading ? "Analyzing…" : "Analyze resume"}
                </Button>
              </div>
            </Card>

            {resumeResult && (
              <Card>
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: resumeResult.keywords?.length ? 16 : 0 }}>
                  <ScoreRing score={resumeResult.score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 14 }}>{resumeResult.summary}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.teal, fontWeight: 500, marginBottom: 6 }}>Strengths</div>
                        {(resumeResult.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>{s}</div>)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.coral, fontWeight: 500, marginBottom: 6 }}>Improve</div>
                        {(resumeResult.improvements || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>{s}</div>)}
                      </div>
                    </div>
                  </div>
                </div>
                {resumeResult.keywords?.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {resumeResult.keywords.map((k, i) => <Badge key={i} tone="muted">{k}</Badge>)}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {view === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Assistant</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Ask anything about interview prep.</div>
            </div>
            <KeyNotice apiKey={apiKey} onOpenSettings={() => setView("settings")} />
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 14, paddingRight: 4 }}>
              {chat.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                  <div style={{
                    maxWidth: "72%", padding: "10px 14px", borderRadius: 12, fontSize: 14, lineHeight: 1.55,
                    background: m.role === "user" ? C.amber : C.panel2,
                    color: m.role === "user" ? "#241A08" : C.text,
                    border: m.role === "user" ? "none" : `1px solid ${C.border}`,
                  }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 6, color: C.muted, fontSize: 13, alignItems: "center" }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Input placeholder="Ask about answer structure, nerves, negotiation…" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()} />
              <Button variant="primary" onClick={sendChat} disabled={!chatInput.trim()}><Send size={14} /></Button>
            </div>
          </div>
        )}

        {view === "reports" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Reports</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Export your practice history.</div>
            </div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, marginBottom: 4 }}>Download report</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Opens a print view — save as PDF from your browser's print dialog.</div>
                </div>
                <Button variant="primary" onClick={downloadReport} disabled={sessions.length === 0}>
                  <Download size={14} /> Download
                </Button>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 15, marginBottom: 4 }}>Email report</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                Sending needs a backend (this demo runs entirely in your browser). Wire this up to a Node + Nodemailer endpoint in the full build.
              </div>
              <form onSubmit={sendEmail} style={{ display: "flex", gap: 10 }}>
                <Input type="email" required placeholder="you@example.com" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} />
                <Button type="submit" variant="secondary"><Mail size={14} /> Send</Button>
              </form>
              {emailSent && <div style={{ color: C.teal, fontSize: 13, marginTop: 10 }}>Queued — this is a demo, so no email actually goes out yet.</div>}
            </Card>

            {sessions.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Session history</div>
                {sessions.slice().reverse().map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.question}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.category} · {new Date(s.date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontFamily: "IBM Plex Mono", fontSize: 15, color: s.score >= 75 ? C.teal : s.score >= 50 ? C.amber : C.coral, marginLeft: 12 }}>{s.score}</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {view === "settings" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Fraunces", fontSize: 26 }}>Settings</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Connect your Groq API key to unlock real AI generation, scoring, and chat.</div>
            </div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Groq API key</div>
              <div style={{ display: "flex", gap: 10 }}>
                <Input type="password" placeholder="gsk_…" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} />
                <Button variant="primary" onClick={saveApiKey}>Save</Button>
                {apiKey && <Button variant="secondary" onClick={clearApiKey}><X size={14} /></Button>}
              </div>
              <div style={{ fontSize: 12.5, color: C.mutedDark, marginTop: 10, lineHeight: 1.6 }}>
                Get a free key at console.groq.com. Saved to your account in Supabase (row-level security scopes it to only you), so it's there next time you sign in. It's sent only to Groq's API and to your own Supabase project — never anywhere else. Treat it like a password: don't share this account.
                If requests fail with a network/CORS error, Groq's endpoint may need to be called from a small backend instead — happy to build that as the full downloadable version.
              </div>
              {apiKey && <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.teal, fontSize: 13, marginTop: 12 }}><CheckCircle2 size={14} /> Key active — questions, scoring, and chat use Groq now.</div>}
            </Card>
            <Card>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>What's simulated in this demo</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }}>
                Voice input uses your browser's built-in speech recognition (Chrome recommended).<br/>
                PDF export uses your browser's print-to-PDF, not a server.<br/>
                Email sending is a stub — it needs a real backend to actually deliver mail.<br/>
                Session history and dashboard stats live in memory for this session only.
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={22} color={C.amber} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onSignedIn={() => {}} />;
  }

  return <InterviewApp user={session.user} onSignOut={() => supabase.auth.signOut()} />;
}
