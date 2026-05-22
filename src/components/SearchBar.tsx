import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for magnets..."
          className="w-full px-6 py-4 text-lg bg-slate-800 border-2 border-slate-700 rounded-full focus:outline-none focus:border-blue-500 text-white placeholder-slate-400 shadow-xl transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search size={24} />
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
