window.WorldEngineSample = {
  manifest: {
    format: "worldengine-package",
    version: "0.1",
    graph: "graph.json",
    sourceRoot: "source/"
  },
  graph: {
    version: "0.1",
    program: {
      id: "checkout-demo",
      title: "Checkout order",
      summary: "Ví dụ graph ngữ nghĩa: kiểm tra đơn hàng, chọn phương thức thanh toán, lưu giao dịch và trả kết quả.",
      language: "JavaScript",
      entryPoint: "checkout()"
    },
    nodes: [
      { "id": "start", "type": "start", "label": "Bắt đầu checkout", "summary": "Nhận order và user từ request.", "source": { "file": "source/checkout.js", "startLine": 1, "endLine": 2 } },
      { "id": "validate", "type": "process", "label": "Kiểm tra đơn hàng", "summary": "Xác thực dữ liệu và tính tổng tiền.", "notes": ["Gom các kiểm tra nhỏ thành một bước ngữ nghĩa thay vì render từng câu lệnh."], "source": { "file": "source/checkout.js", "startLine": 4, "endLine": 7 } },
      { "id": "valid", "type": "decision", "label": "Đơn hàng hợp lệ?", "summary": "Tách luồng lỗi khỏi luồng xử lý chính.", "source": { "file": "source/checkout.js", "startLine": 9, "endLine": 11 } },
      { "id": "reject", "type": "error", "label": "Từ chối đơn hàng", "summary": "Trả lỗi validation cho caller.", "source": { "file": "source/checkout.js", "startLine": 10, "endLine": 10 } },
      { "id": "payment", "type": "subgraph", "label": "Xử lý thanh toán", "summary": "Chọn payment provider, charge và chuẩn hóa kết quả.", "children": ["payment-method", "card-charge", "wallet-charge", "payment-result"], "entryNode": "payment-method", "exitNodes": ["payment-result"], "metrics": { "steps": 4, "branches": 2, "externalCalls": 2 } },
      { "id": "payment-method", "parent": "payment", "type": "decision", "label": "Phương thức thanh toán?", "summary": "Chọn provider phù hợp.", "source": { "file": "source/checkout.js", "startLine": 14, "endLine": 20 } },
      { "id": "card-charge", "parent": "payment", "type": "external", "label": "Charge card", "summary": "Gọi card gateway.", "source": { "file": "source/checkout.js", "startLine": 15, "endLine": 16 } },
      { "id": "wallet-charge", "parent": "payment", "type": "external", "label": "Charge wallet", "summary": "Gọi wallet provider.", "source": { "file": "source/checkout.js", "startLine": 18, "endLine": 19 } },
      { "id": "payment-result", "parent": "payment", "type": "process", "label": "Chuẩn hóa payment result", "summary": "Đưa kết quả provider về một cấu trúc chung.", "source": { "file": "source/checkout.js", "startLine": 22, "endLine": 22 } },
      { "id": "save", "type": "process", "label": "Lưu giao dịch", "summary": "Ghi order và transaction xuống database.", "source": { "file": "source/checkout.js", "startLine": 24, "endLine": 25 } },
      { "id": "done", "type": "return", "label": "Trả checkout result", "summary": "Hoàn thành luồng chính.", "source": { "file": "source/checkout.js", "startLine": 27, "endLine": 27 } }
    ],
    edges: [
      { "id": "e1", "from": "start", "to": "validate" },
      { "id": "e2", "from": "validate", "to": "valid" },
      { "id": "e3", "from": "valid", "to": "reject", "label": "No" },
      { "id": "e4", "from": "valid", "to": "payment", "label": "Yes" },
      { "id": "e5", "from": "payment", "to": "save" },
      { "id": "e6", "from": "save", "to": "done" },
      { "id": "p1", "from": "payment-method", "to": "card-charge", "label": "Card" },
      { "id": "p2", "from": "payment-method", "to": "wallet-charge", "label": "Wallet" },
      { "id": "p3", "from": "card-charge", "to": "payment-result" },
      { "id": "p4", "from": "wallet-charge", "to": "payment-result" }
    ]
  },
  sources: {
    "source/checkout.js": "async function checkout(order, user) {\n  const context = { order, user };\n\n  const total = calculateTotal(order.items);\n  const errors = validateOrder(order, user);\n  const valid = errors.length === 0 && total > 0;\n  context.total = total;\n\n  if (!valid) {\n    return { ok: false, errors };\n  }\n\n  let payment;\n  if (order.paymentMethod === 'card') {\n    payment = await cardGateway.charge(total);\n  } else {\n    payment = await walletProvider.charge(user.id, total);\n  }\n\n  const paymentResult = normalizePayment(payment);\n  await db.saveOrder(order, paymentResult);\n  await db.saveTransaction(paymentResult);\n\n  return { ok: true, orderId: order.id, payment: paymentResult };\n}"
  }
};
