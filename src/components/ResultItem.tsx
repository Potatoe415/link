import React from 'react';
import { Magnet, Calendar } from 'lucide-react';
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
    <div className="bg-slate-800/50 border border-slate-700 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-colors group gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm sm:text-base font-medium truncate mb-1" title={result.title}>
          {result.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-sm text-slate-400">
          <span className="whitespace-nowrap">{result.size}</span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
            {result.date}
          </span>
          <span className={`flex items-center gap-1 font-bold whitespace-nowrap ${getSeederColor(result.seeders)}`}>
            {result.seeders} <span className="hidden xs:inline">seeders</span>
          </span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-none">{result.source}</span>
        </div>
      </div>
      <button
        onClick={() => onDownload(result.magnetUrl)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-2.5 sm:px-4 sm:py-2 rounded-lg transition-colors shrink-0"
      >
        <Magnet size={18} />
        <span className="hidden sm:inline">Download</span>
      </button>
    </div>
  );
};

export default ResultItem;
