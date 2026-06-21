/**
 * 法案奇幻冒險：三讀闖關大作戰！
 * 遊戲邏輯與互動控制 JS 檔案
 */

// --- 後端配置 ---
// 教師部署 Google Apps Script 後，請將產生的網頁應用程式 URL 貼在下方雙引號內：
// 例如："https://script.google.com/macros/s/AKfycb.../exec"
const GOOGLE_SHEET_APP_URL = "https://script.google.com/macros/s/AKfycbzQ8H2_-tT-TUOSC0rOBE-xPGXlWVPm--MkO4XAWMFz_JQb6_3OaCnlHWuLPYks1ZYc/exec";

// --- 遊戲狀態管理 ---
const gameState = {
  playerClass: "無",
  playerSeat: "無",
  playerName: "訪客委員",
  selectedChar: "dotty", // dotty, ray, wah
  selectedBill: "homework", // homework, lunch, green
  currentStage: 0, // 0: intro, 1: select, 2: stage1, 3: stage2, 4: stage3, 5: stage4, 6: stage5, 7: cert
  soundEnabled: true,
  signaturesCollected: 0,
  sigTimer: null,
  sigTimeLeft: 15,
  sigGameActive: false,
  sortingCorrectCount: 0,
  sortingTotal: 6,
  negotiationSolved: false,
  quizCurrentQuestion: 0,
  quizScore: 0,
  quizQuestions: [],
  votingActive: false,
  yesVotes: 0,
  noVotes: 0,
  proofreadCorrected: 0,
  proofreadTotal: 2,
  vetoClicks: 0,
  vetoTimer: null,
  vetoTimeLeft: 8.0,
  vetoGameActive: false
};

// --- 靜態資料定義 ---
const BILLS = {
  homework: {
    title: "「中小學禁止週末作業條例」",
    shortTitle: "禁止週末作業條例",
    content: "國民中小學學生之課業，<span class='typo-target' id='typo1' data-correct='應'>英</span>以課堂學習為主。為保障學生身心健全發展與充足睡眠，各級學校<span class='typo-target' id='typo2' data-correct='不得'>不德</span>於週五或連續假期指派課後作業，以鼓勵學生自主規劃週末休閒生活。",
    cardSorting: [
      { text: "適度休息能大幅提升週一的學習專注度。", type: "support" },
      { text: "自主規劃週末有助於培養主動學習習慣。", type: "support" },
      { text: "多出時間能進行戶外運動，增進親子感情。", type: "support" },
      { text: "可能導致學生成績下滑，降低學科競爭力。", type: "oppose" },
      { text: "家長週末被迫要花更多心思安排照護或補習。", type: "oppose" },
      { text: "自主管理能力差的學生，週末可能沉迷電動。", type: "oppose" }
    ]
  },
  lunch: {
    title: "「營養午餐全面加糖與點心法案」",
    shortTitle: "午餐加糖與點心法案",
    content: "各級中小學校營養午餐之設計，<span class='typo-target' id='typo1' data-correct='應'>嬰</span>注重膳食均衡。為提升學生學習動能與上學幸福感，學校餐廳<span class='typo-target' id='typo2' data-correct='得'>德</span>於每日下午加設甜點與低糖茶飲之免費供應時段。",
    cardSorting: [
      { text: "美味的甜點能有效舒緩學生的課業壓力。", type: "support" },
      { text: "提供多元副食品，能提高學生在校用餐意願。", type: "support" },
      { text: "甜食能迅速補充熱量，恢復下午上課精力。", type: "support" },
      { text: "攝取過多糖分會增加學生過胖與齲齒機率。", type: "oppose" },
      { text: "加糖偏好可能加劇偏食習慣，影響健康發育。", type: "oppose" },
      { text: "學校廚房與營養師調配菜單的財務負擔大增。", type: "oppose" }
    ]
  },
  green: {
    title: "「校園綠能與垃圾減量推廣法」",
    shortTitle: "校園綠能與垃圾減量法",
    content: "各級學校應落實綠色校園政策。校區新設建築應<span class='typo-target' id='typo1' data-correct='規劃'>瑰劃</span>屋頂發電系統；且校園合作社與餐廳<span class='typo-target' id='typo2' data-correct='禁止'>禁只</span>提供一次性塑膠製品，以深化學子之環保實踐意識。",
    cardSorting: [
      { text: "能顯著降低校園碳排放，給予學生最佳環境教育。", type: "support" },
      { text: "太陽能發電能自給自足，多餘電力還能回售補貼校務。", type: "support" },
      { text: "減少塑膠製品能有效從源頭減少校園垃圾量。", type: "support" },
      { text: "太陽能板初期建置經費昂貴，後續維護技術難度高。", type: "oppose" },
      { text: "禁用一次性塑膠會造成師生外帶清洗的極大不便。", type: "oppose" },
      { text: "全面無紙化電子教學可能增加學生用眼過度的傷害。", type: "oppose" }
    ]
  }
};

