"use client";

import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { IcSend } from '@/components/Icons';
import { aiApi, AnalyzeResponse } from '@/lib/ai.api';

const SUGGESTIONS = [
  'Should I invest in IT sector?',
  'Analyze RELIANCE for long term',
  'Best mid-cap stocks for 2026',
  'Compare TCS vs INFY fundamentals',
  'Risk analysis: my current portfolio',
];

const AGENT_STEPS = [
  'Fetching NSE / market data…',
  'Running technical analysis…',
  'Analyzing news sentiment…',
  'Generating recommendation…'
];

type Message = {
  role: 'user' | 'ai';
  text: string;
};

export default function AIPage() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [step, setStep] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const formatAiResponse = (response: AnalyzeResponse): string => {
    const verdictEmoji = response.verdict === 'BULLISH' ? '📈' : response.verdict === 'BEARISH' ? '📉' : '➡️';
    return [
      `**Verdict: ${response.verdict}** ${verdictEmoji} (Confidence: ${response.confidence}%)`,
      '',
      response.reasoning_summary,
      '',
      `**Risk Assessment:** ${response.risk_assessment}`,
    ].join('\n');
  };

  const send = async (text?: string) => {
    const q = text || input; 
    if (!q.trim() || thinking) return;
    
    setInput(''); 
    setMsgs(m => [...m, { role: 'user', text: q }]); 
    setThinking(true); 
    setStep(0);
    
    // Animation interval while waiting for API
    const interval = setInterval(() => {
      setStep(s => (s < AGENT_STEPS.length ? s + 1 : s));
    }, 1500);

    try {
      const response = await aiApi.analyze(q);
      const formatted = formatAiResponse(response);
      
      setMsgs(m => [...m, { 
        role: 'ai', 
        text: formatted 
      }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setMsgs(m => [...m, {
        role: 'ai',
        text: `**Error:** Sorry, I encountered an issue processing your request. ${errorMsg}. Please try again later.`,
      }]);
    } finally {
      clearInterval(interval);
      setThinking(false);
      setStep(0);
    }
  };

  useEffect(() => { 
    endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [msgs, thinking]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="AI Research Agent" />
      <div className="flex-1 flex flex-col p-5 md:p-[22px] gap-3.5 overflow-hidden">
        
        {/* Suggestions */}
        {msgs.length === 0 && (
          <div className="text-center pt-10">
            <div className="text-[28px] font-semibold tracking-[-0.03em] mb-2">AI Research Agent</div>
            <div className="text-sm text-muted mb-8">Ask anything about markets, stocks, or your portfolio</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-[600px] mx-auto">
              {SUGGESTIONS.map(s => (
                <button 
                  key={s} 
                  onClick={() => send(s)} 
                  className="bg-card border border-border rounded-full px-4 py-[9px] text-[12.5px] text-text cursor-pointer hover:bg-card2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-2">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div 
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                  m.role === 'user' 
                    ? 'bg-gradient-to-br from-purple to-pink text-white' 
                    : 'bg-gradient-to-br from-lime to-[#7aaa00] text-black'
                }`}
              >
                {m.role === 'user' ? 'A' : 'F'}
              </div>
              <div 
                className={`max-w-[72%] rounded-[14px] p-3 px-4 ${
                  m.role === 'user' ? 'bg-dim border border-border border-r-transparent border-y-transparent' : 'bg-card border border-border'
                }`}
              >
                <div className="text-[13px] leading-[1.75] text-text whitespace-pre-line">
                  {m.text.split('**').map((part, j) => 
                    j % 2 === 1 
                      ? <strong key={j} className="text-lime">{part}</strong> 
                      : <span key={j}>{part}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {thinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-lime to-[#7aaa00] flex items-center justify-center text-xs font-bold text-black">F</div>
              <div className="bg-card border border-border rounded-[14px] p-3 px-4">
                {AGENT_STEPS.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 ${i < AGENT_STEPS.length - 1 ? 'mb-2' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i < step ? 'bg-lime' : 'bg-dim'}`} />
                    <span className={`text-xs ${i < step ? 'text-lime' : 'text-muted'}`}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2.5 bg-card border border-border-hi rounded-[14px] p-2.5 px-3.5 mt-auto shrink-0">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && send()} 
            placeholder="Ask the AI agent… e.g. Should I buy RELIANCE now?" 
            className="flex-1 bg-transparent border-none outline-none text-text text-[13px] w-full"
            disabled={thinking}
          />
          <button 
            onClick={() => send()} 
            disabled={thinking}
            className="bg-lime border-none rounded-[9px] w-9 h-9 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <IcSend c="#000" s={15} />
          </button>
        </div>

      </div>
    </div>
  );
}
