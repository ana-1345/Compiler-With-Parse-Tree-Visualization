import React, { useEffect, useState, useRef } from 'react';
import { ParseTreeNode } from '../../types/compiler';

interface ParseTreeVisualizationProps {
  parseTree: ParseTreeNode | null;
}

const ParseTreeVisualization: React.FC<ParseTreeVisualizationProps> = ({ parseTree }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<ParseTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [fullscreenMode, setFullscreenMode] = useState(false);

  useEffect(() => {
    if (!parseTree || !svgRef.current) return;
    renderTree(layoutTree(parseTree));
  }, [parseTree, transform, expandedNodes, fullscreenMode]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const layoutTree = (node: ParseTreeNode) => {
    const NODE_WIDTH = 160;
    const NODE_HEIGHT = 40;
    const LEVEL_HEIGHT = 80;
    const nodes: any[] = [];
    const links: any[] = [];
    
    const processNode = (n: ParseTreeNode, x = 0, y = 0, level = 0): number => {
      const isExpanded = expandedNodes.has(n.id);
      
      nodes.push({
        id: n.id,
        label: n.type,
        value: n.value,
        x,
        y: y + level * LEVEL_HEIGHT,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        hasChildren: n.children.length > 0,
        isExpanded
      });

      if (!isExpanded || !n.children || n.children.length === 0) {
        return NODE_WIDTH;
      }

      const childrenWidth = n.children.reduce((total, child) => {
        return total + processNode(child, 0, y, level + 1);
      }, 0);

      const startX = x - childrenWidth / 2 + NODE_WIDTH / 2;
      let currentX = startX;

      n.children.forEach(child => {
        const childWidth = processNode(child, currentX, y, level + 1);
        if (isExpanded) {
          links.push({
            source: n.id,
            target: child.id,
            sourceX: x,
            sourceY: y + level * LEVEL_HEIGHT + NODE_HEIGHT,
            targetX: currentX,
            targetY: y + (level + 1) * LEVEL_HEIGHT
          });
        }
        currentX += childWidth;
      });

      return Math.max(NODE_WIDTH, childrenWidth);
    };

    processNode({ ...node, id: 'root' });
    return { nodes, links };
  };

  const renderTree = ({ nodes, links }: { nodes: any[], links: any[] }) => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    svg.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${transform.x},${transform.y}) scale(${transform.scale})`);
    svg.appendChild(g);

    // Draw links
    links.forEach(link => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = link.targetX - link.sourceX;
      const dy = link.targetY - link.sourceY;
      const midY = link.sourceY + dy / 2;

      path.setAttribute('d', `M${link.sourceX},${link.sourceY} C${link.sourceX},${midY} ${link.targetX},${midY} ${link.targetX},${link.targetY}`);
      path.setAttribute('stroke', '#94a3b8');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      g.appendChild(path);
    });

    // Draw nodes
    nodes.forEach(node => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('transform', `translate(${node.x - node.width / 2},${node.y})`);
      g.appendChild(group);

      // Node background
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', String(node.width));
      rect.setAttribute('height', String(node.height));
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', node.isExpanded ? '#dbeafe' : '#e0f2fe');
      rect.setAttribute('stroke', '#0284c7');
      rect.setAttribute('stroke-width', '1.5');
      group.appendChild(rect);

      // Node label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(node.width / 2));
      text.setAttribute('y', String(node.height / 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'monospace');
      text.setAttribute('font-size', '12px');
      text.textContent = node.label;
      group.appendChild(text);

      // Expand/collapse indicator
      if (node.hasChildren) {
        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const size = 8;
        const x = node.width - 20;
        const y = node.height / 2;
        
        if (node.isExpanded) {
          indicator.setAttribute('d', `M${x-size},${y-size/2} L${x+size},${y-size/2} L${x},${y+size/2} Z`);
        } else {
          indicator.setAttribute('d', `M${x-size/2},${y-size} L${x-size/2},${y+size} L${x+size/2},${y} Z`);
        }
        
        indicator.setAttribute('fill', '#0284c7');
        group.appendChild(indicator);
      }

      // Click handlers
      group.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node.hasChildren) {
          toggleNode(node.id);
        }
        setSelectedNode(node);
      });

      // Hover effects
      group.addEventListener('mouseover', () => {
        rect.setAttribute('fill', node.isExpanded ? '#bae6fd' : '#93c5fd');
        rect.setAttribute('stroke-width', '2');
      });

      group.addEventListener('mouseout', () => {
        rect.setAttribute('fill', node.isExpanded ? '#dbeafe' : '#e0f2fe');
        rect.setAttribute('stroke-width', '1.5');
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

  if (!parseTree) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">No parse tree available</p>
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
            onClick={() => setExpandedNodes(new Set(['root']))}
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
              <dd className="mb-1">{selectedNode.label}</dd>

              {selectedNode.value && (
                <>
                  <dt className="font-medium text-gray-500">Value</dt>
                  <dd className="mb-1 font-mono">{selectedNode.value}</dd>
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

export default ParseTreeVisualization;