const QUIZ_QUESTIONS = [
  {
    question: "我國立法院目前共有幾席立法委員？任期是幾年？",
    options: [
      "113 席，任期 4 年",
      "225 席，任期 3 年",
      "100 席，任期 4 年",
      "113 席，任期 3 年"
    ],
    answer: 0,
    explanation: "我國立法委員共有 113 席，任期 4 年，可以連選連任。"
  },
  {
    question: "在立法「三讀」程序中，哪一個階段會進行最關鍵的「逐條討論、修正與表決」？",
    options: [
      "第一讀會 (一讀)",
      "委員會審查",
      "第二讀會 (二讀)",
      "第三讀會 (三讀)"
    ],
    answer: 2,
    explanation: "二讀會是立法程序中最核心的階段，會對法案進行廣泛討論、逐條討論，並針對爭議條文進行修正與表決。"
  },
  {
    question: "若行政院認為立法院通過的法案「窒礙難行」，經總統核可後可以提出什麼機制要求立法院重新審議？",
    options: [
      "釋憲案 (憲法法庭審理)",
      "覆議案 (重新審議與表決)",
      "不信任案 (倒閣)",
      "彈劾案 (移送監察院)"
    ],
    answer: 1,
    explanation: "行政院經總統核可，可在法案送達 10 日內移請立法院「覆議」。若立法院過半數委員維持原案，行政院長即須接受。"
  }
];

