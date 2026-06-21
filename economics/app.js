/**
 * 市場大師：供需平衡大挑戰！
 * 遊戲邏輯與互動控制 JS 檔案
 * (改編自立法大師素養遊戲，專為國中經濟學供給與需求教學設計)
 */

// --- 後端配置 ---
// 教師部署 Google Apps Script 後，請將產生的網頁應用程式 URL 貼在下方雙引號內：
const GOOGLE_SHEET_APP_URL = "https://script.google.com/macros/s/AKfycbzQ8H2_-tT-TUOSC0rOBE-xPGXlWVPm--MkO4XAWMFz_JQb6_3OaCnlHWuLPYks1ZYc/exec"; 

// --- 遊戲狀態管理 ---
const gameState = {
  playerClass: "無",
  playerSeat: "無",
  playerName: "訪客老闆",
  selectedChar: "dotty", // dotty: 阿吉, ray: 小雅, wah: 大華
  selectedBill: "tea", // tea: 手搖珍奶, mobile: 電競手機, veg: 有機生菜
  currentStage: 0, // 0: intro, 1: select, 2: stage1, 3: stage2, 4: stage3, 5: stage4, 6: stage5, 7: cert
  soundEnabled: true,
  
  // 滿意度軌跡對應：
  // student -> 消費者 (Consumer)
  // parent -> 生產者 (Producer)
  // teacher -> 政府與社會 (Government & Society)
  satisfaction: {
    student: 50,
    parent: 50,
    teacher: 50
  },

  // 記錄決策選擇，供教師評估素養表現
  draftChoice: "",      // 起草經營方針
  hearingChoices: {},   // 供需事件抉擇記錄
  vetoChoice: "",       // 危機處理策略
  
  signaturesCollected: 0, // 交易媒合數
  sigTimer: null,
  sigTimeLeft: 20,
  sigGameActive: false,
  
  hearingCurrentStakeholder: 0, // 0: consumer, 1: producer, 2: society
  
  quizCurrentQuestion: 0,
  quizScore: 0,
  
  yesVotes: 0, // 交易成功數
  noVotes: 0,  // 交易失敗數
  votingActive: false,
  
  constitutionCorrected: false, // 公平交易修正狀態
  
  vetoClicks: 0,
  vetoClicksRequired: 29, 
  vetoTimer: null,
  vetoTimeLeft: 8.0,
  vetoGameActive: false
};

