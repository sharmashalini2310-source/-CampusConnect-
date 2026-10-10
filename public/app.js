const API = "/api";
const $ = (id) => document.getElementById(id);
const tokenKey = "campusconnectToken";
let authMode = "login";
let authModal;

function token() { return localStorage.getItem(tokenKey); }
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the server. Check that CampusConnect is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}
function showAlert(el, text, type = "danger") {
  el.textContent = text;
  el.className = `alert alert-${type}`;
}
function hideAlert(el) { el.className = "alert d-none"; }
function updateNav() {
  const loggedIn = Boolean(token());
  $("loginNav").hidden = loggedIn;
  $("registerNav").hidden = loggedIn;
  $("logoutNav").hidden = !loggedIn;
  $("dashboardNav").hidden = !loggedIn;
}
function openAuth(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "register" ? "Create your account" : "Welcome back";
  $("authSubmit").textContent = mode === "register" ? "Create account" : "Login";
  $("nameGroup").hidden = mode !== "register";
  $("authName").required = mode === "register";
  $("authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("switchPrompt").textContent = mode === "register" ? "Already registered?" : "New to CampusConnect?";
  $("switchAuth").textContent = mode === "register" ? "Login" : "Create an account";
  hideAlert($("authMessage"));
  authModal.show();
}
function itemCard(item, mine = false) {
  const isFound = item.type === "found";
  const emoji = ({ Electronics:"📱", Documents:"📄", Bags:"🎒", Clothing:"👕", Keys:"🔑", Books:"📚", Accessories:"🕶️", Other:"📦" })[item.category] || "📦";
  const photo = item.imageUrl && /^https?:\/\//i.test(item.imageUrl)
    ? `<img class="item-photo" src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;item-placeholder&quot;>📦</div>'">`
    : `<div class="item-placeholder">${emoji}</div>`;
  const date = item.date ? new Date(item.date).toLocaleDateString() : "Date not specified";
  const owner = item.owner && item.owner.name ? `<span>👤 ${escapeHTML(item.owner.name)}</span>` : "";
  const action = mine ? `<div class="d-flex gap-2 mt-3"><button class="btn btn-sm btn-outline-success" data-status="${escapeHTML(item._id)}" data-next="${item.status === "returned" ? "open" : "returned"}">${item.status === "returned" ? "Reopen" : "Mark returned"}</button><button class="btn btn-sm btn-outline-danger" data-delete="${escapeHTML(item._id)}">Delete</button></div>` : "";
  return `<div class="col-sm-6 col-lg-4"><article class="card item-card">${photo}<div class="card-body"><div class="d-flex justify-content-between align-items-center mb-2"><span class="badge ${isFound ? "text-bg-success" : "text-bg-danger"} type-badge">${isFound ? "Found item" : "Lost item"}</span><span class="badge text-bg-light">${escapeHTML(item.category)}</span></div><h5 class="card-title fw-bold">${escapeHTML(item.title)}</h5><p class="card-text text-secondary">${escapeHTML(item.description)}</p><div class="item-meta d-grid gap-2"><span>📍 ${escapeHTML(item.location)}</span><span>📅 ${escapeHTML(date)}</span>${owner}<span>Status: ${escapeHTML(item.status || "open")}</span></div>${action}</div></article></div>`;
}
function emptyState(title, detail, emoji = "🔎") {
  return `<div class="col-12"><div class="empty-state"><div class="emoji">${emoji}</div><h5>${escapeHTML(title)}</h5><p class="mb-0">${escapeHTML(detail)}</p></div></div>`;
}
async function loadItems() {
  const grid = $("itemsGrid");
  grid.innerHTML = '<div class="col-12 text-center py-5 text-secondary">Loading listings...</div>';
  const params = new URLSearchParams();
  if ($("searchInput").value.trim()) params.set("search", $("searchInput").value.trim());
  if ($("typeFilter").value) params.set("type", $("typeFilter").value);
  if ($("categoryFilter").value) params.set("category", $("categoryFilter").value);
  try {
    const { items } = await apiRequest(`/items?${params.toString()}`);
    $("totalItems").textContent = items.length;
    $("foundItems").textContent = items.filter((x) => x.type === "found").length;
    $("returnedItems").textContent = items.filter((x) => x.status === "returned").length;
    grid.innerHTML = items.length ? items.map((item) => itemCard(item)).join("") : emptyState("No listings yet", "Be the first to report a lost or found item.", "🎒");
  } catch (err) {
    grid.innerHTML = emptyState("Could not load listings", err.message, "⚠️");
  }
}
async function loadMine() {
  if (!token()) return;
  const section = $("dashboard");
  section.classList.remove("d-none");
  try {
    const { items } = await apiRequest("/items/mine");
    $("myItems").innerHTML = items.length ? items.map((item) => itemCard(item, true)).join("") : emptyState("No reports yet", "Items you report will appear here.", "📝");
  } catch (err) {
    $("myItems").innerHTML = emptyState("Could not load your reports", err.message, "⚠️");
  }
}
async function submitAuth(event) {
  event.preventDefault();
  const button = $("authSubmit");
  button.disabled = true;
  hideAlert($("authMessage"));
  try {
    const body = { email: $("authEmail").value.trim(), password: $("authPassword").value };
    if (authMode === "register") body.name = $("authName").value.trim();
    const result = await apiRequest(`/auth/${authMode}`, { method: "POST", body: JSON.stringify(body) });
    localStorage.setItem(tokenKey, result.token);
    updateNav();
    authModal.hide();
    $("authForm").reset();
    await loadMine();
    await loadItems();
    if (window.location.hash === "#register" || window.location.hash === "#login") history.replaceState(null, "", "#home");
    alert(result.message || "Success!");
  } catch (err) {
    showAlert($("authMessage"), err.message);
  } finally {
    button.disabled = false;
    button.textContent = authMode === "register" ? "Create account" : "Login";
  }
}
async function submitReport(event) {
  event.preventDefault();
  const message = $("reportMessage");
  if (!token()) {
    showAlert(message, "Please login or create an account before reporting an item.", "warning");
    openAuth("login");
    return;
  }
  const payload = {
    type: $("itemType").value,
    category: $("itemCategory").value,
    title: $("itemTitle").value.trim(),
    description: $("itemDescription").value.trim(),
    location: $("itemLocation").value.trim(),
    date: $("itemDate").value || undefined,
    imageUrl: $("itemImage").value.trim()
  };
  const button = $("reportForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await apiRequest("/items", { method: "POST", body: JSON.stringify(payload) });
    showAlert(message, result.message, "success");
    $("reportForm").reset();
    await loadItems();
    await loadMine();
    document.querySelector("#browse").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showAlert(message, err.message);
    if (/login|session/i.test(err.message)) openAuth("login");
  } finally {
    button.disabled = false;
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  authModal = new bootstrap.Modal($("authModal"));
  updateNav();
  $("loginNav").querySelector("a").addEventListener("click", (e) => { e.preventDefault(); openAuth("login"); });
  $("registerNav").querySelector("a").addEventListener("click", (e) => { e.preventDefault(); openAuth("register"); });
  document.querySelectorAll('[href="#login"]').forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); openAuth("login"); }));
  document.querySelectorAll('[href="#register"]').forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); openAuth("register"); }));
  $("switchAuth").addEventListener("click", (e) => { e.preventDefault(); openAuth(authMode === "login" ? "register" : "login"); });
  $("authForm").addEventListener("submit", submitAuth);
  $("reportForm").addEventListener("submit", submitReport);
  $("searchBtn").addEventListener("click", loadItems);
  $("searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") loadItems(); });
  $("typeFilter").addEventListener("change", loadItems);
  $("categoryFilter").addEventListener("change", loadItems);
  $("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(tokenKey);
    updateNav();
    $("dashboard").classList.add("d-none");
    loadItems();
  });
  document.querySelectorAll('[data-action="report"]').forEach((el) => el.addEventListener("click", () => $("reportSection").scrollIntoView({ behavior: "smooth" })));
  $("myItems").addEventListener("click", async (event) => {
    const del = event.target.closest("[data-delete]");
    const status = event.target.closest("[data-status]");
    try {
      if (del && confirm("Delete this listing?")) {
        await apiRequest(`/items/${del.dataset.delete}`, { method: "DELETE" });
      } else if (status) {
        await apiRequest(`/items/${status.dataset.status}`, { method: "PATCH", body: JSON.stringify({ status: status.dataset.next }) });
      } else return;
      await loadMine();
      await loadItems();
    } catch (err) { alert(err.message); }
  });
  if (location.hash === "#register") openAuth("register");
  if (location.hash === "#login") openAuth("login");
  await loadItems();
  if (token()) await loadMine();
});