// --- Web Audio API 音效產生器 ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!gameState.soundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;
    
    switch (type) {
      case 'click': {
        // 短促的點擊聲
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'bubble': {
        // 氣球泡泡點擊啵一聲
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'gavel': {
        // 木槌敲擊沉悶砰聲 + 金屬餘音
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        
        gain1.gain.setValueAtTime(0.6, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
        // 金屬敲擊高頻聲
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(900, now);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        gain2.gain.setValueAtTime(0.1, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc1.start(now);
        osc1.stop(now + 0.25);
        osc2.start(now);
        osc2.stop(now + 0.08);
        break;
      }
      case 'success': {
        // 琶音上升 (C大調)
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          
          gain.gain.setValueAtTime(0.1, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);
          
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.2);
        });
        break;
      }
      case 'fail': {
        // 低沉下降音
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.4);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
      case 'tick': {
        // 答題或倒數的滴答聲
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
        
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'cheer': {
        // 勝利慶祝歡呼模擬音效
        const duration = 1.5;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // 產生白噪音
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        // 使用帶通濾波器模擬群眾聲音
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(2.0, now);
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(1500, now + duration);
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        
        noise.start(now);
        noise.stop(now + duration);
        break;
      }
    }
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

// --- DOM 元素取得 ---
const screens = {
  intro: document.getElementById('screen-intro'),
  select: document.getElementById('screen-select'),
  stage1: document.getElementById('screen-stage1'),
  stage2: document.getElementById('screen-stage2'),
  stage3: document.getElementById('screen-stage3'),
  stage4: document.getElementById('screen-stage4'),
  stage5: document.getElementById('screen-stage5'),
  cert: document.getElementById('screen-certificate')
};

const hud = document.getElementById('game-hud');
const hudBillTitle = document.getElementById('hud-bill-title');
const hudCharName = document.getElementById('hud-char-name');
const hudCharAvatar = document.getElementById('hud-char-avatar');
const progressBar = document.getElementById('timeline-progress-bar');
const stepNodes = document.querySelectorAll('.step-node');

// 後端同步 DOM
const syncStatusBox = document.getElementById('sync-status-box');
const syncIcon = document.getElementById('sync-icon');
const syncText = document.getElementById('sync-text');

// --- 輔助函式：切換關卡畫面 ---
function switchScreen(screenName) {
  playSound('click');
  // 隱藏所有畫面
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  // 顯示目標畫面
  screens[screenName].classList.add('active');
  
  // 更新狀態值
  if (screenName === 'intro') {
    gameState.currentStage = 0;
    hud.classList.remove('show');
  } else if (screenName === 'select') {
    gameState.currentStage = 0;
    hud.classList.remove('show');
  } else {
    hud.classList.add('show');
    if (screenName === 'stage1') gameState.currentStage = 1;
    if (screenName === 'stage2') gameState.currentStage = 2;
    if (screenName === 'stage3') gameState.currentStage = 3;
    if (screenName === 'stage4') gameState.currentStage = 4;
    if (screenName === 'stage5') gameState.currentStage = 5;
    if (screenName === 'cert') gameState.currentStage = 6;
    
    updateHUDProgress();
  }
  
  // 初始化特定關卡
  if (screenName === 'stage1') initStage1();
  if (screenName === 'stage2') initStage2();
  if (screenName === 'stage3') initStage3();
  if (screenName === 'stage4') initStage4();
  if (screenName === 'stage5') initStage5();
  if (screenName === 'cert') initCertificate();
}

function updateHUDProgress() {
  const currentStep = gameState.currentStage - 1; // 關卡1對應節點0
  
  // 更新進度條百分比
  const progressPercent = Math.max(0, Math.min(100, currentStep * 25));
  progressBar.style.width = `${progressPercent}%`;
  
  // 更新節點樣式
  stepNodes.forEach((node, idx) => {
    node.classList.remove('active', 'completed');
    if (idx < currentStep) {
      node.classList.add('completed');
    } else if (idx === currentStep) {
      node.classList.add('active');
    }
  });
}

// --- 音效開關控制 ---
const soundToggle = document.getElementById('sound-toggle');
soundToggle.addEventListener('click', () => {
  gameState.soundEnabled = !gameState.soundEnabled;
  if (gameState.soundEnabled) {
    soundToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
    initAudio();
    playSound('click');
  } else {
    soundToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
  }
});

// --- 0. 歡迎畫面邏輯 ---
const btnStartGame = document.getElementById('btn-start-game');
const playerNameInput = document.getElementById('player-name-input');
const playerClassInput = document.getElementById('player-class-input');
const playerSeatInput = document.getElementById('player-seat-input');

btnStartGame.addEventListener('click', () => {
  const nameVal = playerNameInput.value.trim();
  const classVal = playerClassInput.value.trim();
  const seatVal = playerSeatInput.value.trim();
  
  if (nameVal === "" || classVal === "" || seatVal === "") {
    alert("請填寫完整的班級、座號與姓名，才能開始推動法案唷！");
    return;
  }
  
  gameState.playerName = nameVal;
  gameState.playerClass = classVal;
  gameState.playerSeat = seatVal;
  switchScreen('select');
});

// --- 1. 角色與法案選擇邏輯 ---
const charCards = document.querySelectorAll('.character-card');
const billCards = document.querySelectorAll('.bill-card');
const btnConfirmSelection = document.getElementById('btn-confirm-selection');

charCards.forEach(card => {
  card.addEventListener('click', () => {
    playSound('click');
    charCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    gameState.selectedChar = card.dataset.char;
  });
});

billCards.forEach(card => {
  card.addEventListener('click', () => {
    playSound('click');
    billCards.forEach(b => b.classList.remove('active'));
    card.classList.add('active');
    gameState.selectedBill = card.dataset.bill;
  });
});

btnConfirmSelection.addEventListener('click', () => {
  // 將選取的資料同步至 HUD
  const billInfo = BILLS[gameState.selectedBill];
  hudBillTitle.textContent = billInfo.shortTitle;
  hudCharName.textContent = gameState.playerName;
  
  // 設定頭像圖示
  let iconClass = "fa-wand-magic-sparkles";
  if (gameState.selectedChar === "ray") iconClass = "fa-graduation-cap";
  if (gameState.selectedChar === "wah") iconClass = "fa-bullhorn";
  
  // 我們直接使用 FontAwesome 圖示取代圖片
  hudCharAvatar.className = "hidden"; // 隱藏 img 元素
  const avatarSpan = document.createElement('i');
  avatarSpan.className = `fas ${iconClass}`;
  avatarSpan.style.color = "var(--color-primary)";
  
  // 清理舊的圖示
  const existingIcon = hudCharName.parentElement.querySelector('i');
  if (existingIcon) {
    existingIcon.remove();
  }
  hudCharName.parentElement.insertBefore(avatarSpan, hudCharName);

  switchScreen('stage1');
});

// --- 2. 第一關：連署與一讀會邏輯 ---
const sigCountSpan = document.getElementById('sig-count');
const sigTimerSpan = document.getElementById('sig-timer');
const sigPlayArea = document.getElementById('sig-play-area');
const sigStartOverlay = document.getElementById('sig-start-overlay');
const btnStartSig = document.getElementById('btn-start-sig');
const firstReadingCeremony = document.getElementById('first-reading-ceremony');
const ceremonyBillTitle = document.getElementById('ceremony-bill-title');
const btnStrikeGavelS1 = document.getElementById('btn-strike-gavel-s1');
const btnToStage2 = document.getElementById('btn-to-stage2');
const gavelAnimS1 = document.getElementById('gavel-anim-s1');

function initStage1() {
  gameState.signaturesCollected = 0;
  gameState.sigTimeLeft = 15;
  gameState.sigGameActive = false;
  
  sigCountSpan.textContent = "0";
  sigTimerSpan.textContent = "15";
  
  // 清空除了 Start Overlay 以外的泡泡
  const bubbles = sigPlayArea.querySelectorAll('.sig-bubble');
  bubbles.forEach(b => b.remove());
  
  sigStartOverlay.classList.remove('hidden');
  firstReadingCeremony.classList.add('hidden');
  btnToStage2.classList.add('hidden');
}

btnStartSig.addEventListener('click', () => {
  playSound('click');
  sigStartOverlay.classList.add('hidden');
  gameState.sigGameActive = true;
  
  // 啟動倒數計時器
  gameState.sigTimer = setInterval(() => {
    gameState.sigTimeLeft--;
    sigTimerSpan.textContent = gameState.sigTimeLeft;
    playSound('tick');
    
    if (gameState.sigTimeLeft <= 0) {
      clearInterval(gameState.sigTimer);
      endSigGame(false);
    }
  }, 1000);
  
  // 持續產生泡泡
  spawnBubbles();
});

const legislatorNames = [
  "林立委", "張立委", "王立委", "李立委", "陳立委", 
  "黃立委", "蔡立委", "吳立委", "徐立委", "趙立委",
  "美美委員", "阿明委員", "強強委員", "小華委員", "國安委員"
];

function spawnBubbles() {
  if (!gameState.sigGameActive) return;
  
  // 每秒隨機產生 2-3 個泡泡
  const count = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < count; i++) {
    createBubble();
  }
  
  // 1.5 秒後繼續產生
  setTimeout(spawnBubbles, 1200);
}

function createBubble() {
  if (!gameState.sigGameActive) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'sig-bubble';
  
  const name = legislatorNames[Math.floor(Math.random() * legislatorNames.length)];
  bubble.innerHTML = `<i class="fas fa-pen-nib"></i> ${name}`;
  
  // 隨機水平位置
  const posX = Math.random() * (sigPlayArea.clientWidth - 100);
  bubble.style.left = `${posX}px`;
  
  // 隨機動畫速度
  const speed = 4 + Math.random() * 3; // 4~7秒
  bubble.style.animationDuration = `${speed}s`;
  
  // 點擊事件
  bubble.addEventListener('click', () => {
    if (bubble.classList.contains('signed')) return;
    
    bubble.classList.add('signed');
    bubble.innerHTML = `<i class="fas fa-check-circle"></i> 已連署`;
    gameState.signaturesCollected++;
    sigCountSpan.textContent = gameState.signaturesCollected;
    playSound('bubble');
    
    if (gameState.signaturesCollected >= 15) {
      clearInterval(gameState.sigTimer);
      endSigGame(true);
    }
  });
  
  sigPlayArea.appendChild(bubble);
  
  // 動畫結束後自動移除
  setTimeout(() => {
    bubble.remove();
  }, speed * 1000);
}

function endSigGame(isWon) {
  gameState.sigGameActive = false;
  
  // 移除剩餘未點擊的泡泡
  const bubbles = sigPlayArea.querySelectorAll('.sig-bubble:not(.signed)');
  bubbles.forEach(b => b.remove());
  
  if (isWon) {
    playSound('success');
    // 進入一讀典禮
    ceremonyBillTitle.textContent = BILLS[gameState.selectedBill].title;
    firstReadingCeremony.classList.remove('hidden');
    
    // 顯示一讀敲槌按鈕
    btnStrikeGavelS1.classList.remove('hidden');
  } else {
    playSound('fail');
    alert("連署時間到！我們需要至少 15 位立委簽名才能順利提案。請再挑戰一次！");
    initStage1();
  }
}

// 敲一讀槌
gavelAnimS1.addEventListener('click', strikeGavelS1);
btnStrikeGavelS1.addEventListener('click', strikeGavelS1);

function strikeGavelS1() {
  if (gavelAnimS1.classList.contains('striking')) return;
  
  gavelAnimS1.classList.add('striking');
  playSound('gavel');
  
  setTimeout(() => {
    gavelAnimS1.classList.remove('striking');
    btnStrikeGavelS1.classList.add('hidden');
    btnToStage2.classList.remove('hidden');
  }, 500);
}

btnToStage2.addEventListener('click', () => {
  switchScreen('stage2');
});

// --- 3. 第二關：委員會審查與協商邏輯 ---
const sortingDeck = document.getElementById('sorting-deck');
const supportSlots = document.getElementById('support-slots');
const opposeSlots = document.getElementById('oppose-slots');
const sortingFeedback = document.getElementById('sorting-feedback');
const negGameContainer = document.getElementById('negotiation-game-container');
const btnToStage3 = document.getElementById('btn-to-stage3');

// 協商控制
const sliders = {
  a: document.getElementById('slider-party-a'),
  b: document.getElementById('slider-party-b'),
  c: document.getElementById('slider-party-c')
};
const valDisplays = {
  a: document.getElementById('val-party-a'),
  b: document.getElementById('val-party-b'),
  c: document.getElementById('val-party-c')
};
const pointers = {
  a: document.getElementById('ptr-party-a'),
  b: document.getElementById('ptr-party-b'),
  c: document.getElementById('ptr-party-c')
};
const negFeedback = document.getElementById('negotiation-feedback');

function initStage2() {
  gameState.sortingCorrectCount = 0;
  gameState.negotiationSolved = false;
  
  sortingFeedback.textContent = "";
  sortingFeedback.style.color = "var(--text-light)";
  
  // 清空 slots
  supportSlots.innerHTML = "";
  opposeSlots.innerHTML = "";
  sortingDeck.innerHTML = "";
  
  negGameContainer.classList.add('hidden');
  btnToStage3.classList.add('hidden');
  
  // 建立分類卡片庫
  const billInfo = BILLS[gameState.selectedBill];
  const cardsData = [...billInfo.cardSorting];
  
  // 隨機洗牌
  cardsData.sort(() => Math.random() - 0.5);
  
  // 渲染卡片 (堆疊在 Deck 區)
  cardsData.forEach((data, index) => {
    const card = document.createElement('div');
    card.className = 'sorting-card';
    card.textContent = data.text;
    card.dataset.type = data.type;
    card.draggable = true;
    
    // 設定堆疊效果 (只讓最上面的一張可拖曳，其他隱藏或疊在下面)
    card.style.transform = `translateY(${index * 2}px) rotate(${(index % 2 === 0 ? 1 : -1) * 1.5}deg)`;
    if (index !== cardsData.length - 1) {
      card.style.pointerEvents = 'none';
      card.style.opacity = '0.7';
    }
    
    // 拖曳事件 (HTML5 Drag & Drop)
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', data.type);
      card.classList.add('dragging');
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    
    // 行動裝置相容：點擊分類 (直接點擊卡片，再點擊左右框)
    card.addEventListener('click', () => {
      if (card.style.pointerEvents === 'none') return;
      
      // 亮起提示
      document.querySelectorAll('.sorting-bucket').forEach(b => {
        b.style.borderColor = "var(--color-primary)";
      });
      gameState.activeClickedCard = card;
    });

    sortingDeck.appendChild(card);
  });
  
  // 設定 Buckets Drag & Drop 監聽
  setupBucketEvents();
  
  // 重設協商拉桿
  sliders.a.value = 20;
  sliders.b.value = 80;
  sliders.c.value = 50;
  updateNegotiationSliders();
}

function setupBucketEvents() {
  const buckets = document.querySelectorAll('.sorting-bucket');
  buckets.forEach(bucket => {
    bucket.addEventListener('dragover', (e) => {
      e.preventDefault();
      bucket.classList.add('dragover');
    });
    
    bucket.addEventListener('dragleave', () => {
      bucket.classList.remove('dragover');
    });
    
    bucket.addEventListener('drop', (e) => {
      e.preventDefault();
      bucket.classList.remove('dragover');
      const cardType = e.dataTransfer.getData('text/plain');
      const draggingCard = document.querySelector('.sorting-card.dragging');
      
      handleCardPlacement(draggingCard, cardType, bucket);
    });
    
    // 行動版點擊落點
    bucket.addEventListener('click', () => {
      if (gameState.activeClickedCard) {
        const card = gameState.activeClickedCard;
        const cardType = card.dataset.type;
        handleCardPlacement(card, cardType, bucket);
        gameState.activeClickedCard = null;
        
        // 還原提示
        document.querySelectorAll('.sorting-bucket').forEach(b => {
          b.style.borderColor = "rgba(255, 255, 255, 0.1)";
        });
      }
    });
  });
}

function handleCardPlacement(card, cardType, bucket) {
  if (!card) return;
  
  const targetBucketType = bucket.dataset.target; // support or oppose
  
  if (cardType === targetBucketType) {
    // 分類正確
    playSound('bubble');
    card.classList.add('placed');
    card.draggable = false;
    card.style.transform = 'none';
    card.style.pointerEvents = 'none';
    card.style.opacity = '1';
    
    // 移入對應 bucket
    const slot = bucket.querySelector('.bucket-slots');
    slot.appendChild(card);
    
    gameState.sortingCorrectCount++;
    sortingFeedback.textContent = "答對了！觀點歸類正確！";
    sortingFeedback.style.color = "var(--color-success)";
    
    // 解鎖下一張卡片
    const remainingCards = sortingDeck.querySelectorAll('.sorting-card');
    if (remainingCards.length > 0) {
      const topCard = remainingCards[remainingCards.length - 1];
      topCard.style.pointerEvents = 'auto';
      topCard.style.opacity = '1';
      topCard.style.transform = 'none';
    }
    
    if (gameState.sortingCorrectCount === gameState.sortingTotal) {
      playSound('success');
      sortingFeedback.textContent = "委員會正反意見整理完畢！現在進入朝野協商階段。";
      // 顯示協商遊戲
      setTimeout(() => {
        negGameContainer.classList.remove('hidden');
        negGameContainer.scrollIntoView({ behavior: 'smooth' });
      }, 800);
    }
  } else {
    // 分類錯誤
    playSound('fail');
    sortingFeedback.textContent = "不對唷，這項觀點的屬性分錯了，請重新思考！";
    sortingFeedback.style.color = "var(--color-danger)";
  }
}

// 黨團協商拉桿事件
Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    updateNegotiationSliders();
  });
});

