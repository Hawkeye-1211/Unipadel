// UniPadel app.js — BULK STEP 1 (selection only)

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";

  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbx_SbZlBKAPFOyAb_mbllCytQEKTpzn-bafaZ7RloDTXsRLmsXB9Bngjp_Dv_h-I2tGHA/exec";

  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    history.replaceState({}, document.title, window.location.pathname);
  }

  const isAdminMode = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  const adminNavLink = document.getElementById("adminNavLink");
  const exitAdminLink = document.getElementById("exitAdminLink");
  if (adminNavLink) adminNavLink.hidden = !isAdminMode;
  if (exitAdminLink) exitAdminLink.hidden = !isAdminMode;

  if (exitAdminLink) {
    exitAdminLink.onclick = (e) => {
      e.preventDefault();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      location.href = "/ideas.html";
    };
  }

  const ideasList = document.getElementById("ideasList");
  if (!isAdminMode || !ideasList) return;

  // ✅ BULK STATE
  const selectedIds = new Set();

  async function fetchRows() {
    const r = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
    const j = await r.json();
    return j.rows || [];
  }

  function updateSelectAllCheckbox() {
    const all = document.querySelectorAll('input[data-select="row"]');
    const checked = [...all].every(cb => cb.checked);
    const selectAll = document.getElementById("selectAllIdeas");
    if (selectAll) selectAll.checked = checked;
  }

  async function renderAdminIdeas() {
    ideasList.innerHTML = "Loading…";
    const rows = await fetchRows();

    const active = rows.filter(r => r.Status === "ACTIVE");
    ideasList.innerHTML = "";

    // ✅ SELECT ALL ROW
    const selectAllLi = document.createElement("li");
    selectAllLi.innerHTML = `
      <label style="display:flex; gap:10px; align-items:center; font-weight:600;">
        <input type="checkbox" id="selectAllIdeas" />
        Select all
      </label>
    `;
    ideasList.appendChild(selectAllLi);

    selectAllLi.querySelector("input").addEventListener("change", (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('input[data-select="row"]').forEach(cb => {
        cb.checked = checked;
        cb.dispatchEvent(new Event("change"));
      });
    });

    for (const r of active) {
      const id = r.Timestamp;
      const li = document.createElement("li");
      li.style.margin = "14px 0";
      li.style.padding = "12px";
      li.style.borderRadius = "12px";
      li.style.border = "1px solid rgba(201,204,210,.18)";
      li.style.background = "rgba(15,22,34,.55)";

      li.innerHTML = `
        <label style="display:flex; gap:10px; align-items:flex-start;">
          <input type="checkbox" data-select="row" data-id="${id}" />
          <div style="flex:1;">
            <strong>${r["Idea Title"]}</strong><br/>
            ${r["Idea Description"]}
          </div>
        </label>
      `;

      const checkbox = li.querySelector("input");

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedIds.add(id);
          li.style.outline = "2px solid #B6E600";
        } else {
          selectedIds.delete(id);
          li.style.outline = "none";
        }
        updateSelectAllCheckbox();
      });

      ideasList.appendChild(li);
    }
  }

  renderAdminIdeas();
});
