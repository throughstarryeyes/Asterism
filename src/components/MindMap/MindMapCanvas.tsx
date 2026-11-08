import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { ToolDocBar } from '../Common/ToolDocBar';
import type { MindMapNode, MindMapEdge } from '../../types';
import {
  Network,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Link2,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  Compass,
  Key,
  MapPin,
  HelpCircle,
  X,
  Edit2,
  Home
} from 'lucide-react';

export const MindMapCanvas: React.FC = () => {
  const { toolDoc, toolParent, toolFromDoc, updateToolDoc, leaveTool, setViewMode, notePlanning } = useAsterism();
  // characters come from the manuscript this map is attached to
  const source = toolParent ?? (toolDoc.kind ? null : toolDoc);

  const [nodes, setNodes] = useState<MindMapNode[]>(toolDoc.mindMap.nodes);
  const [edges, setEdges] = useState<MindMapEdge[]>(toolDoc.mindMap.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // dragging node state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // modal for new node
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeType, setNewNodeType] = useState<MindMapNode['type']>('character');
  const [newNodeColor, setNewNodeColor] = useState('#c9933b');
  const [newNodeNotes, setNewNodeNotes] = useState('');

  // Edge label modal
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string } | null>(null);
  const [edgeLabel, setEdgeLabel] = useState('Related to');

  const canvasRef = useRef<HTMLDivElement>(null);

  // fingers on the screen: one pans or drags, two pinch to zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; world: { x: number; y: number } } | null>(null);
  const twoFingers = () => {
    const [a, b] = Array.from(pointers.current.values());
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  // sync to project
  const saveMapToProject = useCallback((newNodes: MindMapNode[], newEdges: MindMapEdge[]) => {
    updateToolDoc({
      mindMap: {
        ...toolDoc.mindMap,
        nodes: newNodes,
        edges: newEdges
      }
    });
  }, [toolDoc.mindMap, updateToolDoc]);

  // handle pan
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
    }
  };

  const trackPointer = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // a second finger turns whatever the first was doing into a pinch
      setIsPanning(false);
      setDraggedNodeId(null);
      const { dist, mid } = twoFingers();
      pinch.current = { dist, zoom, world: { x: (mid.x - pan.x) / zoom, y: (mid.y - pan.y) / zoom } };
    }
  };

  const releasePointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    handleMouseUp();
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const { dist, mid } = twoFingers();
      const next = Math.min(2, Math.max(0.4, pinch.current.zoom * (dist / pinch.current.dist)));
      setZoom(next);
      setPan({ x: mid.x - pinch.current.world.x * next, y: mid.y - pinch.current.world.y * next });
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    } else if (draggedNodeId) {
      const updated = nodes.map(n => {
        if (n.id === draggedNodeId) {
          const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
          const newY = (e.clientY - pan.y) / zoom - dragOffset.y;
          return { ...n, x: Math.round(newX), y: Math.round(newY) };
        }
        return n;
      });
      setNodes(updated);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
    if (draggedNodeId) {
      setDraggedNodeId(null);
      saveMapToProject(nodes, edges);
    }
  };

  // node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    if (isConnectMode) {
      handleNodeConnectClick(node.id);
      return;
    }
    setSelectedNodeId(node.id);
    setDraggedNodeId(node.id);
    const mouseX = (e.clientX - pan.x) / zoom;
    const mouseY = (e.clientY - pan.y) / zoom;
    setDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
  };

  // connect click
  const handleNodeConnectClick = (nodeId: string) => {
    if (!connectSourceId) {
      setConnectSourceId(nodeId);
    } else if (connectSourceId !== nodeId) {
      setPendingEdge({ from: connectSourceId, to: nodeId });
      setIsConnectMode(false);
      setConnectSourceId(null);
    }
  };

  // confirm Edge
  const handleConfirmEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEdge) return;
    const newEdge: MindMapEdge = {
      id: `edge-${Date.now()}`,
      fromNodeId: pendingEdge.from,
      toNodeId: pendingEdge.to,
      label: edgeLabel || 'Connected to'
    };
    const updatedEdges = [...edges, newEdge];
    setEdges(updatedEdges);
    saveMapToProject(nodes, updatedEdges);
    setPendingEdge(null);
    setEdgeLabel('Related to');
    notePlanning('Story Relationship Connected');
  };

  // add node
  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;

    const nodeColors: Record<MindMapNode['type'], string> = {
      character: '#c9933b',
      plot_event: '#4f80ff',
      clue: '#10b981',
      location: '#d4638c',
      theme: '#8a2be2',
      custom: '#6e6051'
    };

    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      label: newNodeLabel.trim(),
      type: newNodeType,
      x: -pan.x / zoom + 350 + (Math.random() * 60 - 30),
      y: -pan.y / zoom + 250 + (Math.random() * 60 - 30),
      color: newNodeColor || nodeColors[newNodeType],
      notes: newNodeNotes
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    saveMapToProject(updatedNodes, edges);
    setIsAddNodeOpen(false);
    setNewNodeLabel('');
    setNewNodeNotes('');
    notePlanning('Mind Map Node Added');
  };

  // delete selected node
  const handleDeleteSelected = () => {
    if (!selectedNodeId) return;
    const updatedNodes = nodes.filter(n => n.id !== selectedNodeId);
    const updatedEdges = edges.filter(e => e.fromNodeId !== selectedNodeId && e.toNodeId !== selectedNodeId);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    saveMapToProject(updatedNodes, updatedEdges);
    setSelectedNodeId(null);
  };

  // quick import from story bible
  const handleImportFromBible = () => {
    const existingLabels = new Set(nodes.map(n => n.label.toLowerCase()));
    const importedNodes: MindMapNode[] = [];

    (source?.storyBible.characters ?? []).forEach((char, i) => {
      if (!existingLabels.has(char.name.toLowerCase())) {
        importedNodes.push({
          id: `node-imp-${char.id}`,
          label: char.name,
          type: 'character',
          x: 200 + (i % 3) * 180,
          y: 150 + Math.floor(i / 3) * 140,
          color: char.avatarColor || '#c9933b',
          notes: `${char.role.toUpperCase()}: ${char.coreDesire}`
        });
      }
    });

    if (importedNodes.length > 0) {
      const updated = [...nodes, ...importedNodes];
      setNodes(updated);
      saveMapToProject(updated, edges);
      notePlanning('Characters Imported to Mind Map');
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div
      style={{
        width: 'var(--app-vw)',
        height: 'var(--app-vh)',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onPointerDownCapture={trackPointer}
      onPointerMove={handleMouseMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
    >
      {/* top floating control bar */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: 'var(--toolbar-bg)',
          zIndex: 1000
        }}
      >
        {/* from a manuscript the back button leads to its editor */}
        <button
          onClick={() => setViewMode('home')}
          title="Return to Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--accent-gold-text, var(--accent-gold))',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Home size={15} />
          <span>Home</span>
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {toolFromDoc && <button
          onClick={leaveTool}
          title="Return to Word Processor"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          <span>Editor</span>
        </button>}

        {toolFromDoc && <span style={{ color: 'var(--border-strong)' }}>|</span>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', fontSize: '0.9rem' }}>
          <Network size={18} />
          <span>Mind map</span>
        </div>
        <ToolDocBar kind="mindmap" />

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* add node button */}
        <button
          onClick={() => setIsAddNodeOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            fontSize: '0.82rem',
            fontWeight: 500
          }}
        >
          <Plus size={15} />
          <span>Add Node</span>
        </button>

        {/* connect nodes toggle */}
        <button
          onClick={() => {
            setIsConnectMode(!isConnectMode);
            setConnectSourceId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isConnectMode ? 'var(--accent-gold-bg)' : 'transparent',
            border: isConnectMode ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
            color: isConnectMode ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
            fontSize: '0.82rem',
            fontWeight: 500
          }}
        >
          <Link2 size={15} />
          <span>{isConnectMode ? (connectSourceId ? 'Click Target Node...' : 'Click 1st Node...') : 'Connect Nodes'}</span>
        </button>

        {/* import from story bible */}
        <button
          onClick={handleImportFromBible}
          title="Import characters from Story Bible onto mind map"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--tag-bg)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem'
          }}
        >
          <Users size={14} />
          <span>Sync Characters</span>
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} style={{ padding: '4px', color: 'var(--text-secondary)' }}>
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(2.0, z + 0.15))} style={{ padding: '4px', color: 'var(--text-secondary)' }}>
            <ZoomIn size={16} />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset View" style={{ padding: '4px', color: 'var(--text-secondary)' }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* interactive infinite canvas */}
      <div
        ref={canvasRef}
        onPointerDown={handleMouseDownCanvas}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: isPanning ? 'grabbing' : isConnectMode ? 'crosshair' : 'grab',
          backgroundImage: `radial-gradient(circle, var(--border-strong) 1px, transparent 1px)`,
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        {/* SVG layer for relationship edges */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-gold)" />
            </marker>
          </defs>

          {edges.map(edge => {
            const fromNode = nodes.find(n => n.id === edge.fromNodeId);
            const toNode = nodes.find(n => n.id === edge.toNodeId);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x * zoom + pan.x;
            const y1 = fromNode.y * zoom + pan.y;
            const x2 = toNode.x * zoom + pan.x;
            const y2 = toNode.y * zoom + pan.y;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--border-strong)"
                  strokeWidth={2 * zoom}
                  strokeDasharray="4,4"
                  markerEnd="url(#arrow)"
                />
                {edge.label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-edge.label.length * 3.5 - 6}
                      y={-10}
                      width={edge.label.length * 7 + 12}
                      height={20}
                      rx={4}
                      fill="var(--bg-card)"
                      stroke="var(--border-subtle)"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="var(--text-secondary)"
                      fontSize={11 * zoom}
                      fontFamily="var(--font-sans)"
                      fontWeight="600"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* nodes layer */}
        {nodes.map(node => {
          const isSelected = selectedNodeId === node.id;
          const isConnectSource = connectSourceId === node.id;
          const screenX = node.x * zoom + pan.x;
          const screenY = node.y * zoom + pan.y;

          let icon = <Users size={14} />;
          if (node.type === 'plot_event') icon = <Compass size={14} />;
          if (node.type === 'clue') icon = <Key size={14} />;
          if (node.type === 'location') icon = <MapPin size={14} />;
          if (node.type === 'theme') icon = <Sparkles size={14} />;

          return (
            <div
              key={node.id}
              onPointerDown={e => handleNodeMouseDown(e, node)}
              style={{
                position: 'absolute',
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: 'translate(-50%, -50%)',
                padding: `${10 * zoom}px ${16 * zoom}px`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-paper)',
                border: isSelected
                  ? `2px solid var(--accent-gold)`
                  : isConnectSource
                    ? `2px solid #10b981`
                    : `1px solid var(--border-strong)`,
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: `${8 * zoom}px`,
                color: 'var(--text-main)',
                fontSize: `${14 * zoom}px`,
                fontWeight: 600,
                zIndex: isSelected ? 50 : 10,
                transition: 'border 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              <div
                style={{
                  width: `${12 * zoom}px`,
                  height: `${12 * zoom}px`,
                  borderRadius: '50%',
                  backgroundColor: node.color,
                  flexShrink: 0
                }}
              />
              <span style={{ color: node.color, display: 'flex', alignItems: 'center' }}>{icon}</span>
              <span>{node.label}</span>
            </div>
          );
        })}
      </div>

      {/* selected node sidebar inspector */}
      {selectedNode && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '320px',
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-paper)',
            zIndex: 1000
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedNode.color }} />
              <h3 style={{ fontSize: '1.1rem', margin: 0, fontFamily: 'var(--font-display)' }}>{selectedNode.label}</h3>
            </div>
            <button onClick={() => setSelectedNodeId(null)} style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Type: {selectedNode.type}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <textarea
              placeholder="Add story notes, lore connections, or character secrets..."
              value={selectedNode.notes || ''}
              onChange={e => {
                const val = e.target.value;
                const updated = nodes.map(n => n.id === selectedNode.id ? { ...n, notes: val } : n);
                setNodes(updated);
                saveMapToProject(updated, edges);
              }}
              rows={3}
              style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
            />
          </div>

          <button
            onClick={handleDeleteSelected}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fontSize: '0.82rem',
              fontWeight: 500
            }}
          >
            <Trash2 size={14} />
            <span>Delete Node</span>
          </button>
        </div>
      )}

      {/* new node modal */}
      {isAddNodeOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setIsAddNodeOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-paper)',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-paper)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>Add Story Element</h3>
            <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Name or Title (e.g. Corin Vance, The Iron Needle)..."
                value={newNodeLabel}
                onChange={e => setNewNodeLabel(e.target.value)}
                autoFocus
                required
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newNodeType}
                  onChange={e => setNewNodeType(e.target.value as MindMapNode['type'])}
                  style={{ flex: 1, padding: '8px' }}
                >
                  <option value="character">Character</option>
                  <option value="plot_event">Plot Event / Scene</option>
                  <option value="clue">Clue / Key Object</option>
                  <option value="location">Location / Realm</option>
                  <option value="theme">Theme / Leitmotif</option>
                  <option value="custom">Custom Entity</option>
                </select>

                <input
                  type="color"
                  value={newNodeColor}
                  onChange={e => setNewNodeColor(e.target.value)}
                  style={{ width: '42px', height: '38px', padding: '2px', cursor: 'pointer' }}
                />
              </div>

              <textarea
                placeholder="Brief notes or description..."
                value={newNodeNotes}
                onChange={e => setNewNodeNotes(e.target.value)}
                rows={2}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  Create Node
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddNodeOpen(false)}
                  style={{ padding: '8px 14px', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edge relationship label modal */}
      {pendingEdge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-paper)',
              padding: '22px',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <h4 style={{ fontSize: '1.05rem', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Define Relationship</h4>
            <form onSubmit={handleConfirmEdge} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Relationship (e.g. Sister of, Betrays, Investigating, Loves)..."
                value={edgeLabel}
                onChange={e => setEdgeLabel(e.target.value)}
                autoFocus
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  Link Elements
                </button>
                <button
                  type="button"
                  onClick={() => setPendingEdge(null)}
                  style={{ padding: '8px 12px', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
