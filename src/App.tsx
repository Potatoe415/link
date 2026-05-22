import { useState, useMemo, useEffect } from "react";
import { Settings, Check, Terminal, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import SearchBar from "./components/SearchBar";
import ResultList from "./components/ResultList";
import { TorrentResult } from "./types";

const ENGINES = [
  { id: 'apibay', name: 'The Pirate Bay (Apibay)' },
  { id: '1337x', name: '1337x' },
  { id: 'limetorrents', name: 'LimeTorrents' },
  { id: 'yts', name: 'YTS (Movies)' },
  { id: 'solid', name: 'SolidTorrents' },
  { id: 'nyaa', name: 'Nyaa (Anime)' },
  { id: 'kickass', name: 'Kickass (KAT)' },
  { id: 'torrentz2', name: 'Torrentz2' },
  { id: 'fitgirl', name: 'FitGirl (Games)' },
  { id: 'eztv', name: 'EZTV (TV Shows)' },
  { id: 'torrent9', name: 'Torrent9 (FR)' },
  { id: 'oxtorrent', name: 'OxTorrent (FR)' },
];

const ITEMS_PER_PAGE = 50;

interface DebugInfo {
  totalTime: number;
  logs: Array<{
    engine: string;
    status: 'success' | 'error';
    time: number;
    count?: number;
    error?: string;
  }>;
}

type SortOption = 'seeders' | 'size' | 'date';

function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("magnet_auth") === "true";
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);

  const [results, setResults] = useState<TorrentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(ENGINES.map(e => e.id));
  const [sortBy, setSortBy] = useState<SortOption>('seeders');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Dynamic Client-side Sorting
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sortBy === 'seeders') return b.seeders - a.seeders;
      if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
      if (sortBy === 'date') return b.timestamp - a.timestamp;
      return 0;
    });
  }, [results, sortBy]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedResults.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedResults, currentPage]);

  // Reset page when search results or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [results, sortBy]);

  const toggleEngine = (id: string) => {
    setSelectedEngines(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSearch = async (query: string) => {
    if (selectedEngines.length === 0) {
      setError("Please select at least one search engine.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const enginesParam = selectedEngines.join(',');
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&selectedEngines=${enginesParam}`);
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      
      if (data && !Array.isArray(data) && data.results) {
        setResults(data.results);
        setDebugInfo(data.debug || null);
      } else if (Array.isArray(data)) {
        setResults(data);
        setDebugInfo(null);
      } else {
        setResults([]);
        setDebugInfo(null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch results. Please make sure the local server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (magnetUrl: string) => {
    window.location.href = magnetUrl;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "bob") {
      setIsAuthenticated(true);
      localStorage.setItem("magnet_auth", "true");
      setAuthError(false);
    } else {
      setAuthError(true);
      setPassword("");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl text-center relative overflow-hidden text-white font-sans">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
          <div className="inline-flex p-4 rounded-full bg-blue-600/10 text-blue-500 mb-6">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">Access <span className="text-blue-500 text-white">Locked</span></h1>
          <p className="text-slate-400 mb-8 text-sm">Please enter the security password</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoFocus
              className={`w-full px-6 py-5 bg-slate-950 border-2 rounded-2xl focus:outline-none text-white text-center text-2xl tracking-[0.5em] transition-all ${authError ? 'border-red-500/50 ring-4 ring-red-500/10' : 'border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'}`}
            />
            {authError && <p className="text-red-500 text-xs font-medium">Incorrect password. Please try again.</p>}
            <button
              type="submit"
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-blue-600/20 mt-2"
            >
              Verify & Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 p-4 sm:p-8 flex flex-col items-center bg-slate-900 text-white font-sans">
      <header className="mb-8 sm:mb-12 text-center w-full max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 sm:mb-4 tracking-tight text-white">
          Magnet<span className="text-blue-500">Finder</span>
        </h1>
      </header>

      <SearchBar onSearch={handleSearch} isLoading={loading} />

      {/* Sorting Tabs */}
      {results.length > 0 && (
        <div className="flex items-center gap-1 sm:gap-2 mt-8 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          {[
            { id: 'seeders', label: 'Seeders' },
            { id: 'size', label: 'Size' },
            { id: 'date', label: 'Newest' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id as SortOption)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold transition-all ${sortBy === opt.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 p-4 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-sm sm:text-base">
          {error}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="mt-12 sm:mt-20 text-slate-500 text-center">
          <p>Start searching for movies, series, or software.</p>
        </div>
      )}

      <ResultList results={paginatedResults} onDownload={handleDownload} />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center gap-4 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-sm font-medium text-slate-300 px-2">
            Page <span className="text-blue-500 font-bold">{currentPage}</span> / {totalPages}
            <span className="ml-2 text-slate-500 hidden sm:inline">({results.length} total)</span>
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      {/* Floating Settings Button & Logic */}
      <div className="fixed right-4 bottom-14 z-[110]">
        {showSettings && (
          <>
            {/* Click-outside backdrop */}
            <div 
              className="fixed inset-0 z-[-1] cursor-default" 
              onClick={() => setShowSettings(false)}
            />
            
            <div className="absolute bottom-full right-0 mb-4 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-left animate-in fade-in slide-in-from-bottom-4 duration-200">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Search Engines</h3>
              <div className="space-y-1 sm:space-y-2">
                {ENGINES.map(engine => (
                  <button
                    key={engine.id}
                    onClick={() => toggleEngine(engine.id)}
                    className="w-full flex items-center justify-between p-2.5 sm:p-2 rounded-lg hover:bg-slate-700 transition-colors group"
                  >
                    <span className={selectedEngines.includes(engine.id) ? "text-white" : "text-slate-500"}>
                      {engine.name}
                    </span>
                    {selectedEngines.includes(engine.id) && <Check size={18} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-3 rounded-full shadow-2xl border transition-all duration-300 ${showSettings ? 'bg-blue-600 border-blue-500 text-white rotate-90 scale-110' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
          title="Search Settings"
        >
          <Settings size={28} />
        </button>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 transition-all duration-300 z-[100] ${isDebugOpen ? 'h-[70vh] sm:h-64' : 'h-10'}`}>
        <button 
          onClick={() => setIsDebugOpen(!isDebugOpen)}
          className="w-full h-10 flex items-center justify-between px-4 sm:px-6 hover:bg-slate-750 transition-colors border-b border-slate-700/50"
        >
          <div className="flex items-center gap-2 text-slate-300 font-medium text-xs sm:text-sm">
            <Terminal size={14} className="text-blue-500 sm:w-4 sm:h-4" />
            <span>DEBUG</span>
            {debugInfo && (
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-slate-700 rounded text-[10px] sm:text-xs text-slate-400">
                {debugInfo.totalTime}ms
              </span>
            )}
          </div>
          {isDebugOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        
        <div className="p-2 sm:p-3 h-[calc(70vh-40px)] sm:h-52 overflow-y-auto font-mono text-[10px] sm:text-xs">
          {!debugInfo ? (
            <p className="text-slate-500 italic text-center mt-6 sm:mt-10">No search logs yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {debugInfo.logs.map((log, i) => (
                <div key={i} className={`px-3 py-1 rounded-lg border flex items-center justify-between gap-2 ${log.status === 'success' ? 'bg-emerald-950/10 border-emerald-900/20' : 'bg-red-950/10 border-red-900/20'}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-bold text-slate-200 uppercase tracking-tight shrink-0 w-20 truncate">{log.engine}</span>
                    <span className="text-slate-500 shrink-0 text-[9px]">{log.time}ms</span>
                    <div className="h-3 w-px bg-slate-700 shrink-0"></div>
                    {log.status === 'success' ? (
                      <span className="text-emerald-400/80 truncate font-medium">{log.count} items</span>
                    ) : (
                      <span className="text-red-400/80 truncate font-medium" title={log.error}>{log.error}</span>
                    )}
                  </div>
                  <span className={`px-1 py-0.5 rounded text-[7px] uppercase font-bold shrink-0 ${log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {log.status === 'success' ? 'OK' : 'ERR'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
