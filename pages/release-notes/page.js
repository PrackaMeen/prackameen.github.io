const RELEASE_NOTES_URL = new URL("../../release-notes.json", import.meta.url).href;

function renderNotes(target, notes) {
  target.innerHTML = notes.map((note) => {
    const highlights = Array.isArray(note.highlights) ? note.highlights : [];
    const items = highlights.map((item) => `<li>${item}</li>`).join("");

    return `
      <article class="card note-card">
        <p class="note-meta">v${note.version} (${note.commit}) · ${note.date}</p>
        <h2>${note.title}</h2>
        <p class="note-summary">${note.businessSummary}</p>
        <ul>${items}</ul>
      </article>
    `;
  }).join("");
}

function renderFailure(target, message) {
  target.innerHTML = `
    <article class="card note-card" role="alert">
      <h2>Release notes unavailable</h2>
      <p>${message}</p>
    </article>
  `;
}

export function mountPage(context) {
  context.setTitle("Release Notes");

  const buildLabel = document.querySelector("#currentBuildLabel");
  const coverageAlert = document.querySelector("#coverageAlert");
  const releaseNotesList = document.querySelector("#releaseNotesList");

  buildLabel.textContent = `Current build: v${context.appVersion} (${context.appCommitShort})`;

  fetch(RELEASE_NOTES_URL).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load release notes (${response.status})`);
    }
    return response.json();
  }).then((payload) => {
    const notes = Array.isArray(payload?.items) ? payload.items : [];
    const ordered = [...notes].sort((a, b) => {
      if (a.version === b.version) {
        return String(b.date).localeCompare(String(a.date));
      }

      const aParts = String(a.version).split(".").map((n) => Number.parseInt(n, 10) || 0);
      const bParts = String(b.version).split(".").map((n) => Number.parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i += 1) {
        if (aParts[i] !== bParts[i]) {
          return bParts[i] - aParts[i];
        }
      }
      return 0;
    });

    renderNotes(releaseNotesList, ordered);

    const hasCurrentBuildNote = ordered.some((note) => {
      return note.version === context.appVersion && note.commit === context.appCommitShort;
    });

    if (!hasCurrentBuildNote) {
      coverageAlert.classList.remove("hidden");
      coverageAlert.innerHTML = `
        <h2>Missing note for current build</h2>
        <p>No release-notes entry found for v${context.appVersion} (${context.appCommitShort}). Add one to <code>release-notes.json</code>.</p>
      `;
    }
  }).catch((error) => {
    renderFailure(releaseNotesList, error.message);
  });

  return { dispose() {} };
}
