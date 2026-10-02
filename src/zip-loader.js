(function () {
  const root = window.WorldEngine = window.WorldEngine || {};

  class PackageError extends Error {
    constructor(message) {
      super(message);
      this.name = 'WorldEnginePackageError';
    }
  }

  async function readJson(zip, path) {
    const file = zip.file(path);
    if (!file) throw new PackageError(`Missing ${path}`);
    const text = await file.async('string');
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new PackageError(`Invalid JSON in ${path}: ${error.message}`);
    }
  }

  function validateGraph(graph) {
    if (!graph || typeof graph !== 'object') throw new PackageError('graph.json must be an object');
    if (!Array.isArray(graph.nodes)) throw new PackageError('graph.json must contain nodes[]');
    if (!Array.isArray(graph.edges)) throw new PackageError('graph.json must contain edges[]');

    const ids = new Set();
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || !node.id.trim()) {
        throw new PackageError('Every node needs a non-empty string id');
      }
      if (ids.has(node.id)) throw new PackageError(`Duplicate node id: ${node.id}`);
      ids.add(node.id);
    }

    for (const edge of graph.edges) {
      if (!edge || !ids.has(edge.from) || !ids.has(edge.to)) {
        throw new PackageError(`Edge points to an unknown node: ${JSON.stringify(edge)}`);
      }
    }

    return graph;
  }

  async function loadZip(file) {
    if (!window.JSZip) {
      throw new PackageError('JSZip is unavailable. Check your internet connection and reload the page.');
    }
    if (!file) throw new PackageError('No ZIP file selected');
    if (!/\.zip$/i.test(file.name || '')) throw new PackageError('Please choose a .zip file');

    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);

    let manifestPath = names.find(name => /(^|\/)manifest\.json$/i.test(name));
    let manifest;
    let graphPath;

    if (manifestPath) {
      manifest = await readJson(zip, manifestPath);
      const prefix = manifestPath.includes('/') ? manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1) : '';
      graphPath = manifest.graph ? prefix + manifest.graph.replace(/^\.\//, '') : prefix + 'graph.json';
    } else {
      graphPath = names.find(name => /(^|\/)(graph|worldengine)\.json$/i.test(name));
      if (!graphPath) {
        const jsonFiles = names.filter(name => /\.json$/i.test(name));
        if (jsonFiles.length === 1) graphPath = jsonFiles[0];
      }
      if (!graphPath) throw new PackageError('ZIP needs manifest.json + graph.json, or a single graph/worldengine JSON file.');
      manifest = { format: 'worldengine-package', version: '0.1', graph: graphPath };
    }

    const graph = validateGraph(await readJson(zip, graphPath));
    const sources = {};

    const sourceRefs = new Set(
      graph.nodes
        .map(node => node.source && node.source.file)
        .filter(Boolean)
    );

    for (const sourcePath of sourceRefs) {
      let resolved = sourcePath;
      if (!zip.file(resolved) && manifestPath && manifest.sourceRoot && !sourcePath.startsWith(manifest.sourceRoot)) {
        const prefix = manifestPath.includes('/') ? manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1) : '';
        resolved = prefix + manifest.sourceRoot.replace(/^\.\//, '') + sourcePath.replace(/^\.\//, '');
      }
      const entry = zip.file(resolved) || zip.file(sourcePath);
      if (entry) sources[sourcePath] = await entry.async('string');
    }

    return {
      manifest,
      graph,
      sources,
      fileName: file.name,
      fileCount: names.length
    };
  }

  root.PackageError = PackageError;
  root.loadZip = loadZip;
  root.validateGraph = validateGraph;
})();
