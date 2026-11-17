/* =========================================================
   Shared helpers – loaded on EVERY page after data.js.
   Please keep this file small; put feature code in your own
   js file instead so we don't get merge conflicts.

   What's in here (all global):
     Store                       – sessionStorage wrapper
     getAccounts / getPayees / getRecentTransactions
     formatMoney, formatDate, formatDateTime, maskNumber, escapeHtml
     icon(name)                  – inline SVG icon, e.g. icon("shield")
     showToast(message)          – small pop-up message
     renderStepper(el, step)     – 1 Details / 2 OneCheck / 3 Done
     completeTransfer(tx, risk)  – finish a transfer and go to complete.html
   ========================================================= */

/* ---------- Tiny state store (sessionStorage) ----------
   Keys used by the skeleton:
     accounts     – accounts with live balances
     payees       – saved payees (new payees get added after a transfer)
     recent       – recent transactions list
     pendingTx    – transaction waiting for OneCheck / confirmation
     lastTx       – the transaction shown on the completion page
   Feature keys: trustedPerson (Izz), exclusionLog (Su Yi)
*/
const Store = {
  get(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem("demo_" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { sessionStorage.setItem("demo_" + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
  remove(key) {
    try { sessionStorage.removeItem("demo_" + key); } catch (e) { /* ignore */ }
  },
  resetAll() {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("demo_"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }
};

/* ---------- Data accessors ---------- */
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function getAccounts() { return Store.get("accounts", clone(window.DEMO_DATA.accounts)); }
function getPayees() { return Store.get("payees", clone(window.DEMO_DATA.payees)); }
function getRecentTransactions() { return Store.get("recent", clone(window.DEMO_DATA.recentTransactions)); }

/* ---------- Formatting ---------- */
function formatMoney(n, opts = {}) {
  const num = Number(n) || 0;
  const sign = num < 0 ? "-" : opts.plus && num > 0 ? "+" : "";
  return sign + "S$" + Math.abs(num).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}
function maskNumber(number) {
  // "501-123456-001" -> "•••• 6001"
  const digits = String(number || "").replace(/\D/g, "");
  return digits.length > 4 ? "•••• " + digits.slice(-4) : number;
}
function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function makeReference() {
  return "FT" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + Date.now().toString().slice(-6);
}
function initials(name) {
  return String(name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ---------- Icons (inline SVG, stroke style) ----------
   Usage: `${icon("shield")}`  or  `${icon("check", "icon-lg")}` */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  transfer: '<path d="M4 8h14"/><path d="m14 4 4 4-4 4"/><path d="M20 16H6"/><path d="m10 12-4 4 4 4"/>',
  paynow: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  bill: '<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 7.5h6M9 11h6M9 14.5h4"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  shield: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.7.8 2.9 2.4 3.5 4.7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  stop: '<path d="M8 2.5h8L21.5 8v8L16 21.5H8L2.5 16V8z"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  wallet: '<path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><path d="M16 13.5h.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17v.01"/>'
};
function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

/* ---------- Toast ---------- */
function showToast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- Stepper (transfer flow) ----------
   renderStepper(document.getElementById("stepper"), 2) */
function renderStepper(el, current) {
  if (!el) return;
  const steps = ["Transfer details", "OneCheck review", "Done"];
  el.innerHTML = `<ol class="stepper">${steps
    .map((label, i) => {
      const n = i + 1;
      const state = n < current ? "done" : n === current ? "current" : "";
      return `<li class="${state}"><span class="dot">${n < current ? icon("check") : n}</span><span class="label">${label}</span></li>`;
    })
    .join("")}</ol>`;
}

/* ---------- Finalise a transfer (used by onecheck + exclusion bypass) ----------
   Deducts the balance, updates payee history, adds to recent list,
   stores lastTx and goes to complete.html */
function completeTransfer(tx, riskResult) {
  if (!tx || !tx.id || !Number.isFinite(tx.amount) || tx.amount <= 0) return;
  const done = Store.get("completedTxIds", []);
  if (done.includes(tx.id)) { showToast("This transfer was already completed."); return; }
  const source = getAccounts().find(a => a.id === tx.fromAccountId);
  if (!source || tx.amount > source.balance || tx.amount > window.DEMO_DATA.user.dailyTransferLimit) { showToast("Transfer could not be completed. Please check your balance and limit."); return; }
  done.push(tx.id);
  Store.set("completedTxIds", done);
  const today = new Date().toISOString().slice(0, 10);

  const accounts = getAccounts();
  const acc = accounts.find((a) => a.id === tx.fromAccountId);
  if (acc) acc.balance = Math.round((acc.balance - tx.amount) * 100) / 100;
  Store.set("accounts", accounts);

  // Remember the payee so the next transfer to them is no longer "new"
  const payees = getPayees();
  let saved = payees.find((p) => p.number === tx.payee.number);
  if (!saved) {
    saved = Object.assign({}, tx.payee, { id: "p-" + Date.now(), addedOn: today, pastTransfers: 0 });
    payees.push(saved);
  }
  saved.pastTransfers = (saved.pastTransfers || 0) + 1;
  saved.lastPaid = today;
  saved.isNew = false;
  Store.set("payees", payees);

  const reference = makeReference();
  const recent = getRecentTransactions();
  recent.unshift({
    id: "t-" + Date.now(),
    date: today,
    description: (tx.channel === "PayNow" ? "PayNow to " : "Transfer to ") + tx.payee.name,
    category: "Transfer",
    amount: -tx.amount
  });
  Store.set("recent", recent);

  Store.set("lastTx", Object.assign({}, tx, {
    reference,
    completedAt: new Date().toISOString(),
    balanceAfter: acc ? acc.balance : null,
    risk: riskResult || null
  }));
  Store.remove("pendingTx");
  window.location.href = "complete.html";
}

/* ---------- Header / footer ---------- */
function brandHtml() {
  return `
    <a class="brand" href="index.html" aria-label="${escapeHtml(BRAND.name)} home">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="currentColor"/><path d="M9.5 16.5l4.5 4.5 8.5-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="brand-name">${escapeHtml(BRAND.name)}</span>
    </a>`;
}

function renderChrome() {
  const page = document.body.dataset.page || "";
  const user = window.DEMO_DATA.user;
  const links = [
    { id: "home", href: "index.html", label: "Overview" },
    { id: "transfer", href: "transfer.html", label: "Pay &amp; transfer" },
    { id: "trusted", href: "trusted-person.html", label: "Trusted person" },
    { id: "exclusion", href: "exclusion-log.html", label: "SafePay Circle" }
  ];
  const nav = links
    .map((l) => `<a href="${l.href}" class="${l.id === page ? "active" : ""}"${l.id === page ? ' aria-current="page"' : ""}>${l.label}</a>`)
    .join("");

  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <div class="proto-banner">${icon("info")} Student prototype for the OneCheck scam-detection project. Fictional bank, fake accounts, no real money.</div>
      <header class="site-header">
        <div class="utility-bar">
          <div class="inner">
            <span class="segment">Personal Banking</span>
            <div class="utility-links">
              <a href="#" data-demo-only>${icon("lock")} Security</a>
              <a href="#" data-demo-only>${icon("help")} Help &amp; support</a>
              <span class="last-login">Last login: ${escapeHtml(formatDateTime(user.lastLogin))}</span>
            </div>
          </div>
        </div>
        <div class="main-bar">
          <div class="inner">
            ${brandHtml()}
            <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false">${icon("menu")}</button>
            <nav class="site-nav" aria-label="Main">${nav}</nav>
            <div class="user-menu">
              <a href="#" class="icon-btn" data-demo-only aria-label="Notifications">${icon("bell")}<span class="pip"></span></a>
              <span class="avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
              <span class="user-name">${escapeHtml(user.name)}</span>
              <a href="#" class="logout" data-demo-only>${icon("logout")}<span class="logout-label">Log out</span></a>
            </div>
          </div>
        </div>
      </header>`;

    const toggle = header.querySelector(".nav-toggle");
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <div class="footer-links">
            <a href="#" data-demo-only>Security &amp; scams</a>
            <a href="#" data-demo-only>Terms and conditions</a>
            <a href="#" data-demo-only>Privacy</a>
            <a href="#" data-demo-only>Contact us</a>
          </div>
          <div class="footer-meta">
            <span>&copy; 2026 ${escapeHtml(BRAND.name)} (fictional). OneCheck prototype.</span>
            <button type="button" id="reset-demo">Reset demo data</button>
          </div>
        </div>
      </footer>`;
    document.getElementById("reset-demo").addEventListener("click", () => {
      Store.resetAll();
      window.location.href = "index.html";
    });
  }

  // Page title suffix
  if (!document.title.includes(BRAND.name)) document.title += " | " + BRAND.name;
}

// Anything marked data-demo-only is a dummy link in the prototype
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-demo-only]");
  if (!el) return;
  e.preventDefault();
  showToast(el.dataset.demoOnly || "Not part of the prototype. Try Pay & transfer.");
});

document.addEventListener("DOMContentLoaded", renderChrome);