function updateNegotiationSliders() {
  const valA = parseInt(sliders.a.value);
  const valB = parseInt(sliders.b.value);
  const valC = parseInt(sliders.c.value);
  
  valDisplays.a.textContent = `${valA}%`;
  valDisplays.b.textContent = `${valB}%`;
  valDisplays.c.textContent = `${valC}%`;
  
  pointers.a.style.left = `${valA}%`;
  pointers.b.style.left = `${valB}%`;
  pointers.c.style.left = `${valC}%`;
  
  playSound('tick');
  
  // 判斷是否全部都在共識區 (45% ~ 55%)
  const minTarget = 45;
  const maxTarget = 55;
  
  if (valA >= minTarget && valA <= maxTarget &&
      valB >= minTarget && valB <= maxTarget &&
      valC >= minTarget && valC <= maxTarget) {
    
    if (!gameState.negotiationSolved) {
      gameState.negotiationSolved = true;
      playSound('success');
      negFeedback.textContent = "🎉 協商成功！朝野各黨達成折衷共識，本案送出審查報告，進入二讀會！";
      negFeedback.style.color = "var(--color-success)";
      btnToStage3.classList.remove('hidden');
    }
  } else {
    gameState.negotiationSolved = false;
    negFeedback.textContent = "朝野意見仍有分歧，繼續拉近彼此的差距...（將三方指針都調整至發光的共識區）";
    negFeedback.style.color = "var(--color-warning)";
    btnToStage3.classList.add('hidden');
  }
}

