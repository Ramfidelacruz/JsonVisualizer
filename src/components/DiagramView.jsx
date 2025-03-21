import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import SearchBar from './SearchBar';

// Componente de nodo para objetos con mejor visualización
const ObjectNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  const hasProperties = data.properties && data.properties.length > 0;
  
  const toggleCollapsed = (e) => {
    e.stopPropagation();
    if (data.onToggleCollapse) {
      data.onToggleCollapse(id);
    }
  };
  
  return (
    <div className={`node-container px-4 py-3 rounded-md border border-gray-700 bg-gray-900 min-w-[220px] ${collapsed ? 'collapsed-node' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="handle-custom"
      />
      <div className="flex justify-between items-center">
        {data.label && (
          <div className="text-sm text-blue-400 mb-1 font-medium">
            {data.label}
          </div>
        )}
        {hasProperties && (
          <button 
            className="collapse-btn w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir nodo" : "Colapsar nodo"}
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
      {collapsed && hasProperties && (
        <div className="text-xs text-gray-400 py-1">{data.properties.length} propiedades</div>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="handle-custom"
      />
    </div>
  );
};

// Componente de nodo para arrays con mejor visualización
const ArrayNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  
  const toggleCollapsed = (e) => {
    e.stopPropagation();
    if (data.onToggleCollapse) {
      data.onToggleCollapse(id);
    }
  };
  
  return (
    <div className={`node-container px-4 py-3 rounded-md border border-gray-700 bg-gray-900 min-w-[220px] ${collapsed ? 'collapsed-node' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="handle-custom"
      />
      <div className="flex justify-between items-center">
        <div className="text-lg text-yellow-400 font-medium">
          {data.label} [{data.length}]
        </div>
        <button 
          className="collapse-btn w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700"
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir nodo" : "Colapsar nodo"}
        >
          <span className="text-xs text-gray-300">{collapsed ? '+' : '−'}</span>
        </button>
      </div>
      {collapsed && (
        <div className="text-xs text-gray-400 py-1">{data.length} elementos</div>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="handle-custom"
      />
    </div>
  );
};

const DiagramView = ({ jsonData, darkMode = true }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutDirection, setLayoutDirection] = useState('LR');
  const [levelThreshold, setLevelThreshold] = useState(999);
  const [nodeSizeMode, setNodeSizeMode] = useState('medium');
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Definición de nodeTypes MEMOIZADA
  const nodeTypes = useMemo(() => ({
    objectNode: ObjectNode,
    arrayNode: ArrayNode,
  }), []);
  
  // Función auxiliar para estimar el tamaño de un nodo basado en su contenido
  const estimateNodeSize = useCallback((node) => {
    let width = 220; // Ancho base
    let height = 60; // Altura base
    
    // Ajuste según el modo de tamaño seleccionado
    const sizeMultiplier = nodeSizeMode === 'compact' ? 0.8 : 
                          nodeSizeMode === 'expanded' ? 1.2 : 1;
    
    width *= sizeMultiplier;
    height *= sizeMultiplier;
    
    // Calcular tamaño basado en el contenido
    if (node.data) {
      // Si es un nodo de objeto y tiene propiedades, ajustar altura
      if (node.type === 'objectNode' && node.data.properties) {
        const visibleProps = node.data.collapsed ? 0 : node.data.properties.length;
        // Altura base + altura por cada propiedad visible
        height += visibleProps * 22 * sizeMultiplier;
        
        // Calcular ancho basado en las propiedades más largas
        if (node.data.properties && node.data.properties.length > 0) {
          const longestProp = node.data.properties.reduce((max, prop) => {
            const length = (prop.key.length + String(prop.value).length);
            return length > max ? length : max;
          }, 0);
          
          // Ajustar ancho si hay propiedades muy largas
          if (longestProp > 25) {
            width += Math.min((longestProp - 25) * 4, 100) * sizeMultiplier;
          }
        }
      }
      
      // Si es un nodo de array, ajustar según si está colapsado
      if (node.type === 'arrayNode') {
        if (!node.data.collapsed && node.data.length > 0) {
          // Si está expandido, dar más espacio
          height += 20 * sizeMultiplier;
        }
        
        // Si el array tiene un nombre largo
        if (node.data.label && node.data.label.length > 10) {
          width += Math.min((node.data.label.length - 10) * 8, 80) * sizeMultiplier;
        }
      }
    }
    
    // Asegurar mínimos razonables
    width = Math.max(width, 180 * sizeMultiplier);
    height = Math.max(height, 40 * sizeMultiplier);
    
    return { width, height };
  }, [nodeSizeMode]);
  
  // Función de layout mejorada con espaciado más compacto
  const getLayoutedElements = useCallback((nodes, edges, direction = 'LR') => {
    if (!nodes.length) return { nodes, edges };
    
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configuración base según el modo de tamaño (valores reducidos)
    let baseSep = nodeSizeMode === 'compact' ? 30 : 
                 nodeSizeMode === 'expanded' ? 70 : 50;
    
    // Cálculo más progresivo del espaciado según cantidad de nodos
    const nodeCountFactor = Math.min(1 + (nodes.length / 200), 1.5);
    
    // Espaciado horizontal y vertical con escala adaptativa
    let nodesep = baseSep * (direction === 'LR' ? 1.2 : 1.0) * nodeCountFactor;
    let ranksep = baseSep * (direction === 'TB' ? 1.2 : 1.0) * nodeCountFactor;
    
    // Para grafos realmente grandes, limitar el crecimiento del espaciado
    if (nodes.length > 100) {
      nodesep = Math.min(nodesep, baseSep * 1.3);
      ranksep = Math.min(ranksep, baseSep * 1.3);
    }
    
    // Configuración del grafo para el algoritmo dagre
    dagreGraph.setGraph({ 
      rankdir: direction,
      ranksep,
      nodesep,
      marginx: 30,        // Margen reducido
      marginy: 30,        // Margen reducido
      align: direction === 'LR' ? 'UL' : 'DL',
      ranker: 'network-simplex',
      acyclicer: 'greedy'
    });

    // Añadir nodos al grafo con tamaños estimados según su contenido
    nodes.forEach((node) => {
      const { width, height } = estimateNodeSize(node);
      dagreGraph.setNode(node.id, { width, height });
    });

    // Añadir aristas al grafo
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calcular el layout
    dagre.layout(dagreGraph);

    // Obtener las posiciones calculadas con margen más compacto
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const { width, height } = estimateNodeSize(node);
      
      // Añadir un mínimo factor de aleatoriedad solo para nodos muy grandes
      const jitterFactor = nodes.length > 150 ? 3 : 0;
      const jitterX = jitterFactor ? Math.random() * jitterFactor - jitterFactor/2 : 0;
      const jitterY = jitterFactor ? Math.random() * jitterFactor - jitterFactor/2 : 0;
      
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - width / 2 + jitterX,
          y: nodeWithPosition.y - height / 2 + jitterY,
        },
        dimensions: { width, height }
      };
    });

    return { nodes: layoutedNodes, edges };
  }, [nodeSizeMode, estimateNodeSize]);

  // Función para manejar el clic en nodos y resaltar conexiones
  const onNodeClick = useCallback((event, node) => {
    // Resaltar las conexiones del nodo seleccionado
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          return {
            ...edge,
            animated: true,
            style: { stroke: '#f59e0b', strokeWidth: 3 }
          };
        }
        return {
          ...edge,
          animated: false,
          style: { stroke: '#4299e1', strokeWidth: 2 }
        };
      })
    );
  }, [setEdges]);

  // Función para manejar el colapso de nodos individual
  const handleNodeCollapse = useCallback((nodeId) => {
    console.log("Intentando colapsar/expandir nodo:", nodeId);
    
    // Importante: Usar una función para acceder al estado más reciente
    setNodes((prevNodes) => {
      // Encontrar el nodo específico
      const nodeToToggle = prevNodes.find(node => node.id === nodeId);
      if (!nodeToToggle) {
        console.log("Nodo no encontrado:", nodeId);
        return prevNodes;
      }
      
      // Obtener el estado actual de colapso
      const currentCollapsed = nodeToToggle.data.collapsed;
      console.log("Estado actual de colapso:", currentCollapsed);
      
      // Actualizar todos los nodos, cambiando solo el específico
      return prevNodes.map(node => {
        if (node.id === nodeId) {
          console.log(`Cambiando estado de colapso para ${nodeId} de ${currentCollapsed} a ${!currentCollapsed}`);
          return {
            ...node,
            data: {
              ...node.data,
              collapsed: !currentCollapsed,
              // Importante: Mantener la referencia a la función de colapso
              onToggleCollapse: handleNodeCollapse,
              // Importante: Marcar este nodo como modificado manualmente
              manuallyToggled: true
            }
          };
        }
        return node;
      });
    });
  }, []);

  // Función para cambiar el nivel de colapso
  const changeCollapseLevel = useCallback((level) => {
    console.log("Cambiando nivel de colapso a:", level);
    setLevelThreshold(level);
    
    setNodes((prevNodes) => {
      return prevNodes.map((node) => {
        // Si el nodo ha sido modificado manualmente, respetar ese estado
        if (node.data.manuallyToggled) {
          return node;
        }
        
        // De lo contrario, aplicar la regla de nivel
        const nodeLevel = (node.id.match(/node-/g) || []).length;
        const shouldBeCollapsed = nodeLevel > level;
        
        return {
          ...node,
          data: {
            ...node.data,
            collapsed: shouldBeCollapsed,
            onToggleCollapse: handleNodeCollapse
          }
        };
      });
    });
  }, [handleNodeCollapse]);

  // Función para colapsar todos los nodos
  const collapseAllNodes = useCallback(() => {
    setNodes((nodes) => 
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          collapsed: true,
          manuallyToggled: false // Resetear el estado manual
        }
      }))
    );
  }, [setNodes]);

  // Función para expandir todos los nodos
  const expandAllNodes = useCallback(() => {
    setNodes((nodes) => 
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          collapsed: false,
          manuallyToggled: false // Resetear el estado manual
        }
      }))
    );
  }, [setNodes]);

  // Actualizar layout manualmente
  const updateLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      layoutDirection
    );
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes, edges, layoutDirection, getLayoutedElements, setNodes, setEdges]);

  // Función para crear los nodos iniciales con mejor manejo de datos
  const createNodes = useCallback((jsonData) => {
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    // Función recursiva para procesar el JSON
    const processNode = (data, parentId = null, level = 1, keyName = '') => {
      const currentId = `node-${nodeId++}`;
      
      if (Array.isArray(data)) {
        // Procesar array
        nodes.push({
          id: currentId,
          type: 'arrayNode',
          data: {
            label: keyName || 'Array',
            length: data.length,
            collapsed: false, // Siempre expandido por defecto
            onToggleCollapse: handleNodeCollapse,
            manuallyToggled: false
          },
          position: { x: 0, y: 0 }
        });
        
        // Procesar cada elemento del array
        data.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            const childId = processNode(item, currentId, level + 1, `${index}`);
          }
        });
      } else if (typeof data === 'object' && data !== null) {
        // Extraer propiedades simples (no objetos)
        const properties = Object.entries(data)
          .filter(([_, value]) => typeof value !== 'object' || value === null)
          .map(([key, value]) => ({
            key,
            value: value === null ? 'null' : String(value)
          }));
        
        // Crear nodo para el objeto
        nodes.push({
          id: currentId,
          type: 'objectNode',
          data: {
            label: keyName || 'Object',
            properties,
            collapsed: false, // Siempre expandido por defecto
            onToggleCollapse: handleNodeCollapse,
            manuallyToggled: false
          },
          position: { x: 0, y: 0 }
        });
        
        // Procesar propiedades que son objetos
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            const childId = processNode(value, currentId, level + 1, key);
          }
        });
      }
      
      // Crear conexión con el padre si existe
      if (parentId !== null) {
        edges.push({
          id: `edge-${parentId}-${currentId}`,
          source: parentId,
          target: currentId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#4299e1', strokeWidth: 2 }
        });
      }
      
      return currentId;
    };
    
    // Iniciar procesamiento desde la raíz
    processNode(jsonData);
    
    return { nodes, edges };
  }, [handleNodeCollapse]);

  // Función para calcular la profundidad máxima del JSON
  const calculateMaxDepth = useCallback((data, currentDepth = 1) => {
    if (typeof data !== 'object' || data === null) return currentDepth;
    
    let maxDepth = currentDepth;
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          const depth = calculateMaxDepth(item, currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      });
    } else {
      Object.values(data).forEach(value => {
        if (typeof value === 'object' && value !== null) {
          const depth = calculateMaxDepth(value, currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      });
    }
    
    return maxDepth;
  }, []);
  
  // Calcular la profundidad máxima del JSON cuando cambia
  const [maxDepth, setMaxDepth] = useState(1);
  useEffect(() => {
    if (jsonData) {
      const depth = calculateMaxDepth(jsonData);
      setMaxDepth(depth);
      // Opcional: ajustar automáticamente el nivel de umbral basado en la profundidad
      // setLevelThreshold(Math.min(5, Math.max(3, Math.floor(depth / 2))));
    }
  }, [jsonData, calculateMaxDepth]);

  // Actualizar los nodos cuando cambia el JSON
  useEffect(() => {
    if (jsonData) {
      const { nodes: initialNodes, edges: initialEdges } = createNodes(jsonData);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        layoutDirection
      );
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [jsonData, createNodes, getLayoutedElements, setNodes, setEdges, layoutDirection]);
  
  return (
    <div className={`h-full w-full ${darkMode ? 'bg-black' : 'bg-gray-100'} relative`} ref={reactFlowWrapper}>
      {/* Controles de UI */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <SearchBar onSearch={setSearchTerm} />
      </div>
      
      <div className="absolute top-2 right-2 z-10 flex flex-wrap gap-2 tools-panel">
        <button 
          onClick={() => setLayoutDirection('LR')}
          className={`px-2 py-1 text-xs rounded ${layoutDirection === 'LR' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          Horizontal
        </button>
        <button 
          onClick={() => setLayoutDirection('TB')}
          className={`px-2 py-1 text-xs rounded ${layoutDirection === 'TB' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          Vertical
        </button>
        
        {/* Control mejorado para el nivel de profundidad */}
        <div className="flex items-center bg-gray-700 rounded px-2 py-1">
          <span className="text-xs text-white mr-2">Nivel: {levelThreshold}</span>
          <input 
            type="range" 
            min="1" 
            max={Math.max(10, maxDepth)} 
            value={levelThreshold}
            onChange={(e) => changeCollapseLevel(parseInt(e.target.value))}
            className="w-20 h-2"
          />
        </div>
        
        <select 
          onChange={(e) => setNodeSizeMode(e.target.value)}
          value={nodeSizeMode}
          className="px-2 py-1 text-xs rounded bg-gray-700 text-white"
        >
          <option value="compact">Compacto</option>
          <option value="medium">Mediano</option>
          <option value="expanded">Expandido</option>
        </select>
        
        <button 
          onClick={collapseAllNodes}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
          Colapsar Todo
        </button>
        <button 
          onClick={expandAllNodes}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
          Expandir Todo
        </button>
        
        <button 
          onClick={updateLayout}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
          Reorganizar
        </button>
      </div>
      
      {/* Indicador de nodos ocultos */}
      <div className="absolute bottom-2 left-2 z-10 bg-gray-800 bg-opacity-80 rounded px-3 py-1 text-xs text-white">
        Profundidad máxima: {maxDepth} | Mostrando hasta nivel: {levelThreshold}
      </div>
      
      {/* ReactFlow con las opciones corregidas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 1.5 },
        }}
      >
        <Background color={darkMode ? "#333" : "#e5e7eb"} gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.type) {
              case 'arrayNode': return darkMode ? '#ecc94b' : '#d97706';
              default: return darkMode ? '#4299e1' : '#2563eb';
            }
          }}
          maskColor={darkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)"}
          style={{ background: darkMode ? '#1a202c' : '#f3f4f6' }}
        />
      </ReactFlow>
    </div>
  );
};

export default DiagramView;