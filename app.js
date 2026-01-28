// UniPadel app.js
// Public submits -> Google Sheet + Formspree emails
// Admin reads from Google Sheet
// Admin actions: Archive (Status->ARCHIVED) or Delete (remove row)
// Public view shows ACTIVE ideas + voting (Score) and sorts by Score
// Admin triage: Category / Priority / Notes (action=triage) updates existing row
// ✅ Bulk selection (Step 1): checkboxes + select all + count (no bulk actions yet)

document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_KEY = "unipadelgold";
  const ADMIN_SESSION_KEY = "Unipadel_admin_session";
  const LAST_SUBMIT_KEY = "Unipadel_last_submit_ts";

  // Local vote key namespace (per-device voting guard)
  const VOTE_KEY_PREFIX = "Unipadel_vote_";

  // ✅ Live Web App URL (your current deployment)
  const SHEET_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbx_SbZlBKAPFOyAb_mbllCytQEKTpzn-bafaZ7RloDTXsRLmsXB9Bngjp_Dv_h-I2tGHA/exec";

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
  const ideaSourceEl = document.getElementById("ideaSource"); // may not exist
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

  // ✅ Admin triage update (no new rows)
  async function postTriage(id, category, priority, notes) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("Missing Timestamp id.");
    }

    const body = new URLSearchParams({
      action: "triage",
      id,
      category: String(category || ""),
      priority: String(priority || ""),
      notes: String(notes || ""),
    });

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

        const card = document.createElement("div");
        card.className = "public-idea-card";

        const head = document.createElement("div");
        head.style.display = "flex";
        head.style.alignItems = "flex-start";
        head.style.justifyContent = "space-between";
        head.style.gap = "12px";

        const t = document.createElement("div");
        t.className = "public-idea-title";
        t.textContent = title || "Untitled idea";

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

        const state = getVoteState(tsIso);
        if (state.up) upBtn.style.background = "#2F80ED";
        if (state.down) {
          downBtn.style.background = "#1F2937";
          downBtn.style.border = "1px solid rgba(182,230,0,.35)";
        }

        async function handleVote(dir) {
          upBtn.disabled = true;
          downBtn.disabled = true;

          try {
            const cur = getVoteState(tsIso);
            let netDelta = 0;
            let nextState = "";

            if (dir === "up") {
              if (cur.up) { netDelta = -1; nextState = ""; }
              else if (cur.down) { netDelta = 2; nextState = "up"; }
              else { netDelta = 1; nextState = "up"; }
            }

            if (dir === "down") {
              if (cur.down) { netDelta = 1; nextState = ""; }
              else if (cur.up) { netDelta = -2; nextState = "down"; }
              else { netDelta = -1; nextState = "down"; }
            }

            if (netDelta === 0) return;

            const currentScore = Number(scoreEl.textContent.replace("Score:", "").trim()) || score;
            scoreEl.textContent = `Score: ${currentScore + netDelta}`;

            setVoteState(tsIso, nextState);

            await postVote(tsIso, netDelta > 0 ? 1 : -1);
            if (netDelta === 2) await postVote(tsIso, 1);
            else if (netDelta === -2) await postVote(tsIso, -1);

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
      const activeRows = rows.filter((r) => String(r["Status"] || "").trim() === "ACTIVE");

      ideasList.innerHTML = "";

      // ✅ BULK SELECTION STATE (admin only)
      const selectedIds = new Set();

      function updateBulkHeader() {
        const countEl = document.getElementById("bulkSelectedCount");
        if (countEl) countEl.textContent = String(selectedIds.size);

        const allRowCbs = ideasList.querySelectorAll('input[data-bulk="row"]');
        const allChecked = allRowCbs.length > 0 && [...allRowCbs].every(cb => cb.checked);
        const selectAll = document.getElementById("bulkSelectAll");
        if (selectAll) selectAll.checked = allChecked;
      }

      function ensureNotEmptyMessage() {
        // skip the bulk header li (index 0)
        const ideaLis = [...ideasList.children].slice(1);
        if (ideaLis.length === 0) {
          ideasList.innerHTML = "<li>No ACTIVE submissions.</li>";
        }
      }

      // ✅ Bulk header row (selection only for now)
      const bulkLi = document.createElement("li");
      bulkLi.style.margin = "0 0 14px";
      bulkLi.style.padding = "10px 12px";
      bulkLi.style.borderRadius = "12px";
      bulkLi.style.border = "1px solid rgba(201,204,210,.18)";
      bulkLi.style.background = "rgba(15,22,34,.35)";
      bulkLi.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:10px; font-weight:700; font-size:14px;">
            <input type="checkbox" id="bulkSelectAll" />
            Select all
          </label>
          <div style="font-size:13px; opacity:.85;">
            Selected: <strong id="bulkSelectedCount">0</strong>
          </div>
        </div>
      `;
      ideasList.appendChild(bulkLi);

      const selectAllCb = bulkLi.querySelector("#bulkSelectAll");
      if (selectAllCb) {
        selectAllCb.addEventListener("change", () => {
          const checked = selectAllCb.checked;
          ideasList.querySelectorAll('input[data-bulk="row"]').forEach((cb) => {
            cb.checked = checked;
            cb.dispatchEvent(new Event("change"));
          });
        });
      }

      if (activeRows.length === 0) {
        ideasList.innerHTML = "<li>No ACTIVE submissions.</li>";
        return;
      }

      const categoryOptions = ["", "Bug", "UX", "Feature", "Performance", "Pricing"];
      const priorityOptions = ["", "Next", "Soon", "Later", "Won’t"];

      for (const r of activeRows) {
        const tsIso = String(r["Timestamp"] || "").trim();
        if (!tsIso) continue;

        const li = document.createElement("li");
        li.style.marginBottom = "14px";

        const tsNice = new Date(tsIso).toLocaleString();
        const name = r["Name"] || "";
        const email = r["Email"] || "";
        const title = r["Idea Title"] || "";
        const desc = r["Idea Description"] || "";

        const existingCategory = String(r["Category"] || "").trim();
        const existingPriority = String(r["Priority"] || "").trim();
        const existingNotes = String(r["Notes"] || "").trim();

        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="display:flex; gap:10px; align-items:flex-start; padding-top:2px;">
              <input type="checkbox" data-bulk="row" data-id="${tsIso}" style="margin-top:4px;" />
            </div>

            <div style="flex:1;">
              <strong>${title}</strong><br/>
              ${desc}<br/><br/>
              <small>${tsNice}${name ? " · " + name : ""}${email ? " · " + email : ""}</small>
              <div style="margin-top:6px; font-size:12px;">
                Status: <strong>ACTIVE</strong>
              </div>

              <div style="margin-top:10px; padding:10px; border:1px solid rgba(201,204,210,.18); border-radius:10px; background:rgba(15,22,34,.55);">
                <div style="font-size:12px; font-weight:700; opacity:.9; margin-bottom:8px;">Triage</div>

                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                  <label style="font-size:12px; opacity:.85;">Category</label>
                  <select data-triage="category" style="padding:8px 10px; border-radius:8px; background:rgba(15,22,34,.9); color:#E5E7EB; border:1px solid rgba(201,204,210,.3);">
                    ${categoryOptions.map(opt => {
                      const sel = (opt === existingCategory) ? "selected" : "";
                      const label = opt === "" ? "—" : opt;
                      return `<option value="${opt}" ${sel}>${label}</option>`;
                    }).join("")}
                  </select>

                  <label style="font-size:12px; opacity:.85;">Priority</label>
                  <select data-triage="priority" style="padding:8px 10px; border-radius:8px; background:rgba(15,22,34,.9); color:#E5E7EB; border:1px solid rgba(201,204,210,.3);">
                    ${priorityOptions.map(opt => {
                      const sel = (opt === existingPriority) ? "selected" : "";
                      const label = opt === "" ? "—" : opt;
                      return `<option value="${opt}" ${sel}>${label}</option>`;
                    }).join("")}
                  </select>
                </div>

                <div style="margin-top:10px;">
                  <label style="font-size:12px; opacity:.85;">Notes</label><br/>
                  <textarea data-triage="notes" rows="3" style="width:100%; margin-top:6px; padding:10px; border-radius:10px; background:rgba(15,22,34,.9); color:#E5E7EB; border:1px solid rgba(201,204,210,.3);">${existingNotes}</textarea>
                  <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                    <button type="button" data-action="save-triage" style="padding:8px 12px; font-size:14px;">
                      Save triage
                    </button>
                    <span data-triage="saved" style="font-size:12px; opacity:.75; align-self:center;"></span>
                  </div>
                </div>
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

        // ✅ bulk checkbox wiring
        const bulkCb = li.querySelector('input[data-bulk="row"]');
        if (bulkCb) {
          bulkCb.addEventListener("change", () => {
            const id = String(bulkCb.getAttribute("data-id") || "").trim();
            if (!id) return;

            if (bulkCb.checked) {
              selectedIds.add(id);
              li.style.outline = "2px solid rgba(182,230,0,.75)";
              li.style.borderRadius = "12px";
            } else {
              selectedIds.delete(id);
              li.style.outline = "none";
            }
            updateBulkHeader();
          });
        }

        const archiveBtn = li.querySelector('button[data-action="archive"]');
        const deleteBtn = li.querySelector('button[data-action="delete"]');
        const saveBtn = li.querySelector('button[data-action="save-triage"]');

        const categorySel = li.querySelector('select[data-triage="category"]');
        const prioritySel = li.querySelector('select[data-triage="priority"]');
        const notesEl = li.querySelector('textarea[data-triage="notes"]');
        const savedEl = li.querySelector('span[data-triage="saved"]');

        // --- triage "dirty" (unsaved changes) detection ---
        const initial = {
          category: existingCategory,
          priority: existingPriority,
          notes: existingNotes,
        };

        function setSaveBtnDirty(isDirty) {
          if (!saveBtn) return;
          if (isDirty) {
            saveBtn.style.background = "linear-gradient(180deg,#D9FF4F,#B6E600 55%,#8FBF00)";
            saveBtn.style.color = "#0B0F14";
            saveBtn.style.boxShadow = "0 14px 30px rgba(182,230,0,.25), inset 0 2px 0 rgba(255,255,255,.25)";
            saveBtn.style.borderRadius = "12px";
          } else {
            saveBtn.style.background = "#1F2937";
            saveBtn.style.color = "#E5E7EB";
            saveBtn.style.boxShadow = "none";
            saveBtn.style.borderRadius = "6px";
          }
        }

        function setSaveBtnSaving(isSaving) {
          if (!saveBtn) return;
          if (isSaving) {
            saveBtn.textContent = "Saving…";
            saveBtn.style.transform = "translateY(1px)";
            saveBtn.style.boxShadow = "inset 0 3px 10px rgba(0,0,0,.35)";
            saveBtn.style.opacity = "0.9";
            saveBtn.style.cursor = "wait";
          } else {
            saveBtn.textContent = "Save triage";
            saveBtn.style.transform = "";
            saveBtn.style.opacity = "";
            saveBtn.style.cursor = "";
          }
        }

        function computeDirty() {
          const c = categorySel ? String(categorySel.value || "").trim() : "";
          const p = prioritySel ? String(prioritySel.value || "").trim() : "";
          const n = notesEl ? String(notesEl.value || "") : "";
          return c !== initial.category || p !== initial.priority || n !== initial.notes;
        }

        function onTriageChanged() {
          setSaveBtnDirty(computeDirty());
          if (savedEl) savedEl.textContent = "";
        }

        if (categorySel) categorySel.addEventListener("change", onTriageChanged);
        if (prioritySel) prioritySel.addEventListener("change", onTriageChanged);
        if (notesEl) notesEl.addEventListener("input", onTriageChanged);

        setSaveBtnDirty(false);

        function setRowBusy(isBusy) {
          if (archiveBtn) archiveBtn.disabled = isBusy;
          if (deleteBtn) deleteBtn.disabled = isBusy;
          if (saveBtn) saveBtn.disabled = isBusy;
          if (bulkCb) bulkCb.disabled = isBusy;
        }

        archiveBtn.addEventListener("click", async () => {
          const ok = window.confirm(
            "Archive this idea?\n\nThis removes it from the website list but keeps it in the Google Sheet."
          );
          if (!ok) return;

          setRowBusy(true);

          try {
            await postAdminAction("archive", tsIso);

            // remove from bulk selection if selected
            if (selectedIds.has(tsIso)) selectedIds.delete(tsIso);
            li.remove();
            updateBulkHeader();
            ensureNotEmptyMessage();
          } catch (err) {
            console.error(err);
            alert("Archive failed. Please try again.");
            setRowBusy(false);
          }
        });

        deleteBtn.addEventListener("click", async () => {
          const ok = window.confirm(
            "Delete this idea?\n\nThis removes it from BOTH the website list and the Google Sheet.\nThis cannot be undone."
          );
          if (!ok) return;

          setRowBusy(true);

          try {
            await postAdminAction("delete", tsIso);

            if (selectedIds.has(tsIso)) selectedIds.delete(tsIso);
            li.remove();
            updateBulkHeader();
            ensureNotEmptyMessage();
          } catch (err) {
            console.error(err);
            alert("Delete failed. Please try again.");
            setRowBusy(false);
          }
        });

        if (saveBtn) {
          saveBtn.addEventListener("click", async () => {
            const category = categorySel ? categorySel.value : "";
            const priority = prioritySel ? prioritySel.value : "";
            const notes = notesEl ? notesEl.value : "";

            if (savedEl) savedEl.textContent = "";

            saveBtn.disabled = true;
            setSaveBtnSaving(true);

            try {
              await postTriage(tsIso, category, priority, notes);

              initial.category = String(category || "").trim();
              initial.priority = String(priority || "").trim();
              initial.notes = String(notes || "");

              setSaveBtnDirty(false);

              if (savedEl) savedEl.textContent = "Saved ✓";
              setTimeout(() => {
                if (savedEl) savedEl.textContent = "";
              }, 1500);
            } catch (err) {
              console.error(err);
              alert("Save failed. Please try again.");
              setSaveBtnDirty(true);
            } finally {
              setSaveBtnSaving(false);
              saveBtn.disabled = false;
            }
          });
        }

        ideasList.appendChild(li);
      }

      updateBulkHeader();
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
    const source = ideaSourceEl?.value.trim() || ""; // optional (depends on your HTML)
    const title = ideaTitleEl?.value.trim() || "";
    const description = ideaDescriptionEl?.value.trim() || "";

    // Keep your existing required fields (source may not exist on page)
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

        // source keys (compatible)
        source,
        ideaSource: source,
        Source: source,
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
          source,
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
