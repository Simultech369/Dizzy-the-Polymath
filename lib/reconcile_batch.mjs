export async function reconcileOrderBatch(orders, reconcileOrder, onError = () => {}) {
  const results = [];
  for (const order of Array.isArray(orders) ? orders : []) {
    try {
      await reconcileOrder(order);
      results.push({ order, ok: true });
    } catch (error) {
      results.push({ order, ok: false, error });
      try {
        await onError(error, order);
      } catch {
        // Reporting must not prevent later orders from reconciling.
      }
    }
  }
  return results;
}
