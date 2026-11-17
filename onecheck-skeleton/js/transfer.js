/* =========================================================
   Transfer page (Jor El / skeleton)
   On submit it builds a `tx` object, saves it as "pendingTx"
   and sends the user to onecheck.html.

   tx shape (this is what the OneCheck algorithm receives):
   {
     id, timestamp (ISO string),
     fromAccountId, fromAccountName, fromAccountNumber, fromBalance,
     channel:  "Internal" | "FAST" | "PayNow",
     payee: {
       id|null, name, bank, number,
       type: "saved" | "new" | "paynow",
       isNew,              // never paid before
       pastTransfers,      // number of previous transfers to them
       lastPaid,           // "YYYY-MM-DD" | null
       addedOn             // "YYYY-MM-DD" when the payee was added
     },
     amount (number), purpose (string), remarks (string),
     dailyLimit (number)
   }
   Add more fields here if the algorithm needs them
   (e.g. device, session length) and tell Vestin.

   Open transfer.html?mode=paynow to start on the PayNow tab.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const accounts = getAccounts();
  const payees = getPayees();
  const data = window.DEMO_DATA;
  const $ = (id) => document.getElementById(id);

  renderStepper($("stepper"), 1);
  $("tip-title").innerHTML = `${icon("alert")} Before you transfer`;
  $("onecheck-title").innerHTML = `${icon("shield")} Protected by OneCheck`;

  /* ---- Populate selects ---- */
  $("from").innerHTML = accounts
    .map((a) => `<option value="${a.id}">${escapeHtml(a.name)} · ${escapeHtml(a.number)}</option>`)
    .join("");
  $("payee").innerHTML =
    `<option value="">Select a payee</option>` +
    payees.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} · ${escapeHtml(p.bank)} ${escapeHtml(maskNumber(p.number))}</option>`).join("");
  $("new-bank").innerHTML = data.banks.map((b) => `<option>${escapeHtml(b)}</option>`).join("");
  $("purpose").innerHTML =
    `<option value="">Select a purpose</option>` +
    data.purposes.map((p) => `<option>${escapeHtml(p)}</option>`).join("");
  $("limit-hint").textContent = "Daily transfer limit: " + formatMoney(data.user.dailyTransferLimit);

  /* ---- Balance hint ---- */
  function currentAccount() { return accounts.find((a) => a.id === $("from").value); }
  function updateBalanceHint() {
    const acc = currentAccount();
    $("from-balance").textContent = acc ? "Available balance: " + formatMoney(acc.balance) : "";
  }
  $("from").addEventListener("change", updateBalanceHint);
  updateBalanceHint();

  /* ---- Tabs: saved / new / paynow ---- */
  let mode = "saved";
  const tabs = document.querySelectorAll(".segmented [data-mode]");
  function setMode(next) {
    mode = next;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === mode)));
    document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== mode));
    refreshPayeeHints();
  }
  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));

  /* ---- PayNow lookup (fake directory) ---- */
  function paynowLookup() {
    const mobile = $("paynow-mobile").value.replace(/\D/g, "");
    if (mobile.length !== 8) return null;
    const hit = data.paynowDirectory[mobile];
    return hit ? Object.assign({ mobile }, hit) : { mobile, name: null };
  }
  $("paynow-mobile").addEventListener("input", refreshPayeeHints);

  /* ---- Work out who the payee is from the current tab ---- */
  function getSelectedPayee() {
    if (mode === "new") {
      const name = $("new-name").value.trim();
      const number = $("new-number").value.trim();
      const existing = payees.find((p) => p.number === number);
      return {
        id: existing ? existing.id : null,
        name,
        bank: $("new-bank").value,
        number,
        type: "new",
        isNew: existing ? existing.isNew : true,
        pastTransfers: existing ? existing.pastTransfers || 0 : 0,
        lastPaid: existing ? existing.lastPaid : null,
        addedOn: existing ? existing.addedOn : new Date().toISOString().slice(0, 10)
      };
    }
    if (mode === "paynow") {
      const hit = paynowLookup();
      if (!hit || !hit.name) return null;
      const number = "PayNow +65 " + hit.mobile;
      const existing = payees.find((p) => p.number === number);
      return {
        id: existing ? existing.id : null,
        name: hit.name,
        bank: "PayNow",
        number,
        type: "paynow",
        isNew: existing ? existing.isNew : true,
        pastTransfers: existing ? existing.pastTransfers || 0 : 0,
        lastPaid: existing ? existing.lastPaid : null,
        addedOn: existing ? existing.addedOn : new Date().toISOString().slice(0, 10)
      };
    }
    const p = payees.find((x) => x.id === $("payee").value);
    return p ? Object.assign({ type: "saved" }, p) : null;
  }

  function refreshPayeeHints() {
    // Saved payee history
    const p = payees.find((x) => x.id === $("payee").value);
    $("payee-hint").textContent = p
      ? (p.pastTransfers ? `Paid ${p.pastTransfers} time${p.pastTransfers === 1 ? "" : "s"} · last on ${formatDate(p.lastPaid)}` : `Added ${formatDate(p.addedOn)} · never paid before`)
      : "";

    // PayNow name preview
    const hit = paynowLookup();
    $("paynow-result").innerHTML = !hit
      ? ""
      : hit.name
        ? `<div class="payee-preview"><span class="avatar">${escapeHtml(initials(hit.name))}</span><div><strong>${escapeHtml(hit.masked)}</strong><br><span class="muted small">Registered PayNow name. Check this is who you expect.</span></div></div>`
        : `<div class="notice warn" style="margin:8px 0 0">This mobile number is not registered for PayNow (demo).</div>`;

    // Su Yi's exclusion hint
    if (window.ExclusionLog && ExclusionLog.renderHint) {
      ExclusionLog.renderHint(getSelectedPayee(), $("exclusion-slot"));
    }
  }
  ["payee", "new-number", "new-name"].forEach((id) => $(id).addEventListener("input", refreshPayeeHints));
  $("payee").addEventListener("change", refreshPayeeHints);

  /* ---- Submit ---- */
  $("transfer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    $("amount-error").textContent = "";
    $("form-error").textContent = "";
    document.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

    const fail = (msg, fieldId, errId = "form-error") => {
      $(errId).textContent = msg;
      if (fieldId) { $(fieldId).classList.add("invalid"); $(fieldId).focus(); }
    };

    const payee = getSelectedPayee();
    if (mode === "saved" && !payee) return fail("Please select a payee.", "payee");
    if (mode === "new" && (!payee.name || !payee.number)) return fail("Please enter the payee's name and account number.", payee.name ? "new-number" : "new-name");
    if (mode === "paynow" && !payee) return fail("Enter a mobile number registered for PayNow.", "paynow-mobile");

    const acc = currentAccount();
    const amount = Math.round(parseFloat($("amount").value) * 100) / 100;
    if (!amount || amount <= 0) return fail("Enter an amount greater than S$0.00.", "amount", "amount-error");
    if (amount > acc.balance) return fail("This is more than your available balance.", "amount", "amount-error");
    if (amount > data.user.dailyTransferLimit) return fail("This is more than your daily transfer limit of " + formatMoney(data.user.dailyTransferLimit) + ".", "amount", "amount-error");

    const channel = payee.type === "paynow" ? "PayNow" : payee.bank === BRAND.name ? "Internal" : "FAST";

    const tx = {
      id: "tx-" + Date.now(),
      timestamp: new Date().toISOString(),
      fromAccountId: acc.id,
      fromAccountName: acc.name,
      fromAccountNumber: acc.number,
      fromBalance: acc.balance,
      channel,
      payee,
      amount,
      purpose: $("purpose").value,
      remarks: $("remarks").value.trim(),
      dailyLimit: data.user.dailyTransferLimit
    };

    Store.set("pendingTx", tx);
    if (window.ExclusionLog && ExclusionLog.canFastLane(tx)) {
      if (!window.confirm("SafePay Circle fast lane: Transfer S$" + amount.toFixed(2) + " to " + payee.name + "? Please verify the recipient details before proceeding.")) { Store.remove("pendingTx"); return; }
      completeTransfer(tx, { level: "skipped", skipped: true, fastLane: true, reasons: ["SafePay Circle eligible recipient"] });
      return;
    }
    window.location.href = "onecheck.html";
  });

  /* ---- Start-up ---- */
  const startMode = new URLSearchParams(location.search).get("mode");
  setMode(["saved", "new", "paynow"].includes(startMode) ? startMode : "saved");
});
