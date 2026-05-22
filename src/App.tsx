import { useState, useMemo, useEffect } from "react";
import { Settings, Check, Terminal, ChevronUp, ChevronDown, Activity, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import SearchBar from "./components/SearchBar";
import ResultList from "./components/ResultList";
import { TorrentResult } from "./types";

const ENGINES = [
  { id: 'apibay', name: 'The Pirate Bay (Apibay)' },
  { id: 'limetorrents', name: 'LimeTorrents' },
  { id: 'yts', name: 'YTS (Movies)' },
  { id: 'solid', name: 'SolidTorrents' },
  { id: 'nyaa', name: 'Nyaa (Anime)' },
  { id: '1337x', name: '1337x' },
  { id: 'eztv', name: 'EZTV (TV Shows)' },
  { id: 'torrent9', name: 'Torrent9 (FR)' },
  { id: 'oxtorrent', name: 'OxTorrent (FR)' },
];

const ITEMS_PER_PAGE = 100;

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

  return (
    <div className="min-h-screen pb-20 p-4 sm:p-8 flex flex-col items-center bg-slate-900 text-white font-sans">
      <header className="mb-8 sm:mb-12 text-center w-full max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 sm:mb-4 tracking-tight">
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

      {/* Floating Settings Button */}
      <div className="fixed left-4 bottom-14 z-[110]">
        {showSettings && (
          <div className="absolute bottom-full left-0 mb-4 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-left animate-in fade-in slide-in-from-bottom-4 duration-200">
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
            <span>DEBUG CONSOLE</span>
            {debugInfo && (
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-slate-700 rounded text-[10px] sm:text-xs text-slate-400">
                {debugInfo.totalTime}ms
              </span>
            )}
          </div>
          {isDebugOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        
        <div className="p-3 sm:p-4 h-[calc(70vh-40px)] sm:h-52 overflow-y-auto font-mono text-[10px] sm:text-xs">
          {!debugInfo ? (
            <p className="text-slate-500 italic text-center mt-6 sm:mt-10">No search logs yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3">
              {debugInfo.logs.map((log, i) => (
                <div key={i} className={`p-2.5 sm:p-3 rounded-lg border ${log.status === 'success' ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/20 border-red-900/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200 uppercase tracking-tight truncate mr-2">{log.engine}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] sm:text-[10px] uppercase font-bold shrink-0 ${log.status === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:gap-1 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Activity size={10} />
                      <span>{log.time}ms</span>
                    </div>
                    {log.status === 'success' ? (
                      <div className="flex items-center gap-1.5 text-emerald-400/80">
                        <Check size={10} />
                        <span>Found: {log.count} items</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-400/80">
                        <AlertCircle size={10} />
                        <span className="truncate" title={log.error}>{log.error}</span>
                      </div>
                    )}
                  </div>
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