btnToStage3.addEventListener('click', () => {
  switchScreen('stage3');
});

// --- 4. 第三關：二讀會公民問答與大表決邏輯 ---
const quizQNum = document.getElementById('quiz-q-num');
const quizQuestion = document.getElementById('quiz-question');
const quizOptionsContainer = document.getElementById('quiz-options-container');
const quizFeedbackBox = document.getElementById('quiz-feedback-box');
const quizFeedbackText = document.getElementById('quiz-feedback-text');

const voteCountYes = document.getElementById('vote-count-yes');
const voteCountNo = document.getElementById('vote-count-no');
const voteCountUndecided = document.getElementById('vote-count-undecided');
const votingSeatsGrid = document.getElementById('voting-seats-grid');

const votingTriggerOverlay = document.getElementById('voting-trigger-overlay');
const btnStartElectronicVote = document.getElementById('btn-start-electronic-vote');
const btnToStage4 = document.getElementById('btn-to-stage4');

// 總席次 113
const TOTAL_SEATS = 113;
let seatElements = [];

function initStage3() {
  gameState.quizCurrentQuestion = 0;
  gameState.quizScore = 0;
  gameState.votingActive = false;
  gameState.yesVotes = 0;
  gameState.noVotes = 0;
  
  quizFeedbackBox.classList.add('hidden');
  votingTriggerOverlay.classList.add('hidden');
  btnToStage4.classList.add('hidden');
  
  voteCountYes.textContent = "0";
  voteCountNo.textContent = "0";
  voteCountUndecided.textContent = TOTAL_SEATS.toString();
  
  // 建立 113 席立委席次圓點
  votingSeatsGrid.innerHTML = "";
  seatElements = [];
  for (let i = 0; i < TOTAL_SEATS; i++) {
    const seat = document.createElement('div');
    seat.className = 'seat-dot';
    votingSeatsGrid.appendChild(seat);
    seatElements.push(seat);
  }
  
  // 載入問題
  loadQuizQuestion();
}

