// ==============================================================
//  TOKUZ KUMALAK – Oyun Modülü (game.js)
// ==============================================================
"use strict";

import { gameSettings, playRetroClick, toggleFullscreen, GAME_W, GAME_H } from "./main.js";

// Gameplay Constants
const BASLANGIC_TAS = 9;
const LAYER_IDX     = 0;
const KUYU_YARICAP = 90;
const RING_DON_HIZI = 55;   // °/saniye
const HOVER_SURE    = 0.9;  // saniye
const TAS_R  = 11;   // Taş yarıçapı
const RING_R = 52;   // Sarı ring yarıçapı
const HOVER_R = 48;  // Hover spiral max yarıçapı
const TAS_OFFSET = [
    [-24, -22], [  0, -22], [ 24, -22],
    [-24,   0], [  0,   0], [ 24,   0],
    [-24,  22], [  0,  22], [ 24,  22]
];

// Gameplay State Variables
let kuyular     = Array(18).fill(BASLANGIC_TAS); // 0-8=P1, 9-17=P2
let hazineler   = { p1: 0, p2: 0 };
let tuzdikler   = { p1: null, p2: null };
let aktifOyuncu = 1;
let oyunBitti   = false;
let isAiThinking = false;
let isAnimating = false;
let activeFlyingStones = []; // [{x, y, scale, opacity}]
let kuyuSarsintilari   = Array(18).fill(0);
let hazineSarsintiP1   = 0;
let hazineSarsintiP2   = 0;
let tahtaSarsinti      = 0;
let infoText  = "";
let infoTimer = 0;
let _runtime    = null;
let tahtaY      = 540;
let ringAci    = 0;
let hoverKuyu  = -1;
let hoverTimer = 0;
let hoverAci   = 0;
let mouseX = 0;
let mouseY = 0;
let _ctx    = null;
let _overlay = null;
let eventsInitialized = false;

// --------------------------------------------------------------
// POZİSYON HESAPLAYICILAR
// --------------------------------------------------------------
function _getKuyuPoz(k) {
    if (!_runtime) return { x: 0, y: 0 };
    const tahta = _runtime.objects.tahta.getFirstInstance();
    if (!tahta) return { x: 0, y: 0 };
    const ip = k < 9 ? 3 + k : 12 + (k - 9);
    return { x: tahta.getImagePointX(ip), y: tahta.getImagePointY(ip) };
}

function _getHazinePoz(oyuncuNo) {
    if (!_runtime) return { x: 0, y: 0 };
    const tahta = _runtime.objects.tahta.getFirstInstance();
    if (!tahta) return { x: 0, y: 0 };
    const ip = oyuncuNo === 1 ? 1 : 2;
    return { x: tahta.getImagePointX(ip), y: tahta.getImagePointY(ip) };
}

// --------------------------------------------------------------
// SOUND SYNTHESISERS (Game Specific)
// --------------------------------------------------------------
function playRetroWhoosh() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Retro fırlatma/rüzgar sesi (sine wave, yükselen frekans)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
}

function playRetroChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Metalik çınlama (çiling) sesi için çift osilatör sentezi
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5 nota
        osc1.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.35);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1100, ctx.currentTime); // Metalik tını
        osc2.frequency.exponentialRampToValueAtTime(1550, ctx.currentTime + 0.35);
        
        gain.gain.setValueAtTime(0.24, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.38);
        osc2.stop(ctx.currentTime + 0.38);
    } catch (_) {}
}

// --------------------------------------------------------------
// GAME INITIALIZATION
// --------------------------------------------------------------
export function baslatOyun(runtime) {
    try {
        _runtime = runtime;
        const tahta = runtime.objects.tahta.getFirstInstance();
        if (!tahta) {
            alert("[TK] 'tahta' sprite bulunamadi!");
            return;
        }

        // Tahta varsayılan Y konumunu kilitle
        tahtaY = tahta.y;

        // HTML Canvas overlay oluştur (C3 canvas'ını DOM'dan güvenle bul)
        const gameCanvas = document.querySelector("canvas") || runtime.canvas;
        if (!gameCanvas) {
            alert("[TK] Canvas elementi bulunamadi!");
            return;
        }
        _olusturOverlay(gameCanvas);
        if (!_ctx) {
            alert("[TK] Canvas context (2D) olusturulamadi!");
            return;
        }

        // Oyun İçi Butonları Başlat
        _baslatGameUI(runtime, gameCanvas);

        // Olayları bağla
        _olaylariAyarla(runtime);

        console.log("[TK] Oyun baslatildi. Oyuncu 1'in sirasi.");
    } catch(e) {
        alert("[TK] _baslatOyun hatası: " + e.message + "\n" + e.stack);
    }
}

