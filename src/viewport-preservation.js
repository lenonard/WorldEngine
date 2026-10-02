(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Engine = root.Engine;
  if (!Engine) throw new Error('WorldEngine.Engine must load before viewport-preservation.js');

  function expandedSignature(engine) {
    return [...(engine.expanded || [])].sort().join('|');
  }

  const originalRender = Engine.prototype.render;
  Engine.prototype.render = function (...args) {
    const graphRef = this.graph;
    const beforeSignature = this.__viewportExpandedSignature;
    const currentSignature = expandedSignature(this);
    const sameGraph = this.__viewportGraphRef === graphRef;

    if (sameGraph && beforeSignature != null && beforeSignature !== currentSignature) {
      this.__skipNextAutomaticFit = true;
    }

    const result = originalRender.apply(this, args);
    this.__viewportGraphRef = this.graph;
    this.__viewportExpandedSignature = expandedSignature(this);
    return result;
  };

  const originalFit = Engine.prototype.fit;
  Engine.prototype.fit = function (options) {
    const explicit = options && options.explicit === true;
    if (!explicit && this.__skipNextAutomaticFit) {
      this.__skipNextAutomaticFit = false;
      this.applyTransform();
      return;
    }
    this.__skipNextAutomaticFit = false;
    return originalFit.call(this);
  };

  root.fitExplicitly = function (engine) {
    if (engine && engine.fit) engine.fit({ explicit: true });
  };
})();
