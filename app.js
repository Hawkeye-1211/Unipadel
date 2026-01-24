// UniPadel app.js
document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";

  const SHEET_WEB_APP_URL =
    "PASTE_NEW_EXEC_URL_HERE";

  // --- Admin login ---
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    history.replaceState({}, "", location.pathname);
  }

  const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  const form = document.getElementById("ideaForm");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");

  if (isAdmin) {
    if (form) form.style.display = "none";
    ownerSection.style.display = "block";
    loadIdeas();
  }

  async function loadIdeas() {
    ideasList.innerHTML = "<li>Loading…</li>";

    const res = await fetch(SHEET_WEB_APP_URL);
    const data = await res.json();

    ideasList.innerHTML = "";

    data.rows.forEach(r => {
      const li = document.createElement("li");
      const id = r.Timestamp;

      li.innerHTML = `
        <strong>${r["Idea Title"]}</strong><br>
        ${r["Idea Description"]}<br>
        <small>${new Date(id).toLocaleString()}</small><br><br>
        <button data-a="archive">Archive</button>
        <button data-a="delete">Delete</button>
      `;

      li.querySelector('[data-a="archive"]').onclick = () =>
        adminAction("archive", id);
      li.querySelector('[data-a="delete"]').onclick = () =>
        adminAction("delete", id);

      ideasList.appendChild(li);
    });
  }

  async function adminAction(action, id) {
    await fetch(SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action, id })
    });
    loadIdeas();
  }
});
