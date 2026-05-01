"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { ArtifactState, EMPTY_ARTIFACT } from "@/lib/artifact-types";
import { ArtifactRenderer } from "@/components/artifact/ArtifactRenderer";
import ReactMarkdown from "react-markdown";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message { role: "user" | "assistant"; content: string; timestamp: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AIResearchPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactState>(EMPTY_ARTIFACT);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => { esRef.current?.close(); }, []);

  const sendMessage = useCallback(async () => {
    const query = input.trim();
    if (!query || isLoading) return;
    setInput("");
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: query, timestamp: new Date().toISOString() }]);
    setArtifact({ ...EMPTY_ARTIFACT, isStreaming: true });

    let assistantText = "";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${API_BASE}/api/v1/agent/stream?q=${encodeURIComponent(query)}`);
    esRef.current = es;

    const parseSafeJSON = (str: string) => {
      try {
        return JSON.parse(str.replace(/:\s*NaN/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*-Infinity/g, ': null'));
      } catch {
        return {};
      }
    };

    es.addEventListener("artifact_type", (e) => {
      const data = parseSafeJSON(e.data);
      setArtifact(prev => ({
        ...prev,
        isStreaming: true,
        decision: {
          type:        data.type        ?? "full_analysis",
          layout:      data.layout      ?? "investment_thesis",
          components:  data.components  ?? ["HeroMetric","MetricGrid:3col","VerdictBanner"],
          emphasis:    data.emphasis    ?? "fundamentals_primary",
          text_length: data.text_length ?? "1_sentence",
        },
      }));
    });
    es.addEventListener("artifact_text", (e) => { const { text } = parseSafeJSON(e.data); setArtifact(p => ({ ...p, text })); });
    es.addEventListener("slot_technicals", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, technicals: d } })); });
    es.addEventListener("slot_news", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, news: d } })); });
    es.addEventListener("slot_fundamentals", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, fundamentals: d } })); });
    es.addEventListener("slot_financials", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, financials: d } })); });
    es.addEventListener("slot_compare", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, compare: d } })); });
    es.addEventListener("slot_verdict", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, slots: { ...p.slots, verdict: d } })); });

    es.addEventListener("classified", (e) => { const d = parseSafeJSON(e.data); setArtifact(p => ({ ...p, symbol: d.symbol || p.symbol })); });
    es.addEventListener("chunk", (e) => { const d = parseSafeJSON(e.data); assistantText += d.text || d.content || ""; });
    es.addEventListener("result", (e) => { const d = parseSafeJSON(e.data); assistantText = d.content || assistantText; });

    es.addEventListener("done", () => {
      es.close();
      setIsLoading(false);
      setArtifact(p => ({ ...p, isStreaming: false }));
      if (assistantText) setMessages(p => [...p, { role: "assistant", content: assistantText, timestamp: new Date().toISOString() }]);
    });
    es.addEventListener("error", () => {
      es.close();
      setIsLoading(false);
      setArtifact(p => ({ ...p, isStreaming: false }));
      setMessages(p => [...p, { role: "assistant", content: "An error occurred. Please try again.", timestamp: new Date().toISOString() }]);
    });
  }, [input, isLoading]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background overflow-hidden">
      {/* LEFT: CHAT PANEL */}
      <div className="w-[400px] flex flex-col border-r border-border shrink-0">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">AI Research</h2>
          <p className="text-xs text-muted mt-0.5">Ask anything about Indian stocks</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-muted">Start by asking about any NSE stock</p>
              <div className="mt-4 space-y-2">
                {["Analyze RELIANCE for long term", "TCS vs Infosys compare karo", "Latest news on HDFC Bank", "What is PE ratio?"].map(s => (
                  <button key={s} onClick={() => setInput(s)} className="block w-full text-left text-xs text-muted hover:text-lime px-3 py-2 rounded bg-dim hover:bg-card border border-border transition-colors">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-lime text-background font-medium" : "bg-card border border-border text-text"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose-sm prose-invert max-w-none [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&_strong]:text-lime">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about any NSE stock..." disabled={isLoading}
              className="flex-1 bg-dim border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-lime disabled:opacity-50"
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-lime text-background text-sm font-semibold rounded-lg hover:bg-lime/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Send
            </button>
          </div>
        </div>
      </div>
      {/* ── RIGHT: ARTIFACT PANEL ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lime font-semibold text-sm">
              {artifact.symbol ?? "AI Research"}
            </span>
            {artifact.decision && (
              <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">
                {artifact.decision.layout.replace(/_/g, " ")}
              </span>
            )}
            {artifact.isStreaming && (
              <div className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {artifact.decision && (
              <span className="text-xs text-zinc-700">
                {artifact.decision.components.length} components
              </span>
            )}
          </div>
        </div>

        {/* Dynamic renderer */}
        <ArtifactRenderer artifact={artifact} />

      </div>
    </div>
  );
}
