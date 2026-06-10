import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  CheckCheck, 
  Wand2, 
  BookOpen, 
  ChevronRight, 
  Info, 
  FileText, 
  X, 
  Check, 
  Volume2, 
  RefreshCw, 
  Sliders, 
  AlignLeft, 
  Clock, 
  Smile, 
  GraduationCap, 
  TrendingUp, 
  User, 
  Copy, 
  AlertCircle,
  PlayCircle,
  HelpCircle,
  FileEdit,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Type definitions matching the server structure
interface BaseIssue {
  original: string;
  suggestion: string;
  type: 'grammar' | 'spelling' | 'punctuation' | 'clarity' | 'vocabulary';
  explanation: string;
}

interface Readability {
  score: string;
  summary: string;
}

interface AnalysisResponse {
  issues: BaseIssue[];
  readability: Readability;
  suggestions: string[];
}

const TEMPLATES = [
  {
    title: "1. Grammar & Spelling Mistakes",
    text: "their is a lot of people whom goes to the store but they doesnt know what to buy. i seen a dog who have no leash, it was really scary! its running fastly.",
    description: "Contains severe grammatical, spelling, and adverb issues."
  },
  {
    title: "2. Repetitive & Wordy Email",
    text: "I am writing this email to you because I wanted to let you know that we are having a discussion about the project tomorrow morning. We need to finalize the things that we talked about earlier last week. If you can make it, it would be extremely appreciated by all of us in the team.",
    description: "Passive, wordy, and needs clarity improvements."
  },
  {
    title: "3. Flat & Boring Story Draft",
    text: "The movie was very good. The actors did a great job. The story was nice and it had a cool ending. I liked it a lot and I think you should see it.",
    description: "Simple phrasing that needs premium vocabulary enhancement."
  }
];

