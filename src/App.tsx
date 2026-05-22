import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import SearchBar from "./components/SearchBar";
import ResultList from "./components/ResultList";
import { TorrentResult } from "./types";

function App() {
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      // For now, we call the Rust command which we will implement next
      const data: TorrentResult[] = await invoke("search_torrents", { query });
      setResults(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch results. Please try again.");
      // Fallback for UI testing before Rust is ready
      /*
      setResults([
        { title: "Mock Movie 1080p", size: "2.4 GB", seeders: 120, magnetUrl: "magnet:?xt=urn:btih:123", source: "Mock" },
        { title: "Mock Series S01E01", size: "800 MB", seeders: 5, magnetUrl: "magnet:?xt=urn:btih:456", source: "Mock" },
      ]);
      */
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (magnetUrl: string) => {
    try {
      await openUrl(magnetUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to open magnet link. Make sure you have a torrent client installed.");
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          Magnet<span className="text-blue-500">Finder</span>
        </h1>
        <p className="text-slate-400 text-lg">Ultra-light torrent search tool</p>
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
    </div>
  );
}

export default App;
