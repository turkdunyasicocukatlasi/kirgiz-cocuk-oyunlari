// ==============================================================
//  TOKUZ KUMALAK – Construct 3 Ana Script (main.js)
//  Yönlendirici ve Ortak Ayarlar Modülü
// ==============================================================
"use strict";

import { baslatGirisSayfasi } from "./girisscript.js";
import { baslatOyun } from "./game.js";

// Ortak Çözünürlük Sabitleri
export const GAME_W = 1920;
export const GAME_H = 1080;

// Ortak ve Paylaşılan Ayarlar Nesnesi (Mutable)
export const gameSettings = {
    gameMode: "twoPlayers",    // "twoPlayers" veya "vsComputer"
    aiDifficulty: "easy",      // "easy" veya "hard"
    isLoaderActive: true       // Loader ekranı durumu
};

// Global Construct Runtime referansı
let _runtime = null;

// --------------------------------------------------------------
// PAYLAŞILAN SES UTILITY FONKSİYONLARI
// --------------------------------------------------------------
export function playRetroClick() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Retro 8-bit pop sesi (triangle wave, hızlı düşen frekans)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.06);

        osc.start();
        osc.stop(ctx.currentTime + 0.06);
    } catch (_) {}
}

// --------------------------------------------------------------
// TAM EKRAN KONTROLLERİ
// --------------------------------------------------------------
export function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Tam ekran hatasi: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
}

function _guncelleFullscreenButonlari() {
    if (typeof document === 'undefined') return;
    const isFS = !!document.fullscreenElement;
    const enterFSPath = "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z";
    const exitFSPath = "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z";
    const path = isFS ? exitFSPath : enterFSPath;
    
    const btnGame = document.querySelector('#game-btn-fullscreen svg path');
    if (btnGame) btnGame.setAttribute('d', path);
    const btnMenu = document.querySelector('#menu-btn-fullscreen svg path');
    if (btnMenu) btnMenu.setAttribute('d', path);
}

if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', _guncelleFullscreenButonlari);
}

