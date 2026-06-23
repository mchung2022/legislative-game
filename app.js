/* ==========================================
   台灣選舉制度互動式遊戲 - 核心邏輯
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. 遊戲全局狀態與變數
  // ==========================================
  const gameState = {
    playerName: '選民訪客',
    playerClass: '',
    playerSeat: '',
    difficulty: 'first-voter', // 'first-voter', 'youth-candidate', 'senior-politician'
    currentScore: 0,
    currentScreen: 'intro',
    soundEnabled: true,
    
    // 關卡進度與結果
    stage1Complete: false,
    stage1Score: 0,
    referendumPassed: false,
    
    stage2Complete: false,
    stage2Strategy: null,
    stage2Results: null,
    
    stage3Complete: false,
    stage3DistrictVote: null,
    stage3PartyVote: null,
    stage3PartyShares: {
      'A': 40, // 藍天進步黨
      'B': 35, // 民主希望隊
      'C': 12, // 陽光力量聯盟
      'D': 6,  // 新潮青年黨
      'E': 4,  // 生態綠能黨
      'F': 3   // 勞工權益盟
    },
    
    stage4Complete: false,
    stage4Score: 0
  };

  // ==========================================
  // 2. 音效引擎 (Web Audio API)
  // ==========================================
  let audioCtx = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      // 支援不同瀏覽器的 AudioContext
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser");
    }
  }

  function playSound(type) {
    if (!gameState.soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    
    // 如果處於暫停狀態，嘗試恢復（瀏覽器安全限制）
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
      case 'click':
        // 短促啵聲
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

      case 'stamp':
        // 蓋章咚聲
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.15);
        
        // 混入一點點噪音模擬紙張衝擊
        createNoiseBuffer(now, 0.08, 0.05);
        
        osc.start(now);
        osc.stop(now + 0.15);
        break;

      case 'ballot':
        // 投遞選票沙沙聲與沉重聲
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);
        
        createNoiseBuffer(now, 0.2, 0.1);
        
        osc.start(now);
        osc.stop(now + 0.25);
        break;

      case 'success':
        // 答對的大三和弦琶音
        const freqs = [330, 440, 554, 660]; // A major
        freqs.forEach((f, index) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          
          o.type = 'sine';
          o.frequency.setValueAtTime(f, now + index * 0.06);
          g.gain.setValueAtTime(0.12, now + index * 0.06);
          g.gain.linearRampToValueAtTime(0.01, now + index * 0.06 + 0.25);
          
          o.start(now + index * 0.06);
          o.stop(now + index * 0.06 + 0.25);
        });
        break;

      case 'error':
        // 答錯的低沉嗡嗡聲
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.35);
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;

      case 'celebrate':
        // 勝利凱旋鐘聲和弦
        const chord = [261.63, 329.63, 392.00, 523.25]; // C major
        chord.forEach((f, idx) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          
          o.type = 'triangle';
          o.frequency.setValueAtTime(f, now);
          o.frequency.exponentialRampToValueAtTime(f * 0.99, now + 0.8);
          g.gain.setValueAtTime(0.15, now);
          g.gain.linearRampToValueAtTime(0.01, now + 0.8);
          
          o.start(now);
          o.stop(now + 0.8);
        });
        break;
    }
  }

  // 輔助函數：合成噪音模擬摩擦聲
  function createNoiseBuffer(startTime, duration, volume) {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, startTime);
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(volume, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    noiseNode.start(startTime);
    noiseNode.stop(startTime + duration);
  }

  // 音效開關按鈕監聽
  const soundToggleBtn = document.getElementById('sound-toggle');
  soundToggleBtn.addEventListener('click', () => {
    gameState.soundEnabled = !gameState.soundEnabled;
    const icon = soundToggleBtn.querySelector('i');
    if (gameState.soundEnabled) {
      icon.className = 'fas fa-volume-up';
      playSound('click');
    } else {
      icon.className = 'fas fa-volume-mute';
    }
  });

  // ==========================================
  // 3. Canvas 五彩紙屑 (Confetti) 特效
  // ==========================================
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let confettiActive = false;
  let confettiParticles = [];
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#a855f7', '#00f2fe'];

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
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.speed = Math.random() * 3 + 2;
      this.angle = Math.random() * Math.PI * 2;
      this.spin = Math.random() * 0.2 - 0.1;
      this.wind = Math.random() * 1 - 0.5;
    }

    update() {
      this.y += this.speed;
      this.x += this.wind;
      this.angle += this.spin;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.restore();
    }
  }

  function startConfetti() {
    confettiActive = true;
    confettiParticles = [];
    for (let i = 0; i < 120; i++) {
      confettiParticles.push(new ConfettiParticle());
    }
    animateConfetti();
  }

  function stopConfetti() {
    confettiActive = false;
  }

  function animateConfetti() {
    if (!confettiActive && confettiParticles.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.update();
      p.draw();
      
      // 超出邊界重置或刪除
      if (p.y > canvas.height) {
        if (confettiActive) {
          confettiParticles[i] = new ConfettiParticle();
        } else {
          confettiParticles.splice(i, 1);
        }
      }
    }
    requestAnimationFrame(animateConfetti);
  }


  // ==========================================
  // 4. 路由與畫面切換控制器
  // ==========================================
  const screens = {
    'intro': document.getElementById('screen-intro'),
    'stage1': document.getElementById('screen-stage1'),
    'stage2': document.getElementById('screen-stage2'),
    'stage3': document.getElementById('screen-stage3'),
    'stage4': document.getElementById('screen-stage4'),
    'certificate': document.getElementById('screen-certificate')
  };

  const hudLevelVal = document.getElementById('hud-level');
  const hudScoreVal = document.getElementById('hud-score');
  const timelineProgressBar = document.getElementById('timeline-progress-bar');

  function updateHUD() {
    hudScoreVal.textContent = gameState.currentScore;
    
    // 更新 Timeline 進度條寬度與節點
    const levelMap = {
      'intro': { step: 0, label: '選民登錄' },
      'stage1': { step: 1, label: '選民資格與公投' },
      'stage2': { step: 2, label: '總統相對多數' },
      'stage3': { step: 3, label: '立委兩票制' },
      'stage4': { step: 4, label: '地方九合一' },
      'certificate': { step: 5, label: '公民證書' }
    };
    
    const info = levelMap[gameState.currentScreen];
    hudLevelVal.textContent = info.label;
    
    // 計算寬度百分比
    const totalSteps = 5;
    const progressPct = (info.step / totalSteps) * 100;
    timelineProgressBar.style.width = `${progressPct}%`;
    
    // 點亮節點
    for (let i = 0; i <= 5; i++) {
      const node = document.getElementById(`node-${i}`);
      if (!node) continue;
      node.classList.remove('active', 'completed');
      if (i < info.step) {
        node.classList.add('completed');
      } else if (i === info.step) {
        node.classList.add('active');
      }
    }
  }

  function showScreen(screenId) {
    playSound('click');
    gameState.currentScreen = screenId;
    
    // 隱藏所有畫面，顯示指定畫面
    Object.keys(screens).forEach(key => {
      screens[key].classList.remove('active');
    });
    screens[screenId].classList.add('active');
    
    updateHUD();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 觸發各關卡載入邏輯
    if (screenId === 'stage1') {
      loadStage1();
    } else if (screenId === 'stage2') {
      loadStage2();
    } else if (screenId === 'stage3') {
      loadStage3();
    } else if (screenId === 'stage4') {
      loadStage4();
    } else if (screenId === 'certificate') {
      loadCertificate();
    }
  }


  // ==========================================
  // 5. 關卡零：角色登錄與初始化
  // ==========================================
  const btnStartGame = document.getElementById('btn-start-game');
  const playerNameInput = document.getElementById('player-name-input');
  const playerClassInput = document.getElementById('player-class-input');
  const playerSeatInput = document.getElementById('player-seat-input');
  const roleCards = document.querySelectorAll('.role-card');
  const hudCharName = document.getElementById('hud-char-name');
  const hudAvatarMini = document.getElementById('hud-avatar-mini');

  // 參政身份卡片選擇點擊
  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      gameState.difficulty = card.dataset.role;
      playSound('click');
    });
  });

  // 開始遊戲點擊
  btnStartGame.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
      alert('請輸入您的選民名字！');
      playerNameInput.focus();
      return;
    }
    
    gameState.playerName = name;
    gameState.playerClass = playerClassInput.value.trim();
    gameState.playerSeat = playerSeatInput.value.trim();
    
    // 更新頂部 HUD 頭像與名稱
    hudCharName.textContent = gameState.playerName;
    
    const roleIcons = {
      'first-voter': '<i class="fas fa-graduation-cap"></i>',
      'youth-candidate': '<i class="fas fa-bullhorn"></i>',
      'senior-politician': '<i class="fas fa-landmark"></i>'
    };
    hudAvatarMini.innerHTML = roleIcons[gameState.difficulty];
    
    // 開始遊戲
    showScreen('stage1');
  });


  // ==========================================
  // 6. 關卡一：選民參政權與公投門檻
  // ==========================================
  
  // 任務 1：資格拖曳卡片陣列
  const eligibilityCards = [
    { name: '阿婷', age: 18, desc: '剛從高中畢業。她非常熱衷於能源與動物保育政策，希望能參與這次的全國性公民投票。', zone: 'referendum-only' },
    { name: '陳大明', age: 21, desc: '正在就讀大學。今年剛好遇到家鄉的市長選舉，他希望能為支持的市長候選人投票。', zone: 'voter' },
    { name: '張小草', age: 26, desc: '地方社區發展協會的青年。他關心地方創生，決定出面參選今年的縣市議員。', zone: 'candidate-legislator' },
    { name: '蔡先生', age: 42, desc: '擁有豐富地方執政經驗的政治人物。在大家的支持下，他決定登記參選中華民國總統。', zone: 'candidate-president' },
    { name: '小雅', age: 19, desc: '大一學生。雖然她有權去投「核四重啟公投案」，但她很困惑自己今年是否能去投縣長票。', zone: 'referendum-only' },
    { name: '李小姐', age: 23, desc: '回鄉創業的返鄉青年。她認為立法需要青年的視角，決定投入今年年底的立法委員選舉。', zone: 'candidate-legislator' }
  ];

  let cardQueue = [];
  let currentCardIndex = 0;
  
  const activeSortCard = document.getElementById('active-sort-card');
  const sortCardName = document.getElementById('sort-card-name');
  const sortCardAge = document.getElementById('sort-card-age');
  const sortCardDesc = document.getElementById('sort-card-desc');
  const sortRemain = document.getElementById('sort-remain');
  const eligibilityFeedback = document.getElementById('eligibility-feedback');
  
  const dropZones = document.querySelectorAll('.drop-zone');
  const referendumGameContainer = document.getElementById('referendum-game-container');
  const btnToStage2 = document.getElementById('btn-to-stage2');

  function loadStage1() {
    cardQueue = [...eligibilityCards];
    // 根據難度進行隨機排序
    cardQueue.sort(() => Math.random() - 0.5);
    currentCardIndex = 0;
    gameState.stage1Score = 0;
    
    // 隱藏公投模擬器
    referendumGameContainer.classList.add('hidden');
    document.getElementById('eligibility-game-container').classList.remove('hidden');
    btnToStage2.classList.add('hidden');
    
    renderActiveCard();
  }

  function renderActiveCard() {
    if (currentCardIndex >= cardQueue.length) {
      // 任務 1 完成，進入任務 2
      document.getElementById('eligibility-game-container').classList.add('hidden');
      loadReferendumSimulator();
      return;
    }
    
    const card = cardQueue[currentCardIndex];
    sortCardName.textContent = card.name;
    sortCardAge.textContent = `年齡：${card.age} 歲`;
    sortCardDesc.textContent = card.desc;
    sortRemain.textContent = cardQueue.length - currentCardIndex;
    
    eligibilityFeedback.className = 'feedback-message';
    eligibilityFeedback.textContent = '';
    
    // 重置卡片動畫
    activeSortCard.style.animation = 'none';
    activeSortCard.offsetHeight; // 觸發 reflow
    activeSortCard.style.animation = 'dealCard 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';
  }

  // 拖曳與點擊放置邏輯
  dropZones.forEach(zone => {
    // 點擊判定模式
    zone.addEventListener('click', () => {
      checkDropMatch(zone.dataset.zone);
    });

    // 拖曳過渡效果
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      checkDropMatch(zone.dataset.zone);
    });
  });

  activeSortCard.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', 'card');
  });

  function checkDropMatch(zoneName) {
    const card = cardQueue[currentCardIndex];
    const zoneLabels = {
      'referendum-only': '僅限公民投票 (18歲)',
      'voter': '具一般選舉權 (20歲)',
      'candidate-legislator': '可參選立委與公職 (23歲)',
      'candidate-president': '可參選總統 (40歲)'
    };

    if (card.zone === zoneName) {
      // 答對了！
      playSound('success');
      gameState.currentScore += 10;
      gameState.stage1Score += 10;
      updateHUD();
      
      eligibilityFeedback.className = 'feedback-message feedback-success';
      eligibilityFeedback.textContent = `正確！${card.name}(${card.age}歲) 的確符合「${zoneLabels[card.zone]}」的資格！`;
    } else {
      // 答錯了
      playSound('error');
      eligibilityFeedback.className = 'feedback-message feedback-error';
      eligibilityFeedback.textContent = `答錯囉！${card.name}(${card.age}歲) 應歸類在「${zoneLabels[card.zone]}」。`;
    }
    
    // 動動手稍微延遲後切入下一張卡
    currentCardIndex++;
    setTimeout(renderActiveCard, 1500);
  }

  // 任務 2：公投模擬器
  const sliderTurnout = document.getElementById('slider-turnout');
  const sliderAgree = document.getElementById('slider-agree');
  const valTurnout = document.getElementById('val-turnout');
  const valAgree = document.getElementById('val-agree');
  const calcAgreeVotes = document.getElementById('sim-calc-agree-votes');
  
  const barAgree = document.getElementById('bar-agree');
  const barAgreeLbl = document.getElementById('bar-agree-lbl');
  const barDisagree = document.getElementById('bar-disagree');
  const barDisagreeLbl = document.getElementById('bar-disagree-lbl');
  const barNoVote = document.getElementById('bar-no-vote');
  
  const simStatusBox = document.getElementById('sim-status-box');
  const simStatusIcon = document.getElementById('sim-status-icon');
  const simStatusTitle = document.getElementById('sim-status-title');
  const simStatusDesc = document.getElementById('sim-status-desc');
  const btnSubmitReferendum = document.getElementById('btn-submit-referendum');

  function loadReferendumSimulator() {
    referendumGameContainer.classList.remove('hidden');
    updateReferendumOutputs();
  }

  function updateReferendumOutputs() {
    const turnout = parseInt(sliderTurnout.value);
    const agreeOfTurnout = parseInt(sliderAgree.value);
    const disagreeOfTurnout = 100 - agreeOfTurnout;

    valTurnout.textContent = `${turnout}%`;
    valAgree.textContent = `${agreeOfTurnout}%`;

    // 總公民人數 1900 萬
    const totalVoters = 19000000;
    const voteCast = totalVoters * (turnout / 100);
    const agreeVotes = voteCast * (agreeOfTurnout / 100);
    const disagreeVotes = voteCast * (disagreeOfTurnout / 100);

    calcAgreeVotes.textContent = `${(agreeVotes / 10000).toFixed(0)} 萬票`;

    // 計算各長條比例 (未投票、同意佔總人口比例、不同意佔總人口比例)
    const agreeTotalPct = (turnout * agreeOfTurnout) / 100;
    const disagreeTotalPct = (turnout * disagreeOfTurnout) / 100;
    const noVotePct = 100 - turnout;

    barAgree.style.height = `${agreeTotalPct}%`;
    barAgreeLbl.textContent = `同意: ${agreeTotalPct.toFixed(1)}%`;
    
    barDisagree.style.height = `${disagreeTotalPct}%`;
    barDisagreeLbl.textContent = `不同意: ${disagreeTotalPct.toFixed(1)}%`;
    
    barNoVote.style.height = `${noVotePct}%`;

    // 門檻判定
    const thresholdAgreePct = 25; // 同意票須達 25% 以上
    const condition1 = agreeOfTurnout > disagreeOfTurnout; // 同意多於不同意
    const condition2 = agreeTotalPct >= thresholdAgreePct; // 同意票達 25% 以上

    if (condition1 && condition2) {
      // 通過！
      simStatusBox.className = 'sim-status-box passed';
      simStatusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
      simStatusTitle.textContent = '公投結果：正式通過！';
      simStatusDesc.textContent = `同意票佔總公民數的 ${agreeTotalPct.toFixed(1)}% (達25%門檻)，且同意票多於不同意票。這項公投將實施！`;
      btnSubmitReferendum.classList.remove('hidden');
    } else {
      // 未通過
      simStatusBox.className = 'sim-status-box';
      simStatusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
      simStatusTitle.textContent = '公投結果：未通過！';
      
      let failReason = '';
      if (!condition1) {
        failReason = '不同意票數大於或等於同意票數。';
      } else if (!condition2) {
        failReason = `同意票雖多於不同意，但同意率僅佔總公民的 ${agreeTotalPct.toFixed(1)}%，未達總投票權人 25% 的低標 (475萬票)。`;
      }
      
      simStatusDesc.textContent = failReason;
      btnSubmitReferendum.classList.add('hidden');
    }
  }

  sliderTurnout.addEventListener('input', () => {
    updateReferendumOutputs();
    playSound('click');
  });

  sliderAgree.addEventListener('input', () => {
    updateReferendumOutputs();
    playSound('click');
  });

  btnSubmitReferendum.addEventListener('click', () => {
    playSound('celebrate');
    startConfetti();
    setTimeout(stopConfetti, 2500);
    
    gameState.stage1Complete = true;
    gameState.currentScore += 20; // 通過模擬器的加分
    updateHUD();
    
    // 解鎖往第二關按鈕
    btnSubmitReferendum.classList.add('hidden');
    btnToStage2.classList.remove('hidden');
  });

  btnToStage2.addEventListener('click', () => {
    showScreen('stage2');
  });


  // ==========================================
  // 7. 關卡二：總統大選決戰 (相對多數決)
  // ==========================================
  const campaignOptions = document.querySelectorAll('.campaign-option-card');
  const campaignPreviewBox = document.getElementById('campaign-preview-box');
  const btnStartPresVote = document.getElementById('btn-start-pres-vote');
  
  const presResultsContainer = document.getElementById('pres-results-container');
  const playerCandName = document.getElementById('player-cand-name');
  
  const cand1Pct = document.getElementById('cand-1-pct');
  const cand1Bar = document.getElementById('cand-1-bar');
  const cand1Votes = document.getElementById('cand-1-votes');
  
  const cand2Pct = document.getElementById('cand-2-pct');
  const cand2Bar = document.getElementById('cand-2-bar');
  const cand2Votes = document.getElementById('cand-2-votes');
  
  const cand3Pct = document.getElementById('cand-3-pct');
  const cand3Bar = document.getElementById('cand-3-bar');
  const cand3Votes = document.getElementById('cand-3-votes');
  
  const btnToStage3 = document.getElementById('btn-to-stage3');
  const electionAnalysisBox = document.getElementById('election-analysis-box');

  function loadStage2() {
    campaignPreviewBox.classList.add('hidden');
    presResultsContainer.classList.add('hidden');
    btnToStage3.classList.add('hidden');
    electionAnalysisBox.classList.add('hidden');
    
    campaignOptions.forEach(opt => opt.classList.remove('active'));
    playerCandName.textContent = gameState.playerName;
  }

  // 策略選擇
  campaignOptions.forEach(card => {
    card.addEventListener('click', () => {
      campaignOptions.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      gameState.stage2Strategy = card.dataset.strategy;
      playSound('click');
      
      campaignPreviewBox.classList.remove('hidden');
      campaignPreviewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // 投開票模擬
  btnStartPresVote.addEventListener('click', () => {
    playSound('ballot');
    btnStartPresVote.disabled = true;
    presResultsContainer.classList.remove('hidden');
    presResultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 根據玩家策略決定最終得票佔比
    // 相對多數決：只要是第一高票就算贏
    let target1 = 36.5; // 藍天明
    let target2 = 34.0; // 玩家預設
    let target3 = 29.5; // 黃向陽
    
    // 依據角色難度（身份）調整競爭激烈度，以及政見影響力
    if (gameState.difficulty === 'first-voter') {
      // 簡單難度，政見效果好
      if (gameState.stage2Strategy === 'youth') target2 = 41.2;
      else if (gameState.stage2Strategy === 'elderly') target2 = 38.6;
      else target2 = 39.5;
    } else if (gameState.difficulty === 'youth-candidate') {
      // 中等難度
      if (gameState.stage2Strategy === 'youth') target2 = 39.1;
      else if (gameState.stage2Strategy === 'elderly') target2 = 37.8;
      else target2 = 36.8;
    } else {
      // 專家難度，差之毫釐
      if (gameState.stage2Strategy === 'youth') target2 = 37.8;
      else if (gameState.stage2Strategy === 'elderly') target2 = 37.2;
      else target2 = 35.8;
    }
    
    // 微調其他對手的佔比，確保總和為 100
    const remain = 100 - target2;
    // 比例分配
    const sum13 = target1 + target3;
    target1 = (target1 / sum13) * remain;
    target3 = (target3 / sum13) * remain;
    
    // 四捨五入微調
    target1 = parseFloat(target1.toFixed(1));
    target2 = parseFloat(target2.toFixed(1));
    target3 = parseFloat((100 - target1 - target2).toFixed(1));

    // 動態滾動開票動畫
    let currentPct1 = 0;
    let currentPct2 = 0;
    let currentPct3 = 0;
    
    const totalVotesCast = 14200000; // 模擬 1420 萬有效票
    const interval = setInterval(() => {
      // 隨機增加
      currentPct1 += Math.random() * 3;
      currentPct2 += Math.random() * 3;
      currentPct3 += Math.random() * 3;
      
      if (currentPct1 >= target1) currentPct1 = target1;
      if (currentPct2 >= target2) currentPct2 = target2;
      if (currentPct3 >= target3) currentPct3 = target3;
      
      // 更新介面
      updateCandidateRow(1, currentPct1, totalVotesCast);
      updateCandidateRow(2, currentPct2, totalVotesCast);
      updateCandidateRow(3, currentPct3, totalVotesCast);
      
      playSound('click');
      
      if (currentPct1 === target1 && currentPct2 === target2 && currentPct3 === target3) {
        clearInterval(interval);
        btnStartPresVote.disabled = false;
        
        // 判定贏家
        determineWinner(target1, target2, target3);
      }
    }, 60);
  });

  function updateCandidateRow(candNum, pct, totalVotes) {
    const pctStr = `${pct.toFixed(1)}%`;
    const votesStr = `${((totalVotes * pct) / 100 / 10000).toFixed(0)} 萬票`;
    
    if (candNum === 1) {
      cand1Pct.textContent = pctStr;
      cand1Bar.style.width = pctStr;
      cand1Votes.textContent = votesStr;
    } else if (candNum === 2) {
      cand2Pct.textContent = pctStr;
      cand2Bar.style.width = pctStr;
      cand2Votes.textContent = votesStr;
    } else if (candNum === 3) {
      cand3Pct.textContent = pctStr;
      cand3Bar.style.width = pctStr;
      cand3Votes.textContent = votesStr;
    }
  }

  function determineWinner(p1, p2, p3) {
    const maxVal = Math.max(p1, p2, p3);
    
    // 清除舊當選標記
    document.querySelectorAll('.candidate-row').forEach(row => row.classList.remove('winner'));
    document.querySelectorAll('.winner-badge').forEach(badge => badge.classList.add('hidden'));
    
    let winnerText = '';
    if (p1 === maxVal) {
      document.getElementById('cand-1').classList.add('winner');
      document.getElementById('winner-badge-1').classList.remove('hidden');
      winnerText = '藍海進步黨 (1號 藍天明)';
      playSound('error');
    } else if (p2 === maxVal) {
      document.getElementById('cand-2').classList.add('winner');
      document.getElementById('winner-badge-2').classList.remove('hidden');
      winnerText = `民主希望隊 (2號 ${gameState.playerName})`;
      playSound('celebrate');
      startConfetti();
      setTimeout(stopConfetti, 2500);
      gameState.currentScore += 30; // 贏得大選的額外加分
      updateHUD();
    } else {
      document.getElementById('cand-3').classList.add('winner');
      document.getElementById('winner-badge-3').classList.remove('hidden');
      winnerText = '陽光力量聯盟 (3號 黃向陽)';
      playSound('error');
    }

    // 顯示相對多數決解析與過關按鈕
    electionAnalysisBox.classList.remove('hidden');
    
    // 渲染動態解析文字
    const explainText = document.getElementById('relative-majority-explain');
    const winnerScorePct = maxVal;
    const loserCombinePct = (100 - maxVal).toFixed(1);
    explainText.innerHTML = `
      大選開票完成！當選人為：<strong>${winnerText}</strong>，得票率為 <strong>${winnerScorePct}%</strong>。<br>
      這是經典的「<strong>相對多數決</strong>」！即便有 <strong>${loserCombinePct}%</strong> 的選民支持其他對手，但因為當選人拿到了最高的單一得票率，仍然成功贏得總統職位。<br>
      在相對多數決制下，選戰往往容易走向大黨對決，因為選民會擔心投給小黨是浪費選票（棄保效應）。
    `;
    
    gameState.stage2Complete = true;
    btnToStage3.classList.remove('hidden');
    btnToStage3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  btnToStage3.addEventListener('click', () => {
    showScreen('stage3');
  });


  // ==========================================
  // 8. 關卡三：立委兩票制
  // ==========================================
  const districtOptions = document.querySelectorAll('#ballot-district .ballot-option');
  const partyOptions = document.querySelectorAll('#ballot-party .ballot-option-party');
  const ballotBoxAnimContainer = document.getElementById('ballot-box-anim-container');
  
  const legislativeVoteContainer = document.getElementById('legislative-vote-container');
  const legislativeCalculatorContainer = document.getElementById('legislative-calculator-container');
  
  const partySlidersContainer = document.getElementById('party-sliders-container');
  const sliderSumVal = document.getElementById('slider-sum-val');
  const sliderSumWarning = document.getElementById('slider-sum-warning');
  
  const parliamentSvg = document.getElementById('parliament-svg');
  const resultTableBody = document.getElementById('result-table-body');
  const btnSubmitLegislative = document.getElementById('btn-submit-legislative');
  const btnToStage4 = document.getElementById('btn-to-stage4');

  function loadStage3() {
    gameState.stage3DistrictVote = null;
    gameState.stage3PartyVote = null;
    
    // 重置選票樣式與印戳
    districtOptions.forEach(o => o.classList.remove('selected'));
    partyOptions.forEach(o => o.classList.remove('selected'));
    
    legislativeVoteContainer.classList.remove('hidden');
    ballotBoxAnimContainer.classList.add('hidden');
    legislativeCalculatorContainer.classList.add('hidden');
    btnToStage4.classList.add('hidden');
  }

  // 投票 1：區域立委投票點擊
  districtOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      districtOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      gameState.stage3DistrictVote = opt.dataset.cand;
      playSound('stamp');
      checkBothVoted();
    });
  });

  // 投票 2：政黨票點擊
  partyOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      partyOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      gameState.stage3PartyVote = opt.dataset.party;
      playSound('stamp');
      checkBothVoted();
    });
  });

  function checkBothVoted() {
    if (gameState.stage3DistrictVote && gameState.stage3PartyVote) {
      // 兩張票都投了，進入投遞票箱動畫
      setTimeout(() => {
        // 隱藏選票
        document.querySelector('.ballots-wrapper').classList.add('hidden');
        ballotBoxAnimContainer.classList.remove('hidden');
        playSound('ballot');
        
        setTimeout(() => {
          // 動畫完成後，顯示席次計算機
          legislativeVoteContainer.classList.add('hidden');
          document.querySelector('.ballots-wrapper').classList.remove('hidden'); // 重置包裝器以便再次進入
          legislativeCalculatorContainer.classList.remove('hidden');
          initPartySliders();
        }, 2200);
      }, 800);
    }
  }

  // 席次計算機與滑桿生成
  const partiesData = [
    { key: 'A', name: '藍天進步黨', color: '#3b82f6', defaultPct: 40 },
    { key: 'B', name: '民主希望隊', color: '#10b981', defaultPct: 35 },
    { key: 'C', name: '陽光力量聯盟', color: '#f59e0b', defaultPct: 12 },
    { key: 'D', name: '新潮青年黨', color: '#ec4899', defaultPct: 6 },
    { key: 'E', name: '生態綠能黨', color: '#f97316', defaultPct: 4 }, // 預設 4% 挑戰看能不能拉到 5%
    { key: 'F', name: '勞工權益盟', color: '#a855f7', defaultPct: 3 }
  ];

  function initPartySliders() {
    partySlidersContainer.innerHTML = '';
    
    // 複製預設值
    partiesData.forEach(p => {
      gameState.stage3PartyShares[p.key] = p.defaultPct;
    });

    partiesData.forEach(p => {
      const item = document.createElement('div');
      item.className = 'party-slider-item';
      item.innerHTML = `
        <div class="party-slider-info">
          <span class="label"><span class="party-color-icon" style="background:${p.color}"></span> ${p.name}</span>
          <span class="val" id="slide-val-${p.key}">${gameState.stage3PartyShares[p.key]}%</span>
        </div>
        <input type="range" class="party-slider" data-key="${p.key}" min="0" max="100" value="${gameState.stage3PartyShares[p.key]}">
      `;
      partySlidersContainer.appendChild(item);
    });

    // 滑桿事件註冊
    const sliders = partySlidersContainer.querySelectorAll('.party-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.dataset.key;
        const val = parseInt(e.target.value);
        gameState.stage3PartyShares[key] = val;
        document.getElementById(`slide-val-${key}`).textContent = `${val}%`;
        
        playSound('click');
        calculateParliamentSeats();
      });
    });

    calculateParliamentSeats();
  }

  function calculateParliamentSeats() {
    // 1. 計算得票率總和
    const shares = gameState.stage3PartyShares;
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    
    sliderSumVal.textContent = sum;
    
    if (sum !== 100) {
      sliderSumWarning.style.display = 'block';
      btnSubmitLegislative.disabled = true;
      return;
    } else {
      sliderSumWarning.style.display = 'none';
      btnSubmitLegislative.disabled = false;
    }

    // 2. 篩選 >= 5% 得票率的政黨
    const total不分區Seats = 34;
    const eligibleParties = [];
    let eligibleSum = 0;
    
    partiesData.forEach(p => {
      const pct = shares[p.key];
      if (pct >= 5) {
        eligibleParties.push({ ...p, pct });
        eligibleSum += pct;
      }
    });

    // 3. 計算分配席次 (最大餘數法)
    let allocatedSeatsSum = 0;
    
    if (eligibleSum > 0) {
      eligibleParties.forEach(p => {
        const quota = (p.pct / eligibleSum) * total不分區Seats;
        p.quota = quota;
        p.seats = Math.floor(quota);
        p.remainder = quota - p.seats;
        allocatedSeatsSum += p.seats;
      });

      // 分配餘數席次
      let remainingSeats = total不分區Seats - allocatedSeatsSum;
      // 依餘數大小降序排列
      eligibleParties.sort((a, b) => b.remainder - a.remainder);
      
      for (let i = 0; i < remainingSeats; i++) {
        if (eligibleParties[i]) {
          eligibleParties[i].seats += 1;
        }
      }
      
      // 恢復原本政黨順序以便渲染
      const partyMap = {};
      eligibleParties.forEach(p => {
        partyMap[p.key] = p.seats;
      });
      
      partiesData.forEach(p => {
        p.seats = partyMap[p.key] || 0;
        p.pct = shares[p.key];
        p.passed = shares[p.key] >= 5;
      });
    } else {
      // 若無人達 5% 門檻（全體降級，但實務上不會發生）
      partiesData.forEach(p => {
        p.seats = 0;
        p.pct = shares[p.key];
        p.passed = false;
      });
    }

    // 4. 渲染表格與計算婦女保障名額 (席次的一半，若為奇數則無條件進位或捨去，按各黨當選人排序輪流，每黨二分之一以上需為女性)
    resultTableBody.innerHTML = '';
    partiesData.forEach(p => {
      const femaleQuota = p.seats > 0 ? Math.ceil(p.seats / 2) : 0;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><div class="cell-party"><span class="party-color-icon" style="background:${p.color}"></span>${p.name}</div></td>
        <td>${p.pct}%</td>
        <td>${p.passed ? '<span class="yes-badge">跨越 5%</span>' : '<span class="no-badge">未跨越</span>'}</td>
        <td><span class="seat-number">${p.seats} 席</span></td>
        <td><i class="fas fa-female text-purple"></i> 至少 ${femaleQuota} 席</td>
      `;
      resultTableBody.appendChild(row);
    });

    // 5. 繪製立法院議席半圓 (SVG)
    drawParliamentArc();
  }

  function drawParliamentArc() {
    // 清空 SVG
    parliamentSvg.innerHTML = '';
    const hoverInfo = document.getElementById('parliament-hover-info');
    
    // 席次對應政黨陣列
    const seatColorList = [];
    partiesData.forEach(p => {
      for (let i = 0; i < p.seats; i++) {
        seatColorList.push({ name: p.name, color: p.color });
      }
    });
    // 剩餘的灰色席次 (如果有，以防計算未達 34 席)
    const total不分區Seats = 34;
    while (seatColorList.length < total不分區Seats) {
      seatColorList.push({ name: '未分配', color: '#334155' });
    }

    // 34席不分區半圓分佈 (分二圈)
    const row1Seats = 13; // 內圈 13 席
    const row2Seats = 21; // 外圈 21 席
    const r1 = 60;
    const r2 = 88;
    
    let seatIndex = 0;

    // 繪製內圈
    for (let i = 0; i < row1Seats; i++) {
      const angle = 180 - (180 * i) / (row1Seats - 1);
      const rad = (angle * Math.PI) / 180;
      const x = r1 * Math.cos(rad);
      const y = -r1 * Math.sin(rad);
      
      createSeatCircle(x, y, seatColorList[seatIndex]);
      seatIndex++;
    }

    // 繪製外圈
    for (let i = 0; i < row2Seats; i++) {
      const angle = 180 - (180 * i) / (row2Seats - 1);
      const rad = (angle * Math.PI) / 180;
      const x = r2 * Math.cos(rad);
      const y = -r2 * Math.sin(rad);
      
      createSeatCircle(x, y, seatColorList[seatIndex]);
      seatIndex++;
    }

    function createSeatCircle(cx, cy, seatInfo) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', '6');
      circle.setAttribute('fill', seatInfo.color);
      
      // 懸停事件
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('r', '8');
        hoverInfo.textContent = `席次歸屬：${seatInfo.name}`;
        hoverInfo.style.color = seatInfo.color;
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '6');
        hoverInfo.textContent = '移至座位查看詳情';
        hoverInfo.style.color = 'var(--text-muted)';
      });
      
      parliamentSvg.appendChild(circle);
    }
  }

  btnSubmitLegislative.addEventListener('click', () => {
    // 檢查任務挑戰是否完成（生態綠能黨有沒有被拉到5%以上）
    const greenEcoPct = gameState.stage3PartyShares['E'];
    
    playSound('celebrate');
    startConfetti();
    setTimeout(stopConfetti, 2500);

    // 成功跨越門檻，額外獎勵
    let feedbackBonus = 0;
    if (greenEcoPct >= 5) {
      feedbackBonus = 15;
      alert(`🎉 恭喜！你成功調整綠能得票率到 ${greenEcoPct}%，幫助它跨越 5% 門檻獲得不分區立委席次！`);
    } else {
      alert(`已成功計算席次！注意：生態綠能黨得票為 ${greenEcoPct}%，未達 5% 門檻，因此沒有分得席次喔。`);
    }

    gameState.stage3Complete = true;
    gameState.currentScore += 25 + feedbackBonus;
    updateHUD();

    btnSubmitLegislative.classList.add('hidden');
    btnToStage4.classList.remove('hidden');
  });

  btnToStage4.addEventListener('click', () => {
    showScreen('stage4');
  });


  // ==========================================
  // 9. 關卡四：九合一選票分發挑戰 (選票分發員)
  // ==========================================
  
  // 選民池數據
  const stage4VoterDatabase = [
    { name: '王大同', address: '台北市大安區', special: '一般選民', correctChoice: '3-general', reason: '台北市為直轄市，發給市長、議員、里長選票共 3 張。' },
    { name: '林麗萍', address: '新竹縣竹北市', special: '一般選民', correctChoice: '5-general', reason: '新竹縣為一般縣市，發給縣長、議員、鄉鎮市長、鄉鎮代表、村里長共 5 張。' },
    { name: '陳小美', address: '基隆市信義區', special: '一般選民', correctChoice: '3-general', reason: '基隆市為省轄市，只發給市長、議員、里長共 3 張。' },
    { name: 'Iwan (伊旺)', address: '新北市板橋區', special: '原住民選民', correctChoice: '3-indigenous', reason: '直轄市之原住民選民，發給市長、原住民議員、里長共 3 張。' },
    { name: '林巴奈', address: '台中市和平區', special: '原住民身分 (山地原住民)', correctChoice: '5-mountain', reason: '台中市和平區為山地原住民區，發給市長、原住民議員、區長、區民代表、里長共 5 張。' },
    { name: '黃阿松', address: '花蓮縣吉安鄉', special: '原住民選民', correctChoice: '5-indigenous', reason: '一般縣之原住民，發給縣長、原住民議員、鄉鎮長、代表、村里長共 5 張。' },
    { name: '柯建台', address: '新竹市東區', special: '一般選民', correctChoice: '3-general', reason: '新竹市為省轄市，只發給市長、議員、里長共 3 張選票。' },
    { name: 'Kolas', address: '桃園市復興區', special: '原住民身分 (山地原住民)', correctChoice: '5-mountain', reason: '桃園市復興區為直轄市山地原住民區，發給市長、原住民議員、區長、區民代表、里長共 5 張。' }
  ];

  let activeVoterQueue = [];
  let voterQueueIndex = 0;
  let dispatchTimer = null;
  let timeLeft = 30;
  
  const dispatchStartOverlay = document.getElementById('dispatch-start-overlay');
  const btnStartDispatch = document.getElementById('btn-start-dispatch');
  const dispTimerVal = document.getElementById('disp-timer');
  const dispScoreVal = document.getElementById('disp-score');
  
  const voterCardName = document.getElementById('voter-card-name');
  const voterCardAddress = document.getElementById('voter-card-address');
  const voterCardSpecial = document.getElementById('voter-card-special');
  const voterCardTag = document.getElementById('voter-card-identity-tag');
  
  const dispatchFeedback = document.getElementById('dispatch-feedback');
  const btnActionDisps = document.querySelectorAll('.btn-action-disp');
  const btnToStage5 = document.getElementById('btn-to-stage5');

  function loadStage4() {
    dispatchStartOverlay.classList.remove('hidden');
    btnToStage5.classList.add('hidden');
    
    gameState.stage4Score = 0;
    dispScoreVal.textContent = '0';
    timeLeft = 30;
    dispTimerVal.textContent = timeLeft;
    
    // 複製與隨機亂數選民陣列
    activeVoterQueue = [...stage4VoterDatabase].sort(() => Math.random() - 0.5);
    voterQueueIndex = 0;
    
    if (dispatchTimer) {
      clearInterval(dispatchTimer);
    }
  }

  btnStartDispatch.addEventListener('click', () => {
    playSound('click');
    dispatchStartOverlay.classList.add('hidden');
    
    renderNextVoterCard();
    startDispatchTimer();
  });

  function startDispatchTimer() {
    dispatchTimer = setInterval(() => {
      timeLeft--;
      dispTimerVal.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        endDispatchGame();
      }
    }, 1000);
  }

  function renderNextVoterCard() {
    dispatchFeedback.className = 'feedback-message';
    dispatchFeedback.textContent = '';

    if (voterQueueIndex >= activeVoterQueue.length) {
      endDispatchGame();
      return;
    }

    const voter = activeVoterQueue[voterQueueIndex];
    voterCardName.textContent = voter.name;
    voterCardAddress.textContent = voter.address;
    voterCardSpecial.textContent = voter.special;
    voterCardTag.textContent = voter.special;
    
    // 設定原住民標籤色彩
    if (voter.special.includes('原住民')) {
      voterCardTag.style.background = 'var(--primary)';
    } else {
      voterCardTag.style.background = '#3b82f6';
    }

    // 重置證件動畫
    const voterCard = document.getElementById('current-voter-card');
    voterCard.style.animation = 'none';
    voterCard.offsetHeight; // reflow
    voterCard.style.animation = 'dealCard 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';
  }

  // 點擊分發判定
  btnActionDisps.forEach(btn => {
    btn.addEventListener('click', () => {
      if (timeLeft <= 0 || voterQueueIndex >= activeVoterQueue.length) return;
      
      const choice = btn.dataset.choice;
      const voter = activeVoterQueue[voterQueueIndex];
      
      if (choice === voter.correctChoice) {
        // 正確
        playSound('success');
        gameState.stage4Score++;
        gameState.currentScore += 15; // 答對一題得15分
        updateHUD();
        dispScoreVal.textContent = gameState.stage4Score;
        
        dispatchFeedback.className = 'feedback-message feedback-success';
        dispatchFeedback.textContent = `正確！${voter.reason}`;
      } else {
        // 錯誤
        playSound('error');
        dispatchFeedback.className = 'feedback-message feedback-error';
        dispatchFeedback.textContent = `錯囉！${voter.name}的選票應為該選項。原因：${voter.reason}`;
      }

      // 進下一題
      voterQueueIndex++;
      setTimeout(renderNextVoterCard, 2200);
    });
  });

  function endDispatchGame() {
    clearInterval(dispatchTimer);
    playSound('celebrate');
    startConfetti();
    setTimeout(stopConfetti, 2500);
    
    gameState.stage4Complete = true;
    
    // 結算提示
    dispatchFeedback.className = 'feedback-message feedback-success';
    dispatchFeedback.textContent = `挑戰結束！你成功正確分發了 ${gameState.stage4Score} 位選民的選票！`;
    
    btnToStage5.classList.remove('hidden');
    btnToStage5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  btnToStage5.addEventListener('click', () => {
    showScreen('certificate');
  });


  // ==========================================
  // 10. 證書與結算畫面
  // ==========================================
  const certPlayerName = document.getElementById('cert-player-name');
  const certPlayerMeta = document.getElementById('cert-player-meta');
  const certS1Score = document.getElementById('cert-s1-score');
  const certS2Score = document.getElementById('cert-s2-score');
  const certS3Score = document.getElementById('cert-s3-score');
  const certS4Score = document.getElementById('cert-s4-score');
  
  const certDateYear = document.getElementById('cert-date-year');
  const certDateMonth = document.getElementById('cert-date-month');
  const certDateDay = document.getElementById('cert-date-day');
  
  const btnPrintCertificate = document.getElementById('btn-print-certificate');
  const btnRestartAll = document.getElementById('btn-restart-all');

  function loadCertificate() {
    playSound('celebrate');
    startConfetti();
    
    certPlayerName.textContent = gameState.playerName;
    
    let metaText = '';
    if (gameState.playerClass) metaText += `班級：${gameState.playerClass} `;
    if (gameState.playerSeat) metaText += `| 座號：${gameState.playerSeat} `;
    metaText += `| 難度身分：${getDifficultyLabel(gameState.difficulty)}`;
    certPlayerMeta.textContent = metaText;

    // 關卡得分渲染
    certS1Score.textContent = `${gameState.stage1Score} 分`;
    certS2Score.textContent = gameState.stage2Complete ? '成功當選' : '參與開票';
    
    // 兩票制得分評估
    const greenEcoPct = gameState.stage3PartyShares['E'];
    certS3Score.textContent = greenEcoPct >= 5 ? '突破小黨限制' : '完成分配';
    
    // 九合一得分
    certS4Score.textContent = `答對 ${gameState.stage4Score} 題`;

    // 更新日期
    const today = new Date();
    // 民國年 = 西元年 - 1911
    const minguoYear = today.getFullYear() - 1911;
    certDateYear.textContent = minguoYear;
    certDateMonth.textContent = today.getMonth() + 1;
    certDateDay.textContent = today.getDate();
  }

  function getDifficultyLabel(diff) {
    if (diff === 'first-voter') return '首投族 (基本)';
    if (diff === 'youth-candidate') return '新星候選人 (中等)';
    return '資深政治家 (專家)';
  }

  // 列印按鈕
  btnPrintCertificate.addEventListener('click', () => {
    playSound('click');
    window.print();
  });

  // 重新開始
  btnRestartAll.addEventListener('click', () => {
    // 重置大部分狀態
    gameState.currentScore = 0;
    gameState.stage1Complete = false;
    gameState.stage1Score = 0;
    gameState.stage2Complete = false;
    gameState.stage3Complete = false;
    gameState.stage4Complete = false;
    gameState.stage4Score = 0;
    
    playerNameInput.value = '';
    playerClassInput.value = '';
    playerSeatInput.value = '';
    
    stopConfetti();
    showScreen('intro');
  });

});
