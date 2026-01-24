// UniPadel app.js
// Admin session persists for this browser session (sessionStorage).
// Enter admin once via: /ideas.html?admin=unipadelgold

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // ✅ Google Apps Script Web App (NEW, FRESH SHEET)
  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyanNpmtU6SYUqbx51mizw8vN7oCJza1rcQdzJUiaBx4jZT1jSu3vcq9ZNnIUlVYYQExw/exec";

  // --- ADMIN MODE HANDLING ---
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    history.replaceState({}, document.title, location.pathname);
  }

  const isAdminMode = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  const adminNavLink = document.getElementById("adminNavLink");
  const exitAdminLink = document.getElementById("exitAdminLink");

  if (adminNavLink) adminNavLink.hidden = !isAdminMode;
  if (exitAdminLink) exitAdminLink.hidden = !isAdminMode;

  if (exitAdminLink) {
    exitAdminLink.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      location.href = "/ideas.html";
    });
  }

  // --- PAGE ELEMENTS ---
  const form = document.getElementById("ideaForm");
  const messageArea = document.getElementById("messageArea");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");

  const onIdeasPage = !!(form || ownerSection || ideasList);
  if (!onIdeasPage) return;

  // --- ADMIN VIEW: LOAD FROM GOOGLE SHEET ---
  async function renderIdeasFromSheet() {
    ideasList.innerHTML = "<li>Loading submissions...</li>";

    try {
      const res = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
      const data = await res.json();

      if (!data.success) throw new Error("Sheet error");

      if (data.rows.length === 0) {
        ideasList.innerHTML = "<li>No submissions yet.</li>";
        return;
      }

      ideasList.innerHTML = "";

      data.rows.forEach((r) => {
        const li = document.createElement("li");

        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <div>
              <strong>${r["Idea Title"] || ""}</strong><br/>
              ${r["Idea Description"] || ""}<br/><br/>
              <small>
                ${r["Timestamp"] ? new Date(r["Timestamp"]).toLocaleString() : ""}
                ${r["Name"] ? " · " + r["Name"] : ""}
                ${r["Email"] ? " · " + r["Email"] : ""}
              </small>
              <div style="margin-top:6px; font-size:12px;">
                Status: <strong>${r["Status"] || "UNKNOWN"}</strong>
              </div>
            </div>
          </div>
        `;

        ideasList.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      ideasList.innerHTML = "<li>Failed to load submissions.</li>";
    }
  }

  // --- MODE SWITCH ---
  if (isAdminMode) {
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeasFromSheet();
    return;
  }

  // --- PUBLIC FORM SUBMIT ---
  if (ownerSection) ownerSection.style.display = "none";
  if (!form) return;

  const submitButton = form.querySelector("button");

  const pageLoadedAt = Date.now();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot
    const gotcha = document.getElementById("website");
    if (gotcha && gotcha.value.trim() !== "") return;

    // Too fast
    if (Date.now() - pageLoadedAt < 2500) {
      messageArea.textContent = "Please wait a moment before submitting.";
      return;
    }

    // Rate limit
    const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    if (Date.now() - lastSubmit < 30000) {
      messageArea.textContent = "Please wait before submitting again.";
      return;
    }
    localStorage.setItem(LAST_SUBMIT_KEY, Date.now());

    const userName = userNameEl?.value.trim() || "";
    const userEmail = userEmailEl?.value.trim() || "";
    const title = ideaTitleEl?.value.trim() || "";
    const description = ideaDescriptionEl?.value.trim() || "";

    if (!userName || !userEmail || !title || !description) {
      messageArea.textContent = "Please fill out all fields.";
      return;
    }

    submitButton.disabled = true;
    messageArea.textContent = "Submitting...";

    try {
      // 1️⃣ Google Sheet
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

      // 2️⃣ Formspree (emails)
      await fetch("https://formspree.io/f/mykekkgg", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          ideaTitle: title,
          ideaDescription: description,
        }),
      });

      form.reset();
      messageArea.textContent = "Idea served successfully!";
    } catch (err) {
      console.error(err);
      messageArea.textContent = "Submission failed. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });

  // Cache DOM refs
  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  const ideaTitleEl = document.getElementById("ideaTitle");
  const ideaDescriptionEl = document.getElementById("ideaDescription");
});
