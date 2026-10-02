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

  function setStatus(text, error) {
    statusText.textContent = text;
    statusText.style.color = error ? '#ff8693' : '';
  }

  function showPackage(pkg, label) {
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
    setStatus(label ? `Opened ${label}` : 'Graph loaded');
  }

  async function openFile(file) {
    if (!file) return;
    try {
      setStatus(`Reading ${file.name}…`);
      const pkg = await WE.loadZip(file);
      showPackage(pkg, file.name);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Unable to open package', true);
    } finally {
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

  let dragDepth = 0;
  window.addEventListener('dragenter', event => {
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('dragleave', event => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.hidden = true;
  });
  window.addEventListener('drop', event => {
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    openFile(file);
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') engine.clearSelection();
    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault();
      engine.fit();
    }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => engine.fit(), 120);
  });
})();
