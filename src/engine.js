(function () {
  const root = window.WorldEngine = window.WorldEngine || {};

  const NODE_W = 220;
  const NODE_H = 104;
  const X_GAP = 92;
  const Y_GAP = 86;
  const PADDING = 120;

  class Engine {
    constructor(options) {
      this.canvas = options.canvas;
      this.scene = options.scene;
      this.edgeLayer = options.edgeLayer;
      this.nodeLayer = options.nodeLayer;
      this.onStatus = options.onStatus || (() => {});
      this.onZoom = options.onZoom || (() => {});
      this.graph = null;
      this.sources = {};
      this.nodesById = new Map();
      this.expanded = new Set();
      this.selectedId = null;
      this.positions = new Map();
      this.visibleEdges = [];
      this.transform = { x: 80, y: 70, scale: 1 };
      this.bounds = { width: 800, height: 600 };
      this.drag = null;
      this.bindNavigation();
    }

    load(pkg) {
      this.graph = pkg.graph;
      this.sources = pkg.sources || {};
      this.nodesById = new Map(this.graph.nodes.map(node => [node.id, node]));
      this.expanded.clear();
      this.selectedId = null;
      for (const node of this.graph.nodes) {
        if ((node.type === 'subgraph' || node.type === 'group') && node.defaultExpanded) {
          this.expanded.add(node.id);
        }
      }
      this.render();
      requestAnimationFrame(() => this.fit());
    }

    bindNavigation() {
      this.canvas.addEventListener('wheel', event => {
        if (!this.graph) return;
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const oldScale = this.transform.scale;
        const nextScale = this.clamp(oldScale * (event.deltaY < 0 ? 1.1 : 0.9), 0.25, 2.4);
        const worldX = (px - this.transform.x) / oldScale;
        const worldY = (py - this.transform.y) / oldScale;
        this.transform.scale = nextScale;
        this.transform.x = px - worldX * nextScale;
        this.transform.y = py - worldY * nextScale;
        this.applyTransform();
      }, { passive: false });

      this.canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.node')) return;
        this.drag = { x: event.clientX, y: event.clientY, tx: this.transform.x, ty: this.transform.y };
        this.canvas.classList.add('dragging');
        this.canvas.setPointerCapture(event.pointerId);
        if (event.target === this.canvas || event.target === this.scene || event.target === this.edgeLayer) {
          this.clearSelection();
        }
      });

      this.canvas.addEventListener('pointermove', event => {
        if (!this.drag) return;
        this.transform.x = this.drag.tx + (event.clientX - this.drag.x);
        this.transform.y = this.drag.ty + (event.clientY - this.drag.y);
        this.applyTransform();
      });

      const endDrag = () => {
        this.drag = null;
        this.canvas.classList.remove('dragging');
      };
      this.canvas.addEventListener('pointerup', endDrag);
      this.canvas.addEventListener('pointercancel', endDrag);
    }

    zoomBy(factor) {
      if (!this.graph) return;
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const oldScale = this.transform.scale;
      const nextScale = this.clamp(oldScale * factor, 0.25, 2.4);
      const worldX = (cx - this.transform.x) / oldScale;
      const worldY = (cy - this.transform.y) / oldScale;
      this.transform.scale = nextScale;
      this.transform.x = cx - worldX * nextScale;
      this.transform.y = cy - worldY * nextScale;
      this.applyTransform();
    }

    fit() {
      if (!this.graph) return;
      const rect = this.canvas.getBoundingClientRect();
      const usableW = Math.max(240, rect.width - 80);
      const usableH = Math.max(180, rect.height - 80);
      const scale = this.clamp(Math.min(usableW / this.bounds.width, usableH / this.bounds.height), 0.35, 1.15);
      this.transform.scale = scale;
      this.transform.x = (rect.width - this.bounds.width * scale) / 2;
      this.transform.y = (rect.height - this.bounds.height * scale) / 2;
      this.applyTransform();
    }

    applyTransform() {
      this.scene.style.transform = `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.scale})`;
      this.onZoom(Math.round(this.transform.scale * 100));
    }

    render() {
      if (!this.graph) return;
      const visibleNodes = this.getVisibleNodes();
      this.visibleEdges = this.getVisibleEdges(visibleNodes);
      this.positions = this.layout(visibleNodes, this.visibleEdges);
      this.renderEdges(this.visibleEdges);
      this.renderNodes(visibleNodes);
      this.updateStats();
      this.onStatus(`${visibleNodes.length} visible blocks · ${this.visibleEdges.length} connections`);
      this.applyTransform();
      if (this.selectedId) this.selectNode(this.selectedId, false);
    }

    getVisibleNodes() {
      return this.graph.nodes.filter(node => {
        const hiddenBy = this.collapsedAncestor(node.id);
        if (hiddenBy) return false;
        const isContainer = node.type === 'subgraph' || node.type === 'group';
        if (isContainer && this.expanded.has(node.id)) return false;
        return true;
      });
    }

    collapsedAncestor(id) {
      let node = this.nodesById.get(id);
      const seen = new Set();
      while (node && node.parent) {
        if (seen.has(node.parent)) break;
        seen.add(node.parent);
        const parent = this.nodesById.get(node.parent);
        if (!parent) break;
        if (!this.expanded.has(parent.id)) return parent.id;
        node = parent;
      }
      return null;
    }

    resolveEndpoint(id, role, visibleIds, depth = 0) {
      if (depth > 12) return null;
      const hiddenBy = this.collapsedAncestor(id);
      if (hiddenBy) return hiddenBy;
      const node = this.nodesById.get(id);
      if (!node) return null;
      if (visibleIds.has(id)) return id;
      const isExpandedContainer = (node.type === 'subgraph' || node.type === 'group') && this.expanded.has(id);
      if (isExpandedContainer) {
        if (role === 'target' && node.entryNode) {
          return this.resolveEndpoint(node.entryNode, role, visibleIds, depth + 1);
        }
        if (role === 'source' && Array.isArray(node.exitNodes) && node.exitNodes[0]) {
          return this.resolveEndpoint(node.exitNodes[0], role, visibleIds, depth + 1);
        }
        const children = (node.children || []).map(childId => this.nodesById.get(childId)).filter(Boolean);
        const fallback = role === 'target' ? children[0] : children[children.length - 1];
        if (fallback) return this.resolveEndpoint(fallback.id, role, visibleIds, depth + 1);
      }
      return null;
    }

    getVisibleEdges(visibleNodes) {
      const visibleIds = new Set(visibleNodes.map(node => node.id));
      const edges = [];
      const seen = new Set();
      for (const edge of this.graph.edges) {
        const from = this.resolveEndpoint(edge.from, 'source', visibleIds);
        const to = this.resolveEndpoint(edge.to, 'target', visibleIds);
        if (!from || !to || from === to) continue;
        const key = `${from}|${to}|${edge.label || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ ...edge, originalFrom: edge.from, originalTo: edge.to, from, to });
      }
      return edges;
    }

    layout(nodes, edges) {
      const ids = new Set(nodes.map(node => node.id));
      const outgoing = new Map(nodes.map(node => [node.id, []]));
      const incomingCount = new Map(nodes.map(node => [node.id, 0]));
      for (const edge of edges) {
        if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
        outgoing.get(edge.from).push(edge);
        if (!this.isBackEdge(edge)) incomingCount.set(edge.to, (incomingCount.get(edge.to) || 0) + 1);
      }

      const startIds = nodes
        .filter(node => node.type === 'start' || node.id === this.graph.entryNode)
        .map(node => node.id);
      if (!startIds.length) {
        for (const node of nodes) if ((incomingCount.get(node.id) || 0) === 0) startIds.push(node.id);
      }
      if (!startIds.length && nodes[0]) startIds.push(nodes[0].id);

      const rank = new Map();
      const visited = new Set();
      const queue = [...startIds];
      for (const id of startIds) rank.set(id, 0);

      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const currentRank = rank.get(id) || 0;
        for (const edge of outgoing.get(id) || []) {
          if (this.isBackEdge(edge)) continue;
          if (!rank.has(edge.to)) rank.set(edge.to, currentRank + 1);
          if (!visited.has(edge.to)) queue.push(edge.to);
        }
      }

      let fallbackRank = rank.size ? Math.max(...rank.values()) + 1 : 0;
      for (const node of nodes) {
        if (!rank.has(node.id)) rank.set(node.id, fallbackRank++);
      }

      const layers = new Map();
      for (const node of nodes) {
        const r = rank.get(node.id);
        if (!layers.has(r)) layers.set(r, []);
        layers.get(r).push(node);
      }

      const maxLayerCount = Math.max(1, ...[...layers.values()].map(layer => layer.length));
      const contentWidth = maxLayerCount * NODE_W + (maxLayerCount - 1) * X_GAP;
      const positions = new Map();
      const sortedRanks = [...layers.keys()].sort((a, b) => a - b);

      sortedRanks.forEach((r, rankIndex) => {
        const layer = layers.get(r);
        const layerWidth = layer.length * NODE_W + (layer.length - 1) * X_GAP;
        const startX = PADDING + (contentWidth - layerWidth) / 2;
        layer.forEach((node, index) => {
          positions.set(node.id, {
            x: startX + index * (NODE_W + X_GAP),
            y: PADDING + rankIndex * (NODE_H + Y_GAP),
            w: NODE_W,
            h: NODE_H
          });
        });
      });

      this.bounds = {
        width: contentWidth + PADDING * 2,
        height: Math.max(1, sortedRanks.length) * NODE_H + Math.max(0, sortedRanks.length - 1) * Y_GAP + PADDING * 2
      };
      return positions;
    }

    renderNodes(nodes) {
      this.nodeLayer.innerHTML = '';
      for (const node of nodes) {
        const pos = this.positions.get(node.id);
        const el = document.createElement('div');
        el.className = `node type-${this.safeType(node.type)}`;
        el.dataset.id = node.id;
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
        el.innerHTML = `
          <div class="node-type">${this.escape(node.type || 'process')}</div>
          <div class="node-label">${this.escape(node.label || node.id)}</div>
          ${node.summary ? `<div class="node-summary">${this.escape(node.summary)}</div>` : ''}
          ${this.nodeMeta(node)}
          ${(node.type === 'subgraph' || node.type === 'group') ? `<span class="expand-mark">${this.expanded.has(node.id) ? '−' : '+'}</span>` : ''}
        `;
        el.addEventListener('click', event => {
          event.stopPropagation();
          this.selectNode(node.id);
        });
        el.addEventListener('dblclick', event => {
          event.stopPropagation();
          if (node.type === 'subgraph' || node.type === 'group') this.toggleGroup(node.id);
        });
        this.nodeLayer.appendChild(el);
      }
    }

    nodeMeta(node) {
      if (!node.metrics) return '';
      const labels = [];
      if (node.metrics.steps != null) labels.push(`${node.metrics.steps} steps`);
      if (node.metrics.branches != null) labels.push(`${node.metrics.branches} branches`);
      if (node.metrics.externalCalls != null) labels.push(`${node.metrics.externalCalls} calls`);
      if (!labels.length) return '';
      return `<div class="node-meta">${labels.map(label => `<span class="node-pill">${this.escape(label)}</span>`).join('')}</div>`;
    }

    renderEdges(edges) {
      const defs = this.edgeLayer.querySelector('defs').outerHTML;
      this.edgeLayer.innerHTML = defs;
      this.edgeLayer.setAttribute('width', this.bounds.width);
      this.edgeLayer.setAttribute('height', this.bounds.height);
      this.edgeLayer.setAttribute('viewBox', `0 0 ${this.bounds.width} ${this.bounds.height}`);

      for (const edge of edges) {
        const from = this.positions.get(edge.from);
        const to = this.positions.get(edge.to);
        if (!from || !to) continue;
        const back = this.isBackEdge(edge) || to.y <= from.y;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `edge${back ? ' back' : ''}`);
        path.dataset.from = edge.from;
        path.dataset.to = edge.to;
        path.setAttribute('d', this.edgePath(from, to, back));
        this.edgeLayer.appendChild(path);

        if (edge.label) {
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('class', 'edge-label');
          const point = this.edgeLabelPoint(from, to, back);
          label.setAttribute('x', point.x);
          label.setAttribute('y', point.y);
          label.setAttribute('text-anchor', 'middle');
          label.textContent = edge.label;
          this.edgeLayer.appendChild(label);
        }
      }
    }

    edgePath(from, to, back) {
      const sx = from.x + from.w / 2;
      const sy = from.y + from.h;
      const tx = to.x + to.w / 2;
      const ty = to.y;
      if (!back) {
        const mid = sy + Math.max(38, (ty - sy) / 2);
        return `M ${sx} ${sy} C ${sx} ${mid}, ${tx} ${mid}, ${tx} ${ty}`;
      }
      const left = Math.min(from.x, to.x) - 54;
      return `M ${sx} ${sy} C ${left} ${sy + 34}, ${left} ${ty - 34}, ${tx} ${ty}`;
    }

    edgeLabelPoint(from, to, back) {
      if (back) return { x: Math.min(from.x, to.x) - 42, y: (from.y + to.y) / 2 };
      return { x: (from.x + to.x) / 2 + NODE_W / 2, y: (from.y + NODE_H + to.y) / 2 - 6 };
    }

    isBackEdge(edge) {
      return edge.type === 'back' || edge.type === 'loop' || edge.relation === 'back' || edge.relation === 'loop';
    }

    toggleGroup(id) {
      if (this.expanded.has(id)) this.expanded.delete(id);
      else this.expanded.add(id);
      this.selectedId = null;
      this.render();
      requestAnimationFrame(() => this.fit());
    }

    clearSelection() {
      this.selectedId = null;
      this.nodeLayer.querySelectorAll('.node').forEach(el => el.classList.remove('selected', 'dimmed'));
      this.edgeLayer.querySelectorAll('.edge').forEach(el => el.classList.remove('selected', 'dimmed'));
      this.renderDetails(null);
    }

    selectNode(id, updateDetails = true) {
      if (!this.nodesById.has(id)) return;
      if (!this.positions.has(id)) {
        this.revealNode(id);
        return;
      }
      this.selectedId = id;
      const neighbors = new Set([id]);
      for (const edge of this.visibleEdges) {
        if (edge.from === id) neighbors.add(edge.to);
        if (edge.to === id) neighbors.add(edge.from);
      }
      this.nodeLayer.querySelectorAll('.node').forEach(el => {
        const current = el.dataset.id;
        el.classList.toggle('selected', current === id);
        el.classList.toggle('dimmed', !neighbors.has(current));
      });
      this.edgeLayer.querySelectorAll('.edge').forEach(el => {
        const active = el.dataset.from === id || el.dataset.to === id;
        el.classList.toggle('selected', active);
        el.classList.toggle('dimmed', !active);
      });
      if (updateDetails) this.renderDetails(this.nodesById.get(id));
    }

    revealNode(id) {
      let node = this.nodesById.get(id);
      const parents = [];
      while (node && node.parent) {
        parents.unshift(node.parent);
        node = this.nodesById.get(node.parent);
      }
      for (const parentId of parents) this.expanded.add(parentId);
      this.render();
      requestAnimationFrame(() => this.selectNode(id));
    }

    renderDetails(node) {
      const empty = document.getElementById('detailEmpty');
      const content = document.getElementById('detailContent');
      const panel = document.querySelector('.detail-panel');
      if (!node) {
        empty.hidden = false;
        content.hidden = true;
        panel && panel.classList.remove('open');
        return;
      }
      empty.hidden = true;
      content.hidden = false;
      panel && panel.classList.add('open');
      document.getElementById('detailType').textContent = node.type || 'process';
      document.getElementById('detailTitle').textContent = node.label || node.id;
      document.getElementById('detailSummary').textContent = node.summary || '';

      const badges = document.getElementById('detailBadges');
      badges.innerHTML = '';
      const badgeData = [];
      if (node.id) badgeData.push(`id: ${node.id}`);
      if (node.metrics) {
        Object.entries(node.metrics).forEach(([key, value]) => badgeData.push(`${key}: ${value}`));
      }
      badges.innerHTML = badgeData.map(text => `<span class="badge">${this.escape(text)}</span>`).join('');

      const sourceWrap = document.getElementById('detailCodeWrap');
      const code = this.sourceSnippet(node);
      sourceWrap.hidden = !code.text;
      document.getElementById('detailSourceRef').textContent = code.ref || '';
      document.getElementById('detailCode').textContent = code.text || '';

      const notesWrap = document.getElementById('detailNotesWrap');
      const notes = Array.isArray(node.notes) ? node.notes : (node.note ? [node.note] : []);
      notesWrap.hidden = !notes.length;
      document.getElementById('detailNotes').innerHTML = notes.map(note => `<div>${this.escape(note)}</div>`).join('');

      const connections = document.getElementById('detailConnections');
      const related = [];
      for (const edge of this.graph.edges) {
        if (edge.from === node.id) related.push({ id: edge.to, dir: '→', label: edge.label });
        if (edge.to === node.id) related.push({ id: edge.from, dir: '←', label: edge.label });
      }
      connections.innerHTML = '';
      if (!related.length) connections.innerHTML = '<div class="muted">No direct connections.</div>';
      for (const item of related) {
        const target = this.nodesById.get(item.id);
        if (!target) continue;
        const el = document.createElement('div');
        el.className = 'connection';
        el.innerHTML = `<span><span class="dir">${item.dir}</span> ${this.escape(target.label || target.id)}</span><span>${this.escape(item.label || '')}</span>`;
        el.addEventListener('click', () => this.selectNode(target.id));
        connections.appendChild(el);
      }
    }

    sourceSnippet(node) {
      if (node.code) return { text: node.code, ref: 'Embedded code' };
      if (!node.source || !node.source.file) return { text: '', ref: '' };
      const text = this.sources[node.source.file];
      const ref = `${node.source.file}${node.source.startLine ? `:${node.source.startLine}${node.source.endLine && node.source.endLine !== node.source.startLine ? `-${node.source.endLine}` : ''}` : ''}`;
      if (!text) return { text: '', ref };
      const lines = text.split(/\r?\n/);
      const start = Math.max(1, node.source.startLine || 1);
      const end = Math.min(lines.length, node.source.endLine || start);
      const width = String(end).length;
      const snippet = lines.slice(start - 1, end).map((line, index) => `${String(start + index).padStart(width, ' ')}  ${line}`).join('\n');
      return { text: snippet, ref };
    }

    updateStats() {
      const stats = document.getElementById('stats');
      if (!stats || !this.graph) return;
      const groups = this.graph.nodes.filter(node => node.type === 'subgraph' || node.type === 'group').length;
      const decisions = this.graph.nodes.filter(node => node.type === 'decision').length;
      stats.innerHTML = `
        <div class="stat"><strong>${this.graph.nodes.length}</strong><span>Total blocks</span></div>
        <div class="stat"><strong>${this.graph.edges.length}</strong><span>Connections</span></div>
        <div class="stat"><strong>${groups}</strong><span>Subgraphs</span></div>
        <div class="stat"><strong>${decisions}</strong><span>Decisions</span></div>
      `;
    }

    safeType(type) {
      return String(type || 'process').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }

    escape(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  }

  root.Engine = Engine;
})();
