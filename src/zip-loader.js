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

  function validateGraph(graph, label = 'graph') {
    if (!graph || typeof graph !== 'object') throw new PackageError(`${label} must be an object`);
    if (!Array.isArray(graph.nodes)) throw new PackageError(`${label} must contain nodes[]`);
    if (!Array.isArray(graph.edges)) throw new PackageError(`${label} must contain edges[]`);

    const ids = new Set();
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || !node.id.trim()) {
        throw new PackageError(`Every node in ${label} needs a non-empty string id`);
      }
      if (ids.has(node.id)) throw new PackageError(`Duplicate node id in ${label}: ${node.id}`);
      ids.add(node.id);
    }

    for (const edge of graph.edges) {
      if (!edge || !ids.has(edge.from) || !ids.has(edge.to)) {
        throw new PackageError(`Edge in ${label} points to an unknown node: ${JSON.stringify(edge)}`);
      }
    }

    return graph;
  }

  function graphForView(views, viewId, fallback) {
    if (!views || !viewId || !views[viewId]) return fallback;
    return views[viewId].graph || views[viewId];
  }

  function validateTrace(trace, graph, label) {
    if (!Array.isArray(trace)) throw new PackageError(`${label} must contain trace[]`);
    const nodeIds = new Set(graph.nodes.map(node => node.id));
    const edgeIds = new Set(graph.edges.map(edge => edge.id).filter(Boolean));

    trace.forEach((step, index) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        throw new PackageError(`${label} step ${index} must be an object`);
      }
      if (step.node != null && !nodeIds.has(step.node)) {
        throw new PackageError(`${label} step ${index} points to unknown node: ${step.node}`);
      }
      if (step.edge != null && edgeIds.size && !edgeIds.has(step.edge)) {
        throw new PackageError(`${label} step ${index} points to unknown edge: ${step.edge}`);
      }
      if (step.variables != null && (typeof step.variables !== 'object' || Array.isArray(step.variables))) {
        throw new PackageError(`${label} step ${index} variables must be an object`);
      }
      if (step.callStack != null && !Array.isArray(step.callStack)) {
        throw new PackageError(`${label} step ${index} callStack must be an array`);
      }
    });
  }

  function validateExecution(execution, graph, views) {
    if (execution == null) return null;
    if (Array.isArray(execution)) execution = { scenarios: execution };
    if (!execution || typeof execution !== 'object') {
      throw new PackageError('execution data must be an object');
    }

    if (Array.isArray(execution.scenarios)) {
      execution.scenarios.forEach((scenario, index) => {
        if (!scenario || typeof scenario !== 'object') {
          throw new PackageError(`Scenario ${index} must be an object`);
        }
        const scenarioGraph = graphForView(views, scenario.view, graph);
        validateTrace(scenario.trace, scenarioGraph, `scenario ${scenario.id || index}`);
      });
      return execution;
    }

    validateTrace(execution.trace, graph, 'execution');
    return execution;
  }

  function normalizeView(raw, id, spec) {
    const graph = raw && raw.graph && Array.isArray(raw.graph.nodes) ? raw.graph : raw;
    validateGraph(graph, `view ${id}`);
    return {
      id: raw.id || id,
      type: raw.type || (spec && spec.type) || id,
      title: raw.title || (spec && spec.title) || id,
      description: raw.description || (spec && spec.description) || '',
      graph
    };
  }

  async function loadManifestViews(zip, manifest, prefix) {
    const result = {};
    if (!manifest.views || typeof manifest.views !== 'object') return result;

    for (const [id, spec] of Object.entries(manifest.views)) {
      if (typeof spec === 'string') {
        const raw = await readJson(zip, relativePath(prefix, spec));
        result[id] = normalizeView(raw, id, null);
      } else if (spec && typeof spec === 'object') {
        if (spec.path) {
          const raw = await readJson(zip, relativePath(prefix, spec.path));
          result[id] = normalizeView(raw, id, spec);
        } else if (spec.graph || Array.isArray(spec.nodes)) {
          result[id] = normalizeView(spec, id, spec);
        }
      }
    }
    return result;
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
    let graphPath = null;
    let prefix = '';

    if (manifestPath) {
      manifest = await readJson(zip, manifestPath);
      prefix = pathPrefix(manifestPath);
      if (manifest.graph) graphPath = relativePath(prefix, manifest.graph);
      else if (!manifest.views) graphPath = prefix + 'graph.json';
    } else {
      graphPath = names.find(name => /(^|\/)(graph|worldengine)\.json$/i.test(name));
      if (!graphPath) {
        const jsonFiles = names.filter(name => /\.json$/i.test(name));
        if (jsonFiles.length === 1) graphPath = jsonFiles[0];
      }
      if (!graphPath) throw new PackageError('ZIP needs manifest.json with graph/views, or a graph/worldengine JSON file.');
      prefix = pathPrefix(graphPath);
      manifest = { format: 'worldengine-package', version: '0.1', graph: graphPath };
    }

    const views = await loadManifestViews(zip, manifest, prefix);
    let graph = graphPath && zip.file(graphPath) ? validateGraph(await readJson(zip, graphPath)) : null;

    if (!graph && Object.keys(views).length) {
      const defaultKey = manifest.defaultView && views[manifest.defaultView]
        ? manifest.defaultView
        : (views.controlFlow ? 'controlFlow' : Object.keys(views)[0]);
      graph = views[defaultKey].graph;
    }

    if (!graph) throw new PackageError('No renderable graph found in package');

    if (!Object.keys(views).length && graph.views && typeof graph.views === 'object') {
      for (const [id, raw] of Object.entries(graph.views)) {
        views[id] = normalizeView(raw, id, raw);
      }
    }

    let execution = graph.execution || null;
    let executionPath = null;
    const executionSpec = manifest.execution || manifest.scenarios;
    if (executionSpec) {
      executionPath = relativePath(prefix, executionSpec);
    } else {
      const scenarioCandidate = prefix + 'scenarios.json';
      const executionCandidate = prefix + 'execution.json';
      if (zip.file(scenarioCandidate)) executionPath = scenarioCandidate;
      else if (zip.file(executionCandidate)) executionPath = executionCandidate;
    }
    if (executionPath) execution = await readJson(zip, executionPath);
    if (Array.isArray(execution)) execution = { scenarios: execution };
    execution = validateExecution(execution, graph, views);

    const sources = {};
    const allGraphs = [graph, ...Object.values(views).map(view => view.graph)].filter(Boolean);
    const sourceRefs = new Set();
    allGraphs.forEach(item => {
      item.nodes.forEach(node => {
        if (node.source && node.source.file) sourceRefs.add(node.source.file);
      });
    });

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
      views,
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