// --- 經濟學商品與供需情境資料庫 ---
const BILLS = {
  tea: {
    title: "「手搖黑糖珍奶」市場",
    shortTitle: "手搖珍奶市場",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【高價奢華型】(精品定位)",
          desc: "採用嚴選高山紅茶與紐西蘭進口純鮮奶，珍珠每日手工現熬，定價每杯 100 元，鎖定高消費力市場。",
          impact: { student: -15, parent: 30, teacher: 10 },
          route: "精品高價定位"
        },
        {
          id: "balanced",
          title: "【國民平價型】(彈性折衷)",
          desc: "主打經典茶底配上 Q 彈珍珠，定價 55 元，糖度與配料採標準化管理，兼顧大眾消費力與商家合理利潤。",
          impact: { student: 20, parent: 15, teacher: 15 },
          route: "國民平價折衷"
        },
        {
          id: "flexible",
          title: "【低價搶市型】(薄利多銷)",
          desc: "使用人工奶精與平價茶葉，以超高效率量產，定價每杯 30 元。雖受低預算消費者喜好，但引發健康疑慮。",
          impact: { student: 15, parent: -10, teacher: -25 },
          route: "低價薄利多銷"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student", // Consumer
        name: "消費者代表 - 小萱",
        avatar: "fa-shopping-bag",
        quote: "現在很多珍奶一杯賣到 100 元，對國中生來說根本吃不消！而且希望甜度能提供微糖或無糖選項，讓我們喝得健康又沒有負擔！",
        options: [
          {
            text: "體貼消費者！全品項降價 15%，且為了健康強制規定全面取消全糖選項，只提供半糖以下與熱量標示。",
            impact: { student: 25, parent: -15, teacher: 15 }
          },
          {
            text: "引進「健康低卡天然代糖珍奶」，定價維持中平，並提供攜帶環保杯現折 5 元的優惠政策。",
            impact: { student: 15, parent: 15, teacher: 15 }
          },
          {
            text: "尊重店家的獨家糖度配方與品牌定價，相信市場機制，政府不應硬性規定店家的價格與配方。",
            impact: { student: -20, parent: 25, teacher: -10 }
          }
        ]
      },
      {
        stakeholder: "parent", // Producer
        name: "手搖飲商家代表 - 林老闆",
        avatar: "fa-store",
        quote: "最近鮮奶和珍珠的原料進口成本、店面租金一直在漲，如果政府強行凍結價格，我們賺不到利潤只能倒閉，大家也喝不到珍奶了！",
        options: [
          {
            text: "商家賺少一點也是合理的，應強制規定大杯珍奶最高限價 50 元以保障消費者，違反者直接開罰！",
            impact: { student: 20, parent: -30, teacher: 5 }
          },
          {
            text: "由政府補貼「在地小農乳源採購」，降低運輸與包裝成本，輔導店家提升效率，穩定供需與物價。",
            impact: { student: 10, parent: 20, teacher: 15 }
          },
          {
            text: "價格由供需自由決定，允許商家因應原料上漲自由浮動調高價格，將成本轉嫁給消費者。",
            impact: { student: -20, parent: 25, teacher: -15 }
          }
        ]
      },
      {
        stakeholder: "teacher", // Society & Gov
        name: "社會與政府代表 - 衛福官員",
        avatar: "fa-landmark",
        quote: "根據統計，國中生肥胖與蛀牙比例逐年攀升，含糖手搖飲是最大元兇！如果不適度管制，未來健保支出會非常沉重！",
        options: [
          {
            text: "為維護青少年健康，全面禁止在國民中小學周邊 500 公尺內販售含糖手搖飲，違者移送法辦！",
            impact: { student: -25, parent: -25, teacher: 30 }
          },
          {
            text: "推廣「低糖健康標章認證」，凡店家配合減糖且無添加人工色素，可申請 2% 營業稅減免優惠。",
            impact: { student: 10, parent: 15, teacher: 20 }
          },
          {
            text: "市場經濟中健康是個人選擇，政府不應實施任何干預，由學校加強學生健康衛教宣導即可。",
            impact: { student: 15, parent: 15, teacher: -25 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「手搖珍奶市場公平交易管理草案」",
      content: "中華民國手搖珍奶市場之發展，應注重公平競爭與消費者權益。為提升產業服務品質，政府應輔導業者標示糖度與熱量，推廣健康減糖。配合減糖標章之店家，得申請經營補助。<span class='typo-target' id='typo-unconstitutional'>為防堵飲料店削價競爭危害利潤，飲料同業公會與全體業者應強制約定大杯珍奶售價不得低於 80 元，違者由公會直接沒收其店面財產並廢止營業執照。</span>",
      explain: "此草案限制了業者的價格自主權，並構成《公平交易法》所明文禁止的「聯合行為」（限制零售價格，聯合壟斷定價），損害了自由市場競爭與消費者利益；且同業公會並非國家行政機關，根本無權不經正當法律程序沒收私人店面與廢止執照，侵害了工作權及財產權。",
      options: [
        {
          text: "「飲料業者得依經營成本自由決定商品售價，禁止任何業者或公會進行聯合行為限制價格；違規者由公平交易委員會依法懲處。」",
          isCorrect: true,
          feedback: "正確！這符合《公平交易法》保障自由市場競爭之精神，手段合憲且保障消費者權益。"
        },
        {
          text: "「凡是大杯珍奶售價低於 80 元之店家，家長會得聯合發動社區全民抵制，並強制驅逐出該校園商圈。」",
          isCorrect: false,
          feedback: "錯誤。強制驅逐商家違反了商業經營自由與正當法律程序，手段依然過當。"
        },
        {
          text: "「同業公會應每日向政府申報原料成本，由政府統一訂定全國每杯珍奶的單一零售價格，違者處有期徒刑。」",
          isCorrect: false,
          feedback: "錯誤。過度硬性的價格管制完全抹煞了市場機制與營業自由，不符比例原則。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷平衡】「停售並回收問題批次珍珠，由第三方機構檢驗合格後重新上架；政府對受災店家提供檢驗費補貼與行銷宣傳，重建市場信心。」",
          impact: { student: 10, parent: 10, teacher: 15 },
          clicks: 15,
          route: "檢驗補貼重整信心"
        },
        {
          text: "【強硬對抗】「宣稱食安事件是競爭品牌惡意造謠，照常販售不予檢驗，並舉辦『大杯珍奶買一送一』促銷，迅速出清庫存！」",
          impact: { student: -25, parent: 15, teacher: -30 },
          clicks: 40,
          route: "強硬促銷逃避責任"
        },
        {
          text: "【放棄市場】「食安風波太難解決，決定永久關閉所有珍奶連鎖店，全面轉行改賣美式黑咖啡。」",
          impact: { student: -20, parent: -30, teacher: 10 },
          clicks: 0,
          route: "關閉店面全面轉行"
        }
      ]
    }
  },
  mobile: {
    title: "「極速電競手機」市場",
    shortTitle: "電競手機市場",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【頂級旗艦型】(高價效能)",
          desc: "配備頂級 5G 處理器、極速更新率螢幕與主動散熱系統，定價 30000 元，瞄準高階玩家群體。",
          impact: { student: -10, parent: 25, teacher: 10 },
          route: "頂級旗艦定位"
        },
        {
          id: "balanced",
          title: "【主流性價型】(性價平衡)",
          desc: "搭載主流高效能晶片、大容量電池與實用液冷散熱，定價 15000 元，提供流暢遊戲體驗與合理價格。",
          impact: { student: 20, parent: 15, teacher: 15 },
          route: "性價平衡定位"
        },
        {
          id: "flexible",
          title: "【學生普及型】(入門超低價)",
          desc: "採用入門處理器與一般螢幕，定價僅 6000 元。雖對低預算學生極具吸引力，但廠商獲利極低且效能有限。",
          impact: { student: 15, parent: -5, teacher: -10 },
          route: "學生普及定位"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student", // Consumer
        name: "消費者代表 - 阿儒",
        avatar: "fa-shopping-bag",
        quote: "有些電競手機玩重度遊戲時發燙得像暖暖包！而且有些廠商在保固期內就推卸責任，希望法規能加強七天網購鑑賞期與原廠保固！",
        options: [
          {
            text: "力挺買方權益！規定所有電競手機必須提供 3 年免費保固，且發熱只要超過 40 度，廠商應立刻無條件更換新機。",
            impact: { student: 30, parent: -25, teacher: 5 }
          },
          {
            text: "明定網購 7 天無條件退貨權益，並輔導業者建立「手機散熱安全國家標準」，健全透明的保固修繕程序。",
            impact: { student: 15, parent: 15, teacher: 15 }
          },
          {
            text: "買手機玩遊戲應自負風險，過度保障消費者會拖垮廠商營收，消費者應自行承擔保固損壞風險。",
            impact: { student: -25, parent: 20, teacher: -10 }
          }
        ]
      },
      {
        stakeholder: "parent", // Producer
        name: "晶片及製造商代表 - 林總經理",
        avatar: "fa-store",
        quote: "全球半導體晶片短缺、上游代工費和研發成本高昂！如果政府強行要求低定價，我們根本無法負擔成本，只能停止供應電競手機！",
        options: [
          {
            text: "這是商家的藉口！應強制規定所有電競手機最高定價不得超過 10000 元，違反者查封生產廠房！",
            impact: { student: 20, parent: -35, teacher: -10 }
          },
          {
            text: "推動「國內晶片研發租稅減免專案」，補貼關鍵電子元件的進口稅，以降低生產成本、穩定產品供給。",
            impact: { student: 10, parent: 25, teacher: 15 }
          },
          {
            text: "允許廠商自行調降部分硬體規格，或採取「環保包裝」不附充電頭與傳輸線，藉此轉嫁成本給買方以維持原價。",
            impact: { student: -15, parent: 15, teacher: 10 }
          }
        ]
      },
      {
        stakeholder: "teacher", // Society & Gov
        name: "社會與政府代表 - 資安局長",
        avatar: "fa-landmark",
        quote: "部分低價手機為了降低研發成本，電磁波輻射與資安防火牆檢驗不合格，這嚴重威脅國民健康與國家資訊安全！",
        options: [
          {
            text: "國家資安至上！凡是電磁波或資安有疑慮的品牌，警政機關一律直接沒收在台資產，並將其官網永久封鎖！",
            impact: { student: -20, parent: -20, teacher: 30 }
          },
          {
            text: "實施「智慧行動裝置資安合格標章認證」，未通過認證者禁止在主流通路銷售，並補貼廠商首次檢驗費。",
            impact: { student: 10, parent: 15, teacher: 20 }
          },
          {
            text: "自由市場競爭，資安問題應由消費者個人安裝防毒軟體來解決，政府不宜設定多餘檢驗關卡阻礙貿易。",
            impact: { student: 15, parent: 15, teacher: -25 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「極速電競手機市場秩序管理草案」",
      content: "中華民國智慧通訊與電競手機之發展，應注重安全防護與技術創新。為保護消費者通信隱私，政府應健全設備安全檢驗。通過資安與電磁波認證之手機，得標示認證標章。<span class='typo-target' id='typo-unconstitutional'>為防堵國外品牌手機搶佔市場以保障本土產業，本國通路商若販售非國產手機，警政單位得不經司法程序與審判，直接沒收該進口手機並驅逐境外。</span>",
      explain: "此條文嚴重侵害了外國企業在我國的平等工作權、財產權及一般人權保障；且沒收私人物產與驅逐出境屬於重大的司法處分，必須有明確法律依據且經由法院依法審判裁定，行政或警政機關無權在不經司法程序下逕行實施，這違反了憲法正當法律程序與比例原則。",
      options: [
        {
          text: "「對於進口及國產手機，應一律依國家安全標準進行平等檢驗，未達標準者依法限制輸入，廠商得依法提起行政救濟。」",
          isCorrect: true,
          feedback: "正確！這建立公平、平等且合法的安全檢驗機制，維護自由貿易與法治精神。"
        },
        {
          text: "「對所有非國產手機課予 500% 的懲罰性關稅，並規定凡購買國外品牌手機者，一律列入資安高風險信用黑名單。」",
          isCorrect: false,
          feedback: "錯誤。懲罰性關稅與信用黑名單嚴重侵犯人民的消費自由權，手段顯屬過當。"
        },
        {
          text: "「外國品牌手機必須將核心技術與通訊原始碼無條件移交給政府審查，否則直接逮捕該公司在台所有主管。」",
          isCorrect: false,
          feedback: "錯誤。這嚴重侵害智慧財產權與人身自由，手段完全失衡。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷平衡】「啟動實名制登記限量預購以防堵黃牛，協助通路商與代工廠接洽第二晶片備用來源，引導市場供需平穩。」",
          impact: { student: 10, parent: 10, teacher: 15 },
          clicks: 15,
          route: "實名登記開拓客源"
        },
        {
          text: "【強硬對抗】「政府下達價格管制命令，限制手機最高售價絕對不得高於原定價，導致通路商直接將手機轉入黑市高價私下交易！」",
          impact: { student: -20, parent: -25, teacher: -15 },
          clicks: 40,
          route: "強行限價導致黑市"
        },
        {
          text: "【放棄市場】「半導體晶片大火無藥可解，宣布電競手機產業全面無限期停業，原定訂單全數作廢。」",
          impact: { student: -30, parent: -30, teacher: 10 },
          clicks: 0,
          route: "宣布停業作廢訂單"
        }
      ]
    }
  },
  veg: {
    title: "「無毒有機生菜」市場",
    shortTitle: "有機生菜市場",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【極致有機型】(高品質高單價)",
          desc: "全程在無塵溫室內進行水耕栽培，並取得國際與國內有機雙標章，定價每包 120 元，鎖定高所得養生群體。",
          impact: { student: -15, parent: 30, teacher: 10 },
          route: "極致高品質定位"
        },
        {
          id: "balanced",
          title: "【在地無毒型】(普及折衷)",
          desc: "採用在地網室土壤耕作，不噴灑任何化學農藥，定價每包 60 元。兼顧大眾消費者採購預算與農民合理生計。",
          impact: { student: 20, parent: 15, teacher: 15 },
          route: "在地無毒折衷定位"
        },
        {
          id: "flexible",
          title: "【自主宣導型】(低成本低價)",
          desc: "採一般露地種植，僅在採收前兩週停藥以通過殘留檢測，無有機標章，定價每包 35 元。生產成本極低但缺乏信任。",
          impact: { student: 15, parent: -5, teacher: -15 },
          route: "自主宣導低價定位"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student", // Consumer
        name: "消費者代表 - 曉明",
        avatar: "fa-shopping-bag",
        quote: "有機蔬菜雖然健康，但經常買到裡面有小蟲咬過或葉面枯黃的。而且價格通常是普通蔬菜的 3 倍，每天吃荷包真的吃不消！",
        options: [
          {
            text: "保障買方權益！立法規定有機生菜只要發現一片有蟲咬，農民必須無條件全額退費並賠償 3 倍差價。",
            impact: { student: 30, parent: -30, teacher: 5 }
          },
          {
            text: "輔導農民將外觀微瑕的生菜包裝為「格外品/惜食級生菜」打 6 折特價銷售，將精緻級與惜食級分流，兼顧環保與實惠。",
            impact: { student: 15, parent: 15, teacher: 15 }
          },
          {
            text: "有機種植本就天然，有蟲咬是無農藥的健康鐵證！嫌貴的消費者可以去買普通噴灑農藥的蔬菜，我們不予調降。",
            impact: { student: -25, parent: 20, teacher: -10 }
          }
        ]
      },
      {
        stakeholder: "parent", // Producer
        name: "生菜農友代表 - 菜農老張",
        avatar: "fa-store",
        quote: "有機種植完全靠人工除草除蟲，人力成本非常高！要是遇到颱風或梅雨季，整片菜園爛光，供給直接歸零，我們農民拿什麼吃飯？",
        options: [
          {
            text: "不論天災如何，農民有義務穩定物價！天災時強制要求農民依原定價格補足蔬菜差額，違者沒收農地！",
            impact: { student: 15, parent: -35, teacher: -15 }
          },
          {
            text: "政府建立「農業天然災害補助保險」，補貼農民興建耐災溫室，天災後調撥冷藏備用蔬菜以穩定供需。",
            impact: { student: 10, parent: 25, teacher: 15 }
          },
          {
            text: "物以稀為貴，天災後菜價上漲是市場機制，允許農民因產量大跌調漲價格 10 倍，以保障農民收益。",
            impact: { student: -25, parent: 20, teacher: -10 }
          }
        ]
      },
      {
        stakeholder: "teacher", // Society & Gov
        name: "社會與政府代表 - 農業署長",
        avatar: "fa-landmark",
        quote: "市面上近年出現許多偽造的「有機認證貼紙」，魚目混珠欺騙消費者，嚴重敗壞了綠色低碳農業的市場誠信！",
        options: [
          {
            text: "亂貼者罰死！只要發現偽造有機標章，地方政府得直接查封沒收該農場，並將負責人移送法院收歸國有。",
            impact: { student: -15, parent: -25, teacher: 30 }
          },
          {
            text: "建置「生產履歷區塊鏈追溯系統」，由政府全額補貼首期檢驗費，對偽造標章的源頭依法重罰。",
            impact: { student: 15, parent: 20, teacher: 25 }
          },
          {
            text: "防範標章偽造是消費者的義務，消費者應自我提高判讀能力，買錯自認倒楣，政府人力有限不進行干預。",
            impact: { student: 10, parent: 15, teacher: -25 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「校園綠色有機生菜推廣管理條例草案」",
      content: "中華民國各級中小學校推廣綠色低碳飲食與有機生菜，應注重師生營養均衡。為擴大在地農業消費，政府應獎勵採購優良菜農之生菜。符合標準之菜農，得向政府申請運銷補貼。<span class='typo-target' id='typo-unconstitutional'>為保證有機農民利潤，各級學校周邊所有民營餐廳必須強制採購政府指定特定農場之生菜，拒絕採購之餐飲負責人由地方行政機關直接處以行政拘留七日，並無限期停業。</span>",
      explain: "此條文強迫民營餐廳必須向『指定特定農場』採購蔬菜，違反了《公平交易法》保障的自由經營、公平競爭與搭售限制原則，涉嫌圖利壟斷；且對於拒絕採購之行政處分，地方行政機關無權直接限制人身自由處以『行政拘留』，這嚴重侵害了《憲法》人身自由、工作權與財產權，且違背法官保留原則與正當法律程序。",
      options: [
        {
          text: "「學校應優先鼓勵採購具在地產銷履歷之蔬菜；對於配合採購之周邊民營餐廳，政府得給予綠色友善店家獎勵與認證宣傳。」",
          isCorrect: true,
          feedback: "正確！這採取正向鼓勵替代強硬行政拘留，符合市場公平競爭與比例原則。"
        },
        {
          text: "「不採購有機蔬菜之餐廳，衛生局應每日派員進行無預警突擊安檢與消防檢查，直到其妥協或倒閉為止。」",
          isCorrect: false,
          feedback: "錯誤。這屬於行政權濫用，違反行政中立與限制競爭原則，手段過當。"
        },
        {
          text: "「強制規定所有學校周邊餐廳全面轉型為素食有機餐廳，禁止販售任何肉類與化學製品，違者沒收店鋪。」",
          isCorrect: false,
          feedback: "錯誤。這極度侵害人民的營業權與自主消費權，嚴重違反比例原則的衡平性。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷平衡】「緊急調撥釋出政府冷藏庫存蔬菜以平抑菜價，發放弱勢家庭『蔬菜採購生活津貼券』，並補助菜農重建受災設施。」",
          impact: { student: 10, parent: 10, teacher: 15 },
          clicks: 15,
          route: "釋出庫存發放補貼"
        },
        {
          text: "【強硬對抗】「實施蔬菜最高限價命令，規定每包有機菜售價絕對不得高於平時均價，導致農民血本無歸而紛紛關門拒絕賣菜，市場完全短缺！」",
          impact: { student: -25, parent: -25, teacher: -15 },
          clicks: 40,
          route: "硬性限價農民拒賣"
        },
        {
          text: "【放棄市場】「天災純屬不可抗力，政府宣布廢除本校園生菜推廣條例，任由市場自生自滅。」",
          impact: { student: -25, parent: 15, teacher: -15 },
          clicks: 0,
          route: "撤回政策任其自滅"
        }
      ]
    }
  }
};

const QUIZ_QUESTIONS = [
  {
    question: "【需求法則】氣溫炎熱時，手搖飲店通常大排長龍。但如果一杯珍奶價格從 50 元暴漲到 150 元，在其他條件不變下，大部分消費者的購買意願會降低。這種「價格上漲，需求量減少；價格下跌，需求量增加」的變動關係，在經濟學上稱之為？",
    options: [
      "需求法則",
      "供給法則",
      "比較利益法則",
      "受益原則"
    ],
    answer: 0,
    explanation: "需求法則（Law of Demand）指出，在其他條件不變的情況下，商品的「價格」與「需求量」呈反向變動的關係（價格越高，需求量越低）。"
  },
  {
    question: "【供給法則】當高麗菜價格崩跌時，農民常因扣除運銷費用後血本無歸而放棄採收；相反地，當颱風過後菜價暴漲時，農民會設法增加採收與種植。這種「價格越高，供給量越多；價格越低，供給量越少」的現象，稱之為？",
    options: [
      "需求法則",
      "供給法則",
      "分散風險原則",
      "負擔能力原則"
    ],
    answer: 1,
    explanation: "供給法則（Law of Supply）指出，在其他條件不變的情況下，商品的「價格」與「供給量」呈同向變動的關係（價格越高，生產者的供給意願與數量就越多）。"
  },
  {
    question: "【市場均衡】當市場上某項商品的「需求量」剛好等於「供給量」時，買賣雙方都能買到與賣出想要的數量，價格此時不再波動。此時的狀態與價格在經濟學上稱之為？",
    options: [
      "供不應求，超額價格",
      "供過於求，剩餘價格",
      "市場均衡，均衡價格",
      "政府管制，保證價格"
    ],
    answer: 2,
    explanation: "當市場需求量與供給量相等時，達到市場均衡（Market Equilibrium），此時的價格稱為「均衡價格」，交易數量稱為「均衡數量」。"
  },
  {
    question: "【供不應求（短缺）】當某款限量電競手機定價過低，導致有 1000 位玩家想要搶購（需求量），但廠商受限於產能只生產了 100 支（供給量）。這種「需求量大於供給量」的現象會導致市場如何變動？",
    options: [
      "供不應求（短缺），價格有上漲的壓力",
      "供過於求（過剩），價格有下跌的壓力",
      "市場均衡，價格維持不變",
      "供給增加，價格跌到零元"
    ],
    answer: 0,
    explanation: "當需求量大於供給量時，稱為「供不應求」或短缺（Shortage）。因為買不到商品的人願意出更高價搶購，會推動市場價格上漲。"
  },
  {
    question: "【供過於求（過剩）】某年香蕉大豐收，農民拼命採收送往市場（供給量大增），但消費者每天的胃口有限（需求量未變），導致水果攤上堆滿香蕉賣不出去。這種「供給量大於需求量」的現象會導致市場價格如何變動？",
    options: [
      "供不應求，價格上漲",
      "供過於求（過剩），價格下跌",
      "市場均衡，價格上漲",
      "需求增加，價格維持不變"
    ],
    answer: 1,
    explanation: "當供給量大於需求量時，稱為「供過於求」或過剩（Surplus）。商家為了把滯銷的商品賣出去，會降價促銷，導致市場價格下跌。"
  },
  {
    question: "【非價格因素：需求變動】世界衛生組織發表報告證實：「天天喝大杯糖分過高的手搖飲會大幅增加糖尿病風險」。這份報告公布後，即使手搖飲價格完全沒變，市場上的手搖飲銷量依然大幅下滑。這屬於下列哪一種情況？",
    options: [
      "價格上漲導致的需求量減少",
      "消費者喜好（偏好）轉變導致的「需求減少」",
      "生產成本增加導致的「供給減少」",
      "消費者所得增加導致的「需求增加」"
    ],
    answer: 1,
    explanation: "醫學與健康觀念轉變了消費者的偏好（非價格因素），使得在相同價格下購買意願整體下滑，這在經濟學上稱為「需求減少」（需求曲線向左移）。"
  },
  {
    question: "【非價格因素：供給變動】今年因為乾旱缺水，加上工人工資上漲，導致手搖飲的茶葉與珍珠原料人力成本大幅提高。在茶飲零售價不變的情況下，許多飲料店決定縮減每日營業時段與出貨量。這在經濟學上稱之為？",
    options: [
      "生產成本增加導致的「供給減少」",
      "消費者所得減少導致的「需求減少」",
      "生產技術進步導致的「供給增加」",
      "商品價格下跌導致的「供給量減少」"
    ],
    answer: 0,
    explanation: "生產成本（如原料、工資）是影響供給的非價格因素。成本增加會降低商家的利潤率，使商家在相同價格下的供給意願降低，稱為「供給減少」（供給曲線向左移）。"
  },
  {
    question: "【替代品與互補品】當鮮奶的價格大幅暴漲時，很多咖啡店紛紛減少調製鮮奶茶，許多消費者不願意喝昂貴的鮮奶，改為選購燕麥奶來替代。在經濟學上，當鮮奶價格上漲，導致燕麥奶的需求量增加時，這兩種商品互為什麼關係？",
    options: [
      "互補品 (必須搭配一起使用)",
      "替代品 (功能相似，可互相取代)",
      "無關品",
      "奢侈品"
    ],
    answer: 1,
    explanation: "當兩種商品具有相似功能，且其中一種商品的價格上漲時，會導致另一種商品的需求量增加，這兩種商品互為「替代品」（Substitutes）。"
  },
  {
    question: "【政府干預：最高限價】當颱風過後有機蔬菜價格狂飆，政府為了平息買方民怨，強行規定：「一把生菜最高只能賣 20 元（遠低於市場均衡價格）」。這種「最高限價（價格上限）」政策，通常會在市場上導致什麼後果？",
    options: [
      "菜農瘋狂採收，市場出現大量蔬菜過剩",
      "菜農因無利可圖而拒絕賣菜，消費者排隊買不到，甚至出現黃牛黑市（短缺）",
      "買賣雙方皆大歡喜，市場立刻達到完美的均衡",
      "蔬菜品質變得更好，分量變得更多"
    ],
    answer: 1,
    explanation: "政府設定低於均衡價格的「最高限價」旨在保護消費者，但這會壓低生產者利潤，導致供給量急縮，而低價又吸引更多需求量，造成嚴重的「供不應求（短缺）」，常伴隨排隊與黑市炒作。"
  },
  {
    question: "【政府干預：最低限價】政府為了保障基層勞工的最低生活水準，強制實施「最低基本工資（勞動市場的最低限價）」。如果基本工資設定在遠高於市場均衡工資的水平，在其他條件不變下，勞動市場可能出現什麼現象？",
    options: [
      "所有老闆都拼命招募更多員工，失業率降為零",
      "勞工找工作的意願降低，工廠找不到人",
      "老闆因成本過高而減少僱用（需求量減），想工作的勞工增加（供給量增），導致供過於求（失業人口增加）",
      "勞工工作效率立刻提升十倍，薪水大降"
    ],
    answer: 2,
    explanation: "基本工資高於均衡工資是政府施行的「最低限價」政策。雖然保障了在職勞工，但由於僱用成本增加，老闆僱用人數（需求量）減少，而想工作的人數（供給量）增加，導致超額供給，在市場上表現為失業人口增加。"
  }
];

// --- 音效產生器 ---
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
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        gain1.gain.setValueAtTime(0.6, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
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
        const notes = [261.63, 329.63, 392.00, 523.25];
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
        const duration = 1.5;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
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

// 滿意度 HUD 元件
const satisfactionBars = {
  student: document.getElementById('st-fill-student'),
  parent: document.getElementById('st-fill-parent'),
  teacher: document.getElementById('st-fill-teacher')
};
const satisfactionVals = {
  student: document.getElementById('st-val-student'),
  parent: document.getElementById('st-val-parent'),
  teacher: document.getElementById('st-val-teacher')
};

// --- 更新滿意度 HUD 視覺 ---
function updateSatisfactionHUD() {
  Object.keys(gameState.satisfaction).forEach(key => {
    // 確保數值在 0 ~ 100 之間
    gameState.satisfaction[key] = Math.max(0, Math.min(100, gameState.satisfaction[key]));
    const val = gameState.satisfaction[key];
    
    // 更新長條圖與文字
    satisfactionBars[key].style.width = `${val}%`;
    satisfactionVals[key].textContent = `${val}%`;
    
    // 根據滿意度高低微調顏色
    if (val >= 70) {
      satisfactionBars[key].style.backgroundColor = "var(--color-success)";
    } else if (val < 40) {
      satisfactionBars[key].style.backgroundColor = "var(--color-danger)";
    } else {
      satisfactionBars[key].style.backgroundColor = "";
    }
  });
}

// 增減滿意度輔助函式
function adjustSatisfaction(impacts) {
  if (!impacts) return;
  Object.keys(impacts).forEach(key => {
    if (gameState.satisfaction[key] !== undefined) {
      gameState.satisfaction[key] += impacts[key];
    }
  });
  updateSatisfactionHUD();
}

// --- 輔助函式：切換關卡畫面 ---
function switchScreen(screenName) {
  playSound('click');
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[screenName].classList.add('active');
  
  if (screenName === 'intro' || screenName === 'select') {
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
    updateSatisfactionHUD();
  }
  
  if (screenName === 'stage1') initStage1();
  if (screenName === 'stage2') initStage2();
  if (screenName === 'stage3') initStage3();
  if (screenName === 'stage4') initStage4();
  if (screenName === 'stage5') initStage5();
  if (screenName === 'cert') initCertificate();
}

function updateHUDProgress() {
  const currentStep = gameState.currentStage - 1;
  const progressPercent = Math.max(0, Math.min(100, currentStep * 25));
  progressBar.style.width = `${progressPercent}%`;
  
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
    alert("請填寫完整的班級、座號與姓名，才能開始經營挑戰唷！");
    return;
  }
  
  gameState.playerName = nameVal;
  gameState.playerClass = classVal;
  gameState.playerSeat = seatVal;
  switchScreen('select');
});

// --- 1. 角色與商品選擇邏輯 ---
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
  const billInfo = BILLS[gameState.selectedBill];
  hudBillTitle.textContent = billInfo.shortTitle;
  hudCharName.textContent = gameState.playerName;
  
  let iconClass = "fa-wand-magic-sparkles";
  if (gameState.selectedChar === "ray") iconClass = "fa-shopping-bag";
  if (gameState.selectedChar === "wah") iconClass = "fa-store";
  
  hudCharAvatar.className = "hidden";
  const avatarSpan = document.createElement('i');
  avatarSpan.className = `fas ${iconClass}`;
  avatarSpan.style.color = "var(--color-primary)";
  
  const existingIcon = hudCharName.parentElement.querySelector('i');
  if (existingIcon) {
    existingIcon.remove();
  }
  hudCharName.parentElement.insertBefore(avatarSpan, hudCharName);

  switchScreen('stage1');
});

// --- 2. 第一關：起草與開市大典邏輯 ---
const draftingGameContainer = document.getElementById('drafting-game-container');
const draftingOptionsContainer = document.getElementById('drafting-options-container');

const sigCountSpan = document.getElementById('sig-count');
const sigTimerSpan = document.getElementById('sig-timer');
const sigPlayArea = document.getElementById('sig-play-area');
const sigStartOverlay = document.getElementById('sig-start-overlay');
const btnStartSig = document.getElementById('btn-start-sig');
const sigGameContainer = document.getElementById('sig-game-container');

const firstReadingCeremony = document.getElementById('first-reading-ceremony');
const ceremonyBillTitle = document.getElementById('ceremony-bill-title');
const btnStrikeGavelS1 = document.getElementById('btn-strike-gavel-s1');
const btnToStage2 = document.getElementById('btn-to-stage2');
const gavelAnimS1 = document.getElementById('gavel-anim-s1');

function initStage1() {
  gameState.signaturesCollected = 0;
  gameState.sigTimeLeft = 20;
  gameState.sigGameActive = false;
  gameState.satisfaction = { student: 50, parent: 50, teacher: 50 }; // 重置滿意度
  
  sigCountSpan.textContent = "0";
  sigTimerSpan.textContent = "20";
  
  draftingGameContainer.classList.remove('hidden');
  sigGameContainer.classList.add('hidden');
  firstReadingCeremony.classList.add('hidden');
  btnToStage2.classList.add('hidden');
  
  const bubbles = sigPlayArea.querySelectorAll('.sig-bubble');
  bubbles.forEach(b => b.remove());
  sigStartOverlay.classList.remove('hidden');
  
  const billInfo = BILLS[gameState.selectedBill];
  draftingOptionsContainer.innerHTML = "";
  
  billInfo.drafting.options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'draft-opt-card';
    card.dataset.id = opt.id;
    
    const getImpactText = (val) => val > 0 ? `+${val}` : `${val}`;
    
    card.innerHTML = `
      <div class="draft-opt-title">${opt.title}</div>
      <div class="draft-opt-desc">${opt.desc}</div>
      <div class="draft-opt-impact">
        <span class="student"><i class="fas fa-shopping-bag"></i> 消費者: ${getImpactText(opt.impact.student)}%</span>
        <span class="parent"><i class="fas fa-store"></i> 生產者: ${getImpactText(opt.impact.parent)}%</span>
        <span class="teacher"><i class="fas fa-landmark"></i> 政府社會: ${getImpactText(opt.impact.teacher)}%</span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      playSound('click');
      document.querySelectorAll('.draft-opt-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      gameState.draftChoice = opt.route;
      
      setTimeout(() => {
        adjustSatisfaction(opt.impact);
        draftingGameContainer.classList.add('hidden');
        sigGameContainer.classList.remove('hidden');
        sigGameContainer.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    });
    
    draftingOptionsContainer.appendChild(card);
  });
}

// 交易媒合泡泡小遊戲
btnStartSig.addEventListener('click', () => {
  playSound('click');
  sigStartOverlay.classList.add('hidden');
  gameState.sigGameActive = true;
  
  gameState.sigTimer = setInterval(() => {
    gameState.sigTimeLeft--;
    sigTimerSpan.textContent = gameState.sigTimeLeft;
    playSound('tick');
    
    if (gameState.sigTimeLeft <= 0) {
      clearInterval(gameState.sigTimer);
      endSigGame(false);
    }
  }, 1000);
  
  spawnBubbles();
});

const traderKeywords = [
  "買方意願", "賣方供應", "成交訂單", "市場訂單", "買家買單", 
  "商家出貨", "買賣對接", "交易媒合", "訂單成立", "供給契約",
  "合理價格", "安心消費", "穩定利潤", "品質承諾", "產銷保障"
];

function spawnBubbles() {
  if (!gameState.sigGameActive) return;
  const count = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < count; i++) {
    createBubble();
  }
  setTimeout(spawnBubbles, 1000);
}

function createBubble() {
  if (!gameState.sigGameActive) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'sig-bubble';
  const txt = traderKeywords[Math.floor(Math.random() * traderKeywords.length)];
  bubble.innerHTML = `<i class="fas fa-handshake"></i> ${txt}`;
  
  const posX = Math.random() * (sigPlayArea.clientWidth - 100);
  bubble.style.left = `${posX}px`;
  
  const speed = 4 + Math.random() * 2;
  bubble.style.animationDuration = `${speed}s`;
  
  bubble.addEventListener('click', () => {
    if (bubble.classList.contains('signed')) return;
    bubble.classList.add('signed');
    bubble.innerHTML = `<i class="fas fa-check-circle"></i> 媒合成功`;
    gameState.signaturesCollected++;
    sigCountSpan.textContent = gameState.signaturesCollected;
    playSound('bubble');
    
    if (gameState.signaturesCollected >= 15) {
      clearInterval(gameState.sigTimer);
      endSigGame(true);
    }
  });
  
  sigPlayArea.appendChild(bubble);
  setTimeout(() => bubble.remove(), speed * 1000);
}

function endSigGame(isWon) {
  gameState.sigGameActive = false;
  sigPlayArea.querySelectorAll('.sig-bubble:not(.signed)').forEach(b => b.remove());
  
  if (isWon) {
    playSound('success');
    ceremonyBillTitle.textContent = BILLS[gameState.selectedBill].title;
    firstReadingCeremony.classList.remove('hidden');
    btnStrikeGavelS1.classList.remove('hidden');
    firstReadingCeremony.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    alert("開市失敗！我們需要至少 15 筆市場交易媒合才能成功啟動開市。請再挑戰一次！");
    initStage1();
  }
}

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

// --- 3. 第二關：公聽會與價格/供需協商邏輯 ---
const hearingGameContainer = document.getElementById('hearing-game-container');
const hearingWorkspace = document.getElementById('hearing-workspace');
const hearingOptionsContainer = document.getElementById('hearing-options-container');
const negGameContainer = document.getElementById('negotiation-game-container');
const btnToStage3 = document.getElementById('btn-to-stage3');

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
const targetGlowZone = document.getElementById('target-glow-zone');

function initStage2() {
  gameState.hearingCurrentStakeholder = 0;
  gameState.negotiationSolved = false;
  gameState.hearingChoices = {};
  
  hearingGameContainer.classList.remove('hidden');
  negGameContainer.classList.add('hidden');
  btnToStage3.classList.add('hidden');
  
  loadHearingQuestion();
  
  // 初始化滑塊數值
  sliders.a.value = 50; // Price
  sliders.b.value = 50; // Preference
  sliders.c.value = 50; // Cost
  
  // 隱藏第三個無用指針
  pointers.c.style.display = 'none';
  
  updateNegotiationSliders();
}

function loadHearingQuestion() {
  const billInfo = BILLS[gameState.selectedBill];
  
  if (gameState.hearingCurrentStakeholder < billInfo.hearing.length) {
    const qData = billInfo.hearing[gameState.hearingCurrentStakeholder];
    
    hearingWorkspace.innerHTML = `
      <div class="stakeholder-bubble-box">
        <div class="sh-avatar ${qData.stakeholder}">
          <i class="fas ${qData.avatar}"></i>
        </div>
        <div class="sh-bubble">
          <div class="sh-name">${qData.name}</div>
          <div class="sh-quote">「${qData.quote}」</div>
        </div>
      </div>
    `;
    
    hearingOptionsContainer.innerHTML = "";
    qData.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'hearing-opt-btn';
      btn.textContent = opt.text;
      
      btn.addEventListener('click', () => {
        playSound('click');
        gameState.hearingChoices[qData.stakeholder] = opt.text;
        adjustSatisfaction(opt.impact);
        
        gameState.hearingCurrentStakeholder++;
        hearingWorkspace.classList.add('hidden');
        setTimeout(() => {
          hearingWorkspace.classList.remove('hidden');
          loadHearingQuestion();
        }, 400);
      });
      
      hearingOptionsContainer.appendChild(btn);
    });
  } else {
    hearingGameContainer.classList.add('hidden');
    negGameContainer.classList.remove('hidden');
    
    updateNegotiationSliders();
    negGameContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

// 協商拉桿處理
Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    updateNegotiationSliders();
  });
});

function updateNegotiationSliders() {
  const valA = parseInt(sliders.a.value); // Price (定價)
  const valB = parseInt(sliders.b.value); // Preference (偏好)
  const valC = parseInt(sliders.c.value); // Cost (成本)
  
  valDisplays.a.textContent = `${valA}%`;
  valDisplays.b.textContent = `${valB}%`;
  valDisplays.c.textContent = `${valC}%`;
  
  // 計算買方需求與賣方供給 (經濟學曲線模擬)
  // 需求 Qd = 偏好 - 0.6 * 價格 + 30
  // 供給 Qs = 0.6 * 價格 - 成本 + 50
  const Qd = Math.max(5, Math.min(95, Math.round(valB - 0.6 * valA + 30)));
  const Qs = Math.max(5, Math.min(95, Math.round(0.6 * valA - valC + 50)));
  
  pointers.a.style.left = `${Qd}%`; // 需求量指針
  pointers.b.style.left = `${Qs}%`; // 供給量指針
  
  playSound('tick');
  
  // 檢查是否都在均衡區
  const vals = Object.values(gameState.satisfaction);
  const minVal = Math.min(...vals);
  
  // 根據是否有嚴重滿意度衝突，決定均衡共識區的界線
  let minTarget = 42;
  let maxTarget = 58;
  if (minVal < 35) {
    minTarget = 47;
    maxTarget = 53;
    targetGlowZone.style.left = "47%";
    targetGlowZone.style.width = "6%";
    document.getElementById('equilibrium-label').textContent = "市場意見嚴重分歧！極窄均衡區 (47%~53%)";
    negFeedback.textContent = "🚨 由於各方利益代表衝突極大，市場信心脆弱，供需指針必須完美對齊在中央均衡區內！";
    negFeedback.style.color = "var(--color-danger)";
  } else {
    targetGlowZone.style.left = "42%";
    targetGlowZone.style.width = "16%";
    document.getElementById('equilibrium-label').textContent = "市場均衡區 (42%~58%)";
    negFeedback.textContent = "市場利益調和中，調整價格、偏好與成本，讓「需求量（買方）」與「供給量（賣方）」指針均落入綠色均衡區！";
    negFeedback.style.color = "var(--color-warning)";
  }
  
  if (Qd >= minTarget && Qd <= maxTarget && Qs >= minTarget && Qs <= maxTarget) {
    if (!gameState.negotiationSolved) {
      gameState.negotiationSolved = true;
      playSound('success');
      negFeedback.textContent = "🎉 市場達成均衡！價格合理，供需雙方交易順暢，進入下一關！";
      negFeedback.style.color = "var(--color-success)";
      btnToStage3.classList.remove('hidden');
    }
  } else {
    gameState.negotiationSolved = false;
    btnToStage3.classList.add('hidden');
  }
}

btnToStage3.addEventListener('click', () => {
  switchScreen('stage3');
});

// --- 4. 第三關：供需考驗大辯論 ---
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
  
  votingSeatsGrid.innerHTML = "";
  seatElements = [];
  for (let i = 0; i < TOTAL_SEATS; i++) {
    const seat = document.createElement('div');
    seat.className = 'seat-dot';
    votingSeatsGrid.appendChild(seat);
    seatElements.push(seat);
  }
  
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
      btn.textContent = opt;
      btn.addEventListener('click', () => handleQuizAnswer(idx, btn));
      quizOptionsContainer.appendChild(btn);
    });
  } else {
    quizQNum.textContent = "現場答辯結束";
    quizQuestion.textContent = "供需法則答辯完畢！全案進行二讀市場交易電子媒合！";
    quizOptionsContainer.innerHTML = "";
    votingTriggerOverlay.classList.remove('hidden');
  }
}

function handleQuizAnswer(selectedIdx, clickedBtn) {
  const qData = QUIZ_QUESTIONS[gameState.quizCurrentQuestion];
  const allBtns = quizOptionsContainer.querySelectorAll('.quiz-opt-btn');
  
  allBtns.forEach(btn => btn.style.pointerEvents = 'none');
  
  if (selectedIdx === qData.answer) {
    playSound('success');
    gameState.quizScore++;
    clickedBtn.classList.add('correct');
    
    quizFeedbackBox.classList.remove('hidden');
    quizFeedbackText.innerHTML = `<strong>答對了！</strong> ${qData.explanation}`;
    quizFeedbackText.style.color = "var(--color-success)";
    
    // 答對加 8 位支持買賣成交者，且增加各方支持滿意度
    convinceLegislators(true, 8);
    adjustSatisfaction({ student: 3, parent: 3, teacher: 3 });
  } else {
    playSound('fail');
    clickedBtn.classList.add('wrong');
    allBtns[qData.answer].classList.add('correct');
    
    quizFeedbackBox.classList.remove('hidden');
    quizFeedbackText.innerHTML = `<strong>答錯了。</strong>正確答案為：<strong>【${qData.options[qData.answer]}】</strong>。<br>${qData.explanation}`;
    quizFeedbackText.style.color = "var(--color-danger)";
    
    // 答錯加 5 位失敗交易者
    convinceLegislators(false, 5);
  }
  
  setTimeout(() => {
    gameState.quizCurrentQuestion++;
    loadQuizQuestion();
  }, 4000);
}

function convinceLegislators(isYes, num) {
  const undecidedIndices = [];
  seatElements.forEach((seat, idx) => {
    if (!seat.classList.contains('yes') && !seat.classList.contains('no')) {
      undecidedIndices.push(idx);
    }
  });
  
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
  
  voteCountYes.textContent = gameState.yesVotes.toString();
  voteCountNo.textContent = gameState.noVotes.toString();
  voteCountUndecided.textContent = (TOTAL_SEATS - gameState.yesVotes - gameState.noVotes).toString();
}

btnStartElectronicVote.addEventListener('click', () => {
  playSound('click');
  votingTriggerOverlay.classList.add('hidden');
  runVotingSimulation();
});

function runVotingSimulation() {
  gameState.votingActive = true;
  const undecidedIndices = [];
  seatElements.forEach((seat, idx) => {
    if (!seat.classList.contains('yes') && !seat.classList.contains('no')) {
      undecidedIndices.push(idx);
    }
  });
  
  let i = 0;
  
  const satisfactionAverage = Object.values(gameState.satisfaction).reduce((a,b)=>a+b, 0) / 3;
  let passProbability = 0.2; 
  
  const correctRatio = gameState.quizScore / QUIZ_QUESTIONS.length;
  if (correctRatio >= 0.8) passProbability += 0.5;       
  else if (correctRatio >= 0.5) passProbability += 0.3;  
  else if (correctRatio >= 0.3) passProbability += 0.15; 
  else if (correctRatio < 0.1) passProbability -= 0.1;
  
  if (satisfactionAverage >= 60) passProbability += 0.15;
  if (satisfactionAverage < 40) passProbability -= 0.15;

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
  }, 40);
}

function finishVote() {
  gameState.votingActive = false;
  if (gameState.yesVotes >= 57) {
    playSound('cheer');
    alert(`市場電子媒合成功！\n交易成功：${gameState.yesVotes}人，交易失敗：${gameState.noVotes}人。\n成功跨越 57 人成交門檻，市場進入常態運作！`);
    btnToStage4.classList.remove('hidden');
    btnToStage4.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    alert(`市場成交量嚴重低迷！\n交易成功：${gameState.yesVotes}人，交易失敗：${gameState.noVotes}人。\n因供需法則答辯失敗且市場支持度過低，未達 57 人成交門檻。請重新大辯論！`);
    initStage3();
  }
}

btnToStage4.addEventListener('click', () => {
  switchScreen('stage4');
});

// --- 5. 第四關：三讀規章公平性審查 ---
const proofreadBillTitle = document.getElementById('proofread-bill-title');
const proofreadBillContent = document.getElementById('proofread-bill-content');
const proofreadCorrectedCount = document.getElementById('proofread-corrected-count');
const proofreadFeedback = document.getElementById('proofread-feedback');

const constitutionModal = document.getElementById('constitution-modal');
const constitutionTypoExplain = document.getElementById('constitution-typo-explain');
const constitutionModalOptions = document.getElementById('constitution-modal-options');

const thirdReadingCeremony = document.getElementById('third-reading-ceremony');
const ceremonyBillTitleS4 = document.getElementById('ceremony-bill-title-s4');
const btnStrikeGavelS4 = document.getElementById('btn-strike-gavel-s4');
const gavelAnimS4 = document.getElementById('gavel-anim-s4');
const btnToStage5 = document.getElementById('btn-to-stage5');

function initStage4() {
  gameState.constitutionCorrected = false;
  proofreadCorrectedCount.textContent = "未修正";
  proofreadCorrectedCount.style.color = "var(--color-danger)";
  proofreadFeedback.textContent = "";
  
  constitutionModal.classList.add('hidden');
  thirdReadingCeremony.classList.add('hidden');
  btnToStage5.classList.add('hidden');
  
  const billInfo = BILLS[gameState.selectedBill];
  proofreadBillTitle.textContent = billInfo.title + " (規章最終審)";
  proofreadBillContent.innerHTML = billInfo.unconstitutional.content;
  
  const target = document.getElementById('typo-unconstitutional');
  if (target) {
    target.addEventListener('click', openConstitutionModal);
  }
}

function openConstitutionModal() {
  if (gameState.constitutionCorrected) return;
  playSound('click');
  
  const billInfo = BILLS[gameState.selectedBill];
  constitutionTypoExplain.textContent = billInfo.unconstitutional.explain;
  
  constitutionModalOptions.innerHTML = "";
  billInfo.unconstitutional.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'modal-opt-btn';
    btn.textContent = opt.text;
    
    btn.addEventListener('click', () => {
      if (opt.isCorrect) {
        playSound('success');
        btn.classList.add('correct');
        
        const target = document.getElementById('typo-unconstitutional');
        target.textContent = opt.text;
        target.className = "typo-target fixed";
        
        gameState.constitutionCorrected = true;
        proofreadCorrectedCount.textContent = "已合理修正";
        proofreadCorrectedCount.style.color = "var(--color-success)";
        proofreadFeedback.textContent = opt.feedback;
        
        adjustSatisfaction({ student: 10, parent: 10, teacher: 10 });
        
        setTimeout(() => {
          constitutionModal.classList.add('hidden');
          ceremonyBillTitleS4.textContent = billInfo.shortTitle;
          thirdReadingCeremony.classList.remove('hidden');
          btnStrikeGavelS4.classList.remove('hidden');
          thirdReadingCeremony.scrollIntoView({ behavior: 'smooth' });
        }, 1500);
      } else {
        playSound('fail');
        alert(`${opt.feedback} 請重新考慮對公平競爭與正當程序的影響！`);
      }
    });
    
    constitutionModalOptions.appendChild(btn);
  });
  
  constitutionModal.classList.remove('hidden');
}

// 敲規章三讀槌
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

// --- 6. 第五關：外部危機衝擊與市場調控 ---
const vetoBillTitle = document.getElementById('veto-bill-title');
const vetoAlertContainer = document.getElementById('veto-alert-container');
const vetoOptionsContainer = document.getElementById('veto-options-container');

const vetoGameContainer = document.getElementById('veto-game-container');
const vetoProgressFill = document.getElementById('veto-progress-fill');
const vetoVotesSpan = document.getElementById('veto-votes');
const vetoTimerSpan = document.getElementById('veto-timer');
const btnClickVote = document.getElementById('btn-click-vote');
const vetoGameInstruction = document.getElementById('veto-game-instruction');

const vetoSuccessBox = document.getElementById('veto-success-box');
const vetoFailBox = document.getElementById('veto-fail-box');
const vetoFailMessage = document.getElementById('veto-fail-message');

const btnToCertificate = document.getElementById('btn-to-certificate');
const btnRestartVeto = document.getElementById('btn-restart-veto');

function initStage5() {
  gameState.vetoClicks = 0;
  gameState.vetoTimeLeft = 8.0;
  gameState.vetoGameActive = false;
  gameState.vetoChoice = "";
  
  vetoBillTitle.textContent = BILLS[gameState.selectedBill].title;
  
  vetoAlertContainer.classList.remove('hidden');
  vetoGameContainer.classList.add('hidden');
  vetoSuccessBox.classList.add('hidden');
  vetoFailBox.classList.add('hidden');
  
  vetoProgressFill.style.width = "0%";
  vetoVotesSpan.textContent = "0";
  vetoTimerSpan.textContent = "8.0";
  
  const billInfo = BILLS[gameState.selectedBill];
  vetoOptionsContainer.innerHTML = "";
  
  billInfo.veto.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'veto-opt-btn';
    btn.textContent = opt.text;
    
    btn.addEventListener('click', () => {
      playSound('click');
      gameState.vetoChoice = opt.route;
      adjustSatisfaction(opt.impact);
      
      if (opt.clicks === 0) {
        vetoAlertContainer.classList.add('hidden');
        playSound('fail');
        vetoFailBox.classList.remove('hidden');
        vetoFailMessage.textContent = "您選擇了『撤回政策任其自滅』，放棄調控市場。市場交易完全停擺，挑戰失敗！";
        return;
      }
      
      gameState.vetoClicksRequired = opt.clicks;
      vetoAlertContainer.classList.add('hidden');
      startVetoClickGame();
    });
    
    vetoOptionsContainer.appendChild(btn);
  });
}

function startVetoClickGame() {
  vetoGameContainer.classList.remove('hidden');
  gameState.vetoGameActive = true;
  
  vetoGameInstruction.innerHTML = `
    <i class="fas fa-mouse-pointer animate-ping"></i> 
    您的危機調控策略為：<strong>${gameState.vetoChoice}</strong>。<br>
    需在 8 秒內狂點按鈕累計滿 <strong>${gameState.vetoClicksRequired} 次</strong>（穩定指數 57 點）以度過難關！
  `;
  
  gameState.vetoTimer = setInterval(() => {
    gameState.vetoTimeLeft -= 0.1;
    if (gameState.vetoTimeLeft <= 0) {
      gameState.vetoTimeLeft = 0;
      clearInterval(gameState.vetoTimer);
      endVetoGame();
    }
    vetoTimerSpan.textContent = gameState.vetoTimeLeft.toFixed(1);
    if (gameState.vetoTimeLeft < 3.0 && gameState.vetoTimeLeft > 0) {
      playSound('tick');
    }
  }, 100);
}

btnClickVote.addEventListener('click', () => {
  if (!gameState.vetoGameActive) return;
  
  gameState.vetoClicks++;
  const totalVotes = Math.min(113, Math.floor((gameState.vetoClicks / gameState.vetoClicksRequired) * 58));
  vetoVotesSpan.textContent = totalVotes;
  
  const percent = (totalVotes / 113) * 100;
  vetoProgressFill.style.width = `${percent}%`;
  
  playSound('bubble');
});

function endVetoGame() {
  gameState.vetoGameActive = false;
  vetoGameContainer.classList.add('hidden');
  
  const finalVotes = Math.min(113, Math.floor((gameState.vetoClicks / gameState.vetoClicksRequired) * 58));
  
  if (finalVotes >= 57) {
    playSound('cheer');
    triggerConfetti();
    vetoSuccessBox.classList.remove('hidden');
    vetoSuccessBox.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    vetoFailBox.classList.remove('hidden');
    vetoFailMessage.textContent = `市場防衛失敗！\n市場穩定指數僅 ${finalVotes} 分，未達最低穩定門檻 57 分，市場遭遇失衡崩盤。請重擬調控策略！`;
    vetoFailBox.scrollIntoView({ behavior: 'smooth' });
  }
}

btnRestartVeto.addEventListener('click', () => {
  initStage5();
});

btnToCertificate.addEventListener('click', () => {
  switchScreen('cert');
});

// --- 7. 證書畫面與成果統計邏輯 ---
const certPlayerName = document.getElementById('cert-player-name');
const certBillTitle = document.getElementById('cert-bill-title');
const certDateYear = document.getElementById('cert-date-year');
const certDateMonth = document.getElementById('cert-date-month');
const certDateDay = document.getElementById('cert-date-day');

const certBalanceScore = document.getElementById('cert-balance-score');
const certProportionalityScore = document.getElementById('cert-proportionality-score');

const btnPrintCertificate = document.getElementById('btn-print-certificate');
const btnRestartAll = document.getElementById('btn-restart-all');

function initCertificate() {
  certPlayerName.textContent = gameState.playerName;
  certBillTitle.textContent = BILLS[gameState.selectedBill].title;
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  certDateYear.textContent = (year - 1911).toString();
  certDateMonth.textContent = month.toString();
  certDateDay.textContent = day.toString();
  
  // 評估學生素養指標：利益平衡度 (即消費者、生產者、政府社會滿意度是否差距很大)
  const vals = Object.values(gameState.satisfaction);
  const maxVal = Math.max(...vals);
  const minVal = Math.min(...vals);
  const diff = maxVal - minVal;
  
  let balanceRating = "良好 (平衡)";
  if (diff > 45) {
    balanceRating = "失衡 (偏頗)";
  } else if (diff <= 20) {
    balanceRating = "卓越 (高度和諧)";
  } else {
    balanceRating = "中等 (尚可妥協)";
  }
  
  certBalanceScore.textContent = `${balanceRating} (支持差距: ${diff}%)`;
  certProportionalityScore.textContent = `${gameState.quizScore} / ${QUIZ_QUESTIONS.length} 題`;
  
  // 送出後端 Google Sheets 收集 (包含素養決策欄位)
  sendDataToBackend(balanceRating);
  
  triggerConfetti();
}

function sendDataToBackend(balanceRating) {
  if (!syncStatusBox || !syncIcon || !syncText) return;

  if (GOOGLE_SHEET_APP_URL === "") {
    syncStatusBox.className = "sync-status-box failed";
    syncIcon.className = "fas fa-exclamation-circle sync-icon";
    syncText.textContent = "⚠️ 教師未設定 Google 試算表串接網址，作答成果未同步（單機模式）。";
    return;
  }

  syncStatusBox.className = "sync-status-box syncing";
  syncIcon.className = "fas fa-sync sync-icon";
  syncText.textContent = "正在同步成果至雲端試算表...";

  const payload = {
    class: gameState.playerClass,
    seat: gameState.playerSeat,
    name: gameState.playerName,
    bill: BILLS[gameState.selectedBill].title,
    draft: gameState.draftChoice,               // 經營路線
    balance: `${balanceRating} (差值:${Math.max(...Object.values(gameState.satisfaction))-Math.min(...Object.values(gameState.satisfaction))}%)`, // 滿意度差
    score: gameState.quizScore,                 // 供需法则得分
    vetoStrategy: gameState.vetoChoice,         // 危機應變策略
    passed: "是",
    timestamp: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
  };

  fetch(GOOGLE_SHEET_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(() => {
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
switchScreen('intro');
console.log("市場大師：供需平衡大挑戰載入完成！");