// --------------------------------------------------------------
// HTML CANVAS OVERLAY (C3 canvas üzerine tam kaplar)
// --------------------------------------------------------------
function _olusturOverlay(gameCanvas) {
    // Önceki overlay varsa kaldır
    const eski = document.getElementById('tokuz-overlay');
    if (eski) eski.remove();

    const rect = gameCanvas.getBoundingClientRect();

    _overlay = document.createElement('canvas');
    _overlay.id = 'tokuz-overlay';
    _overlay.width  = GAME_W;
    _overlay.height = GAME_H;

    // CSS boyutu: C3 canvas ile aynı konuma ve boyuta otur
    _konumla(rect);

    _overlay.style.pointerEvents = 'none'; // mouse'u geçir, C3 halletsin
    _overlay.style.zIndex = '999';
    _overlay.style.imageRendering = 'auto';

    document.body.appendChild(_overlay);
    _ctx = _overlay.getContext('2d');

    // Pencere boyutu değişince yeniden konumla
    window.addEventListener('resize', () => {
        _konumla(gameCanvas.getBoundingClientRect());
    });

    console.log("[TK] Overlay canvas olusturuldu:", rect.width.toFixed(0), 'x', rect.height.toFixed(0),
                'at (', rect.left.toFixed(0), ',', rect.top.toFixed(0), ')');
}

function _konumla(rect) {
    if (!_overlay) return;
    _overlay.style.position = 'fixed';
    _overlay.style.left   = rect.left   + 'px';
    _overlay.style.top    = rect.top    + 'px';
    _overlay.style.width  = rect.width  + 'px';
    _overlay.style.height = rect.height + 'px';
}

function _baslatGameUI(runtime, gameCanvas) {
    // Eski butonlar varsa temizle
    const eskiGameUI = document.getElementById('tokuz-game-ui');
    if (eskiGameUI) eskiGameUI.remove();
    const eskiGameStyles = document.getElementById('tokuz-game-styles');
    if (eskiGameStyles) eskiGameStyles.remove();

    // Stillendirme ekle
    const style = document.createElement('style');
    style.id = 'tokuz-game-styles';
    style.innerHTML = `
        #tokuz-game-ui {
            position: fixed;
            z-index: 10005;
            pointer-events: none; /* Tıklamayı altındaki tuvale geçirmek için */
        }
        .game-ui-btn {
            position: absolute;
            width: 80px;
            height: 80px;
            border-radius: 20px;
            border: 2.5px solid #d97706; /* Altın rengi kenarlık */
            background: rgba(22, 28, 38, 0.9);
            color: #94a3b8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            outline: none;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 15px rgba(217, 119, 6, 0.15);
            backdrop-filter: blur(10px);
            pointer-events: auto; /* Kendisine tıklanabilsin */
            box-sizing: border-box;
        }
        #game-btn-home {
            left: 1785px; /* Center x = 1825 (1825 - 40) */
            top: 41px;    /* Center y = 81 (81 - 40) */
        }
        #game-btn-refresh {
            left: 1785px; /* Center x = 1825 (1825 - 40) */
            top: 141px;   /* Center y = 181 (181 - 40) */
        }
        #game-btn-fullscreen {
            left: 1785px; /* Center x = 1825 (1825 - 40) */
            top: 241px;   /* Center y = 281 (281 - 40) */
        }
        .game-ui-btn svg {
            width: 36px;
            height: 36px;
            fill: currentColor;
            transition: transform 0.25s ease;
        }
        .game-ui-btn:hover {
            color: #fbbf24;
            border-color: #fb923c;
            background: #29211c;
            box-shadow: 0 12px 30px rgba(217, 119, 6, 0.4), 0 0 25px rgba(217, 119, 6, 0.2);
            transform: scale(1.08);
        }
        .game-ui-btn:active {
            transform: scale(0.92);
        }
    `;
    document.head.appendChild(style);

    // Panel oluştur
    const uiPanel = document.createElement('div');
    uiPanel.id = 'tokuz-game-ui';
    uiPanel.innerHTML = `
        <button class="game-ui-btn" id="game-btn-home" title="Anasayfa">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        <button class="game-ui-btn" id="game-btn-refresh" title="Yeniden Başlat">
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
        <button class="game-ui-btn" id="game-btn-fullscreen" title="Tam Ekran">
            <svg viewBox="0 0 24 24"><path d="${(typeof document !== 'undefined' && document.fullscreenElement) ? 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z' : 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'}"/></svg>
        </button>
    `;
    document.body.appendChild(uiPanel);

    // Buton Eylemleri
    const btnHome = uiPanel.querySelector('#game-btn-home');
    const btnRefresh = uiPanel.querySelector('#game-btn-refresh');
    const btnFullscreen = uiPanel.querySelector('#game-btn-fullscreen');

    btnHome.addEventListener('click', () => {
        playRetroClick();
        
        // Önce kendi elementlerini temizle
        uiPanel.remove();
        style.remove();
        
        // Giriş sayfasına yönlendir
        if (typeof runtime.goToLayout === "function") {
            runtime.goToLayout("girissayfa");
        }
    });

    btnRefresh.addEventListener('click', () => {
        playRetroClick();
        globalThis.TokuzKumalak.yenidenBaslat(runtime);
    });

    btnFullscreen.addEventListener('click', () => {
        playRetroClick();
        toggleFullscreen();
    });

    // İlk konumlamayı tetikle
    const updateUiPos = () => {
        const rect = gameCanvas.getBoundingClientRect();
        const scale = rect.width / 1920;
        uiPanel.style.left = rect.left + 'px';
        uiPanel.style.top = rect.top + 'px';
        uiPanel.style.width = '1920px';
        uiPanel.style.height = '1080px';
        uiPanel.style.transform = `scale(${scale})`;
        uiPanel.style.transformOrigin = 'top left';
    };
    
    updateUiPos();
}

