// UniPadel app.js
// Public submits -> Google Sheet + Formspree emails
// Admin reads from Google Sheet
// Admin actions: Archive (Status->ARCHIVED) or Delete (remove row)
// Public view shows ACTIVE ideas + voting (Score) and sorts by Score

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // Local vote key namespace (per-device voting guard)
  const VOTE_KEY_PREFIX = "Unipadel_vote_";

  // ✅ Web App URL
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

  // Public ideas section (read-only + voting)
  const publicIdeasSection = document.getElementById("publicIdeasSection");
  const publicIdeasList = document.getElementById("publicIdeasList");

  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  const ideaSourceEl = document.getElementById("ideaSource"); // ✅ NEW
  const ideaTitleEl = document.getElementById("ideaTitle");
  const ideaDescriptionEl = document.getElementById("ideaDescription");

  const onIdeasPage = !!(form || ownerSection || ideasList || publicIdeasList);
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

  // ---- SHEET HELPERS ----
  async function fetchRowsFromSheet() {
    const res = await fetch(`${SHEET_WEB_APP_URL}?t=${Date.now()}`);
    const data = await res.json();
    if (!data || data.success !== true) throw new Error("Bad response from sheet");
    return Array.isArray(data.rows) ? data.rows : [];
  }

  async function postVote(id, delta) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Missing id");
    }
    const d = Number(delta);
    if (d !== 1 && d !== -1) throw new Error("Bad delta");

    const body = new URLSearchParams({
      action: "vote",
      id,
      delta: String(d),
    });

    // no-cors: we can't read response, but it will still execute
    await fetch(SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  }

  function getVoteState(id) {
    const up = localStorage.getItem(`${VOTE_KEY_PREFIX}${id}_up`) === "1";
    const down = localStorage.getItem(`${VOTE_KEY_PREFIX}${id}_down`) === "1";
    return { up, down };
  }

  function setVoteState(id, dir /* "up" | "down" | "" */) {
    localStorage.removeItem(`${VOTE_KEY_PREFIX}${id}_up`);
    localStorage.removeItem(`${VOTE_KEY_PREFIX}${id}_down`);
    if (dir === "up") localStorage.setItem(`${VOTE_KEY_PREFIX}${id}_up`, "1");
    if (dir === "down") localStorage.setItem(`${VOTE_KEY_PREFIX}${id}_down`, "1");
  }

  // ---- PUBLIC VIEW (CARDS + VOTING) ----
  async function renderPublicIdeasFromSheet() {
    if (!publicIdeasList) return;

    publicIdeasList.innerHTML =
      '<div style="opacity:.75; font-size:14px;">Loading ideas...</div>';

    try {
      const rows = await fetchRowsFromSheet();

      const activeRows = rows
        .filter((r) => String(r["Status"] || "").trim() === "ACTIVE")
        .filter((r) => String(r["Timestamp"] || "").trim() !== "");

      // Sort: Score desc, then newest
      activeRows.sort((a, b) => {
        const sa = Number(a["Score"] || 0);
        const sb = Number(b["Score"] || 0);
        if (sb !== sa) return sb - sa;

        const ta = Date.parse(String(a["Timestamp"] || "")) || 0;
        const tb = Date.parse(String(b["Timestamp"] || "")) || 0;
        return tb - ta;
      });

      const visible = activeRows.slice(0, 12);

      if (visible.length === 0) {
        publicIdeasList.innerHTML =
          '<div style="opacity:.75; font-size:14px;">No ideas yet — be the first to serve one 🎾</div>';
        return;
      }

      publicIdeasList.innerHTML = "";

      for (const r of visible) {
        const title = String(r["Idea Title"] || "").trim();
        const desc = String(r["Idea Description"] || "").trim();
        const tsIso = String(r["Timestamp"] || "").trim();
        const score = Number(r["Score"] || 0);

        const dateNice = (() => {
          const d = new Date(tsIso);
          return isNaN(d.getTime())
            ? ""
            : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        })();

        // Card
        const card = document.createElement("div");
        card.className = "public-idea-card";

        // Header row: title + vote controls
        const head = document.createElement("div");
        head.style.display = "flex";
        head.style.alignItems = "flex-start";
        head.style.justifyContent = "space-between";
        head.style.gap = "12px";

        const t = document.createElement("div");
        t.className = "public-idea-title";
        t.textContent = title || "Untitled idea";

        // Voting UI
        const voteWrap = document.createElement("div");
        voteWrap.style.display = "flex";
        voteWrap.style.flexDirection = "column";
        voteWrap.style.alignItems = "flex-end";
        voteWrap.style.gap = "6px";
        voteWrap.style.minWidth = "64px";

        const scoreEl = document.createElement("div");
        scoreEl.className = "public-idea-meta";
        scoreEl.style.marginTop = "0";
        scoreEl.style.opacity = "0.9";
        scoreEl.textContent = `Score: ${score}`;

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.gap = "6px";

        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.textContent = "▲";
        upBtn.style.padding = "6px 10px";
        upBtn.style.borderRadius = "10px";
        upBtn.style.fontWeight = "700";
        upBtn.style.lineHeight = "1";
        upBtn.style.width = "42px";

        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.textContent = "▼";
        downBtn.style.padding = "6px 10px";
        downBtn.style.borderRadius = "10px";
        downBtn.style.fontWeight = "700";
        downBtn.style.lineHeight = "1";
        downBtn.style.width = "42px";

        // Apply visual state (per-device)
        const state = getVoteState(tsIso);
        if (state.up) {
          upBtn.style.background = "#2F80ED";
        }
        if (state.down) {
          downBtn.style.background = "#1F2937";
          downBtn.style.border = "1px solid rgba(182,230,0,.35)";
        }

        // Vote logic:
        // - allow one active vote per idea per device (up OR down OR none)
        // - clicking same vote again removes it (delta reverses)
        async function handleVote(dir) {
          // prevent vote spam clicking
          upBtn.disabled = true;
          downBtn.disabled = true;

          try {
            const cur = getVoteState(tsIso);
            let netDelta = 0;
            let nextState = "";

            if (dir === "up") {
              if (cur.up) {
                // remove upvote
                netDelta = -1;
                nextState = "";
              } else if (cur.down) {
                // switch down -> up
                netDelta = 2;
                nextState = "up";
              } else {
                // add upvote
                netDelta = 1;
                nextState = "up";
              }
            }

            if (dir === "down") {
              if (cur.down) {
                // remove downvote
                netDelta = 1;
                nextState = "";
              } else if (cur.up) {
                // switch up -> down
                netDelta = -2;
                nextState = "down";
              } else {
                // add downvote
                netDelta = -1;
                nextState = "down";
              }
            }

            if (netDelta === 0) return;

            // optimistic UI
            const newScore = (Number(scoreEl.textContent.replace("Score:", "").trim()) || score) + netDelta;
            scoreEl.textContent = `Score: ${newScore}`;

            // save local vote state immediately
            setVoteState(tsIso, nextState);

            // send to backend
            await postVote(tsIso, netDelta > 0 ? 1 : -1);
            // If netDelta is +/-2 we must send twice (because backend accepts +1/-1 only)
            if (netDelta === 2) {
              await postVote(tsIso, 1);
            } else if (netDelta === -2) {
              await postVote(tsIso, -1);
            }

            // Re-render after a short delay to resort by new score
            setTimeout(() => {
              renderPublicIdeasFromSheet();
            }, 600);
          } catch (err) {
            console.error(err);
            alert("Vote failed. Please try again.");
          } finally {
            upBtn.disabled = false;
            downBtn.disabled = false;
          }
        }

        upBtn.addEventListener("click", () => handleVote("up"));
        downBtn.addEventListener("click", () => handleVote("down"));

        btnRow.appendChild(upBtn);
        btnRow.appendChild(downBtn);
        voteWrap.appendChild(btnRow);
        voteWrap.appendChild(scoreEl);

        head.appendChild(t);
        head.appendChild(voteWrap);
        card.appendChild(head);

        if (desc) {
          const d = document.createElement("div");
          d.className = "public-idea-desc";
          d.textContent = desc;
          card.appendChild(d);
        }

        if (dateNice) {
          const meta = document.createElement("div");
          meta.className = "public-idea-meta";
          meta.textContent = `Submitted · ${dateNice}`;
          card.appendChild(meta);
        }

        publicIdeasList.appendChild(card);
      }
    } catch (err) {
      console.error(err);
      publicIdeasList.innerHTML =
        '<div style="opacity:.75; font-size:14px;">Could not load ideas right now.</div>';
    }
  }

  // ---- ADMIN VIEW ----
  async function renderIdeasFromSheet() {
    if (!ideasList) return;

    ideasList.innerHTML = "<li>Loading submissions...</li>";

    try {
      const rows = await fetchRowsFromSheet();

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
        if (!tsIso) continue;

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
    if (publicIdeasSection) publicIdeasSection.style.display = "none";
    if (ownerSection) ownerSection.style.display = "block";
    renderIdeasFromSheet();
    return;
  }

  // ---- PUBLIC MODE ----
  if (ownerSection) ownerSection.style.display = "none";
  if (publicIdeasSection) publicIdeasSection.style.display = "block";
  renderPublicIdeasFromSheet();

  // ---- PUBLIC SUBMIT ----
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
    const source = ideaSourceEl?.value.trim() || ""; // ✅ NEW
    const title = ideaTitleEl?.value.trim() || "";
    const description = ideaDescriptionEl?.value.trim() || "";

    if (!userName || !userEmail || !source || !title || !description) {
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
        source, // ✅ NEW (maps to Sheet "Source" column)
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
          source, // ✅ NEW
        }),
      });

      if (!fsRes.ok) throw new Error("Formspree HTTP " + fsRes.status);

      form.reset();
      if (messageArea) messageArea.textContent = "Great point!! Now lets win the set!";

      setTimeout(() => {
        renderPublicIdeasFromSheet();
      }, 1200);
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
