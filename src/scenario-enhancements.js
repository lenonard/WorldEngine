(function () {
  const root = window.WorldEngine = window.WorldEngine || {};
  const Player = root.ExecutionPlayer;
  if (!Player) throw new Error('ExecutionPlayer must load before scenario-enhancements.js');

  const originalLoad = Player.prototype.load;

  function ensureScenarioSelect(player) {
    let wrap = document.getElementById('scenarioControl');
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = 'scenarioControl';
      wrap.className = 'scenario-control';
      wrap.hidden = true;
      wrap.innerHTML = '<span>Scenario</span><select id="scenarioSelect" class="scenario-select"></select>';
      const controls = player.controls;
      if (controls) controls.insertBefore(wrap, controls.querySelector('.toolbar-separator') || controls.firstChild);
    }
    return wrap;
  }

  function scenariosFrom(execution) {
    if (!execution) return [];
    if (Array.isArray(execution.scenarios)) return execution.scenarios;
    if (Array.isArray(execution.trace)) {
      return [{
        id: execution.id || 'default',
        title: execution.title || 'Default execution',
        view: execution.view || 'controlFlow',
        trace: execution.trace
      }];
    }
    return [];
  }

  Player.prototype.load = function (pkg) {
    this.worldPackage = pkg;
    this.scenarios = scenariosFrom(pkg && (pkg.execution || (pkg.graph && pkg.graph.execution)));
    const wrap = ensureScenarioSelect(this);
    const select = wrap.querySelector('#scenarioSelect');

    select.innerHTML = '';
    wrap.hidden = this.scenarios.length <= 1;

    this.scenarios.forEach((scenario, index) => {
      const option = document.createElement('option');
      option.value = scenario.id || String(index);
      option.textContent = scenario.title || scenario.label || `Scenario ${index + 1}`;
      select.appendChild(option);
    });

    if (!select.dataset.bound) {
      select.dataset.bound = '1';
      select.addEventListener('change', () => this.selectScenario(select.value));
    }

    if (!this.scenarios.length) return originalLoad.call(this, pkg);

    const requested = pkg && pkg.manifest && pkg.manifest.defaultScenario;
    const first = this.scenarios.find(s => s.id === requested) || this.scenarios[0];
    select.value = first.id || '0';
    return this.loadScenario(first, false);
  };

  Player.prototype.selectScenario = function (id) {
    const scenario = (this.scenarios || []).find((item, index) => (item.id || String(index)) === id);
    if (!scenario) return false;
    this.loadScenario(scenario, true);
    return true;
  };

  Player.prototype.loadScenario = function (scenario, userInitiated) {
    this.pause();
    this.activeScenario = scenario;

    if (scenario.view && this.engine && this.engine.switchWorldView) {
      this.engine.switchWorldView(scenario.view);
    }

    const execution = {
      ...scenario,
      id: scenario.id,
      title: scenario.title,
      trace: Array.isArray(scenario.trace) ? scenario.trace : []
    };

    const result = originalLoad.call(this, {
      ...(this.worldPackage || {}),
      execution,
      graph: this.engine && this.engine.graph ? this.engine.graph : (this.worldPackage && this.worldPackage.graph)
    });

    const select = document.getElementById('scenarioSelect');
    if (select && scenario.id != null) select.value = scenario.id;

    if (userInitiated) {
      window.dispatchEvent(new CustomEvent('worldengine:scenariochange', {
        detail: { scenario }
      }));
    }
    return result;
  };
})();
