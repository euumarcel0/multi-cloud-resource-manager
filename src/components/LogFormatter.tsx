
import React from 'react';

interface LogFormatterProps {
  logs: string;
}

const LogFormatter: React.FC<LogFormatterProps> = ({ logs }) => {
  const formatLogs = (logText: string) => {
    return logText.split('\n').map((line, index) => {
      // Color coding for different log types
      let className = 'text-gray-300';
      
      if (line.includes('✅') || line.includes('success')) {
        className = 'text-green-400';
      } else if (line.includes('❌') || line.includes('Error') || line.includes('error')) {
        className = 'text-red-400';
      } else if (line.includes('⚠️') || line.includes('warning')) {
        className = 'text-yellow-400';
      } else if (line.includes('🚀') || line.includes('📡') || line.includes('🔄')) {
        className = 'text-blue-400';
      } else if (line.includes('📋') || line.includes('Info')) {
        className = 'text-cyan-400';
      }

      return (
        <div key={index} className={className}>
          {line}
        </div>
      );
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
      <pre className="text-sm font-mono whitespace-pre-wrap">
        {formatLogs(logs)}
      </pre>
    </div>
  );
};

export default LogFormatter;