// --------------------------------------------------------------
// GİRİŞ AÇILIŞ YÜKLEME EKRANI ()
// --------------------------------------------------------------
function _calistirLoader() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const startLoader = () => {
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', startLoader);
            return;
        }

        // Eğer zaten loader varsa ekleme
        if (document.getElementById('tokuz-loader')) return;

        // Stillendirme ekle
        const style = document.createElement('style');
        style.id = 'tokuz-loader-styles';
        style.innerHTML = `
            #tokuz-loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: #0b0f19;
                z-index: 999999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: sans-serif;
                transition: opacity 0.6s ease;
                opacity: 1;
            }
            .loader-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 28px;
            }
            .spinner-svg {
                width: 90px;
                height: 90px;
                fill: #ffffff;
                animation: spinRotate 1.2s infinite linear;
            }
            @keyframes spinRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .dot {
                opacity: 0.15;
                fill: #ffffff;
            }
            .dot-1 { opacity: 0.2; }
            .dot-2 { opacity: 0.3; }
            .dot-3 { opacity: 0.45; }
            .dot-4 { opacity: 0.6; }
            .dot-5 { opacity: 0.75; }
            .dot-6 { opacity: 0.9; }
            .dot-7 { opacity: 0.95; }
            .dot-8 { opacity: 1.0; }

            .loader-text {
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 2px;
                color: #fbbf24;
                text-shadow: 0 0 12px rgba(251, 191, 36, 0.4);
                text-transform: uppercase;
                text-align: center;
            }
            .loader-bar-bg {
                width: 340px;
                height: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.03);
                box-sizing: border-box;
            }
            .loader-bar-fill {
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #ea580c, #fbbf24);
                border-radius: 4px;
                box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
                transition: width 0.03s linear;
            }
        `;
        document.head.appendChild(style);

        // HTML Ekle
        const loader = document.createElement('div');
        loader.id = 'tokuz-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <svg class="spinner-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="15" r="5" class="dot dot-1" />
                    <circle cx="75" cy="25" r="5" class="dot dot-2" />
                    <circle cx="85" cy="50" r="5" class="dot dot-3" />
                    <circle cx="75" cy="75" r="5" class="dot dot-4" />
                    <circle cx="50" cy="85" r="5" class="dot dot-5" />
                    <circle cx="25" cy="75" r="5" class="dot dot-6" />
                    <circle cx="15" cy="50" r="5" class="dot dot-7" />
                    <circle cx="25" cy="25" r="5" class="dot dot-8" />
                </svg>
                <div class="loader-text">TOKUZ KUMALAK YÜKLENİYOR</div>
                <div class="loader-bar-bg">
                    <div class="loader-bar-fill" id="tokuz-loader-fill"></div>
                </div>
            </div>
        `;
        document.body.appendChild(loader);

        //  İlerleme Animasyonu (3000ms)
        const fill = loader.querySelector('#tokuz-loader-fill');
        const startTime = performance.now();
        const duration = 2000;

        function animLoader() {
            const elapsed = performance.now() - startTime;
            const pct = Math.min(elapsed / duration, 1.0);
            fill.style.width = (pct * 100) + '%';

            if (pct < 1.0) {
                requestAnimationFrame(animLoader);
            } else {
                // Yükleme bitti -> Pürüzsüzce yok et
                loader.style.opacity = '0';
                gameSettings.isLoaderActive = false; // Loader pasif yap
                setTimeout(() => {
                    loader.remove();
                    style.remove();
                    
                    // Giriş sayfası menüsünü görünür yap ve ölçekle
                    const menuOverlay = document.getElementById('tokuz-menu-overlay');
                    if (menuOverlay) {
                        menuOverlay.style.display = 'flex';
                        if (menuOverlay._onResize) menuOverlay._onResize();
                    }
                }, 600);
            }
        }
        requestAnimationFrame(animLoader);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLoader);
    } else {
        startLoader();
    }
}

_calistirLoader();

// --------------------------------------------------------------
// CONSTRUCT 3 GİRİŞ NOKTASI VE LAYOUT YÖNLENDİRİCİSİ
// --------------------------------------------------------------
runOnStartup(async runtime => {
    let currentLayoutName = "";
    
    runtime.addEventListener("tick", () => {
        try {
            const activeLayoutName = runtime.layout.name;
            if (activeLayoutName !== currentLayoutName) {
                currentLayoutName = activeLayoutName;
                _yonlendirLayout(runtime);
            }
        } catch(e) {
            console.error("[TK] Layout takip hatası:", e);
        }
    });
});

function _yonlendirLayout(runtime) {
    try {
        _runtime = runtime;
        const layoutName = runtime.layout.name;
        console.log("[TK] Layout baslatildi:", layoutName);

        // Oyun overlay'ini temizle (giriş sayfasında çizim yapmasın)
        const eski = document.getElementById('tokuz-overlay');
        if (eski) {
            eski.remove();
        }

        // Giriş sayfası overlay'ini ve stillerini temizle
        const eskiMenu = document.getElementById('tokuz-menu-overlay');
        if (eskiMenu) {
            if (eskiMenu._onResize) {
                window.removeEventListener('resize', eskiMenu._onResize);
            }
            eskiMenu.remove();
        }
        const eskiStyles = document.getElementById('tokuz-menu-styles');
        if (eskiStyles) {
            eskiStyles.remove();
        }

        // Oyun UI paneli ve stillerini temizle
        const eskiGameUI = document.getElementById('tokuz-game-ui');
        if (eskiGameUI) eskiGameUI.remove();
        const eskiGameStyles = document.getElementById('tokuz-game-styles');
        if (eskiGameStyles) eskiGameStyles.remove();

        if (layoutName === "girissayfa") {
            baslatGirisSayfasi(runtime);
        } else if (layoutName === "game") {
            baslatOyun(runtime);
        }
    } catch(e) {
        alert("[TK] _yonlendirLayout hatası: " + e.message + "\n" + e.stack);
    }
}
