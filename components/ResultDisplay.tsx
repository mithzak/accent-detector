
import React from 'react';
import { type AnalysisResult } from '../types';

interface ResultDisplayProps {
  result: AnalysisResult;
}

const StatBar: React.FC<{ label: string; value: string; confidence: number }> = ({ label, value, confidence }) => (
  <div className="mb-6">
    <div className="flex justify-between items-end mb-2">
      <div>
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <p className="text-xl font-semibold text-indigo-300">{confidence}%</p>
    </div>
    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
      <div
        className="bg-indigo-500 h-3 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${confidence}%` }}
      />
    </div>
  </div>
);

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  return (
    <div className="bg-gray-800/70 p-6 rounded-lg animate-fade-in">
        <StatBar label="Detected Language" value={result.language.name} confidence={result.language.confidence} />
        <StatBar label="Detected Accent" value={result.accent.name} confidence={result.accent.confidence} />
    </div>
  );
};

export default ResultDisplay;
