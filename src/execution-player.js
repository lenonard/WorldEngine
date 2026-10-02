(function () {
  const root = window.WorldEngine = window.WorldEngine || {};

  class ExecutionPlayer {
    constructor(options) {
      this.engine = options.engine;
      this.trace = [];
      this.execution = null;
      this.stepIndex = -1;
      this.playing = false;
      this.timer = null;
      this.speed = 1;

      this.controls = document.getElementById('executionControls');
      this.panel = document.getElementById('runtimePanel');
      this.panelDivider = document.getElementById('runtimeDivider');
      this.detailPanel = document.querySelector('.detail-panel');
      this.resetBtn = document.getElementById('execResetBtn');
      this.prevBtn = document.getElementById('execPrevBtn');
      this.playBtn = document.getElementById('execPlayBtn');
      this.nextBtn = document.getElementById('execNextBtn');
      this.speedSelect = document.getElementById('execSpeed');
      this.toolbarCounter = document.getElementById('execToolbarCounter');
      this.slider = document.getElementById('traceSlider');
      this.eventEl = document.getElementById('runtimeEvent');
      this.stepLabelEl = document.getElementById('runtimeStepLabel');
      this.stepCounterEl = document.getElementById('runtimeStepCounter');
      this.messageEl = document.getElementById('runtimeMessage');
      this.variablesEl = document.getElementById('runtimeVariables');
      this.callStackEl = document.getElementById('runtimeCallStack');

      this.bind();
    }

    bind() {
      this.resetBtn.addEventListener('click', () => this.reset());
      this.prevBtn.addEventListener('click', () => this.prev());
      this.playBtn.addEventListener('click', () => this.togglePlay());
      this.nextBtn.addEventListener('click', () => this.next());
      this.speedSelect.addEventListener('change', () => {
        this.speed = Number(this.speedSelect.value) || 1;
        if (this.playing) this.schedule();
      });
      this.slider.addEventListener('input', () => {
        this.pause();
        this.goTo(Number(this.slider.value));
      });
    }

    load(pkg) {
      this.pause();
      this.execution = pkg.execution || (pkg.graph && pkg.graph.execution) || null;
      this.trace = this.execution && Array.isArray(this.execution.trace) ? this.execution.trace : [];
      this.stepIndex = -1;
      this.engine.clearExecutionState();

      const hasTrace = this.trace.length > 0;
      this.controls.hidden = !hasTrace;
      this.panel.hidden = !hasTrace;
      this.panelDivider.hidden = !hasTrace;
      this.detailPanel && this.detailPanel.classList.toggle('runtime-open', hasTrace);

      if (!hasTrace) {
        this.toolbarCounter.textContent = '';
        return;
      }

      this.slider.min = '0';
      this.slider.max = String(Math.max(0, this.trace.length - 1));
      this.slider.step = '1';
      this.slider.value = '0';
      this.goTo(0);
    }

    hasTrace() {
      return this.trace.length > 0;
    }

    reset() {
      if (!this.hasTrace()) return;
      this.pause();
      this.goTo(0);
    }

    prev() {
      if (!this.hasTrace()) return;
      this.pause();
      this.goTo(Math.max(0, this.stepIndex - 1));
    }

    next() {
      if (!this.hasTrace()) return;
      if (this.stepIndex >= this.trace.length - 1) {
        this.pause();
        return;
      }
      this.goTo(this.stepIndex + 1);
    }

    togglePlay() {
      if (!this.hasTrace()) return;
      this.playing ? this.pause() : this.play();
    }

    play() {
      if (!this.hasTrace()) return;
      if (this.stepIndex >= this.trace.length - 1) this.goTo(0);
      this.playing = true;
      this.updatePlayButton();
      this.schedule();
    }

    pause() {
      this.playing = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.updatePlayButton();
    }

    schedule() {
      if (this.timer) clearTimeout(this.timer);
      if (!this.playing) return;
      const delay = Math.max(180, 950 / this.speed);
      this.timer = setTimeout(() => {
        if (this.stepIndex >= this.trace.length - 1) {
          this.pause();
          return;
        }
        this.goTo(this.stepIndex + 1);
        this.schedule();
      }, delay);
    }

    goTo(index) {
      if (!this.hasTrace()) return;
      const nextIndex = Math.max(0, Math.min(this.trace.length - 1, index));
      this.stepIndex = nextIndex;
      const step = this.trace[nextIndex] || {};
      const previous = nextIndex > 0 ? this.trace[nextIndex - 1] : null;

      const visitedNodeIds = [];
      const visitedEdgeIds = [];
      for (let i = 0; i <= nextIndex; i += 1) {
        const item = this.trace[i];
        if (item && item.node) visitedNodeIds.push(item.node);
        if (item && item.edge) visitedEdgeIds.push(item.edge);
      }

      this.engine.setExecutionState({
        activeNodeId: step.node || null,
        previousNodeId: previous && previous.node ? previous.node : null,
        activeEdgeId: step.edge || null,
        visitedNodeIds,
        visitedEdgeIds
      });

      this.slider.value = String(nextIndex);
      this.renderStep(step, nextIndex);
      this.updateButtons();
    }

    renderStep(step, index) {
      const node = step.node ? this.engine.nodesById.get(step.node) : null;
      const eventName = step.event || step.type || 'step';
      const stepLabel = step.label || (node && (node.label || node.id)) || `Step ${index + 1}`;
      const message = step.message || step.note || (node && node.summary) || '';

      this.eventEl.textContent = eventName;
      this.stepLabelEl.textContent = stepLabel;
      this.stepCounterEl.textContent = `${index + 1} / ${this.trace.length}`;
      this.toolbarCounter.textContent = `${index + 1}/${this.trace.length}`;
      this.messageEl.textContent = message;

      this.renderVariables(index);
      this.renderCallStack(index);
    }

    renderVariables(index) {
      const current = this.resolveVariables(index);
      const previous = index > 0 ? this.resolveVariables(index - 1) : {};
      const keys = Object.keys(current);

      if (!keys.length) {
        this.variablesEl.innerHTML = '<div class="runtime-empty">No variables for this step.</div>';
        return;
      }

      keys.sort();
      this.variablesEl.innerHTML = keys.map(key => {
        const changed = JSON.stringify(current[key]) !== JSON.stringify(previous[key]);
        return `
          <div class="runtime-variable${changed ? ' changed' : ''}">
            <span class="runtime-variable-name">${this.escape(key)}</span>
            <code>${this.escape(this.formatValue(current[key]))}</code>
          </div>
        `;
      }).join('');
    }

    resolveVariables(index) {
      const state = {};
      for (let i = 0; i <= index; i += 1) {
        const step = this.trace[i] || {};
        if (step.variablesSnapshot === true) {
          Object.keys(state).forEach(key => delete state[key]);
        }
        if (step.variables && typeof step.variables === 'object' && !Array.isArray(step.variables)) {
          Object.assign(state, step.variables);
        }
        if (Array.isArray(step.variablesRemoved)) {
          step.variablesRemoved.forEach(key => delete state[key]);
        }
      }
      return state;
    }

    renderCallStack(index) {
      const stack = this.resolveCallStack(index);
      if (!stack.length) {
        this.callStackEl.innerHTML = '<div class="runtime-empty">No call stack for this step.</div>';
        return;
      }

      this.callStackEl.innerHTML = stack.map((frame, frameIndex) => {
        const normalized = typeof frame === 'string' ? { name: frame } : (frame || {});
        const name = normalized.name || normalized.function || normalized.label || 'anonymous';
        const location = [
          normalized.file,
          normalized.line != null ? `:${normalized.line}` : null
        ].filter(Boolean).join('');
        return `
          <div class="stack-frame${frameIndex === stack.length - 1 ? ' current' : ''}">
            <span class="stack-index">${frameIndex}</span>
            <div>
              <strong>${this.escape(name)}</strong>
              ${location ? `<small>${this.escape(location)}</small>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    resolveCallStack(index) {
      for (let i = index; i >= 0; i -= 1) {
        const step = this.trace[i];
        if (step && Array.isArray(step.callStack)) return step.callStack;
      }
      return [];
    }

    updateButtons() {
      const atStart = this.stepIndex <= 0;
      const atEnd = this.stepIndex >= this.trace.length - 1;
      this.prevBtn.disabled = atStart;
      this.resetBtn.disabled = atStart;
      this.nextBtn.disabled = atEnd;
    }

    updatePlayButton() {
      if (!this.playBtn) return;
      this.playBtn.textContent = this.playing ? '❚❚' : '▶';
      this.playBtn.title = this.playing ? 'Pause execution' : 'Play execution';
      this.playBtn.classList.toggle('playing', this.playing);
    }

    formatValue(value) {
      if (typeof value === 'string') return `"${value}"`;
      if (value === undefined) return 'undefined';
      if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
      try {
        const text = JSON.stringify(value);
        return text && text.length > 120 ? `${text.slice(0, 117)}…` : text;
      } catch (_) {
        return String(value);
      }
    }

    escape(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  root.ExecutionPlayer = ExecutionPlayer;
})();