function loadQuizQuestion() {
  quizFeedbackBox.classList.add('hidden');
  
  if (gameState.quizCurrentQuestion < QUIZ_QUESTIONS.length) {
    const qData = QUIZ_QUESTIONS[gameState.quizCurrentQuestion];
    quizQNum.textContent = `第 ${gameState.quizCurrentQuestion + 1} / ${QUIZ_QUESTIONS.length} 題`;
    quizQuestion.textContent = qData.question;
    
    quizOptionsContainer.innerHTML = "";
    qData.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.innerHTML = opt;
      btn.addEventListener('click', () => handleQuizAnswer(idx, btn));
      quizOptionsContainer.appendChild(btn);
    });
  } else {
    // 答題結束，觸發投票準備
    quizQNum.textContent = "答題完成";
    quizQuestion.textContent = "游離票委員遊說完畢！準備啟動二讀會院會電子表決。";
    quizOptionsContainer.innerHTML = "";
    
    votingTriggerOverlay.classList.remove('hidden');
  }
}

function handleQuizAnswer(selectedIdx, clickedBtn) {
  const qData = QUIZ_QUESTIONS[gameState.quizCurrentQuestion];
  const allBtns = quizOptionsContainer.querySelectorAll('.quiz-opt-btn');
  
  // 停用所有按鈕
  allBtns.forEach(btn => btn.style.pointerEvents = 'none');
  
  if (selectedIdx === qData.answer) {
    // 答對了
    playSound('success');
    gameState.quizScore++;
    clickedBtn.classList.add('correct');
    
    quizFeedbackBox.classList.remove('hidden');
    quizFeedbackText.innerHTML = `<strong>答對了！</strong> ${qData.explanation}`;
    quizFeedbackText.style.color = "var(--color-success)";
    
    // 說服立委：讓 22 位立委變成贊成 (綠色)
    convinceLegislators(true, 22);
  } else {
    // 答錯了
    playSound('fail');
    clickedBtn.classList.add('wrong');
    allBtns[qData.answer].classList.add('correct'); // 顯示正確答案
    
    quizFeedbackBox.classList.remove('hidden');
    quizFeedbackText.innerHTML = `<strong>答錯了。</strong>正確答案是第一個選項。<br>${qData.explanation}`;
    quizFeedbackText.style.color = "var(--color-danger)";
    
    // 說服失敗：讓 10 位立委變成反對 (紅色)
    convinceLegislators(false, 10);
  }
  
  // 3秒後進入下一題
  setTimeout(() => {
    gameState.quizCurrentQuestion++;
    loadQuizQuestion();
  }, 4000);
}

function convinceLegislators(isYes, num) {
  let count = 0;
  // 隨機挑選未決定的席次
  const undecidedIndices = [];
  seatElements.forEach((seat, idx) => {
    if (!seat.classList.contains('yes') && !seat.classList.contains('no')) {
      undecidedIndices.push(idx);
    }
  });
  
  // 洗牌隨機順序
  undecidedIndices.sort(() => Math.random() - 0.5);
  
  const toChange = Math.min(num, undecidedIndices.length);
  for (let i = 0; i < toChange; i++) {
    const seatIdx = undecidedIndices[i];
    if (isYes) {
      seatElements[seatIdx].classList.add('yes');
      gameState.yesVotes++;
    } else {
      seatElements[seatIdx].classList.add('no');
      gameState.noVotes++;
    }
  }
  
  // 更新 HUD 計數
  voteCountYes.textContent = gameState.yesVotes.toString();
  voteCountNo.textContent = gameState.noVotes.toString();
  voteCountUndecided.textContent = (TOTAL_SEATS - gameState.yesVotes - gameState.noVotes).toString();
}

// 點擊啟動表決
btnStartElectronicVote.addEventListener('click', () => {
  playSound('click');
  votingTriggerOverlay.classList.add('hidden');
  runVotingSimulation();
});

function runVotingSimulation() {
  gameState.votingActive = true;
  
  // 找出所有尚未投票的立委
  const undecidedIndices = [];
  seatElements.forEach((seat, idx) => {
    if (!seat.classList.contains('yes') && !seat.classList.contains('no')) {
      undecidedIndices.push(idx);
    }
  });
  
  let i = 0;
  
  // 答題得分越高，剩餘立委投贊成的機率越高
  // 3分: 80% 投贊成
  // 2分: 60% 投贊成
  // 1分: 40% 投贊成
  // 0分: 30% 投贊成
  let passProbability = 0.3;
  if (gameState.quizScore === 3) passProbability = 0.85;
  else if (gameState.quizScore === 2) passProbability = 0.65;
  else if (gameState.quizScore === 1) passProbability = 0.45;

  // 定時器動態開票
  const voteInterval = setInterval(() => {
    if (i >= undecidedIndices.length) {
      clearInterval(voteInterval);
      finishVote();
      return;
    }
    
    const seatIdx = undecidedIndices[i];
    const roll = Math.random();
    
    if (roll < passProbability) {
      seatElements[seatIdx].classList.add('yes');
      gameState.yesVotes++;
    } else {
      seatElements[seatIdx].classList.add('no');
      gameState.noVotes++;
    }
    
    voteCountYes.textContent = gameState.yesVotes.toString();
    voteCountNo.textContent = gameState.noVotes.toString();
    voteCountUndecided.textContent = (TOTAL_SEATS - gameState.yesVotes - gameState.noVotes).toString();
    
    playSound('tick');
    i++;
  }, 40); // 快速滾動開票
}

