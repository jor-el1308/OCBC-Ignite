/* SafePay Circle - Su Yi */
window.ExclusionLog = {
  list() { return Store.get('exclusionLog', []); },
  isTrusted(payee) {
    if (!payee) return false;
    return this.list().some(p => p.number === payee.number && p.name === payee.name && p.bank === payee.bank && Date.now() >= p.activeAt);
  },
  isExcluded(payee) { return this.isTrusted(payee); },
  add(payee) {
    if (!payee || !payee.name || !payee.bank || !payee.number) return false;
    if (this.list().some(p => p.number === payee.number && p.bank === payee.bank)) return false;
    const now = Date.now();
    const items = this.list();
    items.push({ name: payee.name, bank: payee.bank, number: payee.number, addedAt: now, activeAt: now + 86400000 });
    Store.set('exclusionLog', items);
    return true;
  },
  remove(number) {
    Store.set('exclusionLog', this.list().filter(p => p.number !== number));
  }
};

ExclusionLog.suggestions = function() {
  return getPayees().filter(p => p.pastTransfers >= 5 && !this.list().some(t => t.number === p.number && t.bank === p.bank));
};

ExclusionLog.renderHint = function(payee, el) {
  if (!el) return;
  el.innerHTML = this.isTrusted(payee) ? '<div class="slot"><strong>SafePay Circle</strong><p>Active trusted recipient. Eligible transfers can use the fast lane.</p></div>' : '';
};

ExclusionLog.canFastLane = function(tx) {
  return !!(tx && tx.payee && tx.payee.type !== "paynow" && this.isTrusted(tx.payee) && Number.isFinite(tx.amount) && tx.amount > 0 && tx.amount <= 1000);
};
