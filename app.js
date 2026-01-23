// UniPadel app.js
// Behaviour:
// - /ideas.html                 => Ideas mode (form only)
// - /ideas.html?admin=unipadelgold => Admin mode (list + remove only)

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const STORAGE_KEY = "Unipadel_ideas";

  const params = new URLSearchParams(window.location.search);
  const isAdminUser = params.get("admin") === ADMIN_KEY;

  // Elements (may or may not exist on every page)
  const form = document.getElementById("ideaForm");
  const messageArea = document.getElementById("messageArea");
  const adminToggle = document.getElementById("adminToggle");
  const ownerSection = document.querySelector(".owner-only");
  const ideasList = document.getElementById("ideasList");

  // Helpers
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

  // --- MODE SWITCHING (Ideas vs Admin) ---
  // You said:
  // - Admin tab should ALWAYS be in admin mode (no toggle)
  // - Ideas tab should show ONLY the form (no admin UI)

  // Hide toggle everywhere (we don't need it anymore)
  if (adminToggle) {
    adminToggle.style.setProperty("display", "none", "important");
    adminToggle.style.setProperty("visibility", "hidden", "important");
    adminToggle.style.setProperty("pointer-events", "none", "important");
  }

  if (isAdminUser) {
    // ADMIN MODE
    document.body.classList.add("is-admin");

    // Hide form + message area
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";

    // Show owner/admin section and render saved ideas
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeas();
  } else {
    // IDEAS MODE (public)
    document.body.classList.remove("is-admin");

    // Hide admin section
    if (ownerSection) ownerSection.style.display = "none";

    // Ensure form is visible (if present)
    if (form) form.style.display = "block";
    if (messageArea) messageArea.style.display = "block";

    // Attach Formspree submit handler ONLY in Ideas mode
    if (form) {
      const submitButton = form.querySelector('button[type="submit"]') || form.querySelector("button");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

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
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              name: userName,
              email: userEmail,
              ideaTitle: title,
              ideaDescription: description,
            }),
          });

          if (!response.ok) throw new Error("HTTP " + response.status);

          // Formspree sometimes returns JSON; don't fail if it doesn't
          await response.json().catch(() => {});

          if (messageArea) messageArea.textContent = "Great return!! Now lets win the set.";

          // Save to local history (for admin view)
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
  }
});
