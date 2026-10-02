(function () {
  const WE = window.WorldEngine;
  const $ = id => document.getElementById(id);

  const canvas = $('canvas');
  const fileInput = $('fileInput');
  const openBtn = $('openBtn');
  const emptyOpenBtn = $('emptyOpenBtn');
  const sampleBtn = $('sampleBtn');
  const scene = $('scene');
  const emptyState = $('emptyState');
  const dropOverlay = $('dropOverlay');
  const statusText = $('statusText');
  const zoomText = $('zoomText');

  const engine = new WE.Engine({
    canvas,
    scene,
    edgeLayer: $('edgeLayer'),
    nodeLayer: $('nodeLayer'),
    onStatus: text => { statusText.textContent = text; },
    onZoom: percent => { zoomText.textContent = `${percent}%`; }
  });

  const executionPlayer = new WE.ExecutionPlayer({ engine });

  function setStatus(text, error) {
    statusText.textContent = text;
    statusText.style.color = error ? '#ff8693' : '';
  }

  let dragDepth = 0;
  function hideDropOverlay() {
    dragDepth = 0;
    dropOverlay.hidden = true;
  }

  function showPackage(pkg, label) {
    hideDropOverlay();
    WE.validateGraph(pkg.graph);
    const program = pkg.graph.program || {};
    $('programTitle').textContent = program.title || program.id || label || 'WorldEngine graph';
    $('programSummary').textContent = program.summary || 'Semantic program graph';

    const meta = [
      program.language,
      program.entryPoint,
      pkg.manifest && pkg.manifest.version ? `IR ${pkg.manifest.version}` : null
    ].filter(Boolean);
    $('packageMeta').textContent = meta.length ? meta.join(' · ') : (label || 'WorldEngine package');

    emptyState.hidden = true;
    scene.hidden = false;
    engine.load(pkg);
    executionPlayer.load(pkg);
    setStatus(label ? `Opened ${label}` : 'Graph loaded');
  }

  async function openFile(file) {
    if (!file) return;
    hideDropOverlay();
    try {
      setStatus(`Reading ${file.name}…`);
      const pkg = await WE.loadZip(file);
      showPackage(pkg, file.name);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Unable to open package', true);
    } finally {
      hideDropOverlay();
      fileInput.value = '';
    }
  }

  openBtn.addEventListener('click', () => fileInput.click());
  emptyOpenBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => openFile(fileInput.files && fileInput.files[0]));
  sampleBtn.addEventListener('click', () => showPackage(window.WorldEngineSample, 'built-in sample'));

  $('zoomInBtn').addEventListener('click', () => engine.zoomBy(1.18));
  $('zoomOutBtn').addEventListener('click', () => engine.zoomBy(0.84));
  $('fitBtn').addEventListener('click', () => engine.fit());

  function isFileDrag(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    return !!types && Array.from(types).includes('Files');
  }

  window.addEventListener('dragenter', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
  });
  window.addEventListener('dragleave', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) hideDropOverlay();
  });
  window.addEventListener('drop', event => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    hideDropOverlay();
    openFile(file);
  });
  window.addEventListener('dragend', hideDropOverlay);
  window.addEventListener('blur', hideDropOverlay);

  window.addEventListener('keydown', event => {
    const tag = event.target && event.target.tagName;
    const interactive = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON';

    if (event.key === 'Escape') {
      executionPlayer.pause();
      engine.clearSelection();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault();
      engine.fit();
      return;
    }

    if (interactive || !executionPlayer.hasTrace()) return;
    if (event.code === 'Space') {
      event.preventDefault();
      executionPlayer.togglePlay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      executionPlayer.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      executionPlayer.prev();
    }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    hideDropOverlay();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => engine.fit(), 120);
  });
})();
