(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Engine = root.Engine;
  if (!Engine) throw new Error('Engine must load before view-edge-enhancements.js');

  function safe(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  function decorate(engine) {
    if (!engine.edgeLayer) return;
    const paths = [...engine.edgeLayer.querySelectorAll('path.edge')];
    (engine.visibleEdges || []).forEach((edge, index) => {
      const path = paths[index];
      if (!path) return;
      if (edge.id) path.dataset.edgeId = edge.id;
      if (edge.type) path.classList.add(`type-${safe(edge.type)}`);
      if (edge.relation) path.classList.add(`relation-${safe(edge.relation)}`);
    });
  }

  const originalRender = Engine.prototype.render;
  Engine.prototype.render = function (...args) {
    const result = originalRender.apply(this, args);
    decorate(this);
    return result;
  };
})();
