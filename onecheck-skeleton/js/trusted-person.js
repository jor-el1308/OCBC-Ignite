/* =========================================================
   Trusted Person / "Child Alert"  (OWNER: Izz)

   Contract used by the rest of the site:
     TrustedPerson.get()                 -> { name, relationship, contact, alertOn, addedOn } | null
     TrustedPerson.save(person)          -> saves it
     TrustedPerson.remove()              -> removes it
     TrustedPerson.alerts()              -> [{ id, sentAt, level, score, payee, amount, to, contact, sms }]
     TrustedPerson.notify(tx, result)    -> Promise<{ notified: boolean, message: string }>

   onecheck.js calls notify() for medium / high risk transfers and
   shows `message` in #trusted-person-slot.

   alertOn: "medium" = alert on Medium and High risk (default)
            "high"   = alert on High risk only

   The alert is SIMULATED: nothing is really sent. Each alert is saved
   in sessionStorage ("trustedAlerts") and shown on trusted-person.html
   as an SMS preview. To send a real SMS later, Vestin can add
   POST /api/alert on the Python back end and call it inside notify().
   ========================================================= */

const TP_RELATIONSHIPS = ["Son / daughter", "Parent", "Spouse / partner", "Sibling", "Relative", "Friend", "Other"];
const TP_MAX_ALERTS = 20;

window.TrustedPerson = {
  get() {
    return Store.get("trustedPerson", null);
  },

  save(person) {
    Store.set("trustedPerson", person);
  },

  remove() {
    Store.remove("trustedPerson");
  },

  alerts() {
    const list = Store.get("trustedAlerts", []);
    return Array.isArray(list) ? list : [];
  },

  // Should this risk level trigger an alert for this person?
  shouldAlert(person, level) {
    if (!person || level === "low") return false;
    if (person.alertOn === "high") return level === "high";
    return level === "medium" || level === "high";
  },

  // The SMS text the trusted person would receive
  buildSms(person, tx, result) {
    const user = window.DEMO_DATA.user.name;
    const levelWord = result.level === "high" ? "HIGH" : "MEDIUM";
    const action = result.level === "high"
      ? "The payment has been paused until it is verified."
      : "They have been asked to wait before sending.";
    return `${BRAND.name} OneCheck: ${user} is trying to send ${formatMoney(tx.amount)} to ${tx.payee.name}. ` +
      `This transfer was rated ${levelWord} scam risk. ${action} ` +
      `Please call ${user.split(" ")[0]} now to check they are not being scammed. ` +
      `${BRAND.name} will never ask you for an OTP or password.`;
  },

  async notify(tx, result) {
    const person = this.get();
    if (!person || !this.shouldAlert(person, result.level)) {
      return { notified: false, message: "" };   // nothing to show
    }

    const alert = {
      id: "a-" + Date.now(),
      sentAt: new Date().toISOString(),
      level: result.level,
      score: result.score,
      payee: tx.payee.name,
      amount: tx.amount,
      to: person.name,
      contact: person.contact,
      sms: this.buildSms(person, tx, result)
    };
    Store.set("trustedAlerts", [alert].concat(this.alerts()).slice(0, TP_MAX_ALERTS));

    // Later: replace the line above with a call to the back end, e.g.
    // await fetch("/api/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(alert) });

    return {
      notified: true,
      message: `We have sent an SMS alert to ${person.name} (${tpMaskPhone(person.contact)}) about this transfer. ` +
        `Expect a call from them before you continue.`
    };
  }
};

/* ---------- Helpers ---------- */
function tpCleanPhone(value) {
  return String(value || "").replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");
}
function tpIsValidPhone(digits) {
  return /^[89]\d{7}$/.test(digits);   // Singapore mobile: 8 digits starting with 8 or 9
}
function tpFormatPhone(digits) {
  return "+65 " + digits.slice(0, 4) + " " + digits.slice(4);
}
function tpMaskPhone(digits) {
  return "+65 •••• " + String(digits).slice(-4);
}

