import React from 'react';
import { Handle, Position } from 'reactflow';

// Componente de nodo para objetos
export const ObjectNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  const hasChildren = data.childrenCount && data.childrenCount > 0;
  
  const toggleCollapsed = (e) => {
    e.stopPropagation();
    if (data.onToggleCollapse) {
      data.onToggleCollapse(id);
    }
  };
  
  return (
    <div className={`node-container ${collapsed ? 'collapsed-node' : ''}`}>
      <Handle type="target" position={Position.Left} className="handle-custom" />
      <div className="flex justify-between items-center">
        {data.label && (
          <div className="text-sm text-blue-400 mb-1 font-medium flex items-center">
            {data.label}
            {hasChildren && collapsed && (
              <span className="ml-2 text-xs text-yellow-300 bg-gray-800 px-1.5 py-0.5 rounded">
                +{data.childrenCount}
              </span>
            )}
          </div>
        )}
        {hasChildren && (
          <button 
            className="collapse-btn w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir nodos hijos" : "Colapsar nodos hijos"}
          >
            <span className="text-xs text-gray-300">{collapsed ? '+' : '−'}</span>
          </button>
        )}
      </div>
      
      {!collapsed && data.properties && data.properties.map((prop) => (
        <div key={prop.key} className="flex justify-between text-xs py-1">
          <span className="text-blue-400">{prop.key}:</span>
          <span className="text-green-400 ml-2">{prop.value}</span>
        </div>
      ))}
      {collapsed && hasChildren && (
        <div className="text-xs text-gray-400 py-1 flex items-center">
          <span className="w-2 h-2 bg-blue-400 rounded-full inline-block mr-2"></span>
          <span>{data.childrenCount} nodos anidados ocultos</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="handle-custom" />
    </div>
  );
};

// Componente de nodo para arrays
export const ArrayNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  const hasChildren = data.childrenCount && data.childrenCount > 0;
  
  const toggleCollapsed = (e) => {
    e.stopPropagation();
    if (data.onToggleCollapse) {
      data.onToggleCollapse(id);
    }
  };
  
  return (
    <div className={`node-container ${collapsed ? 'collapsed-node' : ''}`}>
      <Handle type="target" position={Position.Left} className="handle-custom" />
      <div className="flex justify-between items-center">
        <div className="text-lg text-yellow-400 font-medium flex items-center">
          {data.label} [{data.length}]
          {hasChildren && collapsed && (
            <span className="ml-2 text-xs text-yellow-300 bg-gray-800 px-1.5 py-0.5 rounded">
              +{data.childrenCount}
            </span>
          )}
        </div>
        {hasChildren && (
          <button 
            className="collapse-btn w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir nodos hijos" : "Colapsar nodos hijos"}
          >
            <span className="text-xs text-gray-300">{collapsed ? '+' : '−'}</span>
          </button>
        )}
      </div>
      {collapsed && hasChildren && (
        <div className="text-xs text-gray-400 py-1 flex items-center">
          <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block mr-2"></span>
          <span>{data.childrenCount} elementos ocultos</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="handle-custom" />
    </div>
  );
}; 