import React from 'react';

// Componente para la barra de herramientas principal
const Toolbar = ({ 
  layoutDirection, 
  setLayoutDirection, 
  levelThreshold, 
  maxDepth, 
  changeCollapseLevel, 
  nodeSizeMode, 
  setNodeSizeMode, 
  onReorganize
}) => {
  return (
    <div className="absolute top-2 right-2 z-20 tools-panel flex flex-col gap-3 w-64">
      {/* Primera fila: Dirección del layout */}
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => setLayoutDirection('LR')}
          className={`control-button flex-1 ${layoutDirection === 'LR' ? 'active' : ''}`}
        >
          <svg className="mr-1.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
          Horizontal
        </button>
        <button 
          onClick={() => setLayoutDirection('TB')}
          className={`control-button flex-1 ${layoutDirection === 'TB' ? 'active' : ''}`}
        >
          <svg className="mr-1.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
          Vertical
        </button>
      </div>
      
      {/* Segunda fila: Control de nivel */}
      <div className="level-control bg-gray-800 rounded-md px-2 py-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-300">Nivel: {levelThreshold}</span>
          <span className="text-xs text-gray-400">de {maxDepth}</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max={Math.max(10, maxDepth)} 
          value={levelThreshold}
          onChange={(e) => changeCollapseLevel(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-md appearance-none cursor-pointer"
        />
      </div>
      
      {/* Tercera fila: Control de tamaño */}
      <div className="size-selector-container">
        <select 
          onChange={(e) => setNodeSizeMode(e.target.value)}
          value={nodeSizeMode}
          className="control-select w-full bg-gray-800 text-white border-0 rounded-md px-3 py-2 text-sm"
        >
          <option value="compact">Tamaño: Compacto</option>
          <option value="medium">Tamaño: Mediano</option>
          <option value="expanded">Tamaño: Expandido</option>
        </select>
      </div>
      
      {/* Cuarta fila: Botones de colapso/expansión */}
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => changeCollapseLevel(0)}
          className="control-button flex-1"
          title="Colapsar todos los nodos excepto el raíz"
        >
          <svg className="mr-1.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Colapsar Todo
        </button>
        <button 
          onClick={() => changeCollapseLevel(999)}
          className="control-button flex-1"
          title="Expandir todos los nodos"
        >
          <svg className="mr-1.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Expandir Todo
        </button>
      </div>
      
      {/* Quinta fila: Botón de reorganización */}
      <button 
        onClick={onReorganize}
        className="control-button bg-blue-600 hover:bg-blue-700 w-full"
      >
        <svg className="mr-1.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
        </svg>
        Reorganizar
      </button>
    </div>
  );
};

export default Toolbar; 