/* ---------- Page code for trusted-person.html ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("trusted-root");
  if (!root) return;   // not on the trusted-person page
  tpRenderPage(root);
});

function tpRenderPage(root, editing = false) {
  const person = TrustedPerson.get();
  root.innerHTML = (!person || editing) ? tpFormHtml(person) : tpSummaryHtml(person);
  if (!person || editing) tpBindForm(root, person);
  else tpBindSummary(root);
  tpRenderHistory();
}

function tpFormHtml(person) {
  const p = person || {};
  const rel = TP_RELATIONSHIPS
    .map((r) => `<option value="${escapeHtml(r)}"${p.relationship === r ? " selected" : ""}>${escapeHtml(r)}</option>`)
    .join("");
  const alertOn = p.alertOn || "medium";
  return `
    <div class="card-head"><h2>${person ? "Edit trusted person" : "Set up a trusted person"}</h2></div>
    <div class="notice tp-explain">
      If OneCheck rates a transfer as <span class="badge medium">Medium</span> or <span class="badge high">High</span> risk,
      we send this person an SMS so they can call you before the money leaves your account.
      Pick someone you trust who is easy to reach, such as a son or daughter.
    </div>
    <form id="tp-form" novalidate>
      <div class="form-row">
        <label for="tp-name">Full name</label>
        <input type="text" id="tp-name" autocomplete="off" maxlength="60" value="${escapeHtml(p.name || "")}" placeholder="e.g. Tan Wei Ming">
        <div class="tp-error" id="tp-name-err"></div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="tp-rel">Relationship to you</label>
          <select id="tp-rel">
            <option value="">Select</option>
            ${rel}
          </select>
          <div class="tp-error" id="tp-rel-err"></div>
        </div>
        <div class="form-row">
          <label for="tp-phone">Mobile number</label>
          <div class="tp-phone">
            <span>+65</span>
            <input type="tel" id="tp-phone" inputmode="numeric" maxlength="9" value="${escapeHtml(p.contact || "")}" placeholder="9123 4567">
          </div>
          <div class="tp-error" id="tp-phone-err"></div>
        </div>
      </div>
      <fieldset class="form-row tp-fieldset">
        <legend>When should we alert them?</legend>
        <label class="tp-radio">
          <input type="radio" name="tp-alert" value="medium"${alertOn === "medium" ? " checked" : ""}>
          <span><strong>Medium and High risk</strong><small>Recommended. They hear about anything suspicious.</small></span>
        </label>
        <label class="tp-radio">
          <input type="radio" name="tp-alert" value="high"${alertOn === "high" ? " checked" : ""}>
          <span><strong>High risk only</strong><small>Fewer alerts, only when a payment is paused.</small></span>
        </label>
      </fieldset>
      <label class="tp-check">
        <input type="checkbox" id="tp-consent"${person ? " checked" : ""}>
        <span>I have told this person they will receive alerts about my transfers.</span>
      </label>
      <div class="tp-error" id="tp-consent-err"></div>
      <div class="btn-row end">
        ${person ? `<button type="button" class="btn btn-ghost" id="tp-cancel">Cancel</button>` : ""}
        <button type="submit" class="btn btn-primary">${person ? "Save changes" : "Save trusted person"}</button>
      </div>
    </form>`;
}

function tpBindForm(root, person) {
  const form = root.querySelector("#tp-form");
  const phone = root.querySelector("#tp-phone");
  phone.addEventListener("input", () => { phone.value = phone.value.replace(/[^\d ]/g, ""); });

  const cancel = root.querySelector("#tp-cancel");
  if (cancel) cancel.addEventListener("click", () => tpRenderPage(root));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = root.querySelector("#tp-name").value.trim();
    const relationship = root.querySelector("#tp-rel").value;
    const contact = tpCleanPhone(phone.value);
    const alertOn = (root.querySelector('input[name="tp-alert"]:checked') || {}).value || "medium";
    const consent = root.querySelector("#tp-consent").checked;

    const errors = {
      name: name.length < 2 ? "Enter their name." : "",
      rel: relationship ? "" : "Choose how they are related to you.",
      phone: tpIsValidPhone(contact) ? "" : "Enter an 8-digit Singapore mobile number starting with 8 or 9.",
      consent: consent ? "" : "Please let them know first, then tick this box."
    };
    tpShowError(root, "name", errors.name);
    tpShowError(root, "rel", errors.rel);
    tpShowError(root, "phone", errors.phone);
    tpShowError(root, "consent", errors.consent);
    const firstBad = Object.keys(errors).find((k) => errors[k]);
    if (firstBad) {
      const field = { name: "#tp-name", rel: "#tp-rel", phone: "#tp-phone", consent: "#tp-consent" }[firstBad];
      root.querySelector(field).focus();
      return;
    }

    TrustedPerson.save({
      name,
      relationship,
      contact,
      alertOn,
      addedOn: person && person.addedOn ? person.addedOn : new Date().toISOString()
    });
    showToast(person ? "Trusted person updated." : `${name} is now your trusted person.`);
    tpRenderPage(root);
  });
}

function tpShowError(root, key, message) {
  const el = root.querySelector(`#tp-${key}-err`);
  if (el) el.textContent = message;
  const input = { name: "#tp-name", rel: "#tp-rel", phone: "#tp-phone" }[key];
  if (input) root.querySelector(input).classList.toggle("invalid", Boolean(message));
}

function tpSummaryHtml(person) {
  return `
    <div class="card-head"><h2>Your trusted person</h2><span class="status-ok">${icon("check", "icon-sm")} Active</span></div>
    <div class="tp-person">
      <span class="avatar tp-avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</span>
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <div class="muted">${escapeHtml(person.relationship)} · ${escapeHtml(tpFormatPhone(person.contact))}</div>
      </div>
    </div>
    <dl class="summary">
      <div><dt>Alerts for</dt><dd>${person.alertOn === "high" ? "High risk only" : "Medium and High risk"}</dd></div>
      <div><dt>Added on</dt><dd>${escapeHtml(formatDate(person.addedOn))}</dd></div>
    </dl>
    <div class="btn-row end">
      <button type="button" class="btn btn-ghost" id="tp-remove">Remove</button>
      <button type="button" class="btn btn-secondary" id="tp-edit">Edit</button>
    </div>
    <div class="notice warn tp-warn">
      ${icon("alert", "icon-sm")} If someone on the phone asks you to change or remove your trusted person, stop. This is a common scam trick.
    </div>`;
}

function tpBindSummary(root) {
  root.querySelector("#tp-edit").addEventListener("click", () => tpRenderPage(root, true));
  root.querySelector("#tp-remove").addEventListener("click", () => {
    // Inline confirm (no browser confirm() dialog)
    const btn = root.querySelector("#tp-remove");
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "Tap again to remove";
      btn.classList.replace("btn-ghost", "btn-danger");
      return;
    }
    TrustedPerson.remove();
    showToast("Trusted person removed.");
    tpRenderPage(root);
  });
}

/* ---------- Alert history + SMS preview ---------- */
function tpRenderHistory() {
  let wrap = document.getElementById("tp-history");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "tp-history";
    wrap.className = "card";
    document.getElementById("trusted-root").after(wrap);
  }
  const alerts = TrustedPerson.alerts();
  if (!TrustedPerson.get() && !alerts.length) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const latest = alerts[0];
  wrap.innerHTML = `
    <div class="card-head"><h2>Alerts sent</h2>${alerts.length ? `<span class="muted small">${alerts.length} this session</span>` : ""}</div>
    ${latest ? `
      <div class="tp-phone-preview" aria-label="Preview of the latest SMS">
        <div class="tp-sms-from">${escapeHtml(BRAND.name)} · to ${escapeHtml(latest.to)}</div>
        <div class="tp-sms">${escapeHtml(latest.sms)}</div>
        <div class="tp-sms-time">${escapeHtml(formatDateTime(latest.sentAt))}</div>
      </div>
      <ul class="tx-list tp-alert-list">
        ${alerts.map((a) => `
          <li>
            <span><span class="badge ${a.level}">${a.level === "high" ? "High" : "Medium"}</span>
              ${escapeHtml(formatMoney(a.amount))} to ${escapeHtml(a.payee)}</span>
            <span class="muted small">${escapeHtml(formatDateTime(a.sentAt))}</span>
          </li>`).join("")}
      </ul>
      <p class="muted small">Demo only: no real SMS is sent.</p>`
    : `<div class="empty-state">${icon("bell")}<p>No alerts yet. Try a risky transfer, e.g. S$3,000 to Quick Crypto Invest.</p>
         <a class="btn btn-secondary" href="transfer.html">Make a test transfer</a></div>`}`;
}
