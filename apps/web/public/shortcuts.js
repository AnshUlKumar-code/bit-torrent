/**
 * Dashboard Keyboard Navigation & Accessibility Shortcuts
 * Contributed by @Amritesh786 (Frontend)
 */

document.addEventListener("keydown", (e) => {
    // Avoid triggering shortcuts while typing inside inputs or selects
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
        if (e.key === "Escape") {
            e.target.blur();
        }
        return;
    }

    switch (e.key.toLowerCase()) {
        case "d":
            // 'D' opens Download Torrent modal
            e.preventDefault();
            if (typeof openModal === "function") openModal("modal-download");
            break;

        case "s":
            // 'S' opens Start Seeding modal
            e.preventDefault();
            if (typeof openModal === "function") openModal("modal-seed");
            break;

        case "c":
            // 'C' opens Create .torrent modal
            e.preventDefault();
            if (typeof openModal === "function") openModal("modal-create");
            break;

        case "r":
            // 'R' triggers manual swarm status refresh
            e.preventDefault();
            if (typeof fetchTorrents === "function") fetchTorrents(true);
            break;

        case "escape":
            // Escape closes any open modal
            document.querySelectorAll(".modal-backdrop.active").forEach((m) => {
                m.classList.remove("active");
            });
            break;

        default:
            break;
    }
});

console.log("µTorrent Keyboard Shortcuts active: [D] Download | [S] Seed | [C] Create | [R] Refresh | [Esc] Close");