// --------------------------------------------------------------
// EVENT REGISTER (Mouse & Keyboard & Tick Loop)
// --------------------------------------------------------------
function _olaylariAyarla(runtime) {
    if (eventsInitialized) return;
    eventsInitialized = true;

    window.addEventListener("pointermove", e => {
        if (runtime.layout.name !== "game") return;
        const layer = runtime.layout.getLayer(LAYER_IDX);
        if (!layer) return;
        try {
            const [lx, ly] = layer.cssPxToLayer(e.clientX, e.clientY);
            mouseX = lx; mouseY = ly;
            _hoverKontrol();
        } catch (_) {}
    });

    window.addEventListener("pointerdown", e => {
        if (runtime.layout.name !== "game") return;
        if (oyunBitti) return;
        const layer = runtime.layout.getLayer(LAYER_IDX);
        if (!layer) return;
        try {
            const [wx, wy] = layer.cssPxToLayer(e.clientX, e.clientY);
            _kuyuTiklandi(wx, wy);
        } catch (_) {}
    });

    window.addEventListener("keydown", e => {
        if (runtime.layout.name !== "game") return;
        if (e.key.toLowerCase() === 'r') {
            globalThis.TokuzKumalak.yenidenBaslat(runtime);
        }
    });

    // Her kare: animasyon güncelle + çiz
    runtime.addEventListener("tick", () => {
        if (runtime.layout.name !== "game" || !_ctx) return;
        
        // Dinamik olarak overlay boyutunu/konumunu C3 canvas ile senkronize et
        try {
            const canvas = document.querySelector('canvas') || runtime.canvas;
            if (canvas && _overlay) {
                const rect = canvas.getBoundingClientRect();
                if (_overlay.style.width !== rect.width + 'px' || 
                    _overlay.style.height !== rect.height + 'px' ||
                    _overlay.style.left !== rect.left + 'px' ||
                    _overlay.style.top !== rect.top + 'px') {
                    _konumla(rect);
                }
            }

            const uiPanel = document.getElementById('tokuz-game-ui');
            if (canvas && uiPanel) {
                const rect = canvas.getBoundingClientRect();
                const scale = rect.width / 1920;
                uiPanel.style.left = rect.left + 'px';
                uiPanel.style.top = rect.top + 'px';
                uiPanel.style.width = '1920px';
                uiPanel.style.height = '1080px';
                uiPanel.style.transform = `scale(${scale})`;
                uiPanel.style.transformOrigin = 'top left';
            }
        } catch(e) {
            console.error("[TK] Konum/UI senkronizasyon hatası:", e);
        }

        try {
            _guncelle(runtime.dt);
            _ciz();
        } catch(e) {
            console.error("[TK] Çizim hatası:", e);
        }

        // AI Hamlesi tetikleme
        if (gameSettings.gameMode === "vsComputer" && aktifOyuncu === 2 && !isAnimating && !oyunBitti && !isAiThinking) {
            isAiThinking = true;
            _bilgisayarHamlesi().finally(() => {
                isAiThinking = false;
            });
        }
    });
}

// --------------------------------------------------------------
// FRAME UPDATE LOGIC
// --------------------------------------------------------------
function _guncelle(dt) {
    ringAci = (ringAci + RING_DON_HIZI * dt) % 360;
    if (hoverKuyu >= 0) {
        hoverTimer += dt;
        hoverAci = (hoverAci + RING_DON_HIZI * 1.8 * dt) % 360;
    }

    // Kuyu sarsıntılarını zamanla sönümlendir (esneklik)
    for (let i = 0; i < 18; i++) {
        if (kuyuSarsintilari[i] > 0) {
            kuyuSarsintilari[i] = Math.max(0, kuyuSarsintilari[i] - dt * 35);
        }
    }

    // Hazine sarsıntılarını zamanla sönümlendir
    if (hazineSarsintiP1 > 0) hazineSarsintiP1 = Math.max(0, hazineSarsintiP1 - dt * 45);
    if (hazineSarsintiP2 > 0) hazineSarsintiP2 = Math.max(0, hazineSarsintiP2 - dt * 45);

    // Tahta genel sarsıntısını sönümlendir
    if (tahtaSarsinti > 0) {
        tahtaSarsinti = Math.max(0, tahtaSarsinti - dt * 40);
        const tahtaInst = _runtime.objects.tahta.getFirstInstance();
        if (tahtaInst) {
            const offset = Math.sin(performance.now() * 0.08) * tahtaSarsinti;
            tahtaInst.y = tahtaY + offset;
        }
    } else {
        const tahtaInst = _runtime.objects.tahta.getFirstInstance();
        if (tahtaInst && tahtaInst.y !== tahtaY) {
            tahtaInst.y = tahtaY;
        }
    }

    // Bilgi paneli sayacını düşür
    if (infoTimer > 0) {
        infoTimer -= dt;
        if (infoTimer <= 0) infoText = "";
    }
}

