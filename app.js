// UniPadel app.js
// Admin session persists for this browser session (sessionStorage).
// Enter admin once via: /ideas.html?admin=unipadelgold

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const STORAGE_KEY = "Unipadel_ideas";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // Google Apps Script Web App (v2) - READ + WRITE
  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyrEN4Zp3GOaVSBPbs8cIY2g1kCcSnf83LQNtqRdhy48hDqo7MQh6nEYiHvMNd1jIfc/exec";

  const params = new URLSearchParams(window.location.search);
  const urlAdminKey = params.get("admin");

  // Start/continue admin session if correct key is present in URL
  if (urlAdminKey === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");

    // Clean the URL so reloads don't lose admin during dev
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
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

  // Page elements (ideas.html)
  const form = document.getElementById("ideaForm");
  const messageArea = document.getElementById("messageArea");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");

  // DEBUG (temporary): show JS errors on the page (helps mobile debugging)
  window.addEventListener("error", (e) => {
    if (ideasList) {
      ideasList.innerHTML = `<li style="white-space:pre-wrap;">JS error: ${e.message}</li>`;
    }
  });

  const onIdeasPage = !!(form || ownerSection || ideasList);
  if (!onIdeasPage) return;

  // Spam protection: time-to-submit baseline
  const pageLoadedAt = Date.now();

  function loadIdeas() {
    const raw = localStorage.getItem(STORAGE_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveIdeas(ideas) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
  }

  // Kept for stability (local cache). Not used for admin sheet view.
  function renderIdeas() {
    if (!ideasList) return;

    const ideas = loadIdeas();
    ideasList.innerHTML = "";

    for (const idea of ideas) {
      const li = document.createElement("li");

      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <strong>${idea.title}</strong><br/>
            ${idea.description}
          </div>

          <button type="button" data-id="${idea.createdAt}" style="padding:8px 12px; font-size:14px;">
            Remove
          </button>
        </div>
      `;

      const removeBtn = li.querySelector("button[data-id]");
      removeBtn.addEventListener("click", () => {
        const confirmed = window.confirm("Are you sure you want to remove this idea?");
        if (!confirmed) return;

        const idToRemove = Number(removeBtn.dataset.id);
        const updated = loadIdeas().filter((x) => x.createdAt !== idToRemove);
        saveIdeas(updated);
        renderIdeas();
      });

      li.style.marginBottom = "12px";
      ideasList.appendChild(li);
    }
  }

  // Admin view: render from Google Sheet (works on any device)
  async function renderIdeasFromSheet() {
    if (!ideasList) return;

    ideasList.innerHTML = "<li>Loading submissions...</li>";

    try {
      const res = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
      const data = await res.json();

      if (!data || data.success !== true) throw new Error("Bad response from sheet");

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

        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <strong>${title}</strong><br/>
              ${desc}<br/><br/>
              <small>${ts}${name ? " · " + name : ""}${email ? " · " + email : ""}</small>
            </div>
          </div>
        `;

        li.style.marginBottom = "12px";
        ideasList.appendChild(li);
      }
    } catch (err) {
      console.error(err);
      ideasList.innerHTML = "<li>Could not load submissions from Google Sheet.</li>";
    }
  }

  // MODE SWITCHING
  if (isAdminMode) {
    // Admin: show list, hide form
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";
    if (ownerSection) ownerSection.style.display = "block";

    // IMPORTANT: Admin reads from Google Sheet (not local)
    renderIdeasFromSheet();
  } else {
    // Public: hide list, show form
    if (ownerSection) ownerSection.style.display = "none";
    if (form) form.style.display = "block";
    if (messageArea) messageArea.style.display = "block";

    if (!form) return;

    const submitButton =
      form.querySelector('button[type="submit"]') || form.querySelector("button");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Spam: honeypot
      const gotcha = document.getElementById("website");
      if (gotcha && gotcha.value.trim() !== "") {
        if (messageArea) messageArea.textContent = "Submission blocked.";
        return;
      }

      // Spam: too fast
      if (Date.now() - pageLoadedAt < 2500) {
        if (messageArea)
          messageArea.textContent = "Please take a moment, then submit again.";
        return;
      }

      // Spam: rate limit 30s
      const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || "0");
      if (lastSubmit && Date.now() - lastSubmit < 30000) {
        if (messageArea)
          messageArea.textContent =
            "You're submitting too quickly. Please wait a moment and try again.";
        return;
      }
      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));

      const userName = document.getElementById("userName")?.value.trim() || "";
      const userEmail = document.getElementById("userEmail")?.value.trim() || "";
      const title = document.getElementById("ideaTitle")?.value.trim() || "";
      const description =
        document.getElementById("ideaDescription")?.value.trim() || "";

      if (!userName || !userEmail || !title || !description) {
        if (messageArea) messageArea.textContent = "Please fill out all fields.";
        return;
      }

      if (messageArea) messageArea.textContent = "Serving...";
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        // 1) Send to Google Sheet (non-blocking)
        try {
          const formBody = new URLSearchParams();
          formBody.append("name", userName);
          formBody.append("email", userEmail);
          formBody.append("ideaTitle", title);
          formBody.append("ideaDescription", description);

          await fetch(SHEET_WEB_APP_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: formBody.toString(),
          });
        } catch (sheetErr) {
          console.warn("Sheet submission failed:", sheetErr);
        }

        // 2) Send to Formspree (emails)
        const response = await fetch("https://formspree.io/f/mykekkgg", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: userName,
            email: userEmail,
            ideaTitle: title,
            ideaDescription: description,
          }),
        });

        if (!response.ok) throw new Error("Formspree HTTP " + response.status);

        await response.json().catch(() => {});
        if (messageArea)
          messageArea.textContent = "Great return!! Now lets win the set.";

        // Keep local cache (optional)
        const ideas = loadIdeas();
        ideas.unshift({ title, description, createdAt: Date.now() });
        saveIdeas(ideas);

        form.reset();
      } catch (err) {
        console.error(err);
        if (messageArea) messageArea.textContent = "Fault, Second serve.";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Serve idea";
        }
      }
    });
  }
});



