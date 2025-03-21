import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow
} from 'reactflow';

// Importamos los componentes UI
import Toolbar from './Toolbar';
import SearchBox from './SearchBox';
import DepthIndicator from './DepthIndicator';

// Importamos componentes de nodos
import { ObjectNode, ArrayNode } from './NodeTypes';
import CustomEdge from './EdgeTypes';

// Importar utils si los necesitas
import { getLayoutedElements } from '../utils/layout';

// Mapeo de tipos de nodos
const NODE_TYPES = {
  objectNode: ObjectNode,
  arrayNode: ArrayNode,
};

// Mapeo de tipos de aristas
const EDGE_TYPES = {
  customEdge: CustomEdge,
};

const DiagramView = ({ jsonData }) => {
  // Estados básicos
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutDirection, setLayoutDirection] = useState('LR');
  const [levelThreshold, setLevelThreshold] = useState(999);
  const [nodeSizeMode, setNodeSizeMode] = useState('medium');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Referencias
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  // Actualizar referencias cuando cambian los estados
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  
  // Función unificada para cambiar el nivel de colapso
  const changeCollapseLevel = useCallback((level) => {
    setLevelThreshold(level);
    
    
    // Determinar si estamos colapsando todo (level = 0) o expandiendo todo (level = 999)
    const isCollapsingAll = level === 0;
    const isExpandingAll = level === 999;
    
    // Guardar referencia a los nodos actuales para evitar problemas de sincronización
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    // Conjunto para rastrear todos los descendientes que deben ocultarse
    const allDescendantsToHide = new Set();
    
    // 1. Determinar todos los nodos que deben ocultarse basados en profundidad
    if (isCollapsingAll) {
      // Si colapsamos todo, ocultamos todos excepto el nodo raíz
      currentNodes.forEach(node => {
        const depth = node.data?.depth || 0;
        if (depth > 0) {
          allDescendantsToHide.add(node.id);
        }
      });
    } else if (!isExpandingAll) {
      // Si es un nivel específico, ocultamos nodos más profundos que el nivel
      currentNodes.forEach(node => {
        const depth = node.data?.depth || 0;
        if (depth > level) {
          allDescendantsToHide.add(node.id);
        }
      });
    }
    
    // 2. Actualizar estado de colapso de los nodos
    setNodes(prevNodes => {
      return prevNodes.map(node => {
        const depth = node.data?.depth || 0;
        const nodeId = node.id;
        
        // Determinar si este nodo debe estar visible
        const shouldBeHidden = isExpandingAll ? false : allDescendantsToHide.has(nodeId);
        
        // Determinar si este nodo debe marcarse como colapsado
        // Un nodo está colapsado si tiene hijos que deben ocultarse
        const hasCollapsibleChildren = currentEdges.some(edge => 
          edge.source === nodeId && 
          allDescendantsToHide.has(edge.target)
        );
        
        const shouldBeCollapsed = isExpandingAll 
          ? false 
          : (isCollapsingAll ? depth === 0 && hasCollapsibleChildren : depth >= level - 1 && hasCollapsibleChildren);
        
        return {
          ...node,
          hidden: shouldBeHidden,
          data: {
            ...node.data,
            collapsed: shouldBeCollapsed,
            // Resetear la marca manuallyToggled al usar colapso/expansión global
            manuallyToggled: false 
          },
          style: {
            ...node.style,
            visibility: shouldBeHidden ? 'hidden' : 'visible',
            opacity: shouldBeHidden ? 0 : 1,
            zIndex: shouldBeHidden ? -999 : 0,
            pointerEvents: shouldBeHidden ? 'none' : 'auto'
          }
        };
      });
    });
    
    // 3. Actualizar las aristas para que coincidan con el estado de los nodos
    setEdges(prevEdges => {
      return prevEdges.map(edge => {
        const sourceHidden = allDescendantsToHide.has(edge.source);
        const targetHidden = allDescendantsToHide.has(edge.target);
        const shouldBeHidden = sourceHidden || targetHidden;
        
        return {
          ...edge,
          hidden: shouldBeHidden,
          style: {
            ...edge.style,
            visibility: shouldBeHidden ? 'hidden' : 'visible',
            opacity: shouldBeHidden ? 0 : 1,
            strokeWidth: shouldBeHidden ? 0 : undefined,
            pointerEvents: shouldBeHidden ? 'none' : 'auto'
          }
        };
      });
    });
    
    // 4. Recalcular layout después de aplicar cambios
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.2,
          includeHiddenNodes: false
        });
      }, 100);
    }
  }, [setLevelThreshold, setNodes, setEdges, reactFlowInstance]);
  
  // Función para manejar el colapso de nodos individual
  const handleNodeCollapse = useCallback((nodeId) => {
    // Encontrar el nodo actual
    const currentNode = nodesRef.current.find(node => node.id === nodeId);
    if (!currentNode) return;
    
    // Obtener el nuevo estado de colapso (inverso del actual)
    const newCollapsedState = !currentNode.data?.collapsed;
    
    // Identificar los descendientes del nodo
    const descendants = [];
    const getChildren = (id) => {
      const childrenEdges = edgesRef.current.filter(edge => edge.source === id);
      const childrenIds = childrenEdges.map(edge => edge.target);
      
      childrenIds.forEach(childId => {
        if (!descendants.includes(childId)) {
          descendants.push(childId);
          getChildren(childId);
        }
      });
    };
    
    getChildren(nodeId);
    
    // Actualizar el nodo principal y sus descendientes
    setNodes(prevNodes => {
      return prevNodes.map(node => {
        if (node.id === nodeId) {
          // Nodo que está siendo colapsado/expandido
          return {
            ...node,
            data: {
              ...node.data,
              collapsed: newCollapsedState,
              manuallyToggled: true  // Marcar como toggled manualmente
            }
          };
        }
        else if (descendants.includes(node.id)) {
          // Nodos descendientes
          return {
            ...node,
            hidden: newCollapsedState,
            style: {
              ...node.style,
              visibility: newCollapsedState ? 'hidden' : 'visible',
              opacity: newCollapsedState ? 0 : 1,
              zIndex: newCollapsedState ? -999 : 0,
              pointerEvents: newCollapsedState ? 'none' : 'auto'
            }
          };
        }
        
        return node;
      });
    });
    
    // Actualizar las aristas relacionadas
    setEdges(prevEdges => {
      return prevEdges.map(edge => {
        // Todas las aristas conectadas a descendientes
        if (descendants.includes(edge.target) || descendants.includes(edge.source)) {
          return {
            ...edge,
            hidden: newCollapsedState,
            style: {
              ...edge.style,
              visibility: newCollapsedState ? 'hidden' : 'visible',
              opacity: newCollapsedState ? 0 : 1,
              strokeWidth: newCollapsedState ? 0 : undefined,
              pointerEvents: newCollapsedState ? 'none' : 'auto'
            }
          };
        }
        
        return edge;
      });
    });
    
    // Recalcular el layout después del cambio
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.2,
          includeHiddenNodes: false
        });
      }, 100);
    }
  }, [setNodes, setEdges, reactFlowInstance]);
  
  // Función para manejar clics en nodos
  const onNodeClick = useCallback((event, node) => {
    if (!node || !node.id) return;
    
    const nodeId = node.id;
    
    // Actualizar estado de selección
    setSelectedNodeId(prevSelectedNodeId => 
      prevSelectedNodeId === nodeId ? null : nodeId);
    
    // Establecer la selección visual en ReactFlow
    setNodes(prevNodes => 
      prevNodes.map(n => ({
        ...n,
        selected: n.id === nodeId
      }))
    );
    
    // Resaltar aristas conectadas
    setEdges(prevEdges => 
      prevEdges.map(edge => ({
        ...edge,
        className: (edge.source === nodeId || edge.target === nodeId) 
          ? 'edge-highlight' 
          : ''
      }))
    );
  }, [setNodes, setEdges, setSelectedNodeId]);
  
  // Función para reorganizar el layout
  const handleReorganize = useCallback(() => {
    if (!reactFlowInstance) return;
    
    try {
      // Conservar las posiciones de los nodos seleccionados
      const selectedNodes = nodesRef.current.filter(node => node.selected);
      const selectedNodePositions = {};
      
      selectedNodes.forEach(node => {
        selectedNodePositions[node.id] = { ...node.position };
      });
      
      // Obtener nuevas posiciones con el layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesRef.current,
        edgesRef.current,
        layoutDirection
      );
      
      // Aplicar las nuevas posiciones, preservando los nodos seleccionados
      const finalNodes = layoutedNodes.map(node => {
        if (selectedNodePositions[node.id]) {
          return {
            ...node,
            position: selectedNodePositions[node.id]
          };
        }
        return node;
      });
      
      // Actualizar los nodos y aristas
      setNodes(finalNodes);
      
      // Ajustar la vista si no hay nodos seleccionados
      if (selectedNodes.length === 0) {
        reactFlowInstance.fitView({
          padding: 0.2,
          includeHiddenNodes: false,
          duration: 200
        });
      }
    } catch (error) {
      console.error("Error al reorganizar el layout:", error);
    }
  }, [reactFlowInstance, layoutDirection, setNodes, getLayoutedElements]);
  
  // Calcular la profundidad máxima del JSON
  const maxDepth = useMemo(() => {
    // ... código para calcular la profundidad
    return 5; // Valor ejemplo
  }, [jsonData]);
  
  return (
    <div className="h-full w-full bg-[#101420]" ref={reactFlowWrapper}>
      {/* Barra de búsqueda */}
      <SearchBox onSearch={setSearchTerm} />
      
      {/* Barra de herramientas */}
      <Toolbar
        layoutDirection={layoutDirection}
        setLayoutDirection={setLayoutDirection}
        levelThreshold={levelThreshold}
        maxDepth={maxDepth}
        changeCollapseLevel={changeCollapseLevel}
        nodeSizeMode={nodeSizeMode}
        setNodeSizeMode={setNodeSizeMode}
        onReorganize={handleReorganize}
      />
      
      {/* Indicador de profundidad */}
      <DepthIndicator maxDepth={maxDepth} levelThreshold={levelThreshold} />
      
      {/* ReactFlow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={null}
        onEdgesChange={null}
        nodesDraggable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedNodeId(null)}
        style={{ background: '#101420' }}
      >
        <Background color="#333" gap={16} size={1} variant="dots" />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor={(node) => node.type === 'arrayNode' ? '#ecc94b' : '#4299e1'}
          maskColor="rgba(0, 0, 0, 0.5)"
          style={{ background: '#1a202c', height: 80, width: 120 }}
          position="bottom-right"
        />
        
        {/* Botón oculto para autoLayout */}
        <Panel position="bottom-center" className="hidden">
          <button id="auto-layout-btn" onClick={handleReorganize} style={{ display: 'none' }} />
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default DiagramView; 