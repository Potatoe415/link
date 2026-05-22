import { useState } from "react";
import { Settings, Check, Terminal, ChevronUp, ChevronDown, Activity, AlertCircle } from "lucide-react";
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

function App() {
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(ENGINES.map(e => e.id));
  
  // Debug State
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

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
      
      // Support both new object format { results, debug } and old array format
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
    <div className="min-h-screen pb-20 p-8 flex flex-col items-center bg-slate-900 text-white">
      <header className="mb-12 text-center relative w-full max-w-2xl">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          Magnet<span className="text-blue-500">Finder</span>
        </h1>
        <p className="text-slate-400 text-lg">Ultra-light torrent search tool</p>
        
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="absolute right-0 top-0 p-2 text-slate-400 hover:text-white transition-colors"
          title="Search Settings"
        >
          <Settings size={28} />
        </button>

        {showSettings && (
          <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-4 text-left">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Search Engines</h3>
            <div className="space-y-2">
              {ENGINES.map(engine => (
                <button
                  key={engine.id}
                  onClick={() => toggleEngine(engine.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-700 transition-colors group"
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
      </header>

      <SearchBar onSearch={handleSearch} isLoading={loading} />

      {error && (
        <div className="mt-8 p-4 bg-red-900/30 border border-red-800 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="mt-20 text-slate-500 text-center">
          <p>Start searching for movies, series, or software.</p>
        </div>
      )}

      <ResultList results={results} onDownload={handleDownload} />

      {/* Foldable Debug Bar */}
      <div className={`fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 transition-all duration-300 z-[100] ${isDebugOpen ? 'h-64' : 'h-10'}`}>
        <button 
          onClick={() => setIsDebugOpen(!isDebugOpen)}
          className="w-full h-10 flex items-center justify-between px-6 hover:bg-slate-750 transition-colors border-b border-slate-700/50"
        >
          <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
            <Terminal size={16} className="text-blue-500" />
            <span>DEBUG CONSOLE</span>
            {debugInfo && (
              <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                Total: {debugInfo.totalTime}ms
              </span>
            )}
          </div>
          {isDebugOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        
        <div className="p-4 h-52 overflow-y-auto font-mono text-xs">
          {!debugInfo ? (
            <p className="text-slate-500 italic text-center mt-10">No search logs yet. Start a search to see performance data.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {debugInfo.logs.map((log, i) => (
                <div key={i} className={`p-3 rounded-lg border ${log.status === 'success' ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/20 border-red-900/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200 uppercase tracking-tight">{log.engine}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${log.status === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} />
                      <span>Time: {log.time}ms</span>
                    </div>
                    {log.status === 'success' ? (
                      <div className="flex items-center gap-1.5 text-emerald-400/80">
                        <Check size={12} />
                        <span>Found: {log.count} items</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-400/80">
                        <AlertCircle size={12} />
                        <span className="truncate" title={log.error}>Error: {log.error}</span>
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
