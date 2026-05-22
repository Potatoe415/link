import React from 'react';
import { TorrentResult } from '../types';
import ResultItem from './ResultItem';

interface ResultListProps {
  results: TorrentResult[];
  onDownload: (magnetUrl: string) => void;
}

const ResultList: React.FC<ResultListProps> = ({ results, onDownload }) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-4xl mx-auto mt-8">
      {results.map((result, index) => (
        <ResultItem
          key={`${result.source}-${index}`}
          result={result}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
};

export default ResultList;