export default function App() {
  const [text, setText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'write' | 'review'>('write');
  
  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [issues, setIssues] = useState<BaseIssue[]>([]);
  const [readability, setReadability] = useState<Readability>({
    score: 'Awaiting Text',
    summary: 'Write or paste your text, then click "Analyze Writing" to see insights.'
  });
  const [overarchingSuggestions, setOverarchingSuggestions] = useState<string[]>([]);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);

  // Autocomplete suggestions
  const [isSuggestingAutocomplete, setIsSuggestingAutocomplete] = useState<boolean>(false);
  const [autocompleteText, setAutocompleteText] = useState<string>('');

  // Rewrite panel states
  const [isRewriting, setIsRewriting] = useState<boolean>(false);
  const [selectedTone, setSelectedTone] = useState<string>('none');
  const [selectedMode, setSelectedMode] = useState<string>('none');
  const [rewriteExplanation, setRewriteExplanation] = useState<string>('');

  // Copy status
  const [copied, setCopied] = useState<boolean>(false);

  // Error notifications
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-analysis on paste or trigger
  const handleAnalyze = async (textToAnalyze = text) => {
    if (!textToAnalyze.trim()) return;
    setIsAnalyzing(true);
    setErrorMessage('');
    setSelectedIssueIndex(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze }),
      });
      if (!response.ok) {
        throw new Error('Analysis server encountered an issue.');
      }
      const data: AnalysisResponse = await response.json();
      
      // Filter out issues that can't be found exactly in the text anymore to prevent crashes
      const validIssues = (data.issues || []).filter(issue => {
        return textToAnalyze.includes(issue.original);
      });
      
      setIssues(validIssues);
      setReadability(data.readability || { score: 'Medium', summary: 'Analysis complete.' });
      setOverarchingSuggestions(data.suggestions || []);
      
      // Auto switch to review mode if elements found
      if (validIssues.length > 0) {
        setActiveTab('review');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to AI writing model.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async (mode: string, tone: string) => {
    if (!text.trim()) return;
    setIsRewriting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode, tone }),
      });
      if (!response.ok) {
        throw new Error('Rewrite server encountered an issue.');
      }
      const data = await response.json();
      setText(data.rewritten);
      setRewriteExplanation(data.explanation);
      
      // Re-run analysis on the rewritten text
      handleAnalyze(data.rewritten);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply rewrite.');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleAutocomplete = async () => {
    if (!text.trim()) return;
    setIsSuggestingAutocomplete(true);
    try {
      const response = await fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error('Autocomplete service offline.');
      }
      const data = await response.json();
      if (data.suggestion) {
        setAutocompleteText(data.suggestion);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggestingAutocomplete(false);
    }
  };

  const applyAutocomplete = () => {
    if (autocompleteText) {
      setText(prev => prev + (prev.endsWith(' ') ? '' : ' ') + autocompleteText);
      setAutocompleteText('');
    }
  };

  const handleApplyCorrection = (issue: BaseIssue, index: number) => {
    // Replace the exact first occurrence of original substring
    const pos = text.indexOf(issue.original);
    if (pos !== -1) {
      const updatedText = text.slice(0, pos) + issue.suggestion + text.slice(pos + issue.original.length);
      setText(updatedText);
      
      // Remove this issue from matching lists
      const updatedIssues = [...issues];
      updatedIssues.splice(index, 1);
      
      // Offset remaining issues that might contain matches and remove invalid ones
      const reValidIssues = updatedIssues.filter(iss => updatedText.includes(iss.original));
      setIssues(reValidIssues);
      setSelectedIssueIndex(null);
    }
  };

  const handleDismissCorrection = (index: number) => {
    const updatedIssues = [...issues];
    updatedIssues.splice(index, 1);
    setIssues(updatedIssues);
    setSelectedIssueIndex(null);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadTemplate = (templateText: string) => {
    setText(templateText);
    setAutocompleteText('');
    setIssues([]);
    setSelectedIssueIndex(null);
    setRewriteExplanation('');
    // Analyze automatically
    handleAnalyze(templateText);
  };

  // Text Statistics calculations
  const cleanWordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const characterCount = text.length;
  const readingTimeEstimate = cleanWordCount ? (cleanWordCount < 100 ? `${Math.ceil((cleanWordCount / 200) * 60)} sec` : `${Math.ceil(cleanWordCount / 200)} min`) : '0 min';

  // Highlight color helper
  const getIssueColorClass = (type: string, isTextDecoration = false) => {
    switch (type) {
      case 'spelling':
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-rose-500 bg-rose-100/60 dark:bg-rose-950/20 cursor-pointer transition'
          : 'border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20';
      case 'grammar':
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-amber-500 bg-amber-100/50 dark:bg-amber-950/20 cursor-pointer transition'
          : 'border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20';
      case 'clarity':
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-sky-500 bg-sky-150/50 dark:bg-sky-950/20 cursor-pointer transition'
          : 'border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/20';
      case 'vocabulary':
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-indigo-500 bg-indigo-100/50 dark:bg-indigo-950/20 cursor-pointer transition'
          : 'border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20';
      case 'punctuation':
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-orange-400 bg-orange-100/50 dark:bg-orange-950/20 cursor-pointer transition'
          : 'border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20';
      default:
        return isTextDecoration 
          ? 'underline decoration-wavy decoration-gray-400 bg-gray-100/50 cursor-pointer transition'
          : 'border-gray-500 hover:bg-gray-50';
    }
  };

  // Render text with interactive spans in Review Mode
  const renderHighlightedText = () => {
    if (!text) {
      return <p className="text-gray-400 italic">No text provided. Go to Write mode to type or load templates.</p>;
    }

    if (issues.length === 0) {
      return <p className="text-gray-800 leading-relaxed dark:text-gray-200 whitespace-pre-wrap">{text}</p>;
    }

    // Advanced precision text parser to split paragraph around issues
    // Sort issues by index order of original occurrences
    let occurrences: { start: number; end: number; issue: BaseIssue; index: number }[] = [];
    
    issues.forEach((issue, idx) => {
      let startIndex = 0;
      while ((startIndex = text.indexOf(issue.original, startIndex)) !== -1) {
        // Confirm this occurrence does not overlap any existing found ones
        const isOverlap = occurrences.some(occ => 
          (startIndex >= occ.start && startIndex < occ.end) || 
          (startIndex + issue.original.length > occ.start && startIndex + issue.original.length <= occ.end)
        );

        if (!isOverlap) {
          occurrences.push({
            start: startIndex,
            end: startIndex + issue.original.length,
            issue,
            index: idx
          });
          break; // Match first occurrences only to correspond to issues array cleanly
        }
        startIndex += 1;
      }
    });

    // Sort occurrences by start character index
    occurrences.sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    occurrences.forEach((occ, key) => {
      // Direct string from last index to start of issue
      if (occ.start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}-${occ.start}`} className="whitespace-pre-wrap">
            {text.slice(lastIndex, occ.start)}
          </span>
        );
      }

      // Highlighted interactive word
      const isSelected = selectedIssueIndex === occ.index;
      elements.push(
        <span
          key={`issue-${occ.index}`}
          className={`${getIssueColorClass(occ.issue.type, true)} font-medium relative ${
            isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 rounded-sm' : ''
          }`}
          onClick={() => setSelectedIssueIndex(occ.index)}
          title={`Click to resolve issue: ${occ.issue.type}`}
        >
          {text.slice(occ.start, occ.end)}
        </span>
      );

      lastIndex = occ.end;
    });

    // Remainder of string
    if (lastIndex < text.length) {
      elements.push(
        <span key={`text-end`} className="whitespace-pre-wrap">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans dark:bg-slate-950 dark:text-slate-150 transition-colors duration-200">
      
      {/* Header Bar */}
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between dark:border-slate-800 dark:bg-slate-900/85" id="app-header">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-200 dark:shadow-none flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-600 bg-clip-text text-transparent dark:from-white dark:via-indigo-200 dark:to-indigo-400">
              AI Schreibstil-Checker & Assistant
            </h1>
            <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
              Your real-time elite editor fueled by Gemini 3.5 AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            AI Assistant Active
          </span>
          {text && (
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1 text-sm bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition font-medium dark:bg-slate-850 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Copy current document text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Editor Main Canvas - left 8 cols */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Quick Demo Playground if and when user starts empty */}
          {!text && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 border border-indigo-200/50 p-5 rounded-2xl dark:from-slate-900 dark:to-slate-950/60 dark:border-slate-800" id="playground-panel">
              <h3 className="text-sm font-semibold text-indigo-950 flex items-center gap-2 mb-2 dark:text-indigo-200">
                <PlayCircle className="w-4 h-4 text-indigo-600" /> Play with Demo Templates
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed dark:text-slate-400">
                Instantly load writing samples with errors, wordiness, or simple structures to witness grammar improvements in seconds.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TEMPLATES.map((tmpl, tIdx) => (
                  <button
                    key={tIdx}
                    onClick={() => loadTemplate(tmpl.text)}
                    className="p-3.5 bg-white border border-slate-200 hover:border-indigo-400 text-left rounded-xl hover:shadow-md transition duration-200 group dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-800"
                  >
                    <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition dark:text-slate-200 dark:group-hover:text-indigo-400 flex items-center justify-between">
                      <span>{tmpl.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition translate-x-[-4px] group-hover:translate-x-0" />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 dark:text-slate-400">{tmpl.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core Writing Canvas Section */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col dark:bg-slate-900 dark:border-slate-800" id="writing-canvas">
            
            {/* Tabs & Mode Switcher bar */}
            <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-3 flex items-center justify-between dark:bg-slate-900/50 dark:border-slate-850">
              <div className="flex gap-1 bg-slate-200/60 p-1.5 rounded-xl dark:bg-slate-800">
                <button
                  onClick={() => setActiveTab('write')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'write'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-750 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  Write & Edit
                </button>
                <button
                  onClick={() => {
                    setActiveTab('review');
                    if (issues.length === 0 && text.trim()) {
                      handleAnalyze();
                    }
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'review'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-750 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  AI Review
                  {issues.length > 0 && (
                    <span className="bg-indigo-650 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {issues.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Autocomplete Quick Trigger */}
              {text && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutocomplete}
                    disabled={isSuggestingAutocomplete}
                    className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200/50 text-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-350 dark:border-slate-700"
                    title="Get suggestions of subsequent sentences/words contextually"
                  >
                    <Wand2 className="w-3 h-3 text-indigo-500" />
                    {isSuggestingAutocomplete ? 'Generating...' : 'AI Autocomplete'}
                  </button>
                </div>
              )}
            </div>

            {/* Editing Box */}
            <div className="p-6 flex-1 min-h-[380px] flex flex-col relative">
              {activeTab === 'write' ? (
                <div className="flex-1 flex flex-col h-full relative">
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setAutocompleteText('');
                      if (issues.length > 0) setIssues([]); // Reset active underlines as text changed
                    }}
                    placeholder="Embark on your writing journey here... Drag & paste, load a sample template, or write from scratch. Standard text checking, sentence expansions, tone conversions will process magically."
                    className="w-full flex-1 min-h-[350px] resize-none outline-none border-0 text-slate-850 dark:text-slate-100 leading-relaxed text-base placeholder-slate-400/80 bg-transparent"
                    id="writing-textarea"
                  />
                  
                  {/* Floating context autocomplete prompt banner if exists */}
                  {autocompleteText && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-2 left-0 right-0 bg-indigo-50/95 border border-indigo-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm dark:bg-slate-800 dark:border-indigo-900/50 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-650 shrink-0 dark:text-indigo-400" />
                        <p className="text-xs text-indigo-950 dark:text-slate-200 leading-relaxed font-medium">
                          Next suggestion: <strong className="text-indigo-700 dark:text-indigo-400 font-bold">"{autocompleteText}"</strong>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAutocompleteText('')}
                          className="p-1 px-2.5 rounded-md text-[11px] text-slate-500 hover:bg-slate-250 dark:text-slate-400"
                        >
                          Discard
                        </button>
                        <button
                          onClick={applyAutocomplete}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-1 px-3 rounded-md text-[11px] transition shadow-sm"
                        >
                          Accept Suggestion (Tab)
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                /* Interactive Review Layout Overlay */
                <div className="flex-1 min-h-[350px] bg-slate-50/20 rounded-xl leading-relaxed text-base selection:bg-indigo-200/50 p-1 dark:selection:bg-indigo-900/50 min-h-full">
                  <div className="prose prose-indigo max-w-none text-slate-850 dark:text-slate-200">
                    {renderHighlightedText()}
                  </div>
                </div>
              )}
            </div>

            {/* Error notifications */}
            {errorMessage && (
              <div className="bg-rose-50 border-t border-rose-200 text-rose-850 px-6 py-3.5 text-xs flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Statistics & Analysis bottom bar */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between dark:bg-slate-900/40 dark:border-slate-800">
              
              {/* Words, Characters, estimated read metrics */}
              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5" title="Character count">
                  <AlignLeft className="w-4 h-4 text-slate-400" />
                  <span><strong>{characterCount}</strong> Characters</span>
                </div>
                <div className="flex items-center gap-1.5" title="Word count">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span><strong>{cleanWordCount}</strong> Words</span>
                </div>
                <div className="flex items-center gap-1.5" title="Estimated reading time">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span><strong>{readingTimeEstimate}</strong> Read Time</span>
                </div>
              </div>

              {/* Big primary analysis executor */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || !text.trim()}
                  className="bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition hover:shadow-lg hover:shadow-indigo-505 shadow-md shadow-indigo-150 cursor-pointer text-center"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Analyzing Draft...' : 'Analyze Writing'}
                </button>
              </div>

            </div>

          </div>

          {/* High-level General Editorial Recommendations if analyzed */}
          {overarchingSuggestions.length > 0 && (
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm dark:bg-slate-900 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> AI General Style Coach Suggestions
              </h4>
              <ul className="space-y-2">
                {overarchingSuggestions.map((suggestion, sIdx) => (
                  <li key={sIdx} className="text-xs text-slate-700 leading-relaxed dark:text-slate-300 flex gap-2 items-start">
                    <span className="text-indigo-600 font-bold dark:text-indigo-400 shrink-0">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Explanation notes about latest rewrite replacement */}
          {rewriteExplanation && (
            <div className="bg-emerald-50/55 border border-emerald-200 p-4 rounded-3xl dark:bg-slate-900 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 dark:text-slate-300 mb-1">
                <CheckCheck className="w-4 h-4 text-emerald-600" /> Rewrite Modifications Log
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-400 font-medium leading-relaxed">
                {rewriteExplanation}
              </p>
            </div>
          )}

        </div>

        {/* AI Co-pilot Sidepanel - right 4 cols */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Readability scoring box */}
          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm dark:bg-slate-900 dark:border-slate-800" id="readability-stats">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-slate-400" /> Readability Index
            </h4>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {readability.score}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full dark:bg-indigo-950/40 dark:text-indigo-400">
                AI Graded
              </span>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
              {readability.summary}
            </p>
          </div>

          {/* Active Specific Corrections Board */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col dark:bg-slate-900 dark:border-slate-800" id="corrections-board">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCheck className="w-4.5 h-4.5 text-slate-400" /> Critical Inline Fixes
              </h4>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-300">
                {issues.length} Issues Found
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto dark:divide-slate-800">
              {issues.length === 0 ? (
                <div className="p-8 text-center" id="empty-corrections-state">
                  <div className="mx-auto w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-3 dark:bg-slate-850">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-300">Your text is pristine!</p>
                  <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500">No spelling, punctuation or grammatical issues identified.</p>
                </div>
              ) : (
                issues.map((issue, idx) => {
                  const isExpanded = selectedIssueIndex === idx;
                  return (
                    <div 
                      key={idx}
                      className={`p-4 transition duration-155 ${
                        isExpanded ? 'bg-indigo-50/40 dark:bg-indigo-950/15 border-l-4 border-indigo-600' : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                      }`}
                    >
                      {/* Issue header clickable row */}
                      <div 
                        onClick={() => setSelectedIssueIndex(isExpanded ? null : idx)}
                        className="flex items-start justify-between cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] leading-none uppercase font-extrabold tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md dark:bg-slate-800 dark:text-slate-300">
                              {issue.type}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 shrink-0 line-clamp-1">
                              "{issue.original}"
                            </span>
                          </div>
                          
                          {/* Quick suggestion highlight */}
                          <p className="text-xs font-black text-rose-600 mt-1 flex items-center gap-1 dark:text-rose-400">
                            Change to: <strong className="text-emerald-600 dark:text-emerald-400 font-black">"{issue.suggestion}"</strong>
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>

                      {/* Extended resolve panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-3"
                          >
                            <p className="text-xs text-slate-600 mb-3.5 leading-relaxed bg-white border border-slate-150 p-2.5 rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350">
                              {issue.explanation || 'Resolving grammar syntax for overall clarity.'}
                            </p>
                            
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <button
                                onClick={() => handleDismissCorrection(idx)}
                                className="border border-slate-200 text-slate-500 hover:bg-slate-50 p-1.5 px-3 rounded-lg font-semibold transition dark:border-slate-700 dark:text-slate-400"
                              >
                                Ignore
                              </button>
                              
                              <button
                                onClick={() => handleApplyCorrection(issue, idx)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 px-3.5 rounded-lg font-bold transition flex items-center gap-1 shadow-sm shadow-emerald-100 dark:shadow-none"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Fix Inline
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sleek Tone and Style Transformer Panel */}
          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm dark:bg-slate-900 dark:border-slate-800" id="tone-changer">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-slate-400" /> Tone & Style Modifiers
            </h4>

            {/* Select Tone Preset */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Adjust Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'professional', label: 'Professional', icon: Sliders },
                  { id: 'friendly', label: 'Friendly', icon: Smile },
                  { id: 'confident', label: 'Confident', icon: TrendingUp },
                  { id: 'academic', label: 'Academic', icon: GraduationCap },
                  { id: 'casual', label: 'Casual', icon: User },
                ].map((toneOpt) => {
                  const IconComp = toneOpt.icon;
                  const isSel = selectedTone === toneOpt.id;
                  return (
                    <button
                      key={toneOpt.id}
                      onClick={() => setSelectedTone(isSel ? 'none' : toneOpt.id)}
                      className={`p-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition text-left start justify-start ${
                        isSel
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 dark:bg-slate-800 dark:border-indigo-850 dark:text-indigo-400'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-850'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span>{toneOpt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Adjust Length / Simplicity Mode */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Length & Phrasing</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'shorter', label: 'Make Shorter' },
                  { id: 'longer', label: 'Make Longer' },
                  { id: 'simpler', label: 'Simplify Phrasing' },
                  { id: 'engaging', label: 'More Engaging' },
                  { id: 'enhancement', label: 'Auto Polish' },
                  { id: 'vocabulary', label: 'Sophisticate Vocab' },
                ].map((modeOpt) => {
                  const isSel = selectedMode === modeOpt.id;
                  return (
                    <button
                      key={modeOpt.id}
                      onClick={() => setSelectedMode(isSel ? 'none' : modeOpt.id)}
                      className={`p-2 rounded-xl border text-[11px] font-bold transition text-left ${
                        isSel
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 dark:bg-slate-800 dark:border-indigo-850 dark:text-indigo-400'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-850'
                      }`}
                    >
                      {modeOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transform Action Trigger */}
            <button
              onClick={() => handleRewrite(selectedMode, selectedTone)}
              disabled={isRewriting || (selectedTone === 'none' && selectedMode === 'none') || !text.trim()}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-750"
            >
              {isRewriting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {isRewriting ? 'Transforming text...' : 'Apply Style Transformers'}
            </button>
          </div>

        </div>

      </main>

      {/* Humble Footer with active API configuration */}
      <footer className="border-t border-slate-200 bg-white py-5 px-6 mt-12 text-center text-xs text-slate-400 dark:border-slate-900 dark:bg-slate-950">
        <p className="font-semibold leading-relaxed">
          AI Writing Assistant & Grammar Checker © 2026. Built with high-contrast, modern UI.
        </p>
        <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500">
          Powered securely and server-side using Gemini models. Configure any private secrets via the Secrets panel.
        </p>
      </footer>

    </div>
  );
}
