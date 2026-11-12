/* =========================================================
   OneCheck result page  (OWNER of the screens: Mushfira)

   Flow of this page:
     1. read pendingTx           (set by transfer.js)
     2. ExclusionLog.isExcluded  (Su Yi) -> skip straight to completion
     3. OneCheckAPI.assess(tx)   (Vestin) -> { level, score, reasons }
     4. show the low / medium / high screen
     5. medium/high -> TrustedPerson.notify(tx, result)  (Izz)
     6. user proceeds -> completeTransfer() in app.js, or cancels

   Mushfira: restyle / redesign the three render*Screen() functions
   and the CSS under "OneCheck Level Screen" in css/style.css.
   Keep the data-action="proceed" / "cancel" attributes so the
   buttons stay wired up (or change the wiring in bindActions()).
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("onecheck-root");
  const tx = Store.get("pendingTx");

  if (!tx) {
    window.location.href = "transfer.html";
    return;
  }

  renderStepper(document.getElementById("stepper"), 2);
  renderLoading(root);

  // Su Yi's feature: trusted contacts skip screening
  if (ExclusionLog.isExcluded(tx.payee)) {
    completeTransfer(tx, {
      level: "low",
      score: 0,
      reasons: ["Payee is in your exclusion log, so OneCheck was skipped."],
      skipped: true
    });
    return;
  }

  let result;
  try {
    // small delay so the "checking…" screen is visible during the demo
    const [res] = await Promise.all([
      OneCheckAPI.assess(tx),
      new Promise((resolve) => setTimeout(resolve, 1200))
    ]);
    result = res;
  } catch (err) {
    renderError(root, err);
    return;
  }

  renderResult(root, tx, result);

  // Izz's feature: alert the trusted person for risky transfers
  if (result.level !== "low") {
    TrustedPerson.notify(tx, result).then((info) => {
      if (info && info.message) {
        document.getElementById("trusted-person-slot").innerHTML =
          `<div class="slot"><div class="slot-title">Trusted person</div>${escapeHtml(info.message)}</div>`;
      }
    });
  }
});

/* ---------- Screens ---------- */

function renderLoading(root) {
  root.innerHTML = `
    <div class="card center">
      <div class="spinner"></div>
      <h2>Checking this transfer…</h2>
      <p class="muted">OneCheck is reviewing the payee, amount and remarks.</p>
    </div>`;
}

function renderError(root, err) {
  root.innerHTML = `
    <div class="card">
      <h2>Sorry, we could not check this transfer</h2>
      <p class="muted">${escapeHtml(err && err.message ? err.message : "Unknown error")}</p>
      <div class="btn-row"><a class="btn btn-secondary" href="transfer.html">Back to transfer</a></div>
    </div>`;
}

function summaryHtml(tx) {
  return `
    <dl class="summary">
      <div><dt>From</dt><dd>${escapeHtml(tx.fromAccountName)}</dd></div>
      <div><dt>To</dt><dd>${escapeHtml(tx.payee.name)}</dd></div>
      <div><dt>${tx.channel === "PayNow" ? "PayNow" : "Bank / account"}</dt><dd>${escapeHtml(tx.channel === "PayNow" ? tx.payee.number.replace("PayNow ", "") : tx.payee.bank + " " + tx.payee.number)}</dd></div>
      <div><dt>Amount</dt><dd>${formatMoney(tx.amount)}</dd></div>
      ${tx.purpose ? `<div><dt>Purpose</dt><dd>${escapeHtml(tx.purpose)}</dd></div>` : ""}
      ${tx.remarks ? `<div><dt>Remarks</dt><dd>${escapeHtml(tx.remarks)}</dd></div>` : ""}
    </dl>`;
}

