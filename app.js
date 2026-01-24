// UniPadel app.js
document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // ✅ NEW Apps Script Web App URL (tab-name-proof)
  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbx9bMvmKiGRo-x_rcVpVuETZv0V7tiN2y6-8ezfUgLBYeOHhEN212OS-Zd36pieJ16ENw/exec";

  // ---- ADMIN MODE ----
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

  // ---- ADMIN VIEW ----
  async function renderIdeasFromSheet() {
    if (!ideasList) return;

    ideasList.innerHTML = "<li>Loading submissions...</li>";

    try {
      const res = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
      const data = await res.json();

      if (!data || data.success !== true) throw new Error("Bad response");

      const rows = Array.isArray(data.rows) ? data.rows : [];

      if (rows.length === 0) {
        ideasList.innerHTML = "<li>No submissions yet.</li>";
        return;
      }

      ideasList.innerHTML = "";

      for (const r of rows) {
        const li = document.createElement("li");

        const ts = r["Timestamp"] ? new Date(r["Timestamp"]).toLocaleString() : "";
        const name = r["Name"] || "";
        const email = r["Email"] || "";
        const title = r["Idea Title"] || "";
        const desc = r["Idea Description"] || "";
        const status = r["Status"] || "";

        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <strong>${title}</strong><br/>
              ${desc}<br/><br/>
              <small>${ts}${name ? " · " + name : ""}${email ? " · " + email : ""}</small>
              ${status ? `<div style="margin-top:6px; font-size:12px;">Status: <strong>${status}</strong></div>` : ""}
            </div>
          </div>
        `;

        li.style.marginBottom = "12px";
        ideasList.appendChild(li);
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

  const submitButton = form.querySelector("button");
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

    if (submitButton) submitButton.disabled = true;
    if (messageArea) messageArea.textContent = "Submitting...";

    try {
      // 1) Google Sheet (force-send; we don't need to read response)
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

      // 2) Formspree (emails)
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
      if (messageArea) messageArea.textContent = "Idea submitted successfully!";
    } catch (err) {
      console.error(err);
      if (messageArea) messageArea.textContent = "Submission failed.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});
