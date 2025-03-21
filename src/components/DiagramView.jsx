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
import { debounce } from 'lodash';

// Mover la definición de los componentes de nodo fuera del componente principal
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

// Definir nodeTypes fuera del componente principal como un objeto constante
const nodeTypeDefinitions = {
  objectNode: ObjectNode,
  arrayNode: ArrayNode,
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
  
  // Estado para almacenar el nodo seleccionado
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Memoizar nodeTypes para evitar recreaciśon
  const nodeTypes = useMemo(() => nodeTypeDefinitions, []);
  
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
    const nodeId = node.id;
    
    // Actualizar el estado de selección
    setSelectedNodeId(prevSelectedNodeId => 
      prevSelectedNodeId === nodeId ? null : nodeId);
    
    // Resaltar/quitar resaltado de las aristas conectadas
    setEdges(prevEdges => {
      return prevEdges.map(edge => {
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
    
    // También podemos resaltar nodos conectados si es necesario
    setNodes(prevNodes => {
      return prevNodes.map(n => {
        const isConnectedNode = edges.some(edge => 
          (edge.source === nodeId && edge.target === n.id) || 
          (edge.target === nodeId && edge.source === n.id)
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
  }, [setEdges, setNodes, edges, selectedNodeId]);

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

  // Debounce para el evento de arrastre
  const onNodesDragStop = useCallback(
    debounce((event, node) => {
      // Aquí puedes manejar lo que sucede al detener el arrastre
      console.log('Node drag stopped:', node);
    }, 1), // Ajusta el tiempo de debounce según sea necesario
    []
  );

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
      
      {/* ReactFlow con las opciones corregidas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance}
        fitView
        fitViewOptions={{ padding: 0.3, includeHiddenNodes: false }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 1.5 },
        }}
        className="animate-layout-transition"
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDragStop={onNodesDragStop}
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
        
        {/* Panel para función automática de recálculo del layout cuando hay cambios */}
        <Panel position="bottom-center" className="bg-transparent">
          <button
            className="hidden"
            onClick={() => {
              if (reactFlowInstance) {
                // Usar requestAnimationFrame para mejores tiempos
                requestAnimationFrame(() => {
                  // Marcar todas las aristas como actualizándose antes del layout
                  setEdges(prevEdges => 
                    prevEdges.map(edge => ({
                      ...edge, 
                      className: `${edge.className || ''} updating`.trim() 
                    }))
                  );
                  
                  // Usar timeout mínimo para dar tiempo a que se completen otras transiciones
                  setTimeout(() => {
                    // Recalcular el layout con opciones optimizadas
                    reactFlowInstance.fitView({
                      padding: 0.3,
                      includeHiddenNodes: false,
                      duration: 300 // Tiempo reducido para la animación
                    });
                    
                    // Quitar la clase de actualización después de completar el layout
                    setTimeout(() => {
                      setEdges(prevEdges => 
                        prevEdges.map(edge => ({
                          ...edge, 
                          className: (edge.className || '').replace('updating', '').trim() 
                        }))
                      );
                    }, 350);
                  }, 30);
                });
              }
            }}
            id="auto-layout-btn"
          />
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default DiagramView;