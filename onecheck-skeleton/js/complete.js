/* Transfer completion page – shows the receipt for lastTx (Jor El / skeleton) */
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("complete-root");
  const tx = Store.get("lastTx");

  if (!tx) {
    root.innerHTML = `
      <div class="empty-state">
        ${icon("transfer")}
        <h2>No recent transfer</h2>
        <p>Start a transfer to see a receipt here.</p>
        <div class="btn-row center"><a class="btn btn-primary" href="transfer.html">Make a transfer</a></div>
      </div>`;
    return;
  }

  renderStepper(document.getElementById("stepper"), 3);

  const risk = tx.risk;
  const riskRow = risk
    ? `<div><dt>OneCheck result</dt><dd>${risk.skipped
        ? `<span class="badge low">Skipped</span> <span class="muted small">SafePay Circle fast lane</span>`
        : `<span class="badge ${escapeHtml(risk.level)}">${escapeHtml(risk.level)} risk</span>`}</dd></div>`
    : "";
  const toLine = tx.channel === "PayNow"
    ? tx.payee.number.replace("PayNow ", "")
    : `${tx.payee.bank} ${tx.payee.number}`;

  root.innerHTML = `
    <div class="receipt-head">
      <div class="success-icon">${icon("check")}</div>
      <h1>Transfer successful</h1>
      <div class="amount">${formatMoney(tx.amount)}</div>
      <div class="muted">to <strong>${escapeHtml(tx.payee.name)}</strong></div>
    </div>
    <dl class="summary">
      <div><dt>Reference no.</dt><dd>${escapeHtml(tx.reference)}</dd></div>
      <div><dt>Date and time</dt><dd>${escapeHtml(formatDateTime(tx.completedAt))}</dd></div>
      <div><dt>From</dt><dd>${escapeHtml(tx.fromAccountName)}<br><span class="muted small">${escapeHtml(tx.fromAccountNumber || "")}</span></dd></div>
      <div><dt>To</dt><dd>${escapeHtml(tx.payee.name)}<br><span class="muted small">${escapeHtml(toLine)}</span></dd></div>
      <div><dt>Transfer type</dt><dd>${escapeHtml(tx.channel || "")}</dd></div>
      ${tx.purpose ? `<div><dt>Purpose</dt><dd>${escapeHtml(tx.purpose)}</dd></div>` : ""}
      ${tx.remarks ? `<div><dt>Remarks</dt><dd>${escapeHtml(tx.remarks)}</dd></div>` : ""}
      ${riskRow}
      ${tx.balanceAfter != null ? `<div><dt>Balance after transfer</dt><dd>${formatMoney(tx.balanceAfter)}</dd></div>` : ""}
    </dl>
    <div class="btn-row center" style="margin-top:24px">
      <button type="button" class="btn btn-ghost" id="print-receipt">${icon("print")} Save / print</button>
      <a class="btn btn-secondary" href="transfer.html">Make another transfer</a>
      <a class="btn btn-primary" href="index.html">Back to overview</a>
    </div>`;

  document.getElementById("print-receipt").addEventListener("click", () => window.print());
});
