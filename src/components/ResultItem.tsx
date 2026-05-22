import React from 'react';
import { Magnet, Calendar, Users, HardDrive } from 'lucide-react';
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

  const formatSeeders = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div 
      onClick={() => onDownload(result.magnetUrl)}
      className="bg-slate-800/50 border border-slate-700 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-colors group gap-2 sm:gap-4 w-full cursor-pointer active:scale-[0.98] sm:active:scale-100"
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm sm:text-base font-medium truncate mb-1" title={result.title}>
          {result.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-sm text-slate-400">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <HardDrive size={13} className="text-slate-500" />
            {result.size}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Calendar size={13} className="text-slate-500" />
            {result.date}
          </span>
          <span className={`flex items-center gap-1.5 font-bold whitespace-nowrap ${getSeederColor(result.seeders)}`}>
            <Users size={13} />
            {formatSeeders(result.seeders)} <span className="hidden xs:inline text-[10px] font-normal opacity-70">seeders</span>
          </span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-none text-slate-300">{result.source}</span>
        </div>
      </div>
      
      {/* Hidden on mobile, visible on desktop */}
      <div className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shrink-0 shadow-lg active:scale-95">
        <Magnet size={18} />
        <span className="font-semibold text-sm">Download</span>
      </div>

      {/* Mobile-only subtle indicator (optional, but good for UX) */}
      <div className="sm:hidden text-blue-500">
        <Magnet size={20} />
      </div>
    </div>
  );
};

export default ResultItem;
