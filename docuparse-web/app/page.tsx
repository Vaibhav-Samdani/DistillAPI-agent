"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  UploadCloud, BrainCircuit, Loader2, FileCheck, 
  Target, FlaskConical, Sparkles, ChevronRight, 
  ThumbsUp, AlertTriangle, Lightbulb, Quote,
  MessageSquare, Send, User, Bot,  BookOpen, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
// Add BookOpen and X to your lucide-react imports


const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000";

// --- Types ---
interface StructuredSummary {
  core_problem: string;
  methodology: string[];
  key_findings: string[];
  strengths: string[];
  limitations: string[];
  practical_implications: string;
  tl_dr: string;
}


interface SourceChunk {
  page: number;
  text: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: SourceChunk[]; // <-- ADDED THIS
}

interface QAPair {
  question: string;
  answer: string;
}

interface ProcessedData {
  summary: StructuredSummary;
  qa_pairs: QAPair[];
}


// --- Custom Markdown Renderer ---
const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
        strong: ({ children }) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 marker:text-zinc-400">{children}</ul>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        
        // --- NEW: Custom renderer to catch and style citations ---
        code: ({ inline, className, children, ...props }: any) => {
          const text = String(children);
          // If the text matches our citation format exactly: [Page X]
          if (inline && /^\[Page \d+\]$/i.test(text)) {
            return (
              <span 
                className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                title="Source Citation"
              >
                {text}
              </span>
            );
          }
          // Otherwise, render normal inline code blocks
          return (
            <code className="bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5 text-sm font-mono text-zinc-800 dark:text-zinc-200" {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // --- NEW RAG STATE ---
  const [docId, setDocId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"qa" | "chat">("qa");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Add these right below your other RAG states (around line 75)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<SourceChunk[]>([]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setDocId(null);
      setError(null);
      setChatMessages([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${baseUrl}/process-paper`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process the document.");

      const data = await response.json();
      setResult(data.data);
      setDocId(data.doc_id); // Save the document ID for chat
      setChatMessages([
        { role: "assistant", text: `Hello! I've analyzed **${file.name}**. What specific questions do you have about it?` }
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !docId) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsChatting(true);

    try {
      const response = await fetch(`${baseUrl}/chat/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: "assistant", text: data.answer, sources: data.sources }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: "assistant", text: "⚠️ Connection error. Please try asking again." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12 font-sans selection:bg-indigo-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-2">
            <BrainCircuit className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            DistillAPI Explorer
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto text-lg">
            Upload any research paper. Our agent will digest the PDF, extract the core methodology, and let you chat directly with the text.
          </p>
        </div>

        {/* Upload Card */}
        <Card className="max-w-2xl mx-auto border-2 border-dashed shadow-sm transition-all hover:border-indigo-400">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            {!file ? (
              <UploadCloud className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
            ) : (
              <FileCheck className="w-12 h-12 text-emerald-500" />
            )}
            
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">
                {file ? file.name : "Select a PDF document"}
              </h3>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 pt-2">
              <div className="relative">
                <Button variant="outline" type="button">Choose File</Button>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              
              <Button 
                onClick={handleUpload} 
                disabled={!file || loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                ) : (
                  "Distill Document"
                )}
              </Button>
            </div>
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8">
            
            {/* Left Column: Structured Summary */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* TL;DR Banner */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-6 flex gap-4 items-start shadow-sm">
                <Quote className="w-8 h-8 text-indigo-400 shrink-0 opacity-50" />
                <div>
                  <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider mb-1">TL;DR</h4>
                  <div className="text-lg font-medium text-indigo-950 dark:text-indigo-100 leading-relaxed">
                    <MarkdownRenderer content={result.summary.tl_dr || "Generating TL;DR failed. Please try again."} />
                  </div>
                </div>
              </div>

              {/* Problem & Implications Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-red-50/40 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                      <Target className="w-5 h-5" /> Core Problem
                    </div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      <MarkdownRenderer content={result.summary.core_problem || "No core problem identified."} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Lightbulb className="w-5 h-5" /> Practical Implications
                    </div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      <MarkdownRenderer content={result.summary.practical_implications || "No implications detailed."} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Methodology Card */}
              <Card className="shadow-sm border-zinc-200/50 dark:border-zinc-800/50">
                <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FlaskConical className="w-5 h-5 text-blue-500" /> Methodology
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {(result.summary.methodology || ["Methodology data missing."]).map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <ChevronRight className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <span className="leading-relaxed"><MarkdownRenderer content={item} /></span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Key Findings Card */}
              <Card className="shadow-sm border-zinc-200/50 dark:border-zinc-800/50">
                <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-amber-500" /> Key Findings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {(result.summary.key_findings || ["No key findings extracted."]).map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                        <span className="leading-relaxed"><MarkdownRenderer content={item} /></span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Strengths & Limitations Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-sm border-zinc-200/50 dark:border-zinc-800/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
                      <ThumbsUp className="w-4 h-4" /> Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-disc pl-4 marker:text-emerald-400">
                      {(result.summary.strengths || ["No strengths noted."]).map((item, i) => (
                        <li key={i}><MarkdownRenderer content={item} /></li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-zinc-200/50 dark:border-zinc-800/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="w-4 h-4" /> Limitations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-disc pl-4 marker:text-amber-500">
                      {(result.summary.limitations || ["No limitations noted."]).map((item, i) => (
                        <li key={i}><MarkdownRenderer content={item} /></li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Column: Assistant (QA & Chat) */}
            <div className="lg:col-span-5">
              <div className="sticky top-6">
                <Card className="shadow-lg border-zinc-200/50 dark:border-zinc-800/50 flex flex-col h-187.5">
                  
                  {/* Assistant Header & Tabs */}
                  <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/50 pb-0">
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setActiveTab("qa")}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                          activeTab === "qa" 
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        <BrainCircuit className="w-4 h-4" /> Knowledge Check
                      </button>
                      <button
                        onClick={() => setActiveTab("chat")}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                          activeTab === "chat" 
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" /> Chat with Paper
                      </button>
                    </div>
                  </CardHeader>

                  {/* Tab Content: Q&A */}
                  {activeTab === "qa" && (
                    <CardContent className="flex-1 p-0 overflow-hidden">
                      <ScrollArea className="h-full px-6 py-4">
                        <Accordion type="single" collapsible className="w-full">
                          {(result.qa_pairs || []).map((qa, index) => (
                            <AccordionItem key={index} value={`item-${index}`} className="border-b-zinc-100 dark:border-zinc-800/50">
                              <AccordionTrigger className="text-left font-semibold text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-4">
                                <MarkdownRenderer content={qa.question} />
                              </AccordionTrigger>
                              <AccordionContent className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-lg mt-1 mb-2 border border-zinc-100 dark:border-zinc-800">
                                <MarkdownRenderer content={qa.answer} />
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </ScrollArea>
                    </CardContent>
                  )}

                  {/* Tab Content: Chat & Sidebar Layout */}
                  {activeTab === "chat" && (
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative">
                      
                      {/* Main Chat Area */}
                      <div className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth">
                        <div className="space-y-6">
                          {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              {msg.role === "assistant" && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-1">
                                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                              )}
                              
                              <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                <div 
                                  className={`text-sm leading-relaxed p-3 rounded-2xl ${
                                    msg.role === "user" 
                                      ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm" 
                                      : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 rounded-tl-sm border border-zinc-200/50 dark:border-zinc-700/50"
                                  }`}
                                >
                                  <MarkdownRenderer content={msg.text} />
                                </div>

                                {/* NEW: View Sources Button for Assistant */}
                                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setActiveSources(msg.sources!);
                                      setIsSidebarOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors px-1"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    View 5 Sources
                                  </button>
                                )}
                              </div>

                              {msg.role === "user" && (
                                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-1">
                                  <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {isChatting && (
                            <div className="flex gap-3 justify-start">
                               <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-1">
                                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                              <div className="bg-zinc-100 dark:bg-zinc-800/80 p-4 rounded-2xl rounded-tl-sm flex items-center gap-1 border border-zinc-200/50 dark:border-zinc-700/50">
                                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} className="h-2" />
                        </div>
                      </div>
                      
                      {/* Chat Input */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 shrink-0 z-10">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask a question about the paper..."
                            disabled={isChatting}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                          />
                          <Button 
                            type="submit" 
                            disabled={isChatting || !chatInput.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 shadow-sm"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </form>
                      </div>

                      {/* NEW: Sliding Sources Sidebar */}
                      <div 
                        className={`absolute inset-y-0 right-0 w-full md:w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl transition-transform duration-300 ease-in-out z-20 flex flex-col ${
                          isSidebarOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                      >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                            <BookOpen className="w-4 h-4" />
                            Source References
                          </div>
                          <button 
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {activeSources.map((source, idx) => (
                            <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                              <div className="bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                <span>Reference {idx + 1}</span>
                                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                                  Page {source.page}
                                </span>
                              </div>
                              <div className="p-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-mono">
                                {source.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                </Card>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}