/* =========================================================
   Fake demo data. Nothing here is real.
   Add more accounts / payees if you need them for your demo.

   Change the bank name / logo text in BRAND – it is used in
   the header, footer and page titles.
   ========================================================= */

window.BRAND = {
  name: "DemoBank",          // fictional bank – see README "Branding"
  product: "Digital Banking"
};

window.DEMO_DATA = {
  user: {
    name: "Alex Tan",
    lastLogin: "2026-11-04T21:14:00+08:00",
    dailyTransferLimit: 5000     // S$ per day – shown on the transfer page
  },

  accounts: [
    { id: "acc-001", type: "Savings", name: "Smart Saver Account",  number: "501-123456-001", balance: 12480.55, currency: "SGD" },
    { id: "acc-002", type: "Current", name: "Everyday Current",     number: "601-987654-001", balance: 3250.00,  currency: "SGD" },
    { id: "acc-003", type: "Savings", name: "Goal Savings – Japan trip", number: "501-778899-002", balance: 1840.20, currency: "SGD" }
  ],

  // Saved payees.
  //   isNew         – true if the user has never paid them before
  //   pastTransfers – how many times the user has paid them (useful for OneCheck)
  //   addedOn       – when the payee was added (recently added payees are riskier)
  payees: [
    { id: "p-001", name: "Mum (Tan Mei Ling)",       bank: "DemoBank",            number: "501-222333-001", isNew: false, pastTransfers: 24, lastPaid: "2026-11-02", addedOn: "2023-02-11", transferDates: ["2026-10-20","2026-10-26","2026-11-02"] },
    { id: "p-002", name: "Sunrise Property Pte Ltd", bank: "DemoBank",            number: "601-445566-002", isNew: false, pastTransfers: 11, lastPaid: "2026-10-28", addedOn: "2025-12-01", transferDates: ["2026-10-17","2026-10-22","2026-10-28"] },
    { id: "p-003", name: "Lim Wei Jie",              bank: "UOB",                 number: "012-345678-9",   isNew: true,  pastTransfers: 0,  lastPaid: null,         addedOn: "2026-11-04", transferDates: [] },
    { id: "p-004", name: "Quick Crypto Invest",      bank: "Other bank",          number: "999-000111-2",   isNew: true,  pastTransfers: 0,  lastPaid: null,         addedOn: "2026-11-05", transferDates: [] },
    { id: "p-005", name: "Sarah Ng",                 bank: "DBS/POSB",            number: "120-55678-1",    isNew: false, pastTransfers: 6,  lastPaid: "2026-10-12", addedOn: "2024-07-19", transferDates: ["2026-09-15","2026-09-28","2026-10-12"] }
  ],

  // Fake PayNow directory: mobile number -> registered name (masked like real PayNow)
  paynowDirectory: {
    "91234567": { name: "TAN MEI LING",    masked: "TAN M** L***" },
    "98765432": { name: "LIM WEI JIE",     masked: "LIM W** J**" },
    "81112222": { name: "JOHN SMITH",      masked: "JOHN S****" }
  },

  // Bank list for "new payee"
  banks: ["DemoBank", "DBS/POSB", "UOB", "Maybank", "Standard Chartered", "HSBC", "Citibank", "CIMB", "Other bank"],

  purposes: ["Family support", "Rent / property", "Bills and utilities", "Purchase of goods", "Investment", "Loan repayment", "Gift", "Others"],

  recentTransactions: [
    { id: "t-001", date: "2026-11-02", description: "Transfer to Mum (Tan Mei Ling)",        category: "Transfer",  amount: -200.00 },
    { id: "t-002", date: "2026-11-01", description: "NTUC FairPrice – Tampines",             category: "Groceries", amount: -86.45 },
    { id: "t-003", date: "2026-10-31", description: "Salary credit – Acme Pte Ltd",          category: "Income",    amount: 3800.00 },
    { id: "t-004", date: "2026-10-30", description: "SP Group – electricity bill",           category: "Bills",     amount: -112.30 },
    { id: "t-005", date: "2026-10-28", description: "Transfer to Sunrise Property Pte Ltd",  category: "Transfer",  amount: -1500.00 },
    { id: "t-006", date: "2026-10-26", description: "PayNow from Sarah Ng",                  category: "Transfer",  amount: 45.00 }
  ]
};
