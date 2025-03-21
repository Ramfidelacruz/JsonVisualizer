import { useMemo } from 'react';

const StatsBar = ({ jsonData }) => {
  const stats = useMemo(() => {
    // Función para calcular profundidad recursivamente
    const getDepth = (obj, currentDepth = 1) => {
      if (typeof obj !== 'object' || obj === null) return currentDepth;
      
      let maxDepth = currentDepth;
      
      Object.values(obj).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          const depth = getDepth(value, currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      });
      
      return maxDepth;
    };

    // Función para contar nodos
    const countNodes = (obj) => {
      if (typeof obj !== 'object' || obj === null) return 0;
      
      let count = 1; // Contar el nodo actual
      
      Object.values(obj).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          count += countNodes(value);
        }
      });
      
      return count;
    };

    // Calcular tamaño en bytes (aproximado)
    const size = new TextEncoder().encode(JSON.stringify(jsonData)).length;
    const formattedSize = size < 1024 
      ? `${size} bytes` 
      : `${(size / 1024).toFixed(2)} KB`;

    return {
      depth: getDepth(jsonData),
      nodes: countNodes(jsonData),
      size: formattedSize,
      properties: JSON.stringify(jsonData).match(/"[^"]+"/g)?.length || 0
    };
  }, [jsonData]);

  return (
    <div className="flex justify-between text-xs text-gray-400 bg-gray-900 p-2 border-t border-gray-800">
      <div>Profundidad: {stats.depth}</div>
      <div>Nodos: {stats.nodes}</div>
      <div>Propiedades: {stats.properties}</div>
      <div>Tamaño: {stats.size}</div>
    </div>
  );
};

export default StatsBar; 