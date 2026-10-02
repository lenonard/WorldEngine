(function () {
  const base = window.WorldEngineSample;
  if (!base || !base.graph) return;

  const controlFlow = base.graph;

  const callGraph = {
    version: '0.3',
    type: 'call-graph',
    program: controlFlow.program,
    nodes: [
      { id: 'checkout', type: 'function', label: 'checkout()', summary: 'Main checkout orchestration.' },
      { id: 'calculateTotal', type: 'function', label: 'calculateTotal()', summary: 'Calculate payable order total.' },
      { id: 'validateOrder', type: 'function', label: 'validateOrder()', summary: 'Validate business rules.' },
      { id: 'cardGateway', type: 'external', label: 'cardGateway.charge()', summary: 'External card provider.' },
      { id: 'walletProvider', type: 'external', label: 'walletProvider.charge()', summary: 'External wallet provider.' },
      { id: 'normalizePayment', type: 'function', label: 'normalizePayment()', summary: 'Normalize provider response.' },
      { id: 'saveOrder', type: 'external', label: 'db.saveOrder()', summary: 'Persist order.' },
      { id: 'saveTransaction', type: 'external', label: 'db.saveTransaction()', summary: 'Persist payment transaction.' }
    ],
    edges: [
      { id: 'c1', from: 'checkout', to: 'calculateTotal', type: 'call' },
      { id: 'c2', from: 'checkout', to: 'validateOrder', type: 'call' },
      { id: 'c3', from: 'checkout', to: 'cardGateway', type: 'call', label: 'card' },
      { id: 'c4', from: 'checkout', to: 'walletProvider', type: 'call', label: 'wallet' },
      { id: 'c5', from: 'checkout', to: 'normalizePayment', type: 'call' },
      { id: 'c6', from: 'checkout', to: 'saveOrder', type: 'call' },
      { id: 'c7', from: 'checkout', to: 'saveTransaction', type: 'call' }
    ]
  };

  const dataFlow = {
    version: '0.3',
    type: 'data-flow',
    program: controlFlow.program,
    nodes: [
      { id: 'input', type: 'data', label: 'order + user', summary: 'Checkout input.' },
      { id: 'validate-data', type: 'process', label: 'Validate + calculate', summary: 'Produces total, errors and valid.' },
      { id: 'total', type: 'value', label: 'total', summary: 'Payable amount.' },
      { id: 'valid-data', type: 'value', label: 'valid / errors', summary: 'Validation result.' },
      { id: 'charge-data', type: 'process', label: 'Charge provider', summary: 'Consumes user/order/total and returns provider result.' },
      { id: 'payment-data', type: 'value', label: 'paymentResult', summary: 'Normalized payment data.' },
      { id: 'persist-data', type: 'process', label: 'Persist transaction', summary: 'Stores order and payment.' },
      { id: 'result-data', type: 'data', label: 'checkout result', summary: 'Returned API result.' }
    ],
    edges: [
      { id: 'd1', from: 'input', to: 'validate-data', type: 'data-flow' },
      { id: 'd2', from: 'validate-data', to: 'total', type: 'data-flow' },
      { id: 'd3', from: 'validate-data', to: 'valid-data', type: 'data-flow' },
      { id: 'd4', from: 'input', to: 'charge-data', type: 'data-flow' },
      { id: 'd5', from: 'total', to: 'charge-data', type: 'data-flow' },
      { id: 'd6', from: 'charge-data', to: 'payment-data', type: 'data-flow' },
      { id: 'd7', from: 'payment-data', to: 'persist-data', type: 'data-flow' },
      { id: 'd8', from: 'input', to: 'persist-data', type: 'data-flow' },
      { id: 'd9', from: 'payment-data', to: 'result-data', type: 'data-flow' },
      { id: 'd10', from: 'valid-data', to: 'result-data', type: 'data-flow' }
    ]
  };

  const asyncView = {
    version: '0.3',
    type: 'async-concurrency',
    program: controlFlow.program,
    nodes: [
      { id: 'async-start', type: 'async', label: 'checkout() async task', summary: 'Main async execution context.' },
      { id: 'choose-provider', type: 'decision', label: 'Payment provider?', summary: 'Chooses one async provider call.' },
      { id: 'await-card', type: 'await', label: 'await cardGateway.charge', summary: 'Suspend until card provider resolves.' },
      { id: 'await-wallet', type: 'await', label: 'await walletProvider.charge', summary: 'Suspend until wallet provider resolves.' },
      { id: 'resume', type: 'async', label: 'Resume checkout()', summary: 'Continue after provider result.' },
      { id: 'await-order', type: 'await', label: 'await db.saveOrder', summary: 'Persist order asynchronously.' },
      { id: 'await-transaction', type: 'await', label: 'await db.saveTransaction', summary: 'Persist transaction asynchronously.' },
      { id: 'async-return', type: 'return', label: 'Resolve checkout result', summary: 'Async function resolves to caller.' }
    ],
    edges: [
      { id: 'a1', from: 'async-start', to: 'choose-provider', type: 'async' },
      { id: 'a2', from: 'choose-provider', to: 'await-card', label: 'Card' },
      { id: 'a3', from: 'choose-provider', to: 'await-wallet', label: 'Wallet' },
      { id: 'a4', from: 'await-card', to: 'resume', type: 'async', label: 'resolved' },
      { id: 'a5', from: 'await-wallet', to: 'resume', type: 'async', label: 'resolved' },
      { id: 'a6', from: 'resume', to: 'await-order', type: 'async' },
      { id: 'a7', from: 'await-order', to: 'await-transaction', type: 'async' },
      { id: 'a8', from: 'await-transaction', to: 'async-return', type: 'async' }
    ]
  };

  const happy = base.execution;
  const validationFailure = {
    id: 'validation-failure',
    title: 'Validation failure',
    view: 'controlFlow',
    trace: [
      { node: 'start', event: 'enter', variablesSnapshot: true, variables: { orderId: 'ORD-FAIL', total: 0 }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 1 }] },
      { node: 'validate', edge: 'e1', event: 'process', variables: { total: 0, errors: ['Order has no items'] }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 4 }] },
      { node: 'valid', edge: 'e2', event: 'branch', variables: { valid: false }, message: 'valid = false, follow the No branch.', callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 9 }] },
      { node: 'reject', edge: 'e3', event: 'return', variables: { ok: false }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 10 }] }
    ]
  };

  const wallet = {
    id: 'happy-wallet',
    title: 'Successful wallet checkout',
    view: 'controlFlow',
    trace: [
      { node: 'start', event: 'enter', variablesSnapshot: true, variables: { orderId: 'ORD-2048', paymentMethod: 'wallet', total: 0 }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 1 }] },
      { node: 'validate', edge: 'e1', event: 'process', variables: { total: 72, errors: [] }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 4 }] },
      { node: 'valid', edge: 'e2', event: 'branch', variables: { valid: true }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 9 }] },
      { node: 'payment-method', edge: 'e4', event: 'branch', message: 'paymentMethod = wallet.', callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 14 }] },
      { node: 'wallet-charge', edge: 'p2', event: 'call', variables: { chargeAmount: 72 }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 18 }, { name: 'walletProvider.charge', line: 1 }] },
      { node: 'payment-result', edge: 'p4', event: 'return', variables: { paymentStatus: 'paid', transactionId: 'WALLET-22' }, variablesRemoved: ['chargeAmount'], callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 22 }] },
      { node: 'save', edge: 'e5', event: 'process', variables: { persisted: true }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 24 }] },
      { node: 'done', edge: 'e6', event: 'return', variables: { ok: true }, callStack: [{ name: 'checkout', file: 'source/checkout.js', line: 27 }] }
    ]
  };

  base.manifest.version = '0.3';
  base.manifest.defaultView = 'controlFlow';
  base.manifest.defaultScenario = happy.id || 'happy-path-card';
  base.views = {
    controlFlow: { id: 'controlFlow', type: 'control-flow', title: 'Control Flow', graph: controlFlow },
    callGraph: { id: 'callGraph', type: 'call-graph', title: 'Call Graph', graph: callGraph },
    dataFlow: { id: 'dataFlow', type: 'data-flow', title: 'Data Flow', graph: dataFlow },
    async: { id: 'async', type: 'async-concurrency', title: 'Async / Concurrency', graph: asyncView }
  };
  base.execution = {
    scenarios: [
      { ...happy, view: 'controlFlow' },
      validationFailure,
      wallet
    ]
  };
})();