// --------------------------------------------------------------
// CANVAS RENDERING
// --------------------------------------------------------------
function _ciz() {
    const ctx = _ctx;
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    _cizRingler(ctx);

    for (let k = 0; k < 18; k++) {
        _cizTuzdikGlow(ctx, k);
    }

    _cizTaslar(ctx);
    _cizUcanTaslar(ctx);
    _cizTumBadgeler(ctx);

    if (hoverKuyu >= 0) _cizHoverSpiral(ctx, hoverKuyu);

    _cizHazineler(ctx);
    _cizArayuz(ctx);
}

function _cizRingler(ctx) {
    const bas = aktifOyuncu === 1 ? 0  : 9;
    const bit = aktifOyuncu === 1 ? 9  : 18;

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth   = 3;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = 'rgba(245,158,11,0.75)';

    for (let k = bas; k < bit; k++) {
        if (kuyular[k] === 0) continue;
        if (tuzdikler.p1 === k || tuzdikler.p2 === k) continue;

        const p = _getKuyuPoz(k);
        const sarsintiY = Math.sin(performance.now() * 0.06) * kuyuSarsintilari[k];

        ctx.save();
        ctx.translate(p.x, p.y + sarsintiY);
        ctx.rotate(ringAci * Math.PI / 180);
        ctx.setLineDash([14, 9]);
        ctx.beginPath();
        ctx.arc(0, 0, RING_R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function _cizTaslar(ctx) {
    for (let k = 0; k < 18; k++) {
        const adet = kuyular[k];
        if (adet === 0) continue;

        const p    = _getKuyuPoz(k);
        const sarsintiY = Math.sin(performance.now() * 0.06) * kuyuSarsintilari[k];
        const isHovered = (k === hoverKuyu);

        const cizSay = Math.min(adet, 9);
        for (let t = 0; t < cizSay; t++) {
            const off = TAS_OFFSET[t];
            let tx = p.x + off[0];
            let ty = p.y + off[1] + sarsintiY;

            if (isHovered) {
                const wobbleTime = performance.now() * 0.015;
                tx += Math.sin(wobbleTime + t * 1.5) * 3;
                ty += Math.cos(wobbleTime + t * 1.5) * 3;
            }

            _cizTas(ctx, tx, ty, TAS_R);
        }

        if (adet > 9) {
            ctx.save();
            ctx.font = 'bold 18px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 4; ctx.shadowColor = '#000';
            ctx.fillText('+' + (adet - 9), p.x + 30, p.y - 30 + sarsintiY);
            ctx.restore();
        }
    }
}

function _cizTumBadgeler(ctx) {
    for (let k = 0; k < 18; k++) {
        const adet = kuyular[k];
        const p    = _getKuyuPoz(k);
        const sarsintiY = Math.sin(performance.now() * 0.06) * kuyuSarsintilari[k];
        const cx = p.x;
        const cy = p.y + sarsintiY;

        _cizSayacBadge(ctx, cx, cy, adet, k);

        const isP1Tuzdik = (tuzdikler.p1 === k);
        const isP2Tuzdik = (tuzdikler.p2 === k);
        
        if (isP1Tuzdik || isP2Tuzdik) {
            const color = isP1Tuzdik ? '#00f0ff' : '#00ff66';
            ctx.save();
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
            ctx.fillText('TUZDIK', cx, cy - RING_R - 18);
            ctx.restore();
        }
    }
}

function _cizTuzdikGlow(ctx, k) {
    const isP1Tuzdik = (tuzdikler.p1 === k);
    const isP2Tuzdik = (tuzdikler.p2 === k);
    if (!isP1Tuzdik && !isP2Tuzdik) return;

    const p = _getKuyuPoz(k);
    const sarsintiY = Math.sin(performance.now() * 0.06) * kuyuSarsintilari[k];
    const cx = p.x;
    const cy = p.y + sarsintiY;

    ctx.save();
    const color = isP1Tuzdik ? '#00f0ff' : '#00ff66';
    ctx.fillStyle = isP1Tuzdik ? 'rgba(0, 240, 255, 0.16)' : 'rgba(0, 255, 102, 0.16)';
    
    ctx.beginPath();
    ctx.ellipse(cx, cy, 46, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 46, 56, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function _cizUcanTaslar(ctx) {
    ctx.save();
    for (const st of activeFlyingStones) {
        if (st.opacity <= 0) continue;
        ctx.globalAlpha = st.opacity;
        _cizTas(ctx, st.x, st.y, TAS_R * st.scale);
    }
    ctx.restore();
}

function _cizTas(ctx, cx, cy, r) {
    const grad = ctx.createRadialGradient(
        cx - r * 0.33, cy - r * 0.33, r * 0.05,
        cx, cy, r
    );
    grad.addColorStop(0,   '#ffffff');
    grad.addColorStop(0.4, '#e2e8f0');
    grad.addColorStop(1,   '#64748b');

    ctx.save();
    ctx.shadowBlur  = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillStyle   = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function _cizSayacBadge(ctx, cx, cy, sayi, k) {
    const bx = cx + RING_R * 0.70;
    const by = cy - RING_R * 0.70;
    const br = 22;

    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle   = sayi === 0 ? 'rgba(39,39,42,0.9)' : 'rgba(15,23,42,0.92)';
    ctx.shadowBlur  = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = sayi === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.shadowBlur  = 0;
    ctx.stroke();

    ctx.font         = 'bold 23px sans-serif';
    ctx.fillStyle    = sayi === 0 ? '#a1a1aa' : '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(sayi), bx, by);

    ctx.restore();
}

function _cizHoverSpiral(ctx, k) {
    const p = _getKuyuPoz(k);
    const sarsintiY = Math.sin(performance.now() * 0.06) * kuyuSarsintilari[k];

    ctx.save();
    ctx.translate(p.x, p.y + sarsintiY);
    ctx.rotate(hoverAci * Math.PI / 180);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.8;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.setLineDash([11, 8]);

    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 56, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function _cizHazineler(ctx) {
    const dp1 = _getHazinePoz(1);
    const dp2 = _getHazinePoz(2);
    if (!dp1 || !dp2) return;
    
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 8;
    ctx.shadowColor  = '#000';

    const p1Offset = Math.sin(performance.now() * 0.08) * hazineSarsintiP1;
    ctx.font      = 'bold 72px sans-serif';
    ctx.fillStyle = '#ebd2a9';
    ctx.fillText(String(hazineler.p1), dp1.x, dp1.y + p1Offset);

    const p2Offset = Math.sin(performance.now() * 0.08) * hazineSarsintiP2;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(String(hazineler.p2), dp2.x, dp2.y + p2Offset);

    ctx.restore();
}

function _cizArayuz(ctx) {
    ctx.save();
    ctx.textBaseline = 'middle';

    if (!oyunBitti) {
        ctx.font      = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        
        if (aktifOyuncu === 1) {
            ctx.fillStyle = '#ebd2a9';
            ctx.fillText("SIRA: OYUNCU 1", GAME_W / 2, 60);
        } else {
            ctx.fillStyle = '#fbbf24';
            const siraMetni = gameSettings.gameMode === "vsComputer" ? "SIRA: BİLGİSAYAR 🤖" : "SIRA: OYUNCU 2";
            ctx.fillText(siraMetni, GAME_W / 2, 60);
        }

        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText("Yeniden Başlatmak İçin 'R' Tuşuna Basın", GAME_W / 2, GAME_H - 40);

        if (infoText && infoTimer > 0) {
            ctx.save();
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            
            const opacity = Math.min(1.0, infoTimer * 2.0);
            ctx.globalAlpha = opacity;

            const textWidth = ctx.measureText(infoText).width;
            const padX = 28;
            const padY = 14;
            const rx = 960 - textWidth / 2 - padX;
            const ry = 988 - 22 - padY;
            const rw = textWidth + padX * 2;
            const rh = 44 + padY * 2;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, 22);
            ctx.fill();

            ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(infoText, 960, 988);
            ctx.restore();
        }
    } else {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        ctx.font      = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(251,191,36,0.5)';
        
        const k = hazineler.p1 > hazineler.p2 ? "OYUNCU 1 KAZANDI! 👑" 
                : hazineler.p2 > hazineler.p1 ? (gameSettings.gameMode === "vsComputer" ? "BİLGİSAYAR KAZANDI! 🤖" : "OYUNCU 2 KAZANDI! 👑") 
                : "BERABERE!";
                
        ctx.fillText("OYUN BİTTİ", GAME_W / 2, GAME_H / 2 - 40);
        
        ctx.font      = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(k, GAME_W / 2, GAME_H / 2 + 20);

        ctx.font      = '20px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText("Yeniden Başlamak İçin 'R' Tuşuna Basın", GAME_W / 2, GAME_H / 2 + 90);
    }

    ctx.restore();
}

// --------------------------------------------------------------
// GAME INTERACTIONS AND SOWING LOGIC
// --------------------------------------------------------------
function _hoverKontrol() {
    const bas = aktifOyuncu === 1 ? 0  : 9;
    const bit = aktifOyuncu === 1 ? 9  : 18;

    let enYakin = -1, enMesafe = KUYU_YARICAP;
    for (let k = bas; k < bit; k++) {
        if (kuyular[k] === 0) continue;
        if (tuzdikler.p1 === k || tuzdikler.p2 === k) continue;
        const p = _getKuyuPoz(k);
        const d = Math.hypot(mouseX - p.x, mouseY - p.y);
        if (d < enMesafe) { enMesafe = d; enYakin = k; }
    }

    if (enYakin !== hoverKuyu) {
        hoverKuyu  = enYakin;
        hoverTimer = 0;
        hoverAci   = 0;
    }
}

function _kuyuTiklandi(wx, wy) {
    if (isAnimating) return;
    const bas = aktifOyuncu === 1 ? 0  : 9;
    const bit = aktifOyuncu === 1 ? 9  : 18;

    for (let k = bas; k < bit; k++) {
        if (kuyular[k] === 0) continue;
        if (tuzdikler.p1 === k || tuzdikler.p2 === k) continue;
        const p = _getKuyuPoz(k);
        const d = Math.hypot(wx - p.x, wy - p.y);
        if (d < KUYU_YARICAP) {
            hamleYapAnimasyonlu(k);
            return;
        }
    }
}

async function hamleYapAnimasyonlu(secilenKuyu) {
    if (isAnimating || oyunBitti) return;
    isAnimating = true;

    const taslar = kuyular[secilenKuyu];
    if (taslar === 0) { isAnimating = false; return; }

    const startPos = _getKuyuPoz(secilenKuyu);
    const sowingStones = [];

    const hareketAdet = taslar === 1 ? 1 : taslar - 1;
    kuyular[secilenKuyu] = taslar === 1 ? 0 : 1;

    for (let i = 0; i < hareketAdet; i++) {
        const off = TAS_OFFSET[Math.min(i, 8)];
        sowingStones.push({
            x: startPos.x + off[0],
            y: startPos.y + off[1],
            scale: 1.0,
            opacity: 1.0
        });
    }
    activeFlyingStones = sowingStones;

    // 1. FAZ: HAVAYA HAFİF YÜKSELME (Levitation)
    let liftDuration = 250;
    let startTime = performance.now();
    
    playRetroWhoosh();

    while (performance.now() - startTime < liftDuration) {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / liftDuration, 1.0);
        const ease = progress * (2 - progress);

        for (const st of sowingStones) {
            st.y -= 1.8 * ease;
            st.scale = 1.0 + 0.35 * ease;
        }
        await new Promise(r => requestAnimationFrame(r));
    }

    // 2. FAZ: PARABOLİK UÇUŞ
    let curIdx = secilenKuyu;
    const sowingTargets = [];
    for (let t = 0; t < hareketAdet; t++) {
        curIdx = (curIdx + 1) % 18;
        sowingTargets.push(curIdx);
    }

    for (let i = 0; i < sowingTargets.length; i++) {
        const targetIdx = sowingTargets[i];
        const targetPos = _getKuyuPoz(targetIdx);
        const st = sowingStones[i];

        const startX = st.x;
        const startY = st.y;
        
        const peakY = Math.min(startY, targetPos.y) - 130;

        let flyDuration = 320;
        let flyStartTime = performance.now();

        playRetroWhoosh();

        while (performance.now() - flyStartTime < flyDuration) {
            const elapsed = performance.now() - flyStartTime;
            const t = Math.min(elapsed / flyDuration, 1.0);

            const invT = 1 - t;
            st.x = invT * invT * startX + 2 * invT * t * ((startX + targetPos.x) / 2) + t * t * targetPos.x;
            st.y = invT * invT * startY + 2 * invT * t * peakY + t * t * targetPos.y;
            
            st.scale = 1.35 * invT + 1.0 * t;

            await new Promise(r => requestAnimationFrame(r));
        }

        kuyular[targetIdx]++;
        st.opacity = 0;
        kuyuSarsintilari[targetIdx] = 12;
        playRetroClick();

        await new Promise(r => setTimeout(r, 90));
    }

    activeFlyingStones = [];

    // 3. FAZ: TUR DEĞİŞİMİ VE SKOR KONTROLÜ
    const finalTargetIndex = sowingTargets[sowingTargets.length - 1];
    await _hamleSonrasiKontrolAnimasyonlu(finalTargetIndex);
    _oyunSonuKontrol();

    console.log(`[TK] Hamle: k${secilenKuyu} → son:${finalTargetIndex} | P1:${hazineler.p1} P2:${hazineler.p2}`);
    isAnimating = false;
}

async function _hamleSonrasiKontrolAnimasyonlu(j) {
    if (tuzdikler.p1 !== null && kuyular[tuzdikler.p1] > 0) {
        const sayi = kuyular[tuzdikler.p1];
        kuyular[tuzdikler.p1] = 0;
        infoText = `Tuzdık! Oyuncu 1, rakip kuyudan ${sayi} taşı hazinesine çekti! 🛡️`;
        infoTimer = 4.0;
        await _ucurHazineye(tuzdikler.p1, 1, sayi);
    }
    if (tuzdikler.p2 !== null && kuyular[tuzdikler.p2] > 0) {
        const sayi = kuyular[tuzdikler.p2];
        kuyular[tuzdikler.p2] = 0;
        infoText = `Tuzdık! Oyuncu 2, rakip kuyudan ${sayi} taşı hazinesine çekti! 🛡️`;
        infoTimer = 4.0;
        await _ucurHazineye(tuzdikler.p2, 2, sayi);
    }

    const rakipBolgesi = (aktifOyuncu === 1 && j >= 9) ||
                          (aktifOyuncu === 2 && j <= 8);

    if (!rakipBolgesi) {
        aktifOyuncu = aktifOyuncu === 1 ? 2 : 1;
        return;
    }

    if (tuzdikler.p1 !== j && tuzdikler.p2 !== j) {
        const sayisi = kuyular[j];

        if (sayisi % 2 === 0 && sayisi > 0) {
            kuyular[j] = 0;
            infoText = `Oyuncu ${aktifOyuncu}, rakip kuyudan ${sayisi} taş kazandı! 💎`;
            infoTimer = 4.0;
            tahtaSarsinti = 15;
            await _ucurHazineye(j, aktifOyuncu, sayisi);
        }

        if (sayisi === 3) {
            const sonKuyuMu = (aktifOyuncu === 1) ? (j === 17) : (j === 8);
            let ayniSutun = false;
            if (aktifOyuncu === 1 && tuzdikler.p2 !== null) ayniSutun = (j - tuzdikler.p2 === 9);
            if (aktifOyuncu === 2 && tuzdikler.p1 !== null) ayniSutun = (tuzdikler.p1 - j === 9);

            console.log(`[TK] TUZDIK Analizi | Sıra: Oyuncu ${aktifOyuncu} | Kuyu Index: ${j} | 9. Kuyu mu: ${sonKuyuMu} | Adaş mı: ${ayniSutun}`);

            if (aktifOyuncu === 1 && tuzdikler.p1 === null && !sonKuyuMu && !ayniSutun) {
                tuzdikler.p1 = j;
                kuyular[j] = 0;
                infoText = `Tuzdık Açıldı! Oyuncu 1, rakibin K${j - 9 + 1} kuyusunu tuzdık yaptı! 🛡️`;
                infoTimer = 4.5;
                playRetroChime();
                await _ucurHazineye(j, 1, 3);
            } else if (aktifOyuncu === 2 && tuzdikler.p2 === null && !sonKuyuMu && !ayniSutun) {
                tuzdikler.p2 = j;
                kuyular[j] = 0;
                infoText = `Tuzdık Açıldı! Oyuncu 2, rakibin K${j + 1} kuyusunu tuzdık yaptı! 🛡️`;
                infoTimer = 4.5;
                playRetroChime();
                await _ucurHazineye(j, 2, 3);
            }
        }
    }

    aktifOyuncu = aktifOyuncu === 1 ? 2 : 1;
}

async function _ucurHazineye(kuyuIdx, oyuncuNo, sayi) {
    const wellPos = _getKuyuPoz(kuyuIdx);
    const hazinePos = _getHazinePoz(oyuncuNo);

    const captureStones = [];
    for (let i = 0; i < sayi; i++) {
        const off = TAS_OFFSET[Math.min(i, 8)];
        captureStones.push({
            x: wellPos.x + off[0],
            y: wellPos.y + off[1],
            scale: 1.0,
            opacity: 1.0
        });
    }
    activeFlyingStones = captureStones;

    let liftDuration = 200;
    let startTime = performance.now();
    playRetroWhoosh();

    while (performance.now() - startTime < liftDuration) {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / liftDuration, 1.0);
        const ease = progress * (2 - progress);

        for (const st of captureStones) {
            st.y -= 2.2 * ease;
            st.scale = 1.0 + 0.4 * ease;
        }
        await new Promise(r => requestAnimationFrame(r));
    }

    let flyDuration = 240;
    let flyStartTime = performance.now();
    const starts = captureStones.map(st => ({ x: st.x, y: st.y }));

    while (performance.now() - flyStartTime < flyDuration) {
        const elapsed = performance.now() - flyStartTime;
        const t = Math.min(elapsed / flyDuration, 1.0);
        const ease = t * t * t;

        for (let i = 0; i < captureStones.length; i++) {
            const st = captureStones[i];
            const start = starts[i];
            
            const peakY = Math.min(start.y, hazinePos.y) - 90;
            const invT = 1 - t;
            
            st.x = invT * invT * start.x + 2 * invT * t * ((start.x + hazinePos.x) / 2) + t * t * hazinePos.x;
            st.y = invT * invT * start.y + 2 * invT * t * peakY + t * t * hazinePos.y;
            
            st.scale = 1.4 * invT + 0.85 * t;
        }
        await new Promise(r => requestAnimationFrame(r));
    }

    if (oyuncuNo === 1) {
        hazineler.p1 += sayi;
        hazineSarsintiP1 = 16;
    } else {
        hazineler.p2 += sayi;
        hazineSarsintiP2 = 16;
    }

    playRetroClick();
    activeFlyingStones = [];
}

function _oyunSonuKontrol() {
    if (hazineler.p1 >= 82 || hazineler.p2 >= 82) {
        const p1Top = kuyular.slice(0, 9).reduce((a, b) => a + b, 0);
        const p2Top = kuyular.slice(9)  .reduce((a, b) => a + b, 0);
        hazineler.p1 += p1Top;
        hazineler.p2 += p2Top;
        for (let i = 0; i < 18; i++) kuyular[i] = 0;
        
        oyunBitti = true;
        const k = hazineler.p1 > hazineler.p2 ? 1 : hazineler.p2 > hazineler.p1 ? 2 : 0;
        console.log(`[TK] OYUN BİTTİ (Çoğunluk)! P1:${hazineler.p1} P2:${hazineler.p2} Kazanan:${k}`);
        return;
    }

    const p1Top = kuyular.slice(0, 9).reduce((a, b) => a + b, 0);
    const p2Top = kuyular.slice(9)  .reduce((a, b) => a + b, 0);

    if ((aktifOyuncu === 1 && p1Top === 0) || (aktifOyuncu === 2 && p2Top === 0)) {
        hazineler.p1 += p1Top;
        hazineler.p2 += p2Top;
        for (let i = 0; i < 18; i++) kuyular[i] = 0;
        
        oyunBitti = true;
        const k = hazineler.p1 > hazineler.p2 ? 1 : hazineler.p2 > hazineler.p1 ? 2 : 0;
        console.log(`[TK] OYUN BİTTİ (Atsyz Kalu)! P1:${hazineler.p1} P2:${hazineler.p2} Kazanan:${k}`);
    }
}

// --------------------------------------------------------------
// GLOBAL C3 HOOKS AND RESETTER
// --------------------------------------------------------------
globalThis.TokuzKumalak = {
    hamleYap: hamleYapAnimasyonlu,
    yenidenBaslat: (runtime) => {
        kuyular     = Array(18).fill(BASLANGIC_TAS);
        hazineler   = { p1: 0, p2: 0 };
        tuzdikler   = { p1: null, p2: null };
        aktifOyuncu = 1;
        oyunBitti   = false;
        hoverKuyu   = -1;
        hoverTimer  = 0;
        ringAci     = 0;
        infoText    = "";
        infoTimer   = 0;
        tahtaSarsinti = 0;
        console.log("[TK] Oyun sifirlandi.");
    },
    getState: () => ({ kuyular, hazineler, tuzdikler, aktifOyuncu, oyunBitti }),
};

// --------------------------------------------------------------
// COMPUTER (AI) PLAYER LOGIC
// --------------------------------------------------------------
async function _bilgisayarHamlesi() {
    if (oyunBitti || isAnimating) return;
    
    const validMoves = [];
    for (let k = 9; k < 18; k++) {
        if (kuyular[k] > 0 && tuzdikler.p1 !== k) {
            validMoves.push(k);
        }
    }

    if (validMoves.length === 0) return;

    let secilenKuyu = -1;
    if (gameSettings.aiDifficulty === "easy") {
        secilenKuyu = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
        let enIyiPuan = -Infinity;
        let enIyiHamleler = [];

        for (const k of validMoves) {
            const puan = _degerlendirHamle(k, 2);
            if (puan > enIyiPuan) {
                enIyiPuan = puan;
                enIyiHamleler = [k];
            } else if (puan === enIyiPuan) {
                enIyiHamleler.push(k);
            }
        }
        
        if (enIyiHamleler.length > 0) {
            secilenKuyu = enIyiHamleler[Math.floor(Math.random() * enIyiHamleler.length)];
        } else {
            secilenKuyu = validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }

    await new Promise(r => setTimeout(r, 900));
    await hamleYapAnimasyonlu(secilenKuyu);
}

function _degerlendirHamle(secilenKuyu, oyuncuNo) {
    const tempKuyular = [...kuyular];
    const taslar = tempKuyular[secilenKuyu];
    if (taslar === 0) return -9999;

    tempKuyular[secilenKuyu] = taslar === 1 ? 0 : 1;
    const hareketAdet = taslar === 1 ? 1 : taslar - 1;

    let curIdx = secilenKuyu;
    for (let t = 0; t < hareketAdet; t++) {
        curIdx = (curIdx + 1) % 18;
        tempKuyular[curIdx]++;
    }
    const finalCup = curIdx;

    let puan = 0;
    const rakipBolgesi = (oyuncuNo === 2 && finalCup <= 8) || (oyuncuNo === 1 && finalCup >= 9);

    if (rakipBolgesi && tuzdikler.p1 !== finalCup && tuzdikler.p2 !== finalCup) {
        const sayi = tempKuyular[finalCup];

        if (sayi % 2 === 0 && sayi > 0) {
            puan += sayi * 1.5;
        }

        if (sayi === 3) {
            const sonKuyuMu = (oyuncuNo === 1) ? (finalCup === 17) : (finalCup === 8);
            let ayniSutun = false;
            if (oyuncuNo === 1 && tuzdikler.p2 !== null) ayniSutun = (finalCup - tuzdikler.p2 === 9);
            if (oyuncuNo === 2 && tuzdikler.p1 !== null) ayniSutun = (tuzdikler.p1 - finalCup === 9);

            const mevcutTuzdik = (oyuncuNo === 1) ? tuzdikler.p1 : tuzdikler.p2;

            if (mevcutTuzdik === null && !sonKuyuMu && !ayniSutun) {
                puan += 25;
            }
        }
    }

    if (oyuncuNo === 2 && tuzdikler.p2 !== null && finalCup === tuzdikler.p2) {
        puan += 1.5;
    }

    if (oyuncuNo === 2 && tuzdikler.p1 !== null && finalCup === tuzdikler.p1) {
        puan -= 1.5;
    }

    puan += (taslar * 0.05);
    return puan;
}
