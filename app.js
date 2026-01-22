const form = document.getElementById("ideaForm");
const messageArea = document.getElementById("messageArea");
const submitButton = form.querySelector("button");

const adminToggle = document.getElementById("adminToggle");
const ownerSection = document.querySelector(".owner-only");

const ideasList = document.getElementById("ideasList");
const STORAGE_KEY = "Unipadel_ideas";

const ADMIN_KEY = "unipadelgold";
const params = new URLSearchParams(window.location.search);
const isAdminUser = params.get("admin") === ADMIN_KEY;

// --- Admin visibility (default: hidden) ---
if (adminToggle && ownerSection) {
  if (isAdminUser) {
    adminToggle.style.display = "inline-block";
    adminToggle.textContent = "Exit Admin Mode";
    adminToggle.classList.add("admin-active");
    ownerSection.style.display = "block";
  } else {
    adminToggle.style.display = "none";
    ownerSection.style.display = "none";
  }

  adminToggle.addEventListener("click", function () {
    const currentlyVisible = ownerSection.style.display === "block";

    if (currentlyVisible) {
      ownerSection.style.display = "none";
      adminToggle.textContent = "Admin Mode";
      adminToggle.classList.remove("admin-active");
    } else {
      ownerSection.style.display = "block";
      adminToggle.textContent = "Exit Admin Mode";
      adminToggle.classList.add("admin-active");
    }
  });
}

// --- Local history helpers ---
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
    li.innerHTML = `<strong>${idea.title}</strong><br/>${idea.description}`;
    li.style.marginBottom = "12px";
    ideasList.appendChild(li);
  }
}

// Render saved ideas on load
renderIdeas();

// --- Form submit ---
form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = document.getElementById("ideaTitle").value.trim();
  const description = document.getElementById("ideaDescription").value.trim();

  if (!title || !description) {
    messageArea.textContent = "Please fill out both fields.";
    return;
  }

  messageArea.textContent = "Serving...";
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    console.log("API response:", data);

    messageArea.textContent =
      "Thanks for returning the point, Now lets win the Set.";

    // Save to local history + re-render list
    const ideas = loadIdeas();
    ideas.unshift({ title, description, createdAt: Date.now() });
    saveIdeas(ideas);
    renderIdeas();

    form.reset();
  } catch (err) {
    console.error(err);
    messageArea.textContent = "Fault, Second serve.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Serve idea";
  }
});