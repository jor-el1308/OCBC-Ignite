/* SafePay Circle - Su Yi */
window.ExclusionLog = {
  list() { return Store.get('exclusionLog', []); },
  isTrusted(payee) {
    if (!payee) return false;
    return this.list().some(p => p.number === payee.number && p.name === payee.name && p.bank === payee.bank && p.status === 'cooling_off' && Number.isFinite(p.activeAt) && Date.now() >= p.activeAt);
  },
  isExcluded(payee) { return this.isTrusted(payee); },
  add(payee) {
    if (!payee || !payee.name || !payee.bank || !payee.number) return false;
    if (this.list().some(p => p.number === payee.number && p.bank === payee.bank)) return false;
    const now = Date.now();
    const items = this.list();
    items.push({ name: payee.name, bank: payee.bank, number: payee.number, addedAt: now, status: 'pending_approval', verificationMethod: this.getVerificationMethod(), activeAt: null });
    Store.set('exclusionLog', items);
    return true;
  },
  remove(number) {
    Store.set('exclusionLog', this.list().filter(p => p.number !== number));
  }
};

ExclusionLog.approve = function(number, result) {
  if (!result || result.approved !== true) return false;
  if (result.method !== 'bank' && result.method !== 'trusted_person') return false;
  const items = this.list();
  const entry = items.find(function(p) { return p.number === number; });
  if (!entry || entry.status !== 'pending_approval') return false;
  if ((entry.verificationMethod || 'bank') !== result.method) return false;
  entry.status = 'cooling_off';
  entry.approvedAt = Date.now();
  entry.activeAt = entry.approvedAt + 86400000;
  Store.set('exclusionLog', items);
  return true;
};

ExclusionLog.reject = function(number) {
  const entry = this.list().find(function(p) { return p.number === number; });
  if (!entry || entry.status !== 'pending_approval') return false;
  this.remove(number);
  return true;
};
ExclusionLog.getVerificationMethod = function() {
  return Store.get('safePayVerificationMethod', 'bank');
};
ExclusionLog.setVerificationMethod = function(method) {
  if (method !== 'bank' && method !== 'trusted_person') return false;
  Store.set('safePayVerificationMethod', method);
  return true;
};
ExclusionLog.hasRecentHistory = function(p) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const now = today.getTime();
  const day = 86400000;
  const dates = (p.transferDates || []).map(function(d) { return Date.parse(d + "T00:00:00"); }).filter(function(t) { return Number.isFinite(t) && t <= now && t >= now - 30 * day; }).sort(function(a,b) { return a-b; });
  let count = 0;
  let last = -Infinity;
  dates.forEach(function(t) { if(t-last >= 3*day) { count++; last=t; } });
  return count >= 3;
};
ExclusionLog.suggestions = function() {
  return getPayees().filter(p => ExclusionLog.hasRecentHistory(p) && !this.list().some(t => t.number === p.number && t.bank === p.bank));
};

ExclusionLog.renderHint = function(payee, el) {
  if (!el) return;
  el.innerHTML = this.isTrusted(payee) ? '<div class="slot"><strong>SafePay Circle</strong><p>Active trusted recipient. Eligible transfers can use the fast lane.</p></div>' : '';
};

ExclusionLog.canFastLane = function(tx) {
  return !!(tx && tx.payee && tx.payee.type !== "paynow" && this.isTrusted(tx.payee) && Number.isFinite(tx.amount) && tx.amount > 0 && tx.amount <= window.DEMO_DATA.user.dailyTransferLimit);
};
