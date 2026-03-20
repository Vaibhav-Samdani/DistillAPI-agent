"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { 
  UploadCloud, BrainCircuit, Loader2, FileCheck, 
  Target, FlaskConical, Sparkles, ChevronRight, 
  ThumbsUp, AlertTriangle, Lightbulb, Quote
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


const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;


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

interface QAPair {
  question: string;
  answer: string;
}

interface ProcessedData {
  summary: StructuredSummary;
  qa_pairs: QAPair[];
}

// --- Custom Markdown Renderer ---
// This ensures Tailwind doesn't strip the styling from our Markdown elements
const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
        strong: ({ children }) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 marker:text-zinc-400">{children}</ul>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            Upload any research paper. Our LangGraph agent will digest the PDF, extract the core methodology, and generate study questions.
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

            {/* Right Column: Q&A */}
            <div className="lg:col-span-5">
              <div className="sticky top-6">
                <Card className="shadow-lg border-zinc-200/50 dark:border-zinc-800/50">
                  <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BrainCircuit className="w-5 h-5 text-indigo-500" />
                      Knowledge Check
                    </CardTitle>
                    <CardDescription>Generated questions to test your comprehension.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[600px] px-4 py-2">
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
                </Card>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}