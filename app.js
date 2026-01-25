// UniPadel app.js
// Public submits -> Google Sheet + Formspree emails
// Admin reads from Google Sheet
// Admin actions: Archive (Status->ARCHIVED) or Delete (remove row)
// Shows ONLY ACTIVE ideas in admin list (so archived clears from website list)

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // ✅ NEW FIXED Web App URL
  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbw1B9iFPa4T3S81Gft7EBwHYFzWKB1H6LeO-OrOvmuYpMmvJJnc-EV8wEqfmsNzumQllw/exec";

  // ---- ADMIN MODE ----
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  const isAdminMode = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  // Navbar links
  const adminNavLink = document.getElementById("adminNavLink");
  const exitAdminLink = document.getElementById("exitAdminLink");

  if (adminNavLink) adminNavLink.hidden = !isAdminMode;
  if (exitAdminLink) exitAdminLink.hidden = !isAdminMode;

  if (exitAdminLink) {
    exitAdminLink.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.href = "/ideas.html";
    });
  }

  // ---- PAGE ELEMENTS ----
  const form = document.getElementById("ideaForm");
  const messageArea = document.getElementById("messageArea");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");

  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  const ideaTitleEl = document.getElementById("ideaTitle");
  const ideaDescriptionEl = document.getElementById("ideaDescription");

  const onIdeasPage = !!(form || ownerSection || ideasList);
  if (!onIdeasPage) return;

  // ---- ADMIN HELPERS ----
  async function postAdminAction(action, id) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Missing Timestamp id.");
    }

    const body = new URLSearchParams({ action, id });

    await fetch(SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  }

  // ---- ADMIN VIEW ----
  async function renderIdeasFromSheet() {
    if (!ideasList) return;

    ideasList.innerHTML = "<li>Loading submissions...</li>";

    try {
      const res = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
      const data = await res.json();

      if (!data || data.success !== true) throw new Error("Bad response from sheet");

      const rows = Array.isArray(data.rows) ? data.rows : [];

      // ONLY ACTIVE rows
      const activeRows = rows.filter(
        (r) => String(r["Status"] || "").trim() === "ACTIVE"
      );

      if (activeRows.length === 0) {
        ideasList.innerHTML = "<li>No ACTIVE submissions.</li>";
        return;
      }

      ideasList.innerHTML = "";

      for (const r of activeRows) {
        const tsIso = String(r["Timestamp"] || "").trim();
        if (!tsIso) continue; // skip junk rows with no timestamp

        const li = document.createElement("li");
        li.style.marginBottom = "12px";

        const tsNice = new Date(tsIso).toLocaleString();
        const name = r["Name"] || "";
        const email = r["Email"] || "";
        const title = r["Idea Title"] || "";
        const desc = r["Idea Description"] || "";

        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="flex:1;">
              <strong>${title}</strong><br/>
              ${desc}<br/><br/>
              <small>${tsNice}${name ? " · " + name : ""}${email ? " · " + email : ""}</small>
              <div style="margin-top:6px; font-size:12px;">
                Status: <strong>ACTIVE</strong>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
              <button type="button" data-action="archive" style="padding:8px 12px; font-size:14px;">
                Archive
              </button>
              <button type="button" data-action="delete" style="padding:8px 12px; font-size:14px;">
                Delete
              </button>
            </div>
          </div>
        `;

        const archiveBtn = li.querySelector('button[data-action="archive"]');
        const deleteBtn = li.querySelector('button[data-action="delete"]');

        archiveBtn.addEventListener("click", async () => {
          const ok = window.confirm(
            "Archive this idea?\n\nThis removes it from the website list but keeps it in the Google Sheet."
          );
          if (!ok) return;

          archiveBtn.disabled = true;
          deleteBtn.disabled = true;

          try {
            await postAdminAction("archive", tsIso);
            // Refresh list (archived item disappears because it won't be ACTIVE)
            await renderIdeasFromSheet();
          } catch (err) {
            console.error(err);
            alert("Archive failed. Please try again.");
            archiveBtn.disabled = false;
            deleteBtn.disabled = false;
          }
        });

        deleteBtn.addEventListener("click", async () => {
          const ok = window.confirm(
            "Delete this idea?\n\nThis removes it from BOTH the website list and the Google Sheet.\nThis cannot be undone."
          );
          if (!ok) return;

          archiveBtn.disabled = true;
          deleteBtn.disabled = true;

          try {
            await postAdminAction("delete", tsIso);
            await renderIdeasFromSheet();
          } catch (err) {
            console.error(err);
            alert("Delete failed. Please try again.");
            archiveBtn.disabled = false;
            deleteBtn.disabled = false;
          }
        });

        ideasList.appendChild(li);
      }

      if (!ideasList.children.length) {
        ideasList.innerHTML = "<li>No ACTIVE submissions.</li>";
      }
    } catch (err) {
      console.error(err);
      ideasList.innerHTML = "<li>Failed to load submissions from Google Sheet.</li>";
    }
  }

  // ---- MODE SWITCH ----
  if (isAdminMode) {
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeasFromSheet();
    return;
  }

  // ---- PUBLIC SUBMIT ----
  if (ownerSection) ownerSection.style.display = "none";
  if (!form) return;

  const submitButton =
    form.querySelector('button[type="submit"]') || form.querySelector("button");
  const pageLoadedAt = Date.now();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot
    const gotcha = document.getElementById("website");
    if (gotcha && gotcha.value.trim() !== "") {
      if (messageArea) messageArea.textContent = "Submission blocked.";
      return;
    }

    // Time check
    if (Date.now() - pageLoadedAt < 2000) {
      if (messageArea) messageArea.textContent = "Please wait a moment.";
      return;
    }

    // Rate limit
    const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    if (Date.now() - lastSubmit < 30000) {
      if (messageArea) messageArea.textContent = "Please wait before submitting again.";
      return;
    }
    localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));

    const userName = userNameEl?.value.trim() || "";
    const userEmail = userEmailEl?.value.trim() || "";
    const title = ideaTitleEl?.value.trim() || "";
    const description = ideaDescriptionEl?.value.trim() || "";

    if (!userName || !userEmail || !title || !description) {
      if (messageArea) messageArea.textContent = "Please fill out all fields.";
      return;
    }

    if (messageArea) messageArea.textContent = "Submitting...";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      // 1) Google Sheet
      const body = new URLSearchParams({
        name: userName,
        email: userEmail,
        ideaTitle: title,
        ideaDescription: description,
      });

      await fetch(SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      // 2) Formspree emails
      const fsRes = await fetch("https://formspree.io/f/mykekkgg", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          ideaTitle: title,
          ideaDescription: description,
        }),
      });

      if (!fsRes.ok) throw new Error("Formspree HTTP " + fsRes.status);

      form.reset();
      if (messageArea) messageArea.textContent = "Great point!! Now lets win the set!";
    } catch (err) {
      console.error(err);
      if (messageArea) messageArea.textContent = "Submission failed.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Serve idea";
      }
    }
  });
});
