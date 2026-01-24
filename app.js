// UniPadel app.js
// Admin session persists for this browser session (sessionStorage).
// Enter admin once via: /ideas.html?admin=unipadelgold

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const STORAGE_KEY = "Unipadel_ideas";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";

  const params = new URLSearchParams(window.location.search);
  const urlAdminKey = params.get("admin");

  // Start/continue admin session if correct key is present in URL
  if (urlAdminKey === ADMIN_KEY) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  }

  const isAdminMode = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

  // Navbar links (exist on pages where you want them to appear)
  const adminNavLink = document.getElementById("adminNavLink");
  const exitAdminLink = document.getElementById("exitAdminLink");

  // Show/hide admin nav links based on session (works with `hidden` attribute)
  if (adminNavLink) adminNavLink.hidden = !isAdminMode;
  if (exitAdminLink) exitAdminLink.hidden = !isAdminMode;

  if (exitAdminLink) {
    exitAdminLink.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.href = "/ideas.html";
    });
  }

  // Page elements (only exist on ideas.html)
  const form = document.getElementById("ideaForm");
  const messageArea = document.getElementById("messageArea");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");
  // Spam protection: time-to-submit baseline
  const pageLoadedAt = Date.now();
  // Spam protection: simple per-browser rate limit
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // Set hidden timestamp field if it exists (ideas.html)
  const tsField = document.getElementById("submissionTs");
  if (tsField) tsField.value = String(pageLoadedAt);

  // If we’re not on ideas.html (no form, no list), stop here after nav handling
  // This is important so index.html doesn't throw errors.
  const onIdeasPage = !!(form || ownerSection || ideasList);
  if (!onIdeasPage) return;

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

  // --- MODE SWITCHING (ideas.html) ---
  if (isAdminMode) {
    // Admin: show list, hide form
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeas();
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
            // Spam protection: honeypot check (bots often fill hidden fields)
      const gotcha = document.getElementById("website");
      if (gotcha && gotcha.value.trim() !== "") {
        if (messageArea) messageArea.textContent = "Submission blocked.";
        return;
      }
      // Spam protection: block submissions that happen too fast (likely bots)
      if (Date.now() - pageLoadedAt < 2500) {
        if (messageArea) messageArea.textContent = "Please take a moment, then submit again.";
        return;
      }
  // Spam protection: rate limit (30 seconds between submits per browser)
  const lastSubmit = Number(localStorage.getItem(LAST_SUBMIT_KEY) || "0");
  if (lastSubmit && Date.now() - lastSubmit < 30000) {
    if (messageArea) messageArea.textContent = "You're submitting too quickly. Please wait a moment and try again.";
    return;
  }
  localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));

      const userName = document.getElementById("userName")?.value.trim() || "";
      const userEmail = document.getElementById("userEmail")?.value.trim() || "";
      const title = document.getElementById("ideaTitle")?.value.trim() || "";
      const description = document.getElementById("ideaDescription")?.value.trim() || "";

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

        if (!response.ok) throw new Error("HTTP " + response.status);

        await response.json().catch(() => {});
        if (messageArea) messageArea.textContent = "Great return!! Now lets win the set.";

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