function reasonsHtml(result) {
  return `<ul>${result.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;
}

function scoreBarHtml(result) {
  return `
    <div class="score-bar ${result.level}"><span style="width:${result.score}%"></span></div>
    <div class="hint">Suspicion score: ${result.score} / 100</div>`;
}

/* =========================================================
   LEVEL SCREENS  (Mushfira)
   Low / medium / high screens + the verify flow. Each screen is a
   render*Screen(tx, result) returning HTML. Buttons use data-action:
     proceed / cancel  -> wired by bindActions() as before
     verify, levels, send-verified -> wired by bindLevelScreen()
   Multi-step screens (verify -> callback -> verified) swap in through go().
   ========================================================= */

const WAIT_SECONDS = 60;                 // medium level: "1 minute to think"
const DEMO_OFFICER_CODE = "123456";      // demo only. A real build verifies this server-side.
const OFFICIAL_NUMBER = "1800 XXX XXXX"; // placeholder, as in the mock-ups
const RING_C = 2 * Math.PI * 52;         // circumference of the timer ring (r = 52)
const CLEAR_MAX_SCORE = 10;              // low level AND score at/below this AND no warning reasons = "Clear"
const AUTO_SEND_MS = 2000;               // Clear: show the green screen, then send automatically
let ocTimer = null;
let ocSendTimer = null;

window.addEventListener("pagehide", () => clearOcTimer());
function clearOcTimer() {
  if (ocTimer) { clearInterval(ocTimer); ocTimer = null; }
  if (ocSendTimer) { clearTimeout(ocSendTimer); ocSendTimer = null; }
}

/* ----- helpers ----- */

function bankName() {
  return (typeof BRAND !== "undefined" && BRAND && BRAND.name) || "DemoBank";
}

function payeeName(tx) {
  return (tx.payee && tx.payee.name) || "the payee";
}

function referenceCode(tx) {
  // Derived from this transaction (id, time, payee, amount), so every case gets its own number.
  const seed = [tx.id, tx.timestamp, tx.payee && tx.payee.name, tx.amount].join("|");
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  return "OC-" + String(h % 1000000).padStart(6, "0");
}

function reasonChips(result, cls) {
  const list = (result && result.reasons) || [];
  if (!list.length) return `<span class="ocl-muted">A routine reminder.</span>`;
  return list.map((r) => `<span class="ocl-chip ${cls}">${escapeHtml(r)}</span>`).join("");
}

/* Short scam-specific tip, picked from the purpose / remarks the customer gave. */
function scamTip(tx) {
  const text = ((tx.purpose || "") + " " + (tx.remarks || "")).toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));
  if (has("job", "deposit", "registration", "employ", "recruit"))
    return "Real employers do not ask you to pay to get a job. Scammers often rush people and ask for secrecy.";
  if (has("invest", "crypto", "return", "guarantee", "profit", "forex"))
    return "No investment can guarantee returns. Be careful if someone you met online is pushing you to invest quickly.";
  if (has("police", "court", "official", "arrest", "bank officer", "safe account"))
    return "Police, courts and banks never ask you to move money to a \"safe account\". Hang up and call the official number yourself.";
  if (has("loan", "fee", "processing", "release", "customs", "parcel"))
    return "Be careful if you must pay a fee first to receive a loan, parcel or prize. That is a common scam pattern.";
  if (has("family", "son", "daughter", "mum", "dad", "friend", "emergency", "hospital"))
    return "Voices and messages can be faked. Call the person on a number you already trust before sending money.";
  return "Scammers often rush people and ask for secrecy. If something feels off, pause and check before you pay.";
}

function levelHeader(level, label, title, blurbHtml) {
  return `
    <div class="ocl-head">
      <div class="ocl-level-icon ${level}" aria-hidden="true">${icon(level === "high" ? "stop" : level === "clear" ? "check" : "alert")}</div>
      <div>
        <div class="ocl-eyebrow">Warning level</div>
        <div class="ocl-level-name">${escapeHtml(label)}</div>
      </div>
      <button type="button" class="ocl-link" data-action="levels">${icon("info")} View levels</button>
    </div>
    <div class="ocl-meter ${level}" aria-hidden="true"><span></span><span></span><span></span></div>
    <h2 class="ocl-title">${escapeHtml(title)}</h2>
    <p class="ocl-blurb">${blurbHtml}</p>`;
}

function payingCard(tx) {
  return `
    <div class="ocl-card ocl-paying">
      <div class="ocl-eyebrow">Paying</div>
      <div class="ocl-paying-name">${escapeHtml(payeeName(tx))}${tx.payee && tx.payee.isNew ? " (new payee)" : ""}</div>
      <div class="ocl-paying-amount">${formatMoney(tx.amount)}</div>
    </div>`;
}

function safeWordCard() {
  return `
    <div class="ocl-card ocl-safeword">
      <div class="ocl-safeword-icon" aria-hidden="true">${icon("lock")}</div>
      <div>
        <strong>Safe Word reminder</strong>
        <p>Is a family member asking for money? Ask for your agreed safe word first. This is a reminder only, we cannot check it.</p>
      </div>
    </div>`;
}

/* Swap the page to another step and re-wire its buttons. */
function go(root, tx, result, html) {
  clearOcTimer();
  root.innerHTML = html;
  bindActions(root, tx, result);
  window.scrollTo({ top: 0 });
}

function showLevelsSheet() {
  if (document.getElementById("ocl-levels")) return;
  const wrap = document.createElement("div");
  wrap.id = "ocl-levels";
  wrap.className = "ocl-modal";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "How OneCheck protects you");
  wrap.innerHTML = `
    <div class="ocl-sheet">
      <h3>How OneCheck protects you</h3>
      <p class="ocl-muted">The more warning signs a payment has, the stronger the check. These are the actions we take.</p>
      <ul class="ocl-levels-list">
        <li><span class="ocl-lv clear">Clear</span><span>No warning signs. Your payment goes through as normal.</span></li>
        <li><span class="ocl-lv low">Low</span><span>You see a warning, then you can continue.</span></li>
        <li><span class="ocl-lv medium">Medium</span><span>You see a warning and get 1 minute to think.</span></li>
        <li><span class="ocl-lv high">High</span><span>The payment is held until you call ${escapeHtml(bankName())} to verify.</span></li>
      </ul>
      <button type="button" class="btn btn-primary" id="ocl-levels-close">Got it</button>
    </div>`;
  document.body.appendChild(wrap);
  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() { wrap.remove(); document.removeEventListener("keydown", onKey); }
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.querySelector("#ocl-levels-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  wrap.querySelector("#ocl-levels-close").focus();
}

/* ----- LOW ----- */
/* Nothing unusual at all: low level, no warning reasons, low score, payee already known. */
function isClear(tx, result) {
  const warnings = (result && result.reasons) || [];
  const score = Number(result && result.score) || 0;
  return result.level === "low" && warnings.length === 0 && score <= CLEAR_MAX_SCORE &&
    !(tx.payee && tx.payee.isNew);
}

function clearChecks(tx) {
  const checks = [];
  if (!(tx.payee && tx.payee.isNew)) checks.push("Saved payee");
  if (tx.dailyLimit == null || Number(tx.amount) <= Number(tx.dailyLimit)) checks.push("Within daily limit");
  checks.push("No warning signs");
  return checks.map((c) => `<span class="ocl-chip clear">${escapeHtml(c)}</span>`).join("");
}

/* ----- CLEAR (green, sends automatically) ----- */
function renderClearScreen(tx) {
  return `
    <section class="ocl-screen" data-ocl="clear">
      ${levelHeader("clear", "Clear", "No warning signs found",
        "OneCheck looked at the payee, the amount and the timing. Everything looks normal, so your payment goes through without any extra steps.")}
      <div class="ocl-card">
        <div class="ocl-eyebrow">What we checked</div>
        <div class="ocl-chips">${clearChecks(tx)}</div>
      </div>
      ${payingCard(tx)}
      <div class="ocl-sending" role="status">
        <span class="ocl-dot" aria-hidden="true"></span>
        Sending ${formatMoney(tx.amount)} to ${escapeHtml(payeeName(tx))}…
      </div>
      <div class="ocl-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel payment</button>
      </div>
    </section>`;
}

/* ----- LOW ----- */
function renderLowScreen(tx, result) {
  if (isClear(tx, result)) return renderClearScreen(tx);
  const tip = tx.payee && tx.payee.isNew
    ? "Check the payee name matches who you expect before you tap send."
    : "Check the amount and payee one more time before you tap send.";
  return `
    <section class="ocl-screen" data-ocl="low">
      ${levelHeader("low", "Low", "This payment looks mostly fine",
        "You have checked the key points, so you can continue. Please make sure you know and trust the person you are paying.")}
      <div class="ocl-card">
        <div class="ocl-eyebrow">Why you are seeing this</div>
        <div class="ocl-chips">${reasonChips(result, "low")}</div>
      </div>
      <div class="ocl-card">
        <strong>Quick tip</strong>
        <p>${escapeHtml(tip)}</p>
      </div>
      ${payingCard(tx)}
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" data-action="proceed">Send ${formatMoney(tx.amount)} anyway</button>
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel payment</button>
      </div>
    </section>`;
}

/* ----- MEDIUM (1 minute to think) ----- */
function renderMediumScreen(tx, result) {
  return `
    <section class="ocl-screen" data-ocl="medium">
      ${levelHeader("medium", "Medium", "Take a minute to think", escapeHtml(scamTip(tx)))}
      <div class="ocl-timer" role="timer" aria-live="off">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ocl-ring-bg" cx="60" cy="60" r="52"></circle>
          <circle class="ocl-ring" id="ocl-ring" cx="60" cy="60" r="52"
                  stroke-dasharray="${RING_C}" stroke-dashoffset="0"></circle>
        </svg>
        <div class="ocl-time" id="ocl-time">1:00</div>
      </div>
      <p class="ocl-sr" id="ocl-sr" aria-live="polite"></p>
      <div class="ocl-card">
        <div class="ocl-eyebrow">Why you are seeing this</div>
        <div class="ocl-chips">${reasonChips(result, "medium")}</div>
      </div>
      ${safeWordCard()}
      ${payingCard(tx)}
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" id="ocl-send" data-action="proceed" disabled>Send ${formatMoney(tx.amount)} (wait ${WAIT_SECONDS}s)</button>
        <button type="button" class="btn btn-secondary ocl-outline" data-action="verify">Verify instead</button>
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel payment</button>
      </div>
    </section>`;
}

/* ----- HIGH (payment paused until verified) ----- */
function renderHighScreen(tx, result) {
  return `
    <section class="ocl-screen ocl-high" role="alert" data-ocl="high">
      ${levelHeader("high", "High", "Payment paused for your safety",
        `This payment has many warning signs of a scam. It will not be sent until you verify with ${escapeHtml(bankName())}.`)}
      <div class="ocl-card">
        <div class="ocl-eyebrow">Why it was paused</div>
        <div class="ocl-chips">${reasonChips(result, "high")}</div>
      </div>
      <div class="ocl-card ocl-reassure">
        Your money is safe. If this is a real payment, verifying takes about two minutes.
      </div>
      ${payingCard(tx)}
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" data-action="verify">Verify with ${escapeHtml(bankName())}</button>
        <button type="button" class="btn btn-secondary" data-action="report">Cancel payment and report</button>
      </div>
    </section>`;
}

/* ----- VERIFY -> CALLBACK / TRUSTED PERSON -> VERIFIED ----- */
function renderVerifyScreen() {
  return `
    <section class="ocl-screen" data-ocl="verify">
      <h2 class="ocl-title">Verify this payment</h2>
      <p class="ocl-blurb">Choose one way to confirm this payment is real. These steps need a code or an approval from someone else. Do not use contact details given by the person asking for money.</p>
      <div class="ocl-options" role="radiogroup" aria-label="Verification method">
        <button type="button" class="ocl-option selected" role="radio" aria-checked="true" data-choice="callback">
          <span class="ocl-option-icon">${icon("help")}</span>
          <span><strong>Callback (recommended)</strong><small>Call ${escapeHtml(bankName())} on the official number saved in the app</small></span>
        </button>
        <button type="button" class="ocl-option" role="radio" aria-checked="false" data-choice="trusted">
          <span class="ocl-option-icon">${icon("user")}</span>
          <span><strong>Trusted Person</strong><small>Ask someone you chose to approve this payment</small></span>
        </button>
      </div>
      ${safeWordCard()}
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" id="ocl-continue">Continue with Callback</button>
        <button type="button" class="btn btn-secondary" data-action="report">Cancel and report</button>
      </div>
    </section>`;
}

function renderCallbackScreen(tx) {
  return `
    <section class="ocl-screen" data-ocl="callback">
      <h2 class="ocl-title">Call ${escapeHtml(bankName())} to verify</h2>
      <p class="ocl-blurb ocl-center">Tap to call the official number. Do not hang up and call any other number.</p>
      <div class="ocl-card ocl-center">
        <div class="ocl-eyebrow">Official ${escapeHtml(bankName())} number (saved in app)</div>
        <div class="ocl-number">${escapeHtml(OFFICIAL_NUMBER)}</div>
      </div>
      <div class="ocl-card">
        <div class="ocl-eyebrow">Tell the officer</div>
        <dl class="ocl-dl">
          <dt>Payee</dt><dd>${escapeHtml(payeeName(tx))}</dd>
          <dt>Amount</dt><dd>${formatMoney(tx.amount)}</dd>
          <dt>Reference code</dt><dd>${escapeHtml(referenceCode(tx))}</dd>
        </dl>
        <p class="ocl-muted">The officer will give you a one-time code to enter below.</p>
      </div>
      <div class="ocl-card">
        <label for="ocl-code" class="ocl-eyebrow">Officer code</label>
        <input id="ocl-code" class="ocl-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" aria-describedby="ocl-code-msg">
        <p class="ocl-muted" id="ocl-code-msg">Demo only: use ${escapeHtml(DEMO_OFFICER_CODE)}.</p>
      </div>
      <p class="ocl-muted ocl-center">The app does not listen to or record your call.</p>
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" id="ocl-call">Call ${escapeHtml(bankName())} now</button>
        <button type="button" class="btn btn-secondary ocl-outline" id="ocl-confirm">I have the officer code</button>
        <button type="button" class="btn btn-ghost" id="ocl-back">Back</button>
      </div>
    </section>`;
}

function renderTrustedScreen(tx) {
  return `
    <section class="ocl-screen" data-ocl="trusted">
      <h2 class="ocl-title">Ask your Trusted Person</h2>
      <p class="ocl-blurb">We have sent a request to the person you chose. They can see the payee and amount, and will approve or decline.</p>
      <div class="ocl-card">
        <div class="ocl-eyebrow">Request</div>
        <dl class="ocl-dl">
          <dt>Payee</dt><dd>${escapeHtml(payeeName(tx))}</dd>
          <dt>Amount</dt><dd>${formatMoney(tx.amount)}</dd>
        </dl>
        <p class="ocl-muted">Demo only: tap the button below to simulate their approval.</p>
      </div>
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" id="ocl-approve">Simulate approval</button>
        <button type="button" class="btn btn-ghost" id="ocl-back">Back</button>
      </div>
    </section>`;
}

function renderVerifiedScreen(tx, how) {
  const line = how === "Callback"
    ? `${bankName()} confirmed this payment with you.`
    : "Your Trusted Person approved this payment.";
  return `
    <section class="ocl-screen ocl-center" data-ocl="verified" data-how="${escapeHtml(how)}">
      <div class="ocl-level-icon clear ocl-big" aria-hidden="true">${icon("check")}</div>
      <h2 class="ocl-title">Verified</h2>
      <p class="ocl-blurb">${escapeHtml(line)} ${formatMoney(tx.amount)} will be sent to ${escapeHtml(payeeName(tx))}.</p>
      <div class="ocl-card">
        <div class="ocl-eyebrow">Reference</div>
        <strong>${escapeHtml(referenceCode(tx))} · Verified by ${escapeHtml(how)}</strong>
      </div>
      <p class="ocl-muted">Think it was a scam after all? You can report it any time from this screen.</p>
      <div class="ocl-actions">
        <button type="button" class="btn btn-primary" data-action="send-verified">Send ${formatMoney(tx.amount)}</button>
        <button type="button" class="btn btn-secondary ocl-outline" data-action="report">Report a scam</button>
      </div>
    </section>`;
}

/* ----- REPORT (payment cancelled + scam reported) ----- */
function saveReport(tx, result, ref) {
  try {
    const list = Store.get("reports");
    const all = Array.isArray(list) ? list : [];
    all.push({
      ref, txId: tx.id, payee: payeeName(tx), amount: tx.amount,
      level: result.level, reasons: result.reasons || [], at: new Date().toISOString()
    });
    Store.set("reports", all);
  } catch (e) { /* demo only: a failed save must never block the screen */ }
}

function renderReportScreen(tx, result, ref) {
  const when = typeof formatDateTime === "function" ? formatDateTime(new Date().toISOString()) : new Date().toLocaleString();
  return `
    <section class="ocl-screen ocl-report ocl-center" data-ocl="report">
      <div class="ocl-level-icon clear ocl-big" aria-hidden="true">${icon("check")}</div>
      <h2 class="ocl-title">Payment cancelled and reported</h2>
      <p class="ocl-blurb">Thank you for reporting. It helps ${escapeHtml(bankName())} protect other customers.</p>

      <div class="ocl-receipt">
        <div class="ocl-receipt-top">
          <span class="ocl-pill">${icon("check")} Cancelled &middot; no money sent</span>
          <div class="ocl-eyebrow">Report reference</div>
          <div class="ocl-ref">${escapeHtml(ref)}</div>
        </div>
        <dl class="ocl-rows">
          <div><dt>Payee</dt><dd>${escapeHtml(payeeName(tx))}</dd></div>
          <div><dt>Amount</dt><dd>${formatMoney(tx.amount)}</dd></div>
          <div><dt>Reported on</dt><dd>${escapeHtml(when)}</dd></div>
        </dl>
      </div>

      <div class="ocl-next">
        <h3>What to do next</h3>
        <ol>
          <li>Stop replying to the person who asked you for money.</li>
          <li>Never share your OTP, password or PIN with anyone.</li>
          <li>If you already sent money another way, call ${escapeHtml(bankName())} on the official number straight away.</li>
        </ol>
      </div>

      <div class="ocl-actions">
        <a class="btn btn-primary" href="index.html">Back to overview</a>
        <a class="btn btn-secondary ocl-outline" href="transfer.html">Make a new transfer</a>
      </div>
    </section>`;
}

/* ----- wiring for the extra buttons (called at the end of bindActions) ----- */
function bindLevelScreen(root, tx, result) {
  root.querySelectorAll('[data-action="levels"]').forEach((b) =>
    b.addEventListener("click", showLevelsSheet));
  root.querySelectorAll('[data-action="verify"]').forEach((b) =>
    b.addEventListener("click", () => go(root, tx, result, renderVerifyScreen(tx, result))));

  root.querySelectorAll('[data-action="report"]').forEach((b) =>
    b.addEventListener("click", () => {
      const ref = "RP-" + referenceCode(tx).slice(3);
      saveReport(tx, result, ref);
      Store.remove("pendingTx");
      go(root, tx, result, renderReportScreen(tx, result, ref));
    }));

  const screen = root.querySelector("[data-ocl]");
  const kind = screen && screen.dataset.ocl;

  if (kind === "medium") startMediumTimer(root, tx);

  if (kind === "clear") {
    clearOcTimer();
    // Cancelling inside the 2-second window must stop the automatic send.
    root.querySelector('[data-action="cancel"]').addEventListener("click", clearOcTimer);
    ocSendTimer = setTimeout(() => {
      ocSendTimer = null;
      completeTransfer(tx, Object.assign({}, result, { level: "low", clear: true }));
    }, AUTO_SEND_MS);
  }

  if (kind === "verify") {
    let choice = "callback";
    const cont = root.querySelector("#ocl-continue");
    root.querySelectorAll(".ocl-option").forEach((b) =>
      b.addEventListener("click", () => {
        choice = b.dataset.choice;
        root.querySelectorAll(".ocl-option").forEach((o) => {
          o.classList.toggle("selected", o === b);
          o.setAttribute("aria-checked", o === b ? "true" : "false");
        });
        cont.textContent = choice === "callback" ? "Continue with Callback" : "Continue with Trusted Person";
      })
    );
    cont.addEventListener("click", () =>
      go(root, tx, result, choice === "callback" ? renderCallbackScreen(tx) : renderTrustedScreen(tx)));
  }

  if (kind === "callback") {
    const input = root.querySelector("#ocl-code");
    const msg = root.querySelector("#ocl-code-msg");
    root.querySelector("#ocl-call").addEventListener("click", () => showToast("Calling is not part of the prototype."));
    root.querySelector("#ocl-back").addEventListener("click", () => go(root, tx, result, renderVerifyScreen(tx, result)));
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, ""); });
    root.querySelector("#ocl-confirm").addEventListener("click", () => {
      if (input.value === DEMO_OFFICER_CODE) {
        go(root, tx, result, renderVerifiedScreen(tx, "Callback"));
      } else {
        msg.textContent = "That code does not match. Check it with the officer and try again.";
        msg.classList.add("ocl-error");
        input.focus();
      }
    });
  }

  if (kind === "trusted") {
    root.querySelector("#ocl-back").addEventListener("click", () => go(root, tx, result, renderVerifyScreen(tx, result)));
    root.querySelector("#ocl-approve").addEventListener("click", () =>
      go(root, tx, result, renderVerifiedScreen(tx, "Trusted Person")));
  }

  if (kind === "verified") {
    const how = screen.dataset.how;
    root.querySelector('[data-action="send-verified"]').addEventListener("click", () =>
      completeTransfer(tx, Object.assign({}, result, { verified: true, verifiedBy: how, reference: referenceCode(tx) })));
  }
}

function startMediumTimer(root, tx) {
  const sendBtn = root.querySelector("#ocl-send");
  const timeEl = root.querySelector("#ocl-time");
  const ring = root.querySelector("#ocl-ring");
  const sr = root.querySelector("#ocl-sr");
  let left = WAIT_SECONDS;
  clearOcTimer();
  ocTimer = setInterval(() => {
    left -= 1;
    timeEl.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    ring.setAttribute("stroke-dashoffset", String(RING_C * (1 - left / WAIT_SECONDS)));
    if (left > 0) {
      sendBtn.textContent = `Send ${formatMoney(tx.amount)} (wait ${left}s)`;
      if (left % 15 === 0) sr.textContent = left + " seconds left to think.";
    } else {
      clearOcTimer();
      sendBtn.disabled = false;
      sendBtn.textContent = `Send ${formatMoney(tx.amount)} anyway`;
      sr.textContent = "You can now send the payment, or verify first.";
    }
  }, 1000);
}

/* ---------- Pick the screen + wire buttons ---------- */

function renderResult(root, tx, result) {
  const screens = { low: renderLowScreen, medium: renderMediumScreen, high: renderHighScreen };
  const render = screens[result.level] || renderMediumScreen;
  root.innerHTML = render(tx, result);
  bindActions(root, tx, result);
}

function bindActions(root, tx, result) {
  const ack = root.querySelector("#ack");
  const proceedHigh = root.querySelector("#proceed-high");
  if (ack && proceedHigh) {
    ack.addEventListener("change", () => { proceedHigh.disabled = !ack.checked; });
  }

  root.querySelectorAll('[data-action="proceed"]').forEach((btn) => {
    btn.addEventListener("click", () => completeTransfer(tx, result));
  });
  root.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      Store.remove("pendingTx");
      window.location.href = "transfer.html";
    });
  });

  bindLevelScreen(root, tx, result); // Mushfira: extra wiring for the new screens
}