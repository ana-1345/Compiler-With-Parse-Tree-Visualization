import React, { useEffect, useRef, useState } from 'react';
import { ControlFlowNode } from '../../types/compiler';

interface ControlFlowVisualizationProps {
  controlFlow: ControlFlowNode | null;
}

const ControlFlowVisualization: React.FC<ControlFlowVisualizationProps> = ({ 
  controlFlow 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<ControlFlowNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['entry']));
  const [fullscreenMode, setFullscreenMode] = useState(false);
  
  useEffect(() => {
    if (!controlFlow || !svgRef.current) return;
    renderControlFlow(controlFlow);
  }, [controlFlow, transform, expandedNodes, fullscreenMode]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        // When collapsing, also collapse all children
        const nodesToCollapse = getAllChildrenIds(nodeId);
        nodesToCollapse.forEach(id => newSet.delete(id));
      } else {
        // When expanding, expand all children of the current level
        const nodesToExpand = getImmediateChildrenIds(nodeId);
        nodesToExpand.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const getAllChildrenIds = (nodeId: string): string[] => {
    const ids: string[] = [];
    const node = findNodeById(controlFlow!, nodeId);
    if (!node) return ids;

    const traverse = (n: ControlFlowNode) => {
      ids.push(n.id);
      n.children.forEach(child => traverse(child));
    };

    node.children.forEach(child => traverse(child));
    return ids;
  };

  const getImmediateChildrenIds = (nodeId: string): string[] => {
    const node = findNodeById(controlFlow!, nodeId);
    return node ? node.children.map(child => child.id) : [];
  };

  const findNodeById = (root: ControlFlowNode, id: string): ControlFlowNode | null => {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  };
  
  const renderControlFlow = (rootNode: ControlFlowNode) => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    svg.innerHTML = '';
    
    // Create main group with transform
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${transform.x},${transform.y}) scale(${transform.scale})`);
    svg.appendChild(g);
    
    // Add definitions for markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    defs.appendChild(marker);
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', '#666');
    marker.appendChild(path);
    
    // Layout algorithm
    const nodes: any[] = [];
    const links: any[] = [];
    
    // Helper function to calculate the width needed for a subtree
    const calculateSubtreeWidth = (node: ControlFlowNode): number => {
      if (!expandedNodes.has(node.id) || !node.children || node.children.length === 0) {
        return 160;
      }
      
      return node.children.reduce((total, child, index) => {
        const childWidth = calculateSubtreeWidth(child);
        return total + childWidth + (index > 0 ? 40 : 0);
      }, 0);
    };
    
    // Helper function to layout the nodes
    const layoutNodes = (
      node: ControlFlowNode, 
      x: number, 
      y: number, 
      level: number
    ): { width: number } => {
      const NODE_WIDTH = 160;
      const NODE_HEIGHT = 60;
      const LEVEL_GAP = 80;
      
      // Add the current node
      nodes.push({
        id: node.id,
        type: node.type,
        condition: node.condition,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        hasChildren: node.children.length > 0,
        isExpanded: expandedNodes.has(node.id)
      });
      
      if (!expandedNodes.has(node.id) || !node.children || node.children.length === 0) {
        return { width: NODE_WIDTH };
      }
      
      // Calculate the total width needed for children
      const childrenWidths = node.children.map(child => calculateSubtreeWidth(child));
      const totalChildrenWidth = childrenWidths.reduce((sum, w) => sum + w, 0) + 
                                 (node.children.length - 1) * 40;
      
      // Start position for the first child
      let childX = x - totalChildrenWidth / 2 + childrenWidths[0] / 2;
      
      // Layout each child
      node.children.forEach((child, i) => {
        // Add link to this child
        links.push({
          source: node.id,
          target: child.id,
          sourceX: x,
          sourceY: y + NODE_HEIGHT / 2,
          targetX: childX,
          targetY: y + NODE_HEIGHT + LEVEL_GAP - NODE_HEIGHT / 2,
          label: node.type === 'IF' && node.children.length > 1 ? 
            (i === 0 ? 'true' : 'false') : 
            undefined
        });
        
        // Layout this child
        const childResult = layoutNodes(
          child, 
          childX, 
          y + NODE_HEIGHT + LEVEL_GAP, 
          level + 1
        );
        
        // Move to the position for the next child
        if (i < node.children.length - 1) {
          childX += childResult.width + 40;
        }
      });
      
      return { width: totalChildrenWidth };
    };
    
    // Start the layout
    layoutNodes(rootNode, 0, 0, 0);
    
    // Draw the links
    links.forEach(link => {
      const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(linkGroup);
      
      // Draw the link
      const linkElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = link.targetX - link.sourceX;
      const dy = link.targetY - link.sourceY;
      const controlPoint1X = link.sourceX;
      const controlPoint1Y = link.sourceY + dy / 2;
      const controlPoint2X = link.targetX;
      const controlPoint2Y = link.sourceY + dy / 2;
      
      linkElement.setAttribute(
        'd', 
        `M ${link.sourceX} ${link.sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${link.targetX} ${link.targetY}`
      );
      linkElement.setAttribute('stroke', '#666');
      linkElement.setAttribute('stroke-width', '2');
      linkElement.setAttribute('fill', 'none');
      linkElement.setAttribute('marker-end', 'url(#arrowhead)');
      
      linkGroup.appendChild(linkElement);
      
      // Add a label if needed
      if (link.label) {
        const midX = (link.sourceX + link.targetX) / 2;
        const midY = link.sourceY + dy / 2;
        
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', String(midX - 15));
        labelBg.setAttribute('y', String(midY - 10));
        labelBg.setAttribute('width', '30');
        labelBg.setAttribute('height', '20');
        labelBg.setAttribute('rx', '4');
        labelBg.setAttribute('fill', '#fff');
        labelBg.setAttribute('stroke', '#ddd');
        linkGroup.appendChild(labelBg);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(midX));
        label.setAttribute('y', String(midY + 5));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10px');
        label.textContent = link.label;
        linkGroup.appendChild(label);
      }
    });
    
    // Draw the nodes
    nodes.forEach(node => {
      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.appendChild(nodeGroup);
      
      let nodeShape;
      let fill;
      let stroke;
      
      switch (node.type) {
        case 'ENTRY':
        case 'EXIT':
          nodeShape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
          nodeShape.setAttribute('cx', String(node.x));
          nodeShape.setAttribute('cy', String(node.y + node.height / 2));
          nodeShape.setAttribute('rx', String(node.width / 2));
          nodeShape.setAttribute('ry', String(node.height / 2));
          fill = node.type === 'ENTRY' ? '#d1fae5' : '#fee2e2';
          stroke = node.type === 'ENTRY' ? '#059669' : '#dc2626';
          break;
          
        case 'IF':
          nodeShape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          const diamondPoints = [
            [node.x, node.y],
            [node.x + node.width / 2, node.y + node.height / 2],
            [node.x, node.y + node.height],
            [node.x - node.width / 2, node.y + node.height / 2]
          ];
          nodeShape.setAttribute('points', diamondPoints.map(p => p.join(',')).join(' '));
          fill = '#fef3c7';
          stroke = '#d97706';
          break;
          
        case 'WHILE':
        case 'FOR':
          nodeShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          nodeShape.setAttribute('x', String(node.x - node.width / 2));
          nodeShape.setAttribute('y', String(node.y));
          nodeShape.setAttribute('width', String(node.width));
          nodeShape.setAttribute('height', String(node.height));
          nodeShape.setAttribute('rx', '20');
          nodeShape.setAttribute('ry', '20');
          fill = '#dbeafe';
          stroke = '#3b82f6';
          break;
          
        default:
          nodeShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          nodeShape.setAttribute('x', String(node.x - node.width / 2));
          nodeShape.setAttribute('y', String(node.y));
          nodeShape.setAttribute('width', String(node.width));
          nodeShape.setAttribute('height', String(node.height));
          nodeShape.setAttribute('rx', '4');
          nodeShape.setAttribute('ry', '4');
          fill = '#f3f4f6';
          stroke = '#6b7280';
      }
      
      nodeShape.setAttribute('fill', node.isExpanded ? fill : '#fff');
      nodeShape.setAttribute('stroke', stroke);
      nodeShape.setAttribute('stroke-width', '2');
      nodeGroup.appendChild(nodeShape);
      
      // Add text for the node
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(node.x));
      text.setAttribute('y', String(node.y + node.height / 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '12px');
      text.textContent = node.type;
      nodeGroup.appendChild(text);
      
      // Add the condition for IF nodes
      if (node.type === 'IF' && node.condition) {
        const conditionText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        conditionText.setAttribute('x', String(node.x));
        conditionText.setAttribute('y', String(node.y + node.height / 2 + 15));
        conditionText.setAttribute('text-anchor', 'middle');
        conditionText.setAttribute('dominant-baseline', 'middle');
        conditionText.setAttribute('font-size', '10px');
        conditionText.textContent = node.condition;
        nodeGroup.appendChild(conditionText);
      }

      // Add expand/collapse indicator if the node has children
      if (node.hasChildren) {
        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const size = 8;
        const x = node.x + node.width / 2 - 20;
        const y = node.y + node.height / 2;
        
        if (node.isExpanded) {
          indicator.setAttribute('d', `M${x-size},${y-size/2} L${x+size},${y-size/2} L${x},${y+size/2} Z`);
        } else {
          indicator.setAttribute('d', `M${x-size/2},${y-size} L${x-size/2},${y+size} L${x+size/2},${y} Z`);
        }
        
        indicator.setAttribute('fill', stroke);
        nodeGroup.appendChild(indicator);
      }

      // Click handler
      nodeGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node.hasChildren) {
          toggleNode(node.id);
        }
        setSelectedNode(node);
      });

      // Hover effects
      nodeGroup.addEventListener('mouseover', () => {
        nodeShape.setAttribute('fill', node.isExpanded ? fill : '#f3f4f6');
        nodeShape.setAttribute('stroke-width', '3');
      });

      nodeGroup.addEventListener('mouseout', () => {
        nodeShape.setAttribute('fill', node.isExpanded ? fill : '#fff');
        nodeShape.setAttribute('stroke-width', '2');
      });
    });
  };
  
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.1, transform.scale * scaleFactor), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const toggleFullscreen = () => {
    setFullscreenMode(!fullscreenMode);
  };
  
  if (!controlFlow) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">No control flow information available</p>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col ${fullscreenMode ? 'fixed inset-0 z-50 bg-white' : 'h-full'}`}>
      <div className="bg-gray-50 p-2 border-b flex justify-between items-center text-sm">
        <div className="flex space-x-2">
          <button 
            onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Reset View
          </button>
          <button 
            onClick={() => setExpandedNodes(new Set(['entry']))}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Collapse All
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-500">
            Click nodes to expand/collapse • Drag to pan • Scroll to zoom
          </span>
          <button 
            onClick={toggleFullscreen}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {fullscreenMode ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <svg 
          ref={svgRef}
          className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
        
        {selectedNode && (
          <div className="absolute bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Node Details</h3>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <dl className="text-sm">
              <dt className="font-medium text-gray-500">Type</dt>
              <dd className="mb-1">{selectedNode.type}</dd>
              
              {selectedNode.condition && (
                <>
                  <dt className="font-medium text-gray-500">Condition</dt>
                  <dd className="mb-1 font-mono">{selectedNode.condition}</dd>
                </>
              )}
              
              <dt className="font-medium text-gray-500">Position</dt>
              <dd>x: {Math.round(selectedNode.x)}, y: {Math.round(selectedNode.y)}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlFlowVisualization;