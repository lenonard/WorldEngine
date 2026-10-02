(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Engine = root.Engine;
  if (!Engine) throw new Error('WorldEngine.Engine must load before ui-enhancements.js');

  function ensureExpandedGroupsContainer(engine) {
    let host = document.getElementById('expandedGroups');
    if (!host) {
      host = document.createElement('div');
      host.id = 'expandedGroups';
      host.className = 'expanded-groups';
      host.hidden = true;
      engine.canvas.appendChild(host);
    }
    return host;
  }

  function renderExpandedGroups(engine) {
    const host = ensureExpandedGroupsContainer(engine);
    const ids = [...(engine.expanded || [])].filter(id => engine.nodesById && engine.nodesById.has(id));
    host.innerHTML = '';
    host.hidden = ids.length === 0;
    if (!ids.length) return;

    const label = document.createElement('span');
    label.className = 'expanded-groups-label';
    label.textContent = 'Expanded';
    host.appendChild(label);

    ids.forEach(id => {
      const node = engine.nodesById.get(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'expanded-group-chip';
      button.title = `Collapse ${node && (node.label || node.id) || id}`;
      button.innerHTML = `<strong>−</strong>${escapeHtml(node && (node.label || node.id) || id)}`;
      button.addEventListener('click', event => {
        event.stopPropagation();
        engine.toggleGroup(id);
      });
      host.appendChild(button);
    });

    if (ids.length > 1) {
      const collapseAll = document.createElement('button');
      collapseAll.type = 'button';
      collapseAll.className = 'collapse-all-chip';
      collapseAll.textContent = 'Collapse all';
      collapseAll.addEventListener('click', event => {
        event.stopPropagation();
        engine.expanded.clear();
        engine.selectedId = null;
        engine.render();
        requestAnimationFrame(() => engine.fit());
      });
      host.appendChild(collapseAll);
    }
  }

  function classifyEdge(edge) {
    const value = [edge && edge.label, edge && edge.relation, edge && edge.type]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();

    if (/^(true|yes|success|valid|pass|matched|found)\b/.test(value)) return 'true';
    if (/^(false|no|failure|fail|invalid|error|not found|rejected)\b/.test(value)) return 'false';
    return null;
  }

  function ensureSemanticMarkers(svg) {
    const defs = svg && svg.querySelector('defs');
    if (!defs) return;

    const createMarker = (id, className, fill) => {
      if (defs.querySelector(`#${id}`)) return;
      const ns = 'http://www.w3.org/2000/svg';
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '4');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M0,0 L0,8 L9,4 z');
      path.setAttribute('class', className);
      path.style.fill = fill;
      marker.appendChild(path);
      defs.appendChild(marker);
    };

    createMarker('arrowTrue', 'arrow-head arrow-head-true', 'var(--edge-true)');
    createMarker('arrowFalse', 'arrow-head arrow-head-false', 'var(--edge-false)');
  }

  function decorateSemanticEdges(engine) {
    if (!engine.edgeLayer) return;
    ensureSemanticMarkers(engine.edgeLayer);

    const paths = [...engine.edgeLayer.querySelectorAll('path.edge')];
    const labels = [...engine.edgeLayer.querySelectorAll('text.edge-label')];
    let labelIndex = 0;

    (engine.visibleEdges || []).forEach((edge, index) => {
      const semantic = classifyEdge(edge);
      const path = paths[index];
      const semanticColor = semantic === 'true' ? 'var(--edge-true)' : semantic === 'false' ? 'var(--edge-false)' : null;
      if (path && semantic) {
        path.classList.add(`edge-${semantic}`);
        path.style.stroke = semanticColor;
        path.setAttribute('marker-end', semantic === 'true' ? 'url(#arrowTrue)' : 'url(#arrowFalse)');
      }

      if (edge && edge.label) {
        const label = labels[labelIndex++];
        if (label && semantic) {
          label.classList.add(`edge-${semantic}`);
          label.style.fill = semanticColor;
        }
      }
    });
  }

  function installThemeToggle() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.getElementById('themeToggle')) return;

    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.type = 'button';
    button.className = 'button theme-toggle';
    toolbar.appendChild(button);

    const stored = localStorage.getItem('worldengine-theme');
    const preferred = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(preferred);

    button.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(next);
    });

    function setTheme(theme) {
      const normalized = theme === 'light' ? 'light' : 'dark';
      document.body.dataset.theme = normalized;
      localStorage.setItem('worldengine-theme', normalized);
      button.textContent = normalized === 'light' ? '☾ Dark' : '☀ Light';
      button.title = normalized === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const originalRender = Engine.prototype.render;
  Engine.prototype.render = function (...args) {
    const result = originalRender.apply(this, args);
    decorateSemanticEdges(this);
    renderExpandedGroups(this);
    return result;
  };

  const originalLoad = Engine.prototype.load;
  Engine.prototype.load = function (...args) {
    const result = originalLoad.apply(this, args);
    renderExpandedGroups(this);
    return result;
  };

  window.addEventListener('DOMContentLoaded', installThemeToggle);
})();
