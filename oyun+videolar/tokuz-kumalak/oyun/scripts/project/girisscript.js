// ==============================================================
//  TOKUZ KUMALAK – Giriş Sayfası Modülü (girisscript.js)
// ==============================================================
"use strict";

import { gameSettings, playRetroClick, toggleFullscreen, GAME_W, GAME_H } from "./main.js";

// C3 nasiloynanir sprite nesnesinden veya dosyasından görsel URL'sini çözmeyi dene
let rulesImgUrl = "nasiloynanir.png"; // Fallback yerel disk yolu

export async function baslatGirisSayfasi(runtime) {
    console.log("[TK] --- RUNTIME DIAGNOSTIC LOGS ---");
    console.log("[TK] runtime:", runtime);
    console.log("[TK] runtime.layouts:", runtime.layouts);
    console.log("[TK] typeof runtime.goToLayout:", typeof runtime.goToLayout);
    if (runtime.layouts) {
        try {
            console.log("[TK] layouts properties:", Object.getOwnPropertyNames(runtime.layouts));
        } catch(e) {}
        try {
            if (runtime.layouts.allLayouts) {
                console.log("[TK] allLayouts:", runtime.layouts.allLayouts.map(l => l.name));
            }
        } catch(e) {}
    }
    console.log("[TK] --------------------------------");

    let rulesSpriteObj = null;
    const temizleStr = (str) => {
        return str.toLowerCase()
                  .replace(/ı/g, 'i')
                  .replace(/ş/g, 's')
                  .replace(/ğ/g, 'g')
                  .replace(/ü/g, 'u')
                  .replace(/ö/g, 'o')
                  .replace(/ç/g, 'c')
                  .replace(/[^a-z0-9]/g, '');
    };
    const targetClean = "nasiloynanir";
    
    console.log("[TK] Projedeki C3 nesne tipleri:", Object.keys(runtime.objects));
    
    for (const key in runtime.objects) {
        if (temizleStr(key).includes(targetClean)) {
            rulesSpriteObj = runtime.objects[key];
            console.log("[TK] Eşleşen nasiloynanir sprite objesi bulundu:", key);
            break;
        }
    }

    let rulesSprite = null;
    if (rulesSpriteObj) {
        try {
            rulesSprite = rulesSpriteObj.getFirstInstance();
            if (rulesSprite) {
                rulesSprite.isVisible = false;
                console.log("[TK] Sahnedeki nasiloynanir sprite örneği gizlendi.");
            }
        } catch(e) {}
    }

    // Construct 3 dosya sistemi üzerinden görsel URL'sini çöz
    try {
        const path = "nasiloynanir.png";
        if (runtime.assets && typeof runtime.assets.getProjectFileUrl === "function") {
            rulesImgUrl = await runtime.assets.getProjectFileUrl(path);
            console.log("[TK] getProjectFileUrl (runtime.assets) ile çözüldü:", rulesImgUrl);
        } else if (typeof runtime.getProjectFileUrl === "function") {
            rulesImgUrl = await runtime.getProjectFileUrl(path);
            console.log("[TK] getProjectFileUrl (runtime) ile çözüldü:", rulesImgUrl);
        }
    } catch(e) {
        console.error("[TK] getProjectFileUrl (nasiloynanir.png) başarısız:", e);
    }

    const ust = runtime.objects.ust.getFirstInstance();
    const alt = runtime.objects.alt.getFirstInstance();

    // Görselleri doğrudan 960x540 konumuna sabitle
    if (ust) {
        ust.x = 960;
        ust.y = 540;
    }
    if (alt) {
        alt.x = 960;
        alt.y = 540;
    }

    // Font yükle (Outfit)
    if (!document.getElementById('outfit-font')) {
        const link = document.createElement('link');
        link.id = 'outfit-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap';
        document.head.appendChild(link);
    }

    // Eski overlay'i kaldır
    const eskiMenu = document.getElementById('tokuz-menu-overlay');
    if (eskiMenu) {
        if (eskiMenu._onResize) {
            window.removeEventListener('resize', eskiMenu._onResize);
        }
        eskiMenu.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'tokuz-menu-overlay';

    // CSS Stylesheet (1920x1080 koordinat uzayında tasarlanmıştır)
    const style = document.createElement('style');
    style.id = 'tokuz-menu-styles';
    style.innerHTML = `
        #tokuz-menu-overlay {
            position: fixed;
            z-index: 10000;
            font-family: 'Outfit', sans-serif;
            background: transparent;
            user-select: none;
            box-sizing: border-box;
            display: ${gameSettings.isLoaderActive ? 'none' : 'flex'}; /* Yükleme aktifken gizle */
            justify-content: flex-start;
            align-items: center;
            padding-left: 220px; /* Valley bölgesine tam yerleşim */
            pointer-events: none; /* Arka plana tıklamaları geçirmemesi için alt öğelerde açılır */
        }
        #menu-btn-fullscreen {
            position: absolute;
            left: 1785px;
            top: 41px;
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
        #menu-btn-fullscreen svg {
            width: 36px;
            height: 36px;
            fill: currentColor;
            transition: transform 0.25s ease;
        }
        #menu-btn-fullscreen:hover {
            color: #fbbf24;
            border-color: #fb923c;
            background: #29211c;
            box-shadow: 0 12px 30px rgba(217, 119, 6, 0.4), 0 0 25px rgba(217, 119, 6, 0.2);
            transform: scale(1.08);
        }
        #menu-btn-fullscreen:active {
            transform: scale(0.92);
        }
        .menu-card {
            background: rgba(22, 28, 38, 0.95);
            border: 2px solid #d97706; /* Altın rengi kenarlık */
            border-radius: 40px;
            padding: 46px 36px;
            width: 480px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.8), 0 0 35px rgba(217, 119, 6, 0.25);
            color: #ffffff;
            box-sizing: border-box;
            animation: cardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            backdrop-filter: blur(10px);
            pointer-events: auto; /* Tıklamaları aktif et */
        }
        @keyframes cardEntrance {
            from { opacity: 0; transform: translateY(20px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .menu-title {
            font-size: 46px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin: 0 0 8px 0;
            background: linear-gradient(185deg, #f97316, #fbbf24);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 20px rgba(249, 115, 22, 0.35);
            text-align: center;
        }
        .menu-subtitle {
            font-size: 16px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 40px;
            letter-spacing: 0.5px;
            text-align: center;
        }
        .menu-section {
            text-align: left;
            margin-bottom: 28px;
        }
        .section-label {
            font-size: 13px;
            font-weight: 800;
            color: #f59e0b;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 12px;
        }
        .button-group {
            display: flex;
            gap: 12px;
            background: #0e131f;
            padding: 6px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .group-btn {
            flex: 1;
            padding: 14px 10px;
            border: none;
            background: transparent;
            color: #64748b;
            font-family: 'Outfit', sans-serif;
            font-size: 16px;
            font-weight: 700;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.25s ease;
        }
        .group-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        .group-btn:hover {
            color: #cbd5e1;
        }
        .group-btn.active {
            background: #29211c; /* Koyu kahverengi/turuncu tonu */
            color: #fbbf24;
            border: 1.5px solid #d97706;
            box-shadow: 0 0 10px rgba(217, 119, 6, 0.15);
        }
        .difficulty-wrapper {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            transition: max-height 0.4s ease, opacity 0.4s ease, margin 0.4s ease;
        }
        .difficulty-wrapper.visible {
            max-height: 100px;
            opacity: 1;
            margin-bottom: 28px;
        }
        .primary-btn {
            width: 100%;
            padding: 18px;
            border: none;
            border-radius: 18px;
            font-family: 'Outfit', sans-serif;
            font-size: 24px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            cursor: pointer;
            color: #ffffff;
            background: linear-gradient(135deg, #ea580c, #c2410c);
            box-shadow: 0 8px 24px rgba(234, 88, 12, 0.45);
            transition: all 0.25s ease;
            margin-top: 10px;
            margin-bottom: 16px;
            display: block;
        }
        .primary-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 30px rgba(234, 88, 12, 0.6), 0 0 15px rgba(234, 88, 12, 0.3);
        }
        .primary-btn:active {
            transform: translateY(1px);
            box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
        }
        .secondary-btn {
            width: 100%;
            padding: 14px;
            border: 1.5px solid rgba(217, 119, 6, 0.4);
            border-radius: 16px;
            font-family: 'Outfit', sans-serif;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            color: #fbbf24;
            background: transparent;
            transition: all 0.25s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .secondary-btn:hover {
            background: rgba(217, 119, 6, 0.08);
            border-color: #fb923c;
            color: #ffffff;
        }
        .secondary-btn:active {
            transform: translateY(1px);
        }
        
        /* Kurallar Modal */
        #rules-modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 1920px;
            height: 1080px;
            background: rgba(0, 0, 0, 0.5); /* Hafif karartma, blur yok */
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20000;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.3s ease, visibility 0.3s ease;
            box-sizing: border-box;
        }
        #rules-modal-overlay.open {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .rules-container {
            position: relative;
            display: inline-block;
        }
        .close-rules-x {
            position: absolute;
            top: -25px;
            right: -25px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #ea580c;
            border: 2.5px solid #ffffff;
            color: #ffffff;
            font-size: 32px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            transition: all 0.2s ease;
            z-index: 20005;
        }
        .close-rules-x:hover {
            background: #c2410c;
            transform: scale(1.1);
        }
        .close-rules-x:active {
            transform: scale(0.9);
        }
        .rules-image {
            width: 1470px;
            height: 861px;
            object-fit: contain;
            box-shadow: 0 20px 50px rgba(0,0,0,0.85);
            border-radius: 24px;
            pointer-events: auto;
            border: 2px solid #d97706;
            animation: rulesEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            display: block;
        }
        @keyframes rulesEntrance {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    overlay.innerHTML = `
        <button id="menu-btn-fullscreen" title="Tam Ekran">
            <svg viewBox="0 0 24 24"><path d="${(typeof document !== 'undefined' && document.fullscreenElement) ? 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z' : 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'}"/></svg>
        </button>
        <div class="menu-card">
            <h1 class="menu-title">Tokuz Kumalak</h1>
            <p class="menu-subtitle">Gelenemsel Türk Zeka ve Strateji Oyunu</p>
            
            <div class="menu-section">
                <div class="section-label">Oyun Modu</div>
                <div class="button-group">
                    <button class="group-btn active" id="mode-2p">
                        <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                        İki Oyuncu
                    </button>
                    <button class="group-btn" id="mode-ai">
                        <svg viewBox="0 0 24 24"><path d="M19 8h-2V6c0-1.1-.9-2-2-2h-3V2H8v2H5c-1.1 0-2 .9-2 2v2H1c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h2v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-4h2c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2zm-2 10H7v-4h10v4zm0-6H7V8h10v4zM9 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                        Bilgisayara Karşı
                    </button>
                </div>
            </div>

            <div class="menu-section difficulty-wrapper" id="diff-section">
                <div class="section-label">AI Zorluk Seviyesi</div>
                <div class="button-group">
                    <button class="group-btn active" id="diff-easy">Kolay</button>
                    <button class="group-btn" id="diff-hard">Zor</button>
                </div>
            </div>

            <button class="primary-btn" id="start-game-btn">Oyuna Başla</button>
            <button class="secondary-btn" id="show-rules-btn">
                <span>📜</span> Nasıl Oynanır?
            </button>
        </div>

        <div id="rules-modal-overlay">
            <div class="rules-container">
                <div class="close-rules-x" id="close-rules-x">✕</div>
                <img id="rules-img-element" class="rules-image" src="" alt="Nasıl Oynanır" />
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Buton dinleyicileri
    const btn2P = overlay.querySelector('#mode-2p');
    const btnAI = overlay.querySelector('#mode-ai');
    const diffSection = overlay.querySelector('#diff-section');
    const btnEasy = overlay.querySelector('#diff-easy');
    const btnHard = overlay.querySelector('#diff-hard');
    const btnStart = overlay.querySelector('#start-game-btn');
    const btnRules = overlay.querySelector('#show-rules-btn');
    const btnFullscreen = overlay.querySelector('#menu-btn-fullscreen');
    
    const rulesOverlay = overlay.querySelector('#rules-modal-overlay');
    const btnCloseRulesX = rulesOverlay.querySelector('#close-rules-x');

    // Varsayılan ayarlar
    gameSettings.gameMode = "twoPlayers";
    gameSettings.aiDifficulty = "easy";

    btn2P.addEventListener('click', () => {
        playRetroClick();
        btn2P.classList.add('active');
        btnAI.classList.remove('active');
        diffSection.classList.remove('visible');
        gameSettings.gameMode = "twoPlayers";
    });

    btnAI.addEventListener('click', () => {
        playRetroClick();
        btnAI.classList.add('active');
        btn2P.classList.remove('active');
        diffSection.classList.add('visible');
        gameSettings.gameMode = "vsComputer";
    });

    btnEasy.addEventListener('click', () => {
        playRetroClick();
        btnEasy.classList.add('active');
        btnHard.classList.remove('active');
        gameSettings.aiDifficulty = "easy";
    });

    btnHard.addEventListener('click', () => {
        playRetroClick();
        btnHard.classList.add('active');
        btnEasy.classList.remove('active');
        gameSettings.aiDifficulty = "hard";
    });

    btnRules.addEventListener('click', () => {
        playRetroClick();
        rulesOverlay.classList.add('open');
        const menuCard = overlay.querySelector('.menu-card');
        if (menuCard) menuCard.style.display = 'none';
        
        if (!rulesSprite && rulesSpriteObj) {
            try { rulesSprite = rulesSpriteObj.getFirstInstance(); } catch(_) {}
        }
        if (rulesSprite) {
            rulesSprite.isVisible = false;
        }
        
        const imgEl = overlay.querySelector('#rules-img-element');
        if (imgEl) {
            imgEl.src = rulesImgUrl;
        }
    });

    const kapatRules = () => {
        playRetroClick();
        rulesOverlay.classList.remove('open');
        const menuCard = overlay.querySelector('.menu-card');
        if (menuCard) menuCard.style.display = '';
        
        if (!rulesSprite && rulesSpriteObj) {
            try { rulesSprite = rulesSpriteObj.getFirstInstance(); } catch(_) {}
        }
        if (rulesSprite) {
            rulesSprite.isVisible = false;
        }
    };

    btnCloseRulesX.addEventListener('click', (e) => {
        kapatRules();
        e.stopPropagation();
    });

    rulesOverlay.addEventListener('click', (e) => {
        if (e.target === rulesOverlay) {
            kapatRules();
        }
    });

    btnFullscreen.addEventListener('click', () => {
        playRetroClick();
        toggleFullscreen();
    });

    // Dinamik Ölçeklendirme Sistemi (C3 canvas'ına göre tam ölçekler)
    const updateScale = () => {
        const canvas = runtime.canvas || document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        
        // Canvas en-boy oranı ile menüyü ölçeklendir
        const scale = rect.width / GAME_W;
        
        overlay.style.position = 'fixed';
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = '1920px';
        overlay.style.height = '1080px';
        overlay.style.transform = `scale(${scale})`;
        overlay.style.transformOrigin = 'top left';
    };

    overlay._onResize = updateScale;
    window.addEventListener('resize', updateScale);
    
    // Canvas yerleşene kadar birkaç defa ölçeklemeyi tetikle
    updateScale();
    setTimeout(updateScale, 0);
    setTimeout(updateScale, 100);

    btnStart.addEventListener('click', () => {
        playRetroClick();
        
        // Tarayıcı güvenlik politikası gereği tam ekran ancak bir kullanıcı etkileşimi (tıklama) ile tetiklenebilir.
        // "Oyuna Başla" butonuna tıklanması bu yetkiyi sağladığı için burada tam ekrana geçişi zorluyoruz.
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Tam ekran hatasi: ${err.message} (${err.name})`);
            });
        }
        
        // Window resize dinleyicisini temizle
        if (overlay._onResize) {
            window.removeEventListener('resize', overlay._onResize);
        }
        
        // DOM elemanlarını kaldır
        overlay.remove();
        
        try {
            if (typeof runtime.goToLayout === "function") {
                runtime.goToLayout("game");
            } else {
                alert("[TK] Bu Construct 3 runtime sürümünde goToLayout metodu bulunamadı!");
            }
        } catch(e) {
            alert("[TK] Layout geçiş hatası: " + e.message);
        }
    });
}