function finishVote() {
  gameState.votingActive = false;
  
  if (gameState.yesVotes >= 57) {
    playSound('cheer');
    alert(`表決結果：贊成 ${gameState.yesVotes} 票，反對 ${gameState.noVotes} 票。過半數委員贊成，本案二讀通過！`);
    btnToStage4.classList.remove('hidden');
    btnToStage4.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    alert(`表決結果：贊成 ${gameState.yesVotes} 票，反對 ${gameState.noVotes} 票。未達過半數通過門檻（57票），法案被否決！\n\n別氣餒，請重新回答問題爭取更多支持，再挑戰表決！`);
    initStage3(); // 重新挑戰
  }
}

btnToStage4.addEventListener('click', () => {
  switchScreen('stage4');
});

// --- 5. 第四關：三讀會字句校對與敲槌邏輯 ---
const proofreadBillTitle = document.getElementById('proofread-bill-title');
const proofreadBillContent = document.getElementById('proofread-bill-content');
const proofreadCorrectedCount = document.getElementById('proofread-corrected-count');
const proofreadFeedback = document.getElementById('proofread-feedback');

const thirdReadingCeremony = document.getElementById('third-reading-ceremony');
const ceremonyBillTitleS4 = document.getElementById('ceremony-bill-title-s4');
const btnStrikeGavelS4 = document.getElementById('btn-strike-gavel-s4');
const gavelAnimS4 = document.getElementById('gavel-anim-s4');
const btnToStage5 = document.getElementById('btn-to-stage5');

function initStage4() {
  gameState.proofreadCorrected = 0;
  proofreadCorrectedCount.textContent = "0";
  proofreadFeedback.textContent = "";
  
  thirdReadingCeremony.classList.add('hidden');
  btnToStage5.classList.add('hidden');
  
  // 載入本案的條文文字
  const billInfo = BILLS[gameState.selectedBill];
  proofreadBillTitle.textContent = billInfo.title + " (草案)";
  proofreadBillContent.innerHTML = billInfo.content;
  
  // 為錯字綁定點擊事件
  const typoTargets = proofreadBillContent.querySelectorAll('.typo-target');
  typoTargets.forEach(typo => {
    typo.addEventListener('click', () => {
      if (typo.classList.contains('fixed')) return;
      
      const correctWord = typo.dataset.correct;
      typo.textContent = correctWord;
      typo.classList.add('fixed');
      
      gameState.proofreadCorrected++;
      proofreadCorrectedCount.textContent = gameState.proofreadCorrected;
      playSound('bubble');
      
      if (gameState.proofreadCorrected === gameState.proofreadTotal) {
        playSound('success');
        proofreadFeedback.textContent = "🎉 字句校對完成！沒有牴觸憲法與法律。本案無異議進行三讀表決通過！";
        
        // 進入三讀敲槌典禮
        setTimeout(() => {
          ceremonyBillTitleS4.textContent = billInfo.shortTitle;
          thirdReadingCeremony.classList.remove('hidden');
          btnStrikeGavelS4.classList.remove('hidden');
          thirdReadingCeremony.scrollIntoView({ behavior: 'smooth' });
        }, 1000);
      }
    });
  });
}

// 敲三讀槌
gavelAnimS4.addEventListener('click', strikeGavelS4);
btnStrikeGavelS4.addEventListener('click', strikeGavelS4);

function strikeGavelS4() {
  if (gavelAnimS4.classList.contains('striking')) return;
  
  gavelAnimS4.classList.add('striking');
  playSound('gavel');
  
  setTimeout(() => {
    gavelAnimS4.classList.remove('striking');
    btnStrikeGavelS4.classList.add('hidden');
    btnToStage5.classList.remove('hidden');
  }, 500);
}

btnToStage5.addEventListener('click', () => {
  switchScreen('stage5');
});

// --- 6. 第五關：總統公布與行政院覆議挑戰邏輯 ---
const vetoBillTitle = document.getElementById('veto-bill-title');
const vetoAlertContainer = document.getElementById('veto-alert-container');
const btnStartVetoGame = document.getElementById('btn-start-veto-game');
const vetoGameContainer = document.getElementById('veto-game-container');

const vetoProgressFill = document.getElementById('veto-progress-fill');
const vetoVotesSpan = document.getElementById('veto-votes');
const vetoTimerSpan = document.getElementById('veto-timer');
const btnClickVote = document.getElementById('btn-click-vote');

const vetoSuccessBox = document.getElementById('veto-success-box');
const vetoFailBox = document.getElementById('veto-fail-box');

const btnToCertificate = document.getElementById('btn-to-certificate');
const btnRestartVeto = document.getElementById('btn-restart-veto');

function initStage5() {
  gameState.vetoClicks = 0;
  gameState.vetoTimeLeft = 8.0;
  gameState.vetoGameActive = false;
  
  vetoBillTitle.textContent = BILLS[gameState.selectedBill].title;
  
  vetoAlertContainer.classList.remove('hidden');
  vetoGameContainer.classList.add('hidden');
  vetoSuccessBox.classList.add('hidden');
  vetoFailBox.classList.add('hidden');
  
  vetoProgressFill.style.width = "0%";
  vetoVotesSpan.textContent = "0";
  vetoTimerSpan.textContent = "8.0";
}

btnStartVetoGame.addEventListener('click', () => {
  playSound('click');
  vetoAlertContainer.classList.add('hidden');
  vetoGameContainer.classList.remove('hidden');
  gameState.vetoGameActive = true;
  
  // 倒數計時器 (支援小數點 1/10 秒更新)
  gameState.vetoTimer = setInterval(() => {
    gameState.vetoTimeLeft -= 0.1;
    if (gameState.vetoTimeLeft <= 0) {
      gameState.vetoTimeLeft = 0;
      clearInterval(gameState.vetoTimer);
      endVetoGame();
    }
    vetoTimerSpan.textContent = gameState.vetoTimeLeft.toFixed(1);
    
    // 如果快倒數完且沒完成，發出緊張滴答聲
    if (gameState.vetoTimeLeft < 3.0 && gameState.vetoTimeLeft > 0) {
      playSound('tick');
    }
  }, 100);
});

