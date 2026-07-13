const modal = document.getElementById("videoModal");
const player = document.getElementById("videoPlayer");
const closeButton = modal.querySelector(".close-button");
const bgAudio = document.getElementById("bgAudio");

let playlist = [];
let playlistIndex = 0;
let bgAudioStopped = false;

function startBackgroundAudio() {
    if (!bgAudio || bgAudioStopped) {
        return;
    }

    bgAudio.volume = 0.25;
    const playPromise = bgAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }
}

function stopBackgroundAudio() {
    if (!bgAudio) {
        return;
    }

    bgAudioStopped = true;
    bgAudio.pause();
    bgAudio.currentTime = 0;
}

function openVideo(sources) {
    stopBackgroundAudio();
    playlist = sources;
    playlistIndex = 0;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    playCurrentVideo();
}

function playCurrentVideo() {
    player.src = playlist[playlistIndex];
    player.load();

    const playPromise = player.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            player.controls = true;
        });
    }
}

function closeVideo() {
    player.pause();
    player.removeAttribute("src");
    player.load();
    playlist = [];
    playlistIndex = 0;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-video]").forEach((button) => {
    button.addEventListener("click", () => {
        const sources = button.dataset.video.split("|").filter(Boolean);
        openVideo(sources);
    });
});

document.querySelectorAll("a.asset-button").forEach((link) => {
    link.addEventListener("click", stopBackgroundAudio);
});

player.addEventListener("ended", () => {
    if (playlistIndex < playlist.length - 1) {
        playlistIndex += 1;
        playCurrentVideo();
    }
});

closeButton.addEventListener("click", closeVideo);

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        closeVideo();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeVideo();
    }
});

document.addEventListener("pointerdown", startBackgroundAudio, { once: true });
document.addEventListener("keydown", startBackgroundAudio, { once: true });
startBackgroundAudio();
