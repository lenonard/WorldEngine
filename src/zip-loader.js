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

  function pathPrefix(path) {
    return path && path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  }

  function relativePath(prefix, path) {
    return prefix + String(path || '').replace(/^\.\//, '');
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

  function validateExecution(execution, graph) {
    if (execution == null) return null;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution)) {
      throw new PackageError('execution data must be an object');
    }
    if (!Array.isArray(execution.trace)) {
      throw new PackageError('execution data must contain trace[]');
    }

    const nodeIds = new Set(graph.nodes.map(node => node.id));
    const edgeIds = new Set(graph.edges.map(edge => edge.id).filter(Boolean));

    execution.trace.forEach((step, index) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        throw new PackageError(`Execution step ${index} must be an object`);
      }
      if (step.node != null && !nodeIds.has(step.node)) {
        throw new PackageError(`Execution step ${index} points to unknown node: ${step.node}`);
      }
      if (step.edge != null && edgeIds.size && !edgeIds.has(step.edge)) {
        throw new PackageError(`Execution step ${index} points to unknown edge: ${step.edge}`);
      }
      if (step.variables != null && (typeof step.variables !== 'object' || Array.isArray(step.variables))) {
        throw new PackageError(`Execution step ${index} variables must be an object`);
      }
      if (step.callStack != null && !Array.isArray(step.callStack)) {
        throw new PackageError(`Execution step ${index} callStack must be an array`);
      }
    });

    return execution;
  }

  async function loadZip(file) {
    if (!window.JSZip) {
      throw new PackageError('JSZip is unavailable. Check your internet connection and reload the page.');
    }
    if (!file) throw new PackageError('No ZIP file selected');
    if (!/\.zip$/i.test(file.name || '')) throw new PackageError('Please choose a .zip file');

    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);

    const manifestPath = names.find(name => /(^|\/)manifest\.json$/i.test(name));
    let manifest;
    let graphPath;
    let prefix = '';

    if (manifestPath) {
      manifest = await readJson(zip, manifestPath);
      prefix = pathPrefix(manifestPath);
      graphPath = manifest.graph ? relativePath(prefix, manifest.graph) : prefix + 'graph.json';
    } else {
      graphPath = names.find(name => /(^|\/)(graph|worldengine)\.json$/i.test(name));
      if (!graphPath) {
        const jsonFiles = names.filter(name => /\.json$/i.test(name));
        if (jsonFiles.length === 1) graphPath = jsonFiles[0];
      }
      if (!graphPath) throw new PackageError('ZIP needs manifest.json + graph.json, or a graph/worldengine JSON file.');
      prefix = pathPrefix(graphPath);
      manifest = { format: 'worldengine-package', version: '0.1', graph: graphPath };
    }

    const graph = validateGraph(await readJson(zip, graphPath));

    let execution = graph.execution || null;
    let executionPath = null;
    if (manifest.execution) {
      executionPath = relativePath(prefix, manifest.execution);
    } else {
      const candidate = prefix + 'execution.json';
      if (zip.file(candidate)) executionPath = candidate;
    }
    if (executionPath) execution = await readJson(zip, executionPath);
    execution = validateExecution(execution, graph);

    const sources = {};
    const sourceRefs = new Set(
      graph.nodes
        .map(node => node.source && node.source.file)
        .filter(Boolean)
    );

    for (const sourcePath of sourceRefs) {
      const candidates = new Set([
        sourcePath,
        relativePath(prefix, sourcePath)
      ]);

      if (manifest.sourceRoot) {
        let rootPath = String(manifest.sourceRoot).replace(/^\.\//, '');
        if (rootPath && !rootPath.endsWith('/')) rootPath += '/';
        const normalizedSource = String(sourcePath).replace(/^\.\//, '');
        const withoutRoot = rootPath && normalizedSource.startsWith(rootPath)
          ? normalizedSource.slice(rootPath.length)
          : normalizedSource;
        candidates.add(relativePath(prefix, rootPath + withoutRoot));
      }

      const resolved = Array.from(candidates).find(candidate => zip.file(candidate));
      const entry = resolved ? zip.file(resolved) : null;
      if (entry) sources[sourcePath] = await entry.async('string');
    }

    return {
      manifest,
      graph,
      execution,
      sources,
      fileName: file.name,
      fileCount: names.length
    };
  }

  root.PackageError = PackageError;
  root.loadZip = loadZip;
  root.validateGraph = validateGraph;
  root.validateExecution = validateExecution;
})();
