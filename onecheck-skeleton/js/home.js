/* Home / account overview (Jor El / skeleton) */
document.addEventListener("DOMContentLoaded", () => {
  const user = window.DEMO_DATA.user;
  const accounts = getAccounts();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("welcome").textContent = `${greeting}, ${user.name.split(" ")[0]}`;
  document.getElementById("last-login").textContent = "Last login " + formatDateTime(user.lastLogin);
  document.getElementById("protect-pill").innerHTML = `${icon("shield")} OneCheck is screening your transfers`;

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  document.getElementById("total-balance").textContent = formatMoney(total);

  // Accounts
  document.getElementById("accounts").innerHTML = accounts
    .map((a) => `
      <li>
        <a class="account-row" href="#" data-demo-only="Account details are not part of the prototype.">
          <span class="acc-icon">${icon(a.type === "Current" ? "wallet" : "card")}</span>
          <span>
            <span class="acc-name">${escapeHtml(a.name)}</span><br>
            <span class="acc-number">${escapeHtml(a.type)} · ${escapeHtml(a.number)}</span>
          </span>
          <span class="acc-balance">${formatMoney(a.balance)}<small>Available balance</small></span>
          ${icon("chevron")}
        </a>
      </li>`)
    .join("");

  // Recent transactions
  document.getElementById("recent").innerHTML = getRecentTransactions()
    .slice(0, 7)
    .map((t) => `
      <li>
        <div>
          <div class="tx-desc">${escapeHtml(t.description)}</div>
          <div class="tx-meta">${escapeHtml(formatDate(t.date))} ${t.category ? `· <span class="tag">${escapeHtml(t.category)}</span>` : ""}</div>
        </div>
        <div class="amount ${t.amount > 0 ? "in" : ""}">${formatMoney(t.amount, { plus: true })}</div>
      </li>`)
    .join("");

  // Quick actions
  const actions = [
    { label: "Transfer", icon: "transfer", href: "transfer.html" },
    { label: "PayNow", icon: "paynow", href: "transfer.html?mode=paynow" },
    { label: "Pay bills", icon: "bill", demo: true },
    { label: "Scan &amp; Pay", icon: "qr", demo: true }
  ];
  document.getElementById("quick-actions").innerHTML = actions
    .map((a) => `<a class="action-tile" href="${a.href || "#"}"${a.demo ? " data-demo-only" : ""}>${icon(a.icon)}${a.label}</a>`)
    .join("");

  // OneCheck feature status (reads Izz's and Su Yi's modules if loaded)
  const person = window.TrustedPerson ? TrustedPerson.get() : null;
  const excluded = window.ExclusionLog ? ExclusionLog.list() : [];
  document.getElementById("security-status").innerHTML = `
    <li>${icon("shield")}<div><strong>OneCheck screening</strong><br><span class="status-ok">On</span> <span class="muted small">for every transfer</span></div></li>
    <li>${icon("user")}<div><strong>Trusted person</strong><br>
      ${person ? `<span class="status-ok">${escapeHtml(person.name)}</span>` : `<span class="status-off">Not set up</span>`}
      · <a href="trusted-person.html">${person ? "Manage" : "Set up"}</a></div></li>
    <li>${icon("list")}<div><strong>SafePay Circle</strong><br>
      <span class="muted">${excluded.length} trusted contact${excluded.length === 1 ? "" : "s"}</span>
      · <a href="exclusion-log.html">Manage</a></div></li>`;

  document.getElementById("tip-title").innerHTML = `${icon("alert")} Stay alert to scams`;
});
