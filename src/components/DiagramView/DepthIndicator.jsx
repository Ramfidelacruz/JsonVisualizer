import React from 'react';

const DepthIndicator = ({ maxDepth, levelThreshold }) => {
  return (
    <div className="absolute bottom-2 left-2 z-10 bg-gray-800 bg-opacity-80 rounded px-3 py-1 text-xs text-white">
      <span className="mr-1 text-gray-300">Profundidad máxima:</span>
      <span className="font-medium">{maxDepth}</span>
      <span className="mx-2 text-gray-500">|</span>
      <span className="mr-1 text-gray-300">Mostrando hasta nivel:</span>
      <span className="font-medium">{levelThreshold}</span>
    </div>
  );
};

export default DepthIndicator; 