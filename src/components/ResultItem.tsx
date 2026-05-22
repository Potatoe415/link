import React from 'react';
import { Magnet } from 'lucide-react';
import { TorrentResult } from '../types';

interface ResultItemProps {
  result: TorrentResult;
  onDownload: (magnetUrl: string) => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ result, onDownload }) => {
  const getSeederColor = (seeders: number) => {
    if (seeders > 50) return 'text-green-400';
    if (seeders > 10) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-colors group">
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-white font-medium truncate mb-1" title={result.title}>
          {result.title}
        </h3>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>{result.size}</span>
          <span className={`flex items-center gap-1 font-bold ${getSeederColor(result.seeders)}`}>
            {result.seeders} seeders
          </span>
          <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{result.source}</span>
        </div>
      </div>
      <button
        onClick={() => onDownload(result.magnetUrl)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
      >
        <Magnet size={18} />
        <span className="hidden sm:inline">Download</span>
      </button>
    </div>
  );
};

export default ResultItem;
