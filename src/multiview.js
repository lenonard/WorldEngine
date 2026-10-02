(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Engine = root.Engine;
  if (!Engine) throw new Error('WorldEngine.Engine must load before multiview.js');

  const originalLoad = Engine.prototype.load;

  function normalizeViews(pkg) {
    const raw = pkg && pkg.views;
    if (!raw || typeof raw !== 'object') return [];

    return Object.entries(raw).map(([id, value]) => {
      if (!value) return null;
      const graph = value.graph && Array.isArray(value.graph.nodes) ? value.graph : value;
      if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;
      const type = value.type || graph.type || id;
      return {
        id: value.id || graph.id || id,
        key: id,
        type,
        title: value.title || graph.title || titleFor(type, id),
        description: value.description || graph.description || '',
        graph
      };
    }).filter(Boolean);
  }

  function titleFor(type, fallback) {
    const titles = {
      'control-flow': 'Control Flow',
      controlFlow: 'Control Flow',
      'call-graph': 'Call Graph',
      callGraph: 'Call Graph',
      'data-flow': 'Data Flow',
      dataFlow: 'Data Flow',
      async: 'Async / Concurrency',
      concurrency: 'Async / Concurrency',
      'async-concurrency': 'Async / Concurrency'
    };
    return titles[type] || titles[fallback] || String(fallback || type || 'View')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function ensureTabs(engine) {
    let host = document.getElementById('worldengineViewTabs');
    if (!host) {
      host = document.createElement('div');
      host.id = 'worldengineViewTabs';
      host.className = 'view-tabs';
      host.hidden = true;
      engine.canvas.appendChild(host);
    }
    return host;
  }

  function stopCanvasGesture(element) {
    ['pointerdown', 'mousedown', 'touchstart'].forEach(type => {
      element.addEventListener(type, event => event.stopPropagation(), { passive: false });
    });
  }

  function renderTabs(engine) {
    const host = ensureTabs(engine);
    const views = engine.worldViews || [];
    host.innerHTML = '';
    host.hidden = views.length <= 1;
    if (views.length <= 1) return;

    for (const view of views) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'view-tab';
      button.dataset.view = view.key;
      button.classList.toggle('active', view.key === engine.activeWorldView);
      button.innerHTML = `<span class="view-tab-icon">${iconFor(view.type)}</span><span>${escapeHtml(view.title)}</span>`;
      button.title = view.description || view.title;
      stopCanvasGesture(button);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        engine.switchWorldView(view.key);
      });
      host.appendChild(button);
    }
  }

  function iconFor(type) {
    const value = String(type || '').toLowerCase();
    if (value.includes('call')) return '⌁';
    if (value.includes('data')) return '◇';
    if (value.includes('async') || value.includes('concurr')) return '⇄';
    return '↳';
  }

  Engine.prototype.load = function (pkg) {
    if (!pkg || pkg.__worldViewResolved) return originalLoad.call(this, pkg);

    const views = normalizeViews(pkg);
    this.worldPackage = pkg;
    this.worldViews = views;

    if (!views.length) {
      this.activeWorldView = null;
      const result = originalLoad.call(this, pkg);
      renderTabs(this);
      return result;
    }

    const requested = pkg.activeView || (pkg.manifest && pkg.manifest.defaultView);
    const initial = views.find(view => view.key === requested || view.id === requested)
      || views.find(view => /control/i.test(view.type) || /control/i.test(view.key))
      || views[0];

    this.activeWorldView = initial.key;
    const result = originalLoad.call(this, {
      ...pkg,
      graph: initial.graph,
      __worldViewResolved: true
    });
    renderTabs(this);
    this.dispatchWorldViewChange(initial);
    return result;
  };

  Engine.prototype.switchWorldView = function (key, options = {}) {
    const views = this.worldViews || [];
    const next = views.find(view => view.key === key || view.id === key);
    if (!next || next.key === this.activeWorldView && !options.force) return false;

    this.activeWorldView = next.key;
    this.expanded && this.expanded.clear();
    this.selectedId = null;
    if (this.clearExecutionState) this.clearExecutionState();

    originalLoad.call(this, {
      ...(this.worldPackage || {}),
      graph: next.graph,
      __worldViewResolved: true
    });
    renderTabs(this);
    this.dispatchWorldViewChange(next);
    return true;
  };

  Engine.prototype.getWorldView = function (key) {
    return (this.worldViews || []).find(view => view.key === key || view.id === key) || null;
  };

  Engine.prototype.dispatchWorldViewChange = function (view) {
    window.dispatchEvent(new CustomEvent('worldengine:viewchange', {
      detail: {
        engine: this,
        viewId: view && view.key,
        view
      }
    }));
  };

  const originalRender = Engine.prototype.render;
  Engine.prototype.render = function (...args) {
    const result = originalRender.apply(this, args);
    renderTabs(this);
    return result;
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  root.normalizeViews = normalizeViews;
})();
