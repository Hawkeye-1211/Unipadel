// UniPadel app.js
// Modes:
// - /ideas.html                      => public ideas form
// - /ideas.html?admin=unipadelgold    => admin request (still requires device unlock)

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const STORAGE_KEY = "Unipadel_ideas";
  const ADMIN_UNLOCK_KEY = "Unipadel_admin_unlocked"; // localStorage flag

  const params = new URLSearchParams(window.location.search);
  const adminKeyFromUrl = params.get("admin");
  const isAdminUrl = adminKeyFromUrl === ADMIN_KEY;

  // Elements
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

  // Hide admin toggle everywhere (we don't use it)
  if (adminToggle) {
    adminToggle.style.setProperty("display", "none", "important");
    adminToggle.style.setProperty("visibility", "hidden", "important");
    adminToggle.style.setProperty("pointer-events", "none", "important");
  }

  // --- Admin unlock check ---
  function isDeviceUnlocked() {
    return localStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
  }

  function unlockDevice() {
    localStorage.setItem(ADMIN_UNLOCK_KEY, "true");
  }

  // If user hit admin URL but device isn't unlocked, prompt once.
  // (Still not "real security", but prevents casual guessing from granting access.)
  let isAdminMode = false;

  if (isAdminUrl) {
    if (isDeviceUnlocked()) {
      isAdminMode = true;
    } else {
      const ok = window.confirm("Admin access: Unlock this device?");
      if (ok) {
        unlockDevice();
        isAdminMode = true;
      } else {
        // If they cancel, drop to public mode (no admin list)
        isAdminMode = false;
      }
    }
  }

  // --- Apply modes ---
  if (isAdminMode) {
    document.body.classList.add("is-admin");

    // Hide form + message
    if (form) form.style.display = "none";
    if (messageArea) messageArea.style.display = "none";

    // Show admin list
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeas();
  } else {
    document.body.classList.remove("is-admin");

    // Hide admin list
    if (ownerSection) ownerSection.style.display = "none";

    // Show form (public)
    if (form) form.style.display = "block";
    if (messageArea) messageArea.style.display = "block";

    // Attach Formspree submit handler ONLY in public mode
    if (form) {
      const submitButton =
        form.querySelector('button[type="submit"]') || form.querySelector("button");

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

          await response.json().catch(() => {});
          if (messageArea) messageArea.textContent = "Great return!! Now lets win the set.";

          // Save to local history (for your admin view)
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