// 狂點表決
btnClickVote.addEventListener('click', () => {
  if (!gameState.vetoGameActive) return;
  
  gameState.vetoClicks++;
  
  // 1 點 = 2 票，最多 113 票
  const totalVotes = Math.min(113, gameState.vetoClicks * 2);
  vetoVotesSpan.textContent = totalVotes;
  
  // 填滿進度條
  const percent = (totalVotes / 113) * 100;
  vetoProgressFill.style.width = `${percent}%`;
  
  playSound('bubble');
});

function endVetoGame() {
  gameState.vetoGameActive = false;
  vetoGameContainer.classList.add('hidden');
  
  const finalVotes = Math.min(113, gameState.vetoClicks * 2);
  
  if (finalVotes >= 57) {
    // 覆議成功，駁回行政院覆議
    playSound('cheer');
    triggerConfetti();
    vetoSuccessBox.classList.remove('hidden');
    vetoSuccessBox.scrollIntoView({ behavior: 'smooth' });
  } else {
    // 覆議失敗，退回
    playSound('fail');
    vetoFailBox.classList.remove('hidden');
    vetoFailBox.scrollIntoView({ behavior: 'smooth' });
  }
}

// 重新挑戰覆議
btnRestartVeto.addEventListener('click', () => {
  initStage5();
});

btnToCertificate.addEventListener('click', () => {
  switchScreen('cert');
});

// --- 7. 證書畫面邏輯 ---
const certPlayerName = document.getElementById('cert-player-name');
const certBillTitle = document.getElementById('cert-bill-title');
const certDateYear = document.getElementById('cert-date-year');
const certDateMonth = document.getElementById('cert-date-month');
const certDateDay = document.getElementById('cert-date-day');

const btnPrintCertificate = document.getElementById('btn-print-certificate');
const btnRestartAll = document.getElementById('btn-restart-all');

function sendDataToBackend() {
  if (!syncStatusBox || !syncIcon || !syncText) return;

  if (GOOGLE_SHEET_APP_URL === "") {
    // 未設定後端，單機模式
    syncStatusBox.className = "sync-status-box failed";
    syncIcon.className = "fas fa-exclamation-circle sync-icon";
    syncText.textContent = "⚠️ 教師未設定 Google 試算表串接網址，作答成果未同步（單機模式）。";
    return;
  }

  // 設定為同步中狀態
  syncStatusBox.className = "sync-status-box syncing";
  syncIcon.className = "fas fa-sync sync-icon";
  syncText.textContent = "正在同步成果至雲端試算表...";

  const payload = {
    class: gameState.playerClass,
    seat: gameState.playerSeat,
    name: gameState.playerName,
    bill: BILLS[gameState.selectedBill].title,
    score: gameState.quizScore,
    passed: (gameState.vetoClicks * 2 >= 57) ? "是" : "否",
    timestamp: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
  };

  // 使用 mode: 'no-cors' 來避免跨網域 CORS 問題
  fetch(GOOGLE_SHEET_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(() => {
    // 成功同步 (no-cors 即使拿到 opaque response 也會 resolve)
    syncStatusBox.className = "sync-status-box success";
    syncIcon.className = "fas fa-check-circle sync-icon";
    syncText.textContent = "🎉 學習成果已成功同步至教師的 Google 試算表！";
  })
  .catch((error) => {
    console.error("Backend sync failed:", error);
    syncStatusBox.className = "sync-status-box failed";
    syncIcon.className = "fas fa-times-circle sync-icon";
    syncText.textContent = "❌ 同步失敗，請檢查網路連線或通知教師！";
  });
}

function initCertificate() {
  certPlayerName.textContent = gameState.playerName;
  certBillTitle.textContent = BILLS[gameState.selectedBill].title;
  
  // 設定當前民國日期
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  certDateYear.textContent = (year - 1911).toString();
  certDateMonth.textContent = month.toString();
  certDateDay.textContent = day.toString();
  
  // 觸發後端同步
  sendDataToBackend();
  
  triggerConfetti();
}

btnPrintCertificate.addEventListener('click', () => {
  playSound('click');
  window.print();
});

btnRestartAll.addEventListener('click', () => {
  switchScreen('select');
});

// --- 五彩紙屑 (Confetti) 效果產生器 ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let confettiActive = false;
let confettiParticles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * -canvas.height - 20;
    this.size = Math.random() * 8 + 6;
    this.color = `hsl(${Math.random() * 360}, 85%, 60%)`;
    this.speedX = Math.random() * 3 - 1.5;
    this.speedY = Math.random() * 5 + 3;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    
    // 如果掉出畫面，重新從上方產生
    if (this.y > canvas.height) {
      this.y = -20;
      this.x = Math.random() * canvas.width;
    }
  }
  
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function triggerConfetti() {
  confettiActive = true;
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  
  animateConfetti();
  
  // 5秒後自動停止動畫以節省 CPU
  setTimeout(() => {
    confettiActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 6000);
}

function animateConfetti() {
  if (!confettiActive) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  confettiParticles.forEach(p => {
    p.update();
    p.draw();
  });
  
  requestAnimationFrame(animateConfetti);
}

// --- 初始化啟動 ---
// 預設回到 intro
switchScreen('intro');
console.log("法案奇幻冒險：三讀闖關大作戰！載入完成！");
