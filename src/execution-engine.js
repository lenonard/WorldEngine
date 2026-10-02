(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Engine = root.Engine;
  if (!Engine) throw new Error('WorldEngine.Engine must load before execution-engine.js');

  const proto = Engine.prototype;
  const originalRender = proto.render;

  proto.render = function (...args) {
    const result = originalRender.apply(this, args);
    if (this.executionState) this.applyExecutionState();
    return result;
  };

  proto.displayNodeForExecution = function (id, depth = 0) {
    if (!id || depth > 16 || !this.nodesById) return null;
    if (this.positions && this.positions.has(id)) return id;

    const hiddenBy = this.collapsedAncestor ? this.collapsedAncestor(id) : null;
    if (hiddenBy && this.positions && this.positions.has(hiddenBy)) return hiddenBy;

    const node = this.nodesById.get(id);
    if (!node) return null;
    const isContainer = node.type === 'subgraph' || node.type === 'group';
    if (isContainer && this.expanded && this.expanded.has(id)) {
      const child = node.entryNode || (Array.isArray(node.children) ? node.children[0] : null);
      if (child) return this.displayNodeForExecution(child, depth + 1);
    }
    return null;
  };

  proto.setExecutionState = function (state) {
    this.executionState = state || null;
    this.applyExecutionState();
  };

  proto.clearExecutionState = function () {
    this.executionState = null;
    if (this.nodeLayer) {
      this.nodeLayer.querySelectorAll('.node').forEach(el => {
        el.classList.remove('exec-active', 'exec-visited');
      });
    }
    if (this.edgeLayer) {
      this.edgeLayer.querySelectorAll('.edge').forEach(el => {
        el.classList.remove('exec-active', 'exec-visited');
      });
    }
  };

  proto.applyExecutionState = function () {
    if (!this.nodeLayer || !this.edgeLayer) return;

    this.nodeLayer.querySelectorAll('.node').forEach(el => {
      el.classList.remove('exec-active', 'exec-visited');
    });
    this.edgeLayer.querySelectorAll('.edge').forEach(el => {
      el.classList.remove('exec-active', 'exec-visited');
    });

    const state = this.executionState;
    if (!state) return;

    const visitedDisplay = new Set();
    for (const id of state.visitedNodeIds || []) {
      const displayId = this.displayNodeForExecution(id);
      if (displayId) visitedDisplay.add(displayId);
    }

    this.nodeLayer.querySelectorAll('.node').forEach(el => {
      if (visitedDisplay.has(el.dataset.id)) el.classList.add('exec-visited');
    });

    const activeDisplay = this.displayNodeForExecution(state.activeNodeId);
    const previousDisplay = this.displayNodeForExecution(state.previousNodeId);
    if (activeDisplay) {
      const activeEl = this.nodeLayer.querySelector(`.node[data-id="${CSS.escape(activeDisplay)}"]`);
      if (activeEl) activeEl.classList.add('exec-active');
    }

    if (previousDisplay && activeDisplay && previousDisplay !== activeDisplay) {
      this.edgeLayer.querySelectorAll('.edge').forEach(el => {
        if (el.dataset.from === previousDisplay && el.dataset.to === activeDisplay) {
          el.classList.add('exec-active');
        }
      });
    }
  };
})();
