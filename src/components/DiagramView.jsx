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
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import SearchBar from './SearchBar';
import { debounce } from 'lodash';

// Primero definimos todos los componentes de nodos
const ObjectNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  const hasChildren = data.childrenCount && data.childrenCount > 0;
  
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
      <Handle 
        type="source" 
        position={Position.Right} 
        className="handle-custom"
      />
    </div>
  );
};

const ArrayNode = ({ data, id, selected }) => {
  const collapsed = data.collapsed || false;
  const hasChildren = data.childrenCount && data.childrenCount > 0;
  
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
      <Handle 
        type="source" 
        position={Position.Right} 
        className="handle-custom"
      />
    </div>
  );
};

// Luego definimos el componente CustomEdge
const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style = {} }) => {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{
        ...style,
        stroke: '#555',
        strokeWidth: 1.5,
      }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              padding: '2px 4px',
              borderRadius: '4px',
              color: '#fff',
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// Definir los tipos de nodos y bordes fuera del componente
const NODE_TYPES = {
  objectNode: ObjectNode,
  arrayNode: ArrayNode,
};

const EDGE_TYPES = {
  customEdge: CustomEdge,
};

const DiagramView = ({ jsonData, darkMode = true }) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutDirection, setLayoutDirection] = useState('LR');
  const [levelThreshold, setLevelThreshold] = useState(999);
  const [nodeSizeMode, setNodeSizeMode] = useState('medium');
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  
  // Estado para almacenar el nodo seleccionado
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Referencias estables para evitar problemas de dependencias circulares
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
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
    if (!nodes || !nodes.length) return { nodes: [], edges: [] };
    
    // Crear una copia segura de los nodos y aristas
    const safeNodes = [...nodes].filter(node => node && node.id);
    const safeEdges = [...edges].filter(edge => 
      edge && edge.id && edge.source && edge.target &&
      safeNodes.some(node => node.id === edge.source) &&
      safeNodes.some(node => node.id === edge.target)
    );
    
    if (!safeNodes.length) return { nodes: safeNodes, edges: safeEdges };
    
    // Crear un nuevo grafo para el layout
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Ajustes mejorados para el espaciado basado en el modo seleccionado
    let baseSep = nodeSizeMode === 'compact' ? 40 : 
                 nodeSizeMode === 'expanded' ? 80 : 60;
    
    // Ajustar espaciado basado en cantidad de nodos (espaciado progresivo)
    let nodeSepFactor = 1.0;
    let rankSepFactor = 1.0;
    
    // Para gráficos con pocos nodos, dar más espacio
    if (safeNodes.length < 20) {
      nodeSepFactor = 1.5;
      rankSepFactor = 1.5;
    } else if (safeNodes.length > 100) {
      // Para gráficos muy grandes, optimizar el espacio
      nodeSepFactor = 0.8;
      rankSepFactor = 0.8;
    }
    
    // Aplicar factores de espaciado según dirección
    const nodesep = baseSep * (direction === 'LR' ? 1.2 : 1.0) * nodeSepFactor;
    const ranksep = baseSep * (direction === 'TB' ? 1.2 : 1.0) * rankSepFactor;
    
    // Configuración mejorada del grafo para evitar superposiciones
    dagreGraph.setGraph({ 
      rankdir: direction,
      ranksep,
      nodesep,
      marginx: 50,
      marginy: 50,
      align: direction === 'LR' ? 'UL' : 'DL',
      ranker: 'tight-tree', // Usar un algoritmo optimizado para árboles
      acyclicer: 'greedy',
      // Utilizar separación forzada para evitar superposiciones
      edgesep: baseSep * 0.4,
      // Preferir layout más compacto pero sin superposiciones
      rankSep: ranksep,
      // Maximizar la utilización del espacio
      nestingRoot: null,
      // Aplicar fuerza de antisolapamiento
      gravity: 0.3,
    });

    // Añadir nodos al grafo con tamaños precisos
    safeNodes.forEach((node) => {
      try {
        // Obtener dimensiones precisas con margen adicional para prevenir solapamientos
        const { width, height } = estimateNodeSize(node);
        // Añadir margen de seguridad para evitar superposiciones
        const safetyMargin = 15;
        
        dagreGraph.setNode(node.id, { 
          width: width + safetyMargin, 
          height: height + safetyMargin
        });
      } catch (error) {
        console.warn(`Error procesando nodo ${node.id}:`, error);
        // Usar tamaño predeterminado con margen si hay error
        dagreGraph.setNode(node.id, { width: 220, height: 65 });
      }
    });

    // Añadir aristas al grafo
    safeEdges.forEach((edge) => {
      try {
        dagreGraph.setEdge(edge.source, edge.target);
      } catch (error) {
        console.warn(`Error procesando arista ${edge.id}:`, error);
      }
    });

    // Calcular el layout con manejo de errores
    try {
      dagre.layout(dagreGraph);
    } catch (error) {
      console.error("Error en el cálculo del layout:", error);
      return { nodes: safeNodes, edges: safeEdges };
    }

    // Procesar los nodos con el nuevo layout y verificar superposiciones
    const layoutedNodes = safeNodes.map((node) => {
      try {
        const nodeWithPosition = dagreGraph.node(node.id);
        
        // Verificar si dagre devolvió posición para este nodo
        if (!nodeWithPosition || typeof nodeWithPosition.x !== 'number' || typeof nodeWithPosition.y !== 'number') {
          return node;
        }
        
        const { width, height } = estimateNodeSize(node);
        
        return {
          ...node,
          // Importante: permitir que el nodo sea arrastrable
          draggable: true,
          position: {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          },
          dimensions: { width, height }
        };
      } catch (error) {
        console.warn(`Error posicionando nodo ${node.id}:`, error);
        // También aquí permitimos que sea arrastrable
        return { ...node, draggable: true };
      }
    });

    return { nodes: layoutedNodes, edges: safeEdges };
  }, [nodeSizeMode, estimateNodeSize]);

  // Referencia estable para las aristas
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  
  // Función para manejar el colapso de nodos individual sin dependencias circulares
  const handleNodeCollapse = useCallback((nodeId) => {
    // Utilizar los refs para acceder a los valores más recientes
    const currentEdges = edgesRef.current;
    
    setNodes(prevNodes => {
      // Obtener el estado de colapso actual del nodo
      const currentNode = prevNodes.find(node => node.id === nodeId);
      if (!currentNode) return prevNodes;
      
      const newCollapsedState = !currentNode.data.collapsed;
      
      // Funciones para el manejo de jerarquía mejorado
      // Función que encuentra todos los descendientes de un nodo (incluyendo todos los niveles de anidación)
      const findAllDescendants = (rootId) => {
        const descendants = new Set();
        
        // Función recursiva interna para explorar el árbol
        const explore = (nodeId) => {
          // Encontrar todos los hijos directos de este nodo
          const childrenIds = currentEdges
            .filter(edge => edge.source === nodeId)
            .map(edge => edge.target);
          
          // Agregar cada hijo al conjunto de descendientes y seguir explorando recursivamente
          childrenIds.forEach(childId => {
            if (!descendants.has(childId)) {
              descendants.add(childId);
              explore(childId);
            }
          });
        };
        
        // Iniciar exploración desde el nodo raíz
        explore(rootId);
        
        return Array.from(descendants);
      };
      
      // Encontrar todos los descendientes recursivamente
      const allDescendants = findAllDescendants(nodeId);
      
      // Crear un conjunto para almacenar todas las aristas que deben ocultarse
      const edgesConnections = new Set();
      
      // Incluir todas las aristas que conectan con descendientes
      allDescendants.forEach(descendantId => {
        // Encontrar todas las aristas que conectan con este descendiente (entrantes y salientes)
        currentEdges.forEach(edge => {
          if (edge.source === descendantId || edge.target === descendantId) {
            edgesConnections.add(edge.id);
          }
        });
      });
      
      // También incluir las aristas que salen directamente del nodo colapsado
      // si está en estado colapsado
      const directEdges = new Set();
      currentEdges.forEach(edge => {
        if (edge.source === nodeId) {
          directEdges.add(edge.id);
        }
      });
      
      // Preparar actualizaciones de aristas para aplicarlas en un lote junto con los nodos
      const updatedEdges = edgesRef.current.map(edge => {
        const isDescendantEdge = edgesConnections.has(edge.id);
        const isDirectEdge = directEdges.has(edge.id);
        
        // Si es una arista directa o de descendiente y se está colapsando
        if ((isDescendantEdge || (isDirectEdge && !edge.isParentEdge)) && newCollapsedState) {
          return {
            ...edge,
            style: {
              ...edge.style,
              opacity: 0,
              visibility: 'hidden',
              strokeWidth: 0,
              pointerEvents: 'none',
            },
            hidden: true,
            savedStyle: edge.style || {} // Guardar el estilo original
          };
        } 
        // Si es una arista oculta que debemos mostrar al expandir
        else if ((isDescendantEdge || isDirectEdge) && !newCollapsedState && edge.hidden) {
          return {
            ...edge,
            style: edge.savedStyle || {
              opacity: 1,
              visibility: 'visible',
              strokeWidth: 2,
              pointerEvents: 'auto',
            },
            hidden: false,
            isParentEdge: edge.source === nodeId // Marcar si es una arista del padre
          };
        }
        
        return edge;
      });
      
      // Actualizar todos los nodos
      const updatedNodes = prevNodes.map(node => {
        // Actualizar el nodo que se está colapsando/expandiendo
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              collapsed: newCollapsedState,
              manuallyToggled: true
            }
          };
        }
        
        // Ocultar/mostrar los nodos descendientes
        if (allDescendants.includes(node.id)) {
          if (newCollapsedState) {
            // Guardamos el estilo anterior al ocultar
            return {
              ...node,
              savedStyle: node.style || {},
              style: {
                ...node.style,
                opacity: 0,
                visibility: 'hidden',
                zIndex: -999,
                pointerEvents: 'none',
              },
              hidden: true,
              isHiddenByParent: true
            };
          } else {
            // Restauramos el estilo guardado al mostrar de nuevo
            return {
              ...node,
              style: node.savedStyle || {
                opacity: 1,
                visibility: 'visible',
                zIndex: 0,
                pointerEvents: 'auto',
              },
              hidden: false,
              isHiddenByParent: false
            };
          }
        }
        
        return node;
      });
      
      // Actualizar las aristas inmediatamente
      setEdges(updatedEdges);
      
      // Recalcular el layout después de un tiempo suficiente para que las animaciones se completen
      requestAnimationFrame(() => {
        setTimeout(() => {
          const autoLayoutBtn = document.getElementById('auto-layout-btn');
          if (autoLayoutBtn) {
            autoLayoutBtn.click();
          }
        }, 50);
      });
      
      return updatedNodes;
    });
  }, [setNodes, setEdges]);

  // Función para cambiar el nivel de colapso
  const changeCollapseLevel = useCallback((level) => {
    setLevelThreshold(level);
    
    // Actualizar los nodos según el nivel
    const currentEdges = edgesRef.current;
    
    setNodes(prevNodes => {
      // Funciones para calcular descendientes basado en el nivel y el estado de colapso
      const findAllDescendantsOfCollapsedNodes = (nodes) => {
        const allDescendants = new Set();
        const nodesToProcess = nodes.filter(node => node.data && node.data.collapsed);
        
        // Función recursiva que explora el árbol desde un nodo colapsado
        const explore = (nodeId) => {
          // Encontrar todos los hijos directos
          const childrenIds = currentEdges
            .filter(edge => edge.source === nodeId)
            .map(edge => edge.target);
          
          // Agregar cada hijo y continuar explorando recursivamente
          childrenIds.forEach(childId => {
            if (!allDescendants.has(childId)) {
              allDescendants.add(childId);
              explore(childId);
            }
          });
        };
        
        // Explorar desde cada nodo colapsado
        nodesToProcess.forEach(node => explore(node.id));
        
        return Array.from(allDescendants);
      };
      
      // Primera pasada: actualizar el estado collapsed de cada nodo basado en su nivel
      const nodesWithCollapseState = prevNodes.map(node => {
        // Si el nodo ha sido modificado manualmente, respetar ese estado
        if (node.data && node.data.manuallyToggled) {
          return node;
        }
        
        // De lo contrario, aplicar la regla de nivel
        const nodeLevel = (node.id.match(/node-/g) || []).length;
        const shouldBeCollapsed = nodeLevel > level;
        
        return {
          ...node,
          data: {
            ...node.data,
            collapsed: shouldBeCollapsed
          }
        };
      });
      
      // Segunda pasada: encontrar todos los descendientes de nodos colapsados
      const allDescendantsToHide = findAllDescendantsOfCollapsedNodes(nodesWithCollapseState);
      
      // Recopilar todas las aristas que deben ocultarse
      const edgesToHide = new Set();
      
      // Considerar aristas conectadas a nodos ocultos
      allDescendantsToHide.forEach(descendantId => {
        currentEdges.forEach(edge => {
          if (edge.source === descendantId || edge.target === descendantId) {
            edgesToHide.add(edge.id);
          }
        });
      });
      
      // Considerar aristas salientes de nodos colapsados
      nodesWithCollapseState.forEach(node => {
        if (node.data && node.data.collapsed) {
          currentEdges.forEach(edge => {
            if (edge.source === node.id) {
              edgesToHide.add(edge.id);
            }
          });
        }
      });
      
      // Preparar actualizaciones de aristas para aplicarlas en un lote
      const updatedEdges = edgesRef.current.map(edge => {
        // Verificar si esta arista debe ocultarse
        const shouldHide = edgesToHide.has(edge.id);
        
        if (shouldHide) {
          return {
            ...edge,
            savedStyle: edge.style || {}, // Guardar el estilo actual
            style: {
              ...edge.style,
              opacity: 0,
              visibility: 'hidden',
              strokeWidth: 0,
              pointerEvents: 'none',
            },
            hidden: true
          };
        } else {
          return {
            ...edge,
            style: edge.savedStyle || {
              ...edge.style,
              opacity: 1,
              visibility: 'visible',
              strokeWidth: edge.style?.strokeWidth || 1.5,
              pointerEvents: 'auto',
            },
            hidden: false
          };
        }
      });
      
      // Aplicar visibilidad a los nodos según si están en la lista de ocultos
      const finalNodes = nodesWithCollapseState.map(node => {
        const shouldHide = allDescendantsToHide.includes(node.id);
        
        if (shouldHide) {
          return {
            ...node,
            savedStyle: node.style || {}, // Guardar el estilo actual
            style: {
              ...node.style,
              opacity: 0,
              visibility: 'hidden',
              zIndex: -999,
              pointerEvents: 'none',
            },
            hidden: true,
            isHiddenByParent: true
          };
        } else {
          return {
            ...node,
            style: node.savedStyle || {
              ...node.style,
              opacity: 1,
              visibility: 'visible',
              zIndex: 0,
              pointerEvents: 'auto',
            },
            hidden: false,
            isHiddenByParent: false
          };
        }
      });
      
      // Actualizar las aristas inmediatamente
      setEdges(updatedEdges);
      
      // Programar el recálculo del layout para después de las actualizaciones visuales
      requestAnimationFrame(() => {
        setTimeout(() => {
          const autoLayoutBtn = document.getElementById('auto-layout-btn');
          if (autoLayoutBtn) {
            autoLayoutBtn.click();
          }
        }, 50);
      });
      
      return finalNodes;
    });
  }, [setNodes, setEdges]);

  // Referencia para la función handleNodeCollapse
  const handleNodeCollapseRef = useRef(handleNodeCollapse);
  useEffect(() => {
    handleNodeCollapseRef.current = handleNodeCollapse;
  }, [handleNodeCollapse]);

  // Función para crear los nodos iniciales con mejor manejo de datos
  const createNodes = useCallback((jsonData) => {
    if (!jsonData) return { nodes: [], edges: [] };
    
    const nodes = [];
    const edges = [];
    let nodeId = 0;
    
    // Mapa para rastrear los hijos de cada nodo
    const childrenMap = {};

    // Función recursiva para procesar el JSON
    const processNode = (data, parentId = null, level = 1, keyName = '') => {
      const currentId = `node-${nodeId++}`;
      
      // Inicializar el contador de hijos para este nodo
      if (!childrenMap[currentId]) {
        childrenMap[currentId] = [];
      }
      
      if (Array.isArray(data)) {
        // Procesar array
        nodes.push({
          id: currentId,
          type: 'arrayNode',
          data: {
            label: keyName || 'Array',
            length: data.length,
            collapsed: false,
            childrenCount: 0 // Se actualizará después
          },
          position: { x: 0, y: 0 }
        });
        
        // Procesar cada elemento del array
        data.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            const childId = processNode(item, currentId, level + 1, `${index}`);
            childrenMap[currentId].push(childId);
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
            collapsed: false,
            childrenCount: 0 // Se actualizará después
          },
          position: { x: 0, y: 0 }
        });
        
        // Procesar propiedades que son objetos
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            const childId = processNode(value, currentId, level + 1, key);
            childrenMap[currentId].push(childId);
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
    
    // Actualizar el recuento de hijos para cada nodo
    nodes.forEach(node => {
      if (childrenMap[node.id]) {
        node.data.childrenCount = childrenMap[node.id].length;
      }
    });
    
    // Añadir función de colapso mediante una referencia estable
    const nodesWithCollapseHandler = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onToggleCollapse: (id) => handleNodeCollapseRef.current(id)
      }
    }));
    
    return { nodes: nodesWithCollapseHandler, edges };
  }, []);

  // Calcular la profundidad máxima del JSON cuando cambia
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
  
  const [maxDepth, setMaxDepth] = useState(1);
  
  // Actualizar la profundidad máxima cuando cambia el JSON
  useEffect(() => {
    if (jsonData) {
      const depth = calculateMaxDepth(jsonData);
      setMaxDepth(depth);
    }
  }, [jsonData, calculateMaxDepth]);

  // Referencia a la función getLayoutedElements
  const getLayoutedElementsRef = useRef(getLayoutedElements);
  useEffect(() => {
    getLayoutedElementsRef.current = getLayoutedElements;
  }, [getLayoutedElements]);

  // Referencia al estado de layoutDirection
  const layoutDirectionRef = useRef(layoutDirection);
  useEffect(() => {
    layoutDirectionRef.current = layoutDirection;
  }, [layoutDirection]);

  // Referencia a la función createNodes
  const createNodesRef = useRef(createNodes);
  useEffect(() => {
    createNodesRef.current = createNodes;
  }, [createNodes]);
  
  // Efecto para activar el recálculo automático del layout cuando hay cambios en los nodos
  useEffect(() => {
    // Activar el botón de recálculo de layout solo si hay cambios importantes
    // como colapsos, expansiones o cambios de dirección
    if (nodes.length > 0) {
      const autoLayoutBtn = document.getElementById('auto-layout-btn');
      if (autoLayoutBtn) {
        setTimeout(() => {
          autoLayoutBtn.click();
        }, 100);
      }
    }
  }, [levelThreshold, layoutDirection, nodeSizeMode]);
  
  // Efecto adicional para recalcular cuando se colapsan/expanden nodos manualmente
  useEffect(() => {
    const collapsedStateChanged = nodes.some(node => node.data && node.data.manuallyToggled);
    
    if (collapsedStateChanged) {
      const autoLayoutBtn = document.getElementById('auto-layout-btn');
      if (autoLayoutBtn) {
        setTimeout(() => {
          autoLayoutBtn.click();
        }, 150);
      }
    }
  }, [nodes]);

  // Actualizar los nodos cuando cambia el JSON evitando dependencias circulares
  useEffect(() => {
    if (!jsonData) return;
    
    const { nodes: initialNodes, edges: initialEdges } = createNodesRef.current(jsonData);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsRef.current(
      initialNodes,
      initialEdges,
      layoutDirectionRef.current
    );
    
    // Inicializar con todos los nodos expandidos al cargar
    const expandedNodes = layoutedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        collapsed: false
      },
      hidden: false,
      style: {
        ...node.style,
        opacity: 1,
        visibility: 'visible',
        zIndex: 0
      }
    }));
    
    setLevelThreshold(999); // Establecer nivel a máximo para mostrar todo inicialmente
    setNodes(expandedNodes);
    setEdges(layoutedEdges);
    
    // Recalcular layout después de la carga inicial
    setTimeout(() => {
      const autoLayoutBtn = document.getElementById('auto-layout-btn');
      if (autoLayoutBtn) {
        autoLayoutBtn.click();
      }
    }, 200);
  }, [jsonData, setNodes, setEdges]);

  // Función para manejar la selección de nodos y resaltar conexiones
  const onNodeClick = useCallback((event, node) => {
    if (!node || !node.id) return;
    
    const nodeId = node.id;
    
    // Actualizar el estado de selección
    setSelectedNodeId(prevSelectedNodeId => 
      prevSelectedNodeId === nodeId ? null : nodeId);
    
    // Referencia segura a las aristas actuales
    const currentEdges = edgesRef.current;
    
    // Resaltar/quitar resaltado de las aristas conectadas
    setEdges(prevEdges => {
      return prevEdges.map(edge => {
        if (!edge || !edge.id) return edge;
        
        const isConnected = edge.source === nodeId || edge.target === nodeId;
        
        // Si el nodo ya estaba seleccionado, quitamos todos los resaltados
        if (selectedNodeId === nodeId) {
          return {
            ...edge,
            className: edge.className?.replace('edge-highlight', '') || '',
            animated: false
          };
        }
        
        // Si es una conexión del nodo seleccionado, resaltarla
        if (isConnected) {
          const existingClass = edge.className || '';
          return {
            ...edge,
            className: existingClass.includes('edge-highlight') 
              ? existingClass 
              : `${existingClass} edge-highlight`,
            animated: true
          };
        }
        
        // Para las demás conexiones, quitar el resaltado
        return {
          ...edge,
          className: edge.className?.replace('edge-highlight', '') || '',
          animated: false
        };
      });
    });
    
    // También podemos resaltar nodos conectados con manejo seguro
    setNodes(prevNodes => {
      return prevNodes.map(n => {
        if (!n || !n.id) return n;
        
        const isConnectedNode = currentEdges.some(edge => 
          edge && edge.id && (
            (edge.source === nodeId && edge.target === n.id) || 
            (edge.target === nodeId && edge.source === n.id)
          )
        );
        
        // Si el nodo ya estaba seleccionado, quitamos todos los resaltados
        if (selectedNodeId === nodeId) {
          return {
            ...n,
            className: n.className?.replace('node-highlight', '') || '',
            style: {
              ...n.style,
              boxShadow: null
            }
          };
        }
        
        // Si es un nodo conectado, resaltarlo
        if (isConnectedNode || n.id === nodeId) {
          const existingClass = n.className || '';
          return {
            ...n,
            className: existingClass.includes('node-highlight') 
              ? existingClass 
              : `${existingClass} node-highlight`,
            style: {
              ...n.style,
              zIndex: 10 // Traer al frente los nodos resaltados
            }
          };
        }
        
        // Para los demás nodos, quitar el resaltado
        return {
          ...n,
          className: n.className?.replace('node-highlight', '') || '',
          style: {
            ...n.style,
            zIndex: n.style?.zIndex || 0
          }
        };
      });
    });
  }, [setEdges, setNodes, selectedNodeId]);

  // Función para limpiar el resaltado cuando se hace clic en el fondo
  const onPaneClick = useCallback(() => {
    if (selectedNodeId) {
      setSelectedNodeId(null);
      
      // Quitar resaltado de todas las conexiones
      setEdges(prevEdges => {
        return prevEdges.map(edge => ({
          ...edge,
          className: edge.className?.replace('edge-highlight', '') || '',
          animated: false
        }));
      });
      
      // Quitar resaltado de todos los nodos
      setNodes(prevNodes => {
        return prevNodes.map(node => ({
          ...node,
          className: node.className?.replace('node-highlight', '') || '',
          style: {
            ...node.style,
            zIndex: node.style?.zIndex === 10 ? 0 : node.style?.zIndex
          }
        }));
      });
    }
  }, [selectedNodeId, setEdges, setNodes]);

  // Optimizar la función recalculateLayout para mejorar el rendimiento de fitView
  const recalculateLayout = useCallback(() => {
    if (reactFlowInstance) {
      try {
        // Indicar visualmente que estamos recalculando
        document.body.classList.add('viewport-transforming');
        
        // Reducción de la precisión visual durante transformaciones
          setEdges(prevEdges => 
            prevEdges.filter(edge => edge && edge.id)
              .map(edge => ({
                ...edge, 
              className: `${edge.className || ''} updating`.trim(),
              // Simplificar visual durante transformación
              style: {
                ...edge.style,
                strokeWidth: 1,
                transition: 'none'
              }
              }))
          );
          
        // Recalcular layout con optimizaciones
            const { nodes: newNodes, edges: newEdges } = getLayoutedElements(
              nodesRef.current,
              edgesRef.current,
              layoutDirection
            );
            
        // Actualizar nodos de manera eficiente
            setNodes(newNodes);
            
        // Usar un valor corto para la duración de fitView para mejorar rendimiento
            setTimeout(() => {
          if (reactFlowInstance) {
              try {
              // Configuración optimizada para fitView
                reactFlowInstance.fitView({
                padding: 0.1, // Reducción del padding para mejor rendimiento
                  includeHiddenNodes: false,
                duration: 200, // Reducir duración para mayor velocidad
                maxZoom: 1.5  // Limitar el zoom máximo para evitar procesamiento excesivo
                });
              
              // Quitar clase de transformación después de que termine
              setTimeout(() => {
                document.body.classList.remove('viewport-transforming');
                
                // Restaurar estilos visuales normales
                setEdges(prevEdges => 
                  prevEdges.filter(edge => edge && edge.id)
                    .map(edge => ({
                      ...edge, 
                      className: (edge.className || '').replace('updating', '').trim(),
                  style: {
                    ...edge.style,
                        strokeWidth: edge.style?.strokeWidth || 1.5,
                        transition: null
                      }
                    }))
                );
              }, 250);
            } catch (error) {
              console.warn("Error al ajustar la vista:", error);
              document.body.classList.remove('viewport-transforming');
            }
          }
        }, 10); // Reducir el tiempo de espera para comenzar fitView
        
      } catch (error) {
        console.warn("Error en el recálculo del layout:", error);
        document.body.classList.remove('viewport-transforming');
      }
    }
  }, [getLayoutedElements, reactFlowInstance, layoutDirection, setNodes, setEdges]);

  // Reemplazar el panel de auto-layout con esta función
  const autoLayoutRef = useRef(recalculateLayout);
  useEffect(() => {
    autoLayoutRef.current = recalculateLayout;
  }, [recalculateLayout]);

  // Función optimizada para controlar el fitView directamente
  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      document.body.classList.add('viewport-transforming');
      
      // Simplificar la representación visual durante la transformación
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            transition: 'none',
          }
        }))
      );
      
      // Usar requestAnimationFrame para sincronizar con el ciclo de renderizado del navegador
      requestAnimationFrame(() => {
        try {
          reactFlowInstance.fitView({
            padding: 0.1,
            includeHiddenNodes: false,
            duration: 200,
            maxZoom: 1.5
          });
          
          // Restaurar después de que termine la transformación
          setTimeout(() => {
            document.body.classList.remove('viewport-transforming');
            setNodes(prevNodes => 
              prevNodes.map(node => ({
                ...node,
                style: {
                  ...node.style,
                  transition: null
                }
              }))
            );
          }, 250);
        } catch (error) {
          console.warn("Error en fitView:", error);
          document.body.classList.remove('viewport-transforming');
        }
      });
    }
  }, [reactFlowInstance, setNodes]);

  // Optimización crítica de los handlers de arrastre
  const onNodeDragStart = useCallback((event, node) => {
    // Desactivar todas las transiciones y animaciones durante el arrastre
    document.body.classList.add('dragging-active');
    
    // Marcar este nodo como el que se está arrastrando para optimizaciones
    setNodes(prevNodes => 
      prevNodes.map(n => ({
        ...n,
        isDragging: n.id === node.id,
        // Desactivar las transiciones para todos los nodos durante el arrastre
        style: {
          ...n.style,
          transition: 'none'
        }
      }))
    );
  }, [setNodes]);

  // Esta función usa throttling implícito al ser muy específica
  const onNodeDrag = useCallback((event, node) => {
    // Usar requestAnimationFrame para limitar actualizaciones y mejorar rendimiento
    if (!window.dragAnimationFrame) {
      window.dragAnimationFrame = requestAnimationFrame(() => {
        // Solo actualizar las aristas directamente conectadas
        const connectedEdges = edgesRef.current.filter(edge => 
          edge.source === node.id || edge.target === node.id
        );
        
        if (connectedEdges.length > 0) {
          setEdges(prevEdges => {
            // Solo actualizamos los bordes conectados al nodo arrastrado
            return prevEdges.map(edge => {
              if (connectedEdges.some(e => e.id === edge.id)) {
                return {
                  ...edge,
                  // Aplicar estilo simplificado durante el arrastre
                  className: 'dragging-edge',
                  // Evitar animaciones durante el arrastre
                  animated: false,
                  style: {
                    ...edge.style,
                    transition: 'none',
                    strokeDasharray: '5,5' // Estilo visual ligero durante arrastre
                  }
                };
              }
              return edge;
            });
          });
        }
        
        window.dragAnimationFrame = null;
      });
    }
  }, [setEdges]);

  const onNodeDragStop = useCallback((event, node) => {
    // Cancelar cualquier frame pendiente
    if (window.dragAnimationFrame) {
      cancelAnimationFrame(window.dragAnimationFrame);
      window.dragAnimationFrame = null;
    }
    
    // Restaurar todas las transiciones
    document.body.classList.remove('dragging-active');
    
    // Restaurar nodos
    setNodes(prevNodes => 
      prevNodes.map(n => ({
        ...n,
        isDragging: false,
        // Restaurar transiciones con un ligero retraso para evitar saltos
        style: {
          ...n.style,
          transition: null // Null para que use el valor por defecto de CSS
        }
      }))
    );
    
    // Restaurar los estilos de los bordes
    setEdges(prevEdges => 
      prevEdges.map(edge => ({
        ...edge,
        className: edge.className?.replace('dragging-edge', '') || '',
        style: {
          ...edge.style,
          transition: null,
          strokeDasharray: null
        }
      }))
    );
    
    // Evitamos recalcular el layout automáticamente después del arrastre
    // para que el usuario pueda posicionar manualmente
  }, [setNodes, setEdges]);

  // Agregar un handler para cambios en los nodos para manejar correctamente el arrastre
  const onNodesChange = useCallback((changes) => {
    // Este es un reemplazo eficiente para setNodes(applyNodeChanges(changes, nodes))
    // que evita recreaciones innecesarias del estado
    setNodes(nodes => {
      // Filtramos los cambios para ignorar ciertos tipos durante el arrastre
      const filteredChanges = changes.filter(change => {
        // Si estamos arrastrando, solo procesamos cambios de posición
        if (document.body.classList.contains('dragging-active')) {
          return change.type === 'position';
        }
        return true;
      });
      
      if (filteredChanges.length === 0) return nodes;
      return applyNodeChanges(filteredChanges, nodes);
    });
  }, [setNodes]);

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
          onClick={() => changeCollapseLevel(0)}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
          Colapsar Todo
        </button>
        <button 
          onClick={() => changeCollapseLevel(999)}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">
          Expandir Todo
        </button>
      </div>
      
      {/* Indicador de nodos ocultos */}
      <div className="absolute bottom-2 left-2 z-10 bg-gray-800 bg-opacity-80 rounded px-3 py-1 text-xs text-white">
        Profundidad máxima: {maxDepth} | Mostrando hasta nivel: {levelThreshold}
      </div>
      
      {/* ReactFlow con configuración optimizada */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={null}
        onInit={setReactFlowInstance}
        fitView
        fitViewOptions={{ 
          padding: 0.1, 
          includeHiddenNodes: false,
          duration: 200, 
          maxZoom: 1.5 
        }}
        minZoom={0.1}
        maxZoom={2} // Limitar el zoom máximo para mejor rendimiento
        proOptions={{ 
          hideAttribution: true,
          account: 'paid-pro' // Activar optimizaciones pro incluso si no tiene cuenta
        }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 1.5 },
          animated: false,
        }}
        className="animate-layout-transition"
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onError={(error) => console.warn("ReactFlow error:", error)}
        nodesDraggable={true}
        edgesFocusable={true}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false} // Desactivar pan al desplazar para evitar operaciones costosas
        snapToGrid={false} // Desactivar snap para mejorar rendimiento
        snapGrid={[15, 15]}
        connectionLineStyle={{ stroke: '#ddd' }} // Simplificar línea de conexión
        elevateEdgesOnSelect={false} // Evitar elevación costosa
      >
        <Background 
          color={darkMode ? "#333" : "#e5e7eb"} 
          gap={16} 
          size={1} // Reducir tamaño para mejor rendimiento 
        />
        <Controls 
          showZoom={true}
          showFitView={true}
          showInteractive={false} // Desactivar elementos interactivos costosos
          fitViewOptions={{ 
            padding: 0.1, 
            duration: 200 
          }}
          onFitView={handleFitView} // Usar nuestra implementación optimizada
        />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.type) {
              case 'arrayNode': return darkMode ? '#ecc94b' : '#d97706';
              default: return darkMode ? '#4299e1' : '#2563eb';
            }
          }}
          maskColor={darkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)"}
          style={{ 
            background: darkMode ? '#1a202c' : '#f3f4f6',
            height: 80, // Reducir tamaño para mejor rendimiento
            width: 120
          }}
        />
        
        {/* Panel modificado con mejor manejo de errores */}
        <Panel position="bottom-center" className="bg-transparent">
          <button
            className="hidden"
            onClick={() => autoLayoutRef.current()}
            id="auto-layout-btn"
          />
        </Panel>
        
        {/* Reemplazar el botón de reorganización para usar nuestra implementación optimizada */}
        <Panel position="top-right" className="tools-panel ml-2">
          <button 
            onClick={() => {
              setEdges(prevEdges => 
                prevEdges.map(edge => ({
                  ...edge,
                  animated: false, // Desactivar animaciones durante el recálculo
                  style: {
                    ...edge.style,
                    transition: 'none'
                  }
                }))
              );
              autoLayoutRef.current();
            }}
            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 flex items-center"
            title="Reorganizar nodos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
            </svg>
            Reorganizar
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default DiagramView;