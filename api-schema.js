function transactionInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return { ...body, categoryId: body.category ?? body.categoryId };
}
function toTransaction(id, data) {
  return {
    id, amount: data.amount, category: data.category ?? data.categoryId,
    date: data.date, type: data.type, month: data.month,
    note: data.note ?? "", receiptPath: data.receiptPath ?? null,
    createdAt: data.createdAt ?? null, updatedAt: data.updatedAt ?? null
  };
}
function toBudget(id, data, spent) {
  return {
    id, category: data.category ?? data.categoryId,
    limit: data.limit ?? data.limitAmount, spent, month: data.month,
    warningAlerted: Boolean(data.warningAlerted),
    exceededAlerted: Boolean(data.exceededAlerted),
    createdAt: data.createdAt ?? null, updatedAt: data.updatedAt ?? null
  };
}

module.exports = { transactionInput, toTransaction, toBudget };
