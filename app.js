/**
 * 法案大師：素養思辨挑戰賽！
 * 遊戲邏輯與互動控制 JS 檔案
 */

// --- 後端配置 ---
// 教師部署 Google Apps Script 後，請將產生的網頁應用程式 URL 貼在下方雙引號內：
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
  
  // 素養指標：利害關係人滿意度 (學生, 家長, 教師) 範圍 0 - 100
  satisfaction: {
    student: 50,
    parent: 50,
    teacher: 50
  },

  // 記錄決策選擇，供教師評估素養表現
  draftChoice: "",      // 起草路線
  hearingChoices: {},   // 公聽會作答記錄
  vetoChoice: "",       // 覆議答辯路線
  
  signaturesCollected: 0,
  sigTimer: null,
  sigTimeLeft: 35,
  sigGameActive: false,
  
  hearingCurrentStakeholder: 0, // 0: student, 1: parent, 2: teacher
  
  quizCurrentQuestion: 0,
  quizScore: 0,
  
  yesVotes: 0,
  noVotes: 0,
  votingActive: false,
  
  constitutionCorrected: false,
  
  vetoClicks: 0,
  vetoClicksRequired: 29, // 預設 29 次點擊 = 58 票 (過半數)
  vetoTimer: null,
  vetoTimeLeft: 8.0,
  vetoGameActive: false
};

// --- 素養情境資料庫 ---
const BILLS = {
  homework: {
    title: "「中小學禁止週末作業條例」",
    shortTitle: "禁止週末作業條例",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【全面禁用型】(強硬管制)",
          desc: "強制規定週末及連續假期學校絕對不能指派任何作業，違者扣減該校之政府補助款並予以通報。",
          impact: { student: 30, parent: -25, teacher: -25 },
          route: "強硬管制"
        },
        {
          id: "balanced",
          title: "【彈性引導型】(彈性折衷)",
          desc: "鼓勵週末以「非傳統抄寫」之自主學習任務替代傳統作業（如運動、家事、觀察），由學校提供自主學習資源彈性引導。",
          impact: { student: 15, parent: 15, teacher: 10 },
          route: "彈性折衷"
        },
        {
          id: "flexible",
          title: "【低度規範型】(寬鬆規範)",
          desc: "原則上週末不指派作業，但若遇到段考前一週、複習週或有特殊教學複習需求，教師仍得視需要指派作業。",
          impact: { student: -10, parent: 25, teacher: 20 },
          route: "寬鬆規範"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student",
        name: "學生代表 - 阿強",
        avatar: "fa-child",
        quote: "如果給學校『特殊教學需求』等太多例外彈性，那最後可能變成天天都是『特殊週』，老師一樣發考卷，我們根本放不到假！",
        options: [
          {
            text: "完全同意！修改草案，嚴格限制『例外情況』每學期不得指派超過兩次，違反者予以行政懲處。",
            impact: { student: 20, parent: -10, teacher: -15 }
          },
          {
            text: "增設『學生會申訴管道』，若班級作業量明顯超標，可向校務會議與教育局提出申訴與調查。",
            impact: { student: 15, parent: 5, teacher: 5 }
          },
          {
            text: "我們必須尊重教師的第一線專業授課權力，相信學校與導師會適度拿捏，不宜過度限制。",
            impact: { student: -20, parent: 15, teacher: 20 }
          }
        ]
      },
      {
        stakeholder: "parent",
        name: "家長代表 - 陳媽媽",
        avatar: "fa-user-friends",
        quote: "週末如果不指派功課，孩子回家都在玩手機、打電動，學習進度落後怎麼辦？家長不是專業老師，不知道怎麼督促輔導啊！",
        options: [
          {
            text: "家長應該學會陪伴孩子進行戶外活動或閱讀，而不是把管教與輔導責任全部塞給學校作業！",
            impact: { student: 15, parent: -25, teacher: -5 }
          },
          {
            text: "由教育局編列經費增設『週末線上自主學習資源平台』，提供多元教材，讓家長有資源引導孩子。",
            impact: { student: 5, parent: 20, teacher: 10 }
          },
          {
            text: "條文放寬限制，允許班級經『家長大會過半數同意』後，得指派適量之週末作業。",
            impact: { student: -15, parent: 15, teacher: 10 }
          }
        ]
      },
      {
        stakeholder: "teacher",
        name: "教師代表 - 施老師",
        avatar: "fa-chalkboard-teacher",
        quote: "週末是段考複習的黃金時期，如果一律不准派作業，學生的進度會嚴重落後，教學目標無法如期達成，教師壓力極大！",
        options: [
          {
            text: "學生的身心健康是不可妥協的。進度落後應由教師調整授課法，週末仍應無條件禁止作業。",
            impact: { student: 20, parent: -15, teacher: -20 }
          },
          {
            text: "鼓勵教師進行『翻轉學習』，週末僅需指派 10 分鐘以內的教學觀看影片，不指派抄寫型作業。",
            impact: { student: 10, parent: 10, teacher: 15 }
          },
          {
            text: "修正條文，明定在段考、模擬考前一週，教師得不受限制指派複習性作業。",
            impact: { student: -10, parent: 15, teacher: 15 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「中小學禁止週末作業條例草案」",
      content: "中華民國國民中小學學生之課業，應以課堂學習為主。為保障學生身心健全發展與充足睡眠，各級學校不得於週五或連續假期指派課後作業。<span class='typo-target' id='typo-unconstitutional'>凡不遵守本條例指派週末作業之教師，應由警察機關處以三日以下之拘役，或由學校直接處以新臺幣三萬元之行政罰鍰。</span>",
      explain: "本段條文嚴重侵犯了憲法第 8 條之『人身自由與法官保留原則』（拘役為刑事處罰限制人身自由，必須由法院依法審理，警察無權處分）；且學校並非行政處罰機關，無權直接對個人處以罰鍰處分。這已嚴重違背比例原則與法律保留原則。",
      options: [
        {
          text: "「違反本條例之學校，由主管教育行政機關限期改善；屆期未改善者，列入學校評鑑參考。」",
          isCorrect: true,
          feedback: "正確！此修正案符合行政指導精神，手段合憲且正當。"
        },
        {
          text: "「違反本條例之教師，應由該校家長會聯名予以直接開除，以示懲戒。」",
          isCorrect: false,
          feedback: "錯誤。這違反了勞動權保障與教師法規定的懲處程序，手段仍屬過當。"
        },
        {
          text: "「不服從規定之教師，學校得報請教育部撤銷其教師證書，且終身不得再任教職。」",
          isCorrect: false,
          feedback: "錯誤。處罰極度過度，嚴重違反了憲法比例原則中的衡平性與必要性。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷答辯】「我們已於三讀將硬性刑罰修正為校務評鑑指標，並增設自主資源庫之配套，請行政院依法執行。」",
          impact: { student: 5, parent: 5, teacher: 10 },
          clicks: 15, // 較簡單
          route: "折衷妥協說服"
        },
        {
          text: "【強硬對抗】「立法院代表民意，本法案旨在捍衛學生健康權！行政院應克服用人與預算困難立即公布，不可多言！」",
          impact: { student: 15, parent: -15, teacher: -15 },
          clicks: 40, // 極難，需要40次點擊
          route: "強硬政策對抗"
        },
        {
          text: "【棄案退讓】「考量行政院所提預算及人力困難，本院決定不予維持原案，撤回本法案重新審議。」",
          impact: { student: -30, parent: 10, teacher: 10 },
          clicks: 0, // 直接失敗
          route: "撤回放棄法案"
        }
      ]
    }
  },
  lunch: {
    title: "「營養午餐全面加糖與點心法案」",
    shortTitle: "午餐加糖與點心法案",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【全面加糖型】(強硬管制)",
          desc: "強制營養午餐每天都必須提供含糖飲料或甜點，且主食口味調配應全面提高甜度比例以迎合學生偏好。",
          impact: { student: 30, parent: -25, teacher: -25 },
          route: "強硬管制"
        },
        {
          id: "balanced",
          title: "【每週特餐型】(彈性折衷)",
          desc: "規定每週五為「快樂點心日」提供精緻甜點，平時則提供水果，並對點心含糖量實施減糖配方管制。",
          impact: { student: 15, parent: 15, teacher: 15 },
          route: "彈性折衷"
        },
        {
          id: "flexible",
          title: "【健康無糖型】(健康規範)",
          desc: "全面禁止營養午餐提供任何精緻糖點心與飲料，改為提供新鮮水果與在地無糖茶飲，以推廣健康飲食。",
          impact: { student: -15, parent: 25, teacher: 20 },
          route: "健康規範"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student",
        name: "學生代表 - 小美",
        avatar: "fa-child",
        quote: "如果改成無糖健康水果，那根本就不叫點心！上課已經夠辛苦了，我們連中午吃點甜的、喝珍奶的小確幸權利都要被剝奪嗎？",
        options: [
          {
            text: "支持學生的自主權！維持每天供應甜點，但改用赤藻糖醇等天然代糖降低身體負擔。",
            impact: { student: 20, parent: -5, teacher: -10 }
          },
          {
            text: "由各校學生會定期舉辦『點心民主投票』，讓學生參與共同決定每月水果與點心的比例。",
            impact: { student: 15, parent: 10, teacher: 10 }
          },
          {
            text: "健康是首要之務。精緻糖百害無一利，學生應多吃水果，我們將維持無糖政策。",
            impact: { student: -25, parent: 20, teacher: 20 }
          }
        ]
      },
      {
        stakeholder: "parent",
        name: "家長代表 - 林爸爸",
        avatar: "fa-user-friends",
        quote: "現在國中生肥胖跟蛀牙比例這麼高，如果在學校天天吃含糖點心，回家又不運動，做家長的非常擔心孩子健康！",
        options: [
          {
            text: "學校的體育課與社團活動會加強消耗熱量，家長不用過度限制孩子的飲食樂趣！",
            impact: { student: 15, parent: -20, teacher: -5 }
          },
          {
            text: "嚴格規範所有供應點心之含糖量，必須符合國家級健康食品低糖標準，並定期公布檢驗報告。",
            impact: { student: 5, parent: 20, teacher: 15 }
          },
          {
            text: "改為家長自由選購制，若家長反對孩子吃甜食，可申請不發放，退還該部分營養午餐費。",
            impact: { student: -15, parent: 15, teacher: 10 }
          }
        ]
      },
      {
        stakeholder: "teacher",
        name: "教師代表 - 黃老師",
        avatar: "fa-chalkboard-teacher",
        quote: "下午多塞一個點心時間會打亂打掃與授課作息，廚房阿姨的人力根本不夠做，且每天廚餘與垃圾分類量會暴增！",
        options: [
          {
            text: "學生福利至上。請教師調整授課進度，廚房阿姨的人力不足可向地方政府申請擴編預算。",
            impact: { student: 20, parent: -10, teacher: -20 }
          },
          {
            text: "點心直接隨午餐一起發放，免除下午額外吃點心的時間，減少廚餘與打亂作息的機會。",
            impact: { student: 10, parent: 10, teacher: 20 }
          },
          {
            text: "縮小規模，將每日點心時間改為每月一次的「慶生茶會」，將負擔降到最低。",
            impact: { student: -20, parent: 15, teacher: 15 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「營養午餐全面加糖與點心法案草案」",
      content: "中華民國各級中小學校營養午餐之設計，應注重膳食均衡。為提升學生學習動能與上學幸福感，學校餐廳得於每日下午加設點心之免費供應時段。<span class='typo-target' id='typo-unconstitutional'>凡對甜點分配、口味提出爭議或挑食之學生，應由學校直接送交少年法院，處以十日以下之感化教育。</span>",
      explain: "本條文將「個人挑食或對口味有爭議」等純屬個人飲食習慣問題，直接施以限制人身自由的「少年法庭感化教育」，手段與目的完全失去均衡（違反手段適合性與衡平性），嚴重違反憲法第 8 條之人身自由保障與第 23 條之比例原則。",
      options: [
        {
          text: "「學校應加強飲食與環境教育，引導挑食學生建立健康飲食習慣，並尊重學生膳食選擇權。」",
          isCorrect: true,
          feedback: "正確！這符合教育基本精神，手段溫和且保障了基本尊嚴。"
        },
        {
          text: "「挑食之學生，學校得逕行禁止其參與校外教學、社團活動及體育課，以示懲罰。」",
          isCorrect: false,
          feedback: "錯誤。這過度限制了學生的學習權與受教權，手段依然違反比例原則。"
        },
        {
          text: "「不服從分配之學生，導師應通知家長帶回自行管教三日，期間視為無故曠課。」",
          isCorrect: false,
          feedback: "錯誤。這剝奪了學生的受教權，作為挑食的處分手段過於嚴苛且過當。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷答辯】「我們已於三讀修正口味為低糖配方，且隨午餐隨餐發放，解決了廚房人力與作息困難，請依法公布。」",
          impact: { student: 5, parent: 5, teacher: 10 },
          clicks: 15,
          route: "折衷妥協說服"
        },
        {
          text: "【強硬對抗】「學生權益不可打折！行政院不應以行政程序或財政為藉口拖延，立法院堅持原案，請立即公布！」",
          impact: { student: 15, parent: -15, teacher: -15 },
          clicks: 40,
          route: "強硬政策對抗"
        },
        {
          text: "【棄案退讓】「考量地方政府經費編列困難與學校廚餘處理問題，本院決定撤回本法案。」",
          impact: { student: -30, parent: 10, teacher: 10 },
          clicks: 0,
          route: "撤回放棄法案"
        }
      ]
    }
  },
  green: {
    title: "「校園綠能與垃圾減量推廣法」",
    shortTitle: "校園綠能與垃圾減量法",
    drafting: {
      options: [
        {
          id: "strict",
          title: "【強制禁用型】(強硬管制)",
          desc: "強制校園內合作社與學生餐廳完全禁用任何一次性塑膠餐具，且新建大樓屋頂必須 100% 覆蓋太陽能發電設備。",
          impact: { student: -20, parent: -10, teacher: 10 },
          route: "強硬管制"
        },
        {
          id: "balanced",
          title: "【漸進引導型】(彈性折衷)",
          desc: "內用禁用一次性塑膠製品，外帶則鼓勵自備；太陽能建置依學校經費逐步裝設，並增設無紙化教學輔導期。",
          impact: { student: 15, parent: 15, teacher: 15 },
          route: "彈性折衷"
        },
        {
          id: "flexible",
          title: "【宣導鼓勵型】(寬鬆規範)",
          desc: "不採強制禁用或罰則，改以「自備餐具加分制度」與「節能減碳競賽」等方式，引導學生自主環保。",
          impact: { student: 20, parent: 20, teacher: -10 },
          route: "寬鬆規範"
        }
      ]
    },
    hearing: [
      {
        stakeholder: "student",
        name: "學生代表 - 小豪",
        avatar: "fa-child",
        quote: "如果完全不提供一次性餐盒，我們中午忘了帶環保便當盒的話，不就沒辦法打包吃飯了？這樣真的很不方便！",
        options: [
          {
            text: "不便是環保的代價！大家應該學會為地球負責，請養成隨身攜帶餐具的習慣。",
            impact: { student: -25, parent: -5, teacher: 15 }
          },
          {
            text: "增設『校園環保便當盒押金租借點』，學生忘記帶時可付押金租借，歸還時退款，兼顧便利與環保。",
            impact: { student: 15, parent: 10, teacher: 10 }
          },
          {
            text: "放寬規定，僅限制在內用區禁用，外帶部分則允許合作社提供可分解紙盒。",
            impact: { student: 10, parent: 5, teacher: -5 }
          }
        ]
      },
      {
        stakeholder: "parent",
        name: "家長代表 - 張媽媽",
        avatar: "fa-user-friends",
        quote: "強迫學校屋頂裝滿太陽能板，電磁波會不會危害孩子健康？而且高昂的建置費用會不會轉移到我們的註冊費或冷氣費中？",
        options: [
          {
            text: "科學研究顯示太陽能板電磁波極低，建置成本有國家專案補助，請家長不要因盲目恐慌阻礙綠能發展！",
            impact: { student: 5, parent: -20, teacher: 5 }
          },
          {
            text: "法案明定綠能收益將全數專款專用於『學生學雜費與電費補貼』，並規範發電變壓設備需設置於教學區 50 公尺外。",
            impact: { student: 5, parent: 25, teacher: 10 }
          },
          {
            text: "如果班級家長會過半數反對，該班教室大樓的屋頂便免予設置發電設備，保留家長選擇權。",
            impact: { student: -10, parent: 15, teacher: -5 }
          }
        ]
      },
      {
        stakeholder: "teacher",
        name: "教師代表 - 羅老師",
        avatar: "fa-chalkboard-teacher",
        quote: "強制無紙化教學推行過快，教案全改電子版，老師不僅培訓負擔重，學生整天盯著平板看，眼睛近視視力惡化，誰來負責？",
        options: [
          {
            text: "數位化是國際趨勢，教師應積極參加資訊素養研習，克服困難調整教學法。",
            impact: { student: 10, parent: -15, teacher: -25 }
          },
          {
            text: "採取混成式教學，僅將課堂作業繳交、聯絡簿改為數位，紙本教科書仍予保留，減少師生用眼時間。",
            impact: { student: 15, parent: 15, teacher: 20 }
          },
          {
            text: "不強制規定，由各學科領域教學研究會自行決定無紙化教材的比例與進度。",
            impact: { student: -5, parent: 10, teacher: 10 }
          }
        ]
      }
    ],
    unconstitutional: {
      title: "「校園綠能與垃圾減量推廣法草案」",
      content: "中華民國各級學校應落實綠色校園政策。校區新設建築應規劃屋頂發電系統；且校園合作社與餐廳禁止提供一次性塑膠製品。<span class='typo-target' id='typo-unconstitutional'>為徹底查緝违規行為，學校環保稽查人員得不經通知，隨時對在校師生之書包、衣物、個人私人物品進行無預警搜查。</span>",
      explain: "這段條文嚴重侵犯了憲法第 22 條保障之「人民隱私權」。在無犯罪嫌疑且缺乏法院法官令狀等程序保障下，學校行政人員隨時隨地搜查師生書包及私人物品，手段對基本權利的限制已嚴重過當，完全違背比例原則中的必要性與法治國原則。",
      options: [
        {
          text: "「學校應以教育宣導為主，引導師生實踐無塑生活；除有危害校園安全之緊急情事外，不得搜查學生私人物品。」",
          isCorrect: true,
          feedback: "正確！這合理限縮了搜查權限，有效保障了校園內的隱私權與合理管教界線。"
        },
        {
          text: "「對私帶塑膠吸管之學生，學校得公告其班級姓名於校門口布告欄，以收警惕之效。」",
          isCorrect: false,
          feedback: "錯誤。公開揭露姓名依然涉嫌侵害學生姓名權與個人隱私，且處罰過度，不符比例原則。"
        },
        {
          text: "「搜查時應有班級導師在場陪同，且搜查所得之違規塑膠餐具應一律予以沒收銷毀。」",
          isCorrect: false,
          feedback: "錯誤。這並未解決「無端搜查書包隱私權受損」的違憲核心問題。"
        }
      ]
    },
    veto: {
      options: [
        {
          text: "【折衷答辯】「我們已於三讀增設餐具押金租借與漸進教學配套，且建置費全額獲教育部專案補助，已化解窒礙難行，請依法公布。」",
          impact: { student: 5, parent: 5, teacher: 10 },
          clicks: 15,
          route: "折衷妥協說服"
        },
        {
          text: "【強硬對抗】「地球環境沒有退路！減碳是攸關下一代的最高道德價值，行政院不應只算商業帳，必須強行公布！」",
          impact: { student: -10, parent: -15, teacher: -15 },
          clicks: 45,
          route: "強硬政策對抗"
        },
        {
          text: "【棄案退讓】「考量禁用塑膠執行困難度與高昂的太陽能建置維護費，本院決定撤回本法案。」",
          impact: { student: -20, parent: 10, teacher: 10 },
          clicks: 0,
          route: "撤回放棄法案"
        }
      ]
    }
  }
};

const QUIZ_QUESTIONS = [
  {
    type: "fill",
    question: "【法律保留原則】新北市政府為整頓道路安全，以行政命令規定「外送員每日送餐不得超過10小時，違者處一萬元罰鍰」。外送員工會抗議此規定限制了其憲法第15條保障之工作權，應屬無效。這是因為限制人民基本權利之重大事項，必須以立法院通過的「法律」明文規定，或有法律明確授權，行政機關不能以行政命令任意限制，此法理在憲法上稱為【＿＿＿＿原則】。",
    answers: ["法律保留", "法律保留原則"],
    explanation: "「法律保留原則」是指限制人民基本權利的重大事項，必須由代表民意的立法機關以「法律」規定，行政機關不得自行發布命令任意限制。"
  },
  {
    type: "choice",
    question: "【比例原則：適合性】某直轄市為降低青少年犯罪率，實施「晚上九點後未成年人禁止在外活動」之宵禁命令。然而，學者指出「大部分青少年犯罪多發生在下午或校園內，限制夜間出行並無法有效降低整體青少年犯罪率」。此一質疑主要指控該宵禁政策違反了比例原則中的哪一項子原則？",
    options: [
      "手段無法有效達成目的之「適合性原則」",
      "未能選擇侵害最小手段之「必要性原則」",
      "損害大於所欲保護公共利益之「衡平性原則」",
      "法律規定內容不夠明確之「法律明確性原則」"
    ],
    answer: 0,
    explanation: "「適合性原則」要求國家限制人民權利的手段，必須「有助於」達成所追求的合法目的。若手段與目的之間缺乏實質因果關係，無法有效達成目標，即違反適合性。"
  },
  {
    type: "choice",
    question: "【比例原則：必要性/最小侵害】為防制詐騙簡訊氾濫，某委員提案「全面禁止各大電信業者發送任何匿名或跨國簡訊，違者重罰電信業者」。在公聽會中，專家反對並提出折衷方案：「電信業者應建立 AI 關鍵字攔截與境外發送警示機制」。專家的主張是基於下列哪一項憲法法理？",
    options: [
      "應在眾多能達成目的的手段中，選擇對人民權益限制最輕微的「必要性（最小侵害）原則」",
      "只要手段能達成防詐，不論侵害多少人均屬正當的「適合性原則」",
      "人民隱私權完全不可限制的「絕對人權保障原則」",
      "行政機關應無條件配合立法院決議之「責任政治原則」"
    ],
    answer: 0,
    explanation: "「必要性原則（最小侵害原則）」要求在所有能達成相同目的的手段中，必須選擇對人民權利侵害最小的那一個。AI 關鍵字攔截與警示比「全面禁用簡訊」造成的通訊自由損害更小，因此後者違反必要性。"
  },
  {
    type: "fill",
    question: "【比例原則：衡平性】某山區道路因土石流高風險，公路局實施管制：「凡進入該路段之車輛需繳交一萬元生態復育捐」，以期減少車流。然而此舉導致依賴該唯一聯外道路維生之果農與居民面臨嚴重生計威脅。此項政策手段所造成的私人財產與經濟利益損害，顯然大於其所追求的些微生態保護公共利益，因而違反了比例原則中的【＿＿＿原則】（亦稱狹義比例原則，三個字）。",
    answers: ["衡平性", "衡平性原則"],
    explanation: "「衡平性原則」要求限制權利所造成的損害，與保護的公共利益之間必須維持均衡。在此情境下，限制私人經濟生存造成的損害大於該環保利益，因此違反衡平性。"
  },
  {
    type: "choice",
    question: "【法律位階原則】某直轄市議會通過地方自治條例，規定「在校園內使用未經檢驗之電子產品者，處以三日拘役處分」。然而，商家指出「拘役為人身自由之剝奪，屬刑事處罰，依《中央法規標準法》必須以法律明文規定，地方自治條例（位階為命令）不得抵觸法律與憲法」。這主要是因為哪一項法律原則？",
    options: [
      "法律優位與法律保留原則，下位階之自治條例或行政命令不得抵觸上位階法律",
      "地方自治條例效力完全等同憲法，無須遵守法律位階",
      "只要學校或市議會通過，即可隨意制定刑罰，不受約束",
      "人身自由屬於行政機關管轄，不需法官開立令狀"
    ],
    answer: 0,
    explanation: "依據法律位階原則，憲法 > 法律 > 命令。限制人身自由之刑事處罰（如拘役）必須由立法院通過的「法律」明文規定，下位階的地方自治條例或命令若予以規定即屬違憲無效。"
  },
  {
    type: "fill",
    question: "【立法院二讀程序】立法程序中的「三讀程序」分工不同。一讀會僅朗讀案由後送交審查，三讀會原則上僅能作文字修正。而在我國立法程序中，最關鍵的「進行逐條廣泛討論、辯論、條文修正與二讀表決」的階段是在【＿＿＿會】（三個字）。",
    answers: ["二讀會", "二讀會階段"],
    explanation: "二讀會是法案審議最核心的階段，會進行廣泛討論、逐條審查、修正與表決。"
  },
  {
    type: "choice",
    question: "【行政院覆議權】立法院三讀通過「大幅提高地方基層預算案」，行政院認為在實務執行上極度窒礙難行，移請立法院覆議。經立法院重新表決後，全體委員過半數維持原案。關於此時行政院長之憲法義務，下列敘述何者正確？",
    options: [
      "行政院長應接受該決議，依法編列預算執行",
      "行政院長可以拒絕公布，並無限期凍結該項預算",
      "行政院長得逕行解散立法院，重新進行立法委員選舉",
      "行政院長應直接向司法院提案彈劾立法院長"
    ],
    answer: 0,
    explanation: "依中華民國憲法增修條文規定，立法院對於行政院移請覆議之法律案，若全體委員過半數維持原案，行政院長即應接受該決議，無權拒絕執行。"
  },
  {
    type: "fill",
    question: "【人身自由與法官保留原則】某條例草案規定：「凡攜帶塑膠吸管進入校園之師生，得由學校安全稽查人員直接限制其自由，當場處以拘役二日」。此條文嚴重侵害了憲法第8條的「人身自由」與「法官保留原則」，這是因為剝奪人民人身自由之強制處分或刑事處罰，必須由中立的【＿＿】（兩個字）依法定程序審理裁判，行政稽查人員無權當場處分。",
    answers: ["法官", "法院"],
    explanation: "「法官保留原則」是指凡涉及人身自由限制（如拘留、拘役）或搜索、扣押等重大強制處分，必須由中立的司法機關（法官/法院）依法審理裁判，行政機關無權自行決定，以防權力濫用。"
  },
  {
    type: "choice",
    question: "【立法院委員會審查】在立法程序中，一讀會通過後法案通常會送交「委員會審查」。關於委員會在法案審議中的功能，下列敘述何者正確？",
    options: [
      "讓不同專業的委員對法案進行實質討論，並得召開公聽會聽取專家、官員與利害關係人的意見",
      "委員會是最終通過法案的機關，通過後直接送總統公布，不需再回大會二讀表決",
      "委員會只負責將法案字體放大，不做任何實質內容的調整",
      "委員會是由學生代表與家長代表組成，立法委員不得參加"
    ],
    answer: 0,
    explanation: "委員會是立法院專業分工的核心，負責對提案進行細緻的常設審查、辦理公聽會蒐集各界民意與利害關係人意見，作為二讀會逐條討論與表決之基礎。"
  },
  {
    type: "fill",
    question: "【司法制衡：憲法法庭】如果立法院通過的法律存在違憲疑慮，人民、法官或特定機關在用盡訴訟救濟後，可向司法院聲請判決。我國負責對法律進行違憲審查，並宣告違憲法律失效的最終機關是司法院的【＿＿＿＿】（四個字）。",
    answers: ["憲法法庭"],
    explanation: "司法院「憲法法庭」是我國行使違憲審查的司法機關，藉由宣告違憲法律無效來行使司法權對立法權的制衡，以守護憲法秩序。"
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
      // 還原原本設計設定的色系
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
  const billInfo = BILLS[gameState.selectedBill];
  hudBillTitle.textContent = billInfo.shortTitle;
  hudCharName.textContent = gameState.playerName;
  
  let iconClass = "fa-wand-magic-sparkles";
  if (gameState.selectedChar === "ray") iconClass = "fa-graduation-cap";
  if (gameState.selectedChar === "wah") iconClass = "fa-bullhorn";
  
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

// --- 2. 第一關：起草與一讀會邏輯 ---
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

const legislatorsData = [
  { name: "林立委", party: "民意黨", concern: "student", icon: "fa-user-tie" },
  { name: "張立委", party: "正義盟", concern: "parent", icon: "fa-user-astronaut" },
  { name: "王立委", party: "中立派", concern: "teacher", icon: "fa-user-shield" },
  { name: "李立委", party: "民意黨", concern: "student", icon: "fa-user-graduate" },
  { name: "陳立委", party: "正義盟", concern: "parent", icon: "fa-user-nurse" },
  { name: "黃立委", party: "中立派", concern: "teacher", icon: "fa-user-md" },
  { name: "蔡立委", party: "民意黨", concern: "student", icon: "fa-user-ninja" },
  { name: "吳立委", party: "正義盟", concern: "parent", icon: "fa-user-secret" },
  { name: "徐立委", party: "中立派", concern: "teacher", icon: "fa-user-clock" },
  { name: "趙立委", party: "民意黨", concern: "student", icon: "fa-user-edit" },
  { name: "美美委員", party: "正義盟", concern: "parent", icon: "fa-user-female" },
  { name: "阿明委員", party: "中立派", concern: "teacher", icon: "fa-user" },
  { name: "強強委員", party: "民意黨", concern: "student", icon: "fa-user-plus" },
  { name: "小華委員", party: "正義盟", concern: "parent", icon: "fa-users" },
  { name: "國安委員", party: "中立派", concern: "teacher", icon: "fa-user-check" }
];

function getConcernChinese(concern) {
  if (concern === 'student') return '學生權益';
  if (concern === 'parent') return '家長立場';
  if (concern === 'teacher') return '教師負擔';
  return '校園發展';
}

function getLegislatorDialogue(billId, concern) {
  const database = {
    homework: {
      student: {
        question: "這個減少週末作業的提案，能真正減輕我們的負擔嗎？會不會反而讓平日的作業變多？",
        correctText: "我們會明定課後總量管制，鼓勵多元自主學習替代抄寫，不讓平日負擔增加。",
        incorrectText: "平日作業隨便老師派，只要週末能放假就行了，大家各退一步嘛。"
      },
      parent: {
        question: "週末不寫功課，孩子回家都在玩手機、學習進度落後怎麼辦？家長不會輔導啊！",
        correctText: "我們會推廣親子共學與多元線上自主資源，讓孩子在週末進行健康的主題探索。",
        incorrectText: "現在強調自主學習，家長應該自己想辦法管教，不能把責任都推給學校。"
      },
      teacher: {
        question: "週末是段考複習的黃金期，全面禁止週末作業會不會侵害教學自主權與課程進度？",
        correctText: "我們保障段考前一週的指派彈性，並提供翻轉教學數位資源，簡化授課壓力。",
        incorrectText: "教學進度不應凌駕於學生健康上，請老師自行想辦法趕課，週末一律禁派。"
      }
    },
    lunch: {
      student: {
        question: "這個法案提倡加糖與點心，我們超支持！但會不會為了健康，最後又偷偷改成無糖水果？",
        correctText: "我們會明定『快樂點心日』，並研發低糖配方的精緻甜點，兼顧美味與健康！",
        incorrectText: "如果家長反對，我們也只能妥協，把所有甜點全換成無糖蔬菜和水果。"
      },
      parent: {
        question: "孩子在學校天天吃含糖點心，我非常擔心他們的牙齒健康和肥胖問題！",
        correctText: "法案要求嚴格使用合格減糖配方，且搭配飲食教育宣導，引導正確飲食習慣。",
        incorrectText: "學生讀書很辛苦，吃點甜的可以有效紓壓，家長不要限制太多飲食樂趣。"
      },
      teacher: {
        question: "下午多發點心會打亂打掃與上課作息，垃圾量會暴增，廚房阿姨也忙不過來！",
        correctText: "我們規定點心隨午餐一同發放以簡化流程，並積極爭取預算補貼廚房人力負擔。",
        incorrectText: "為了學生幸福感，請教師們多辛苦一下，協助指導垃圾分類與作息調整。"
      }
    },
    green: {
      student: {
        question: "全面禁用一次性餐具，我們外帶很不方便，而且自備餐具在學校也沒地方洗！",
        correctText: "我們會推動校園環保餐具租借系統，並在各棟大樓增設現代化流理洗滌區。",
        incorrectText: "不方便是環保必經的代價，請大家咬緊牙關克服，自己把餐具帶回家洗。"
      },
      parent: {
        question: "自備餐具在學校如果洗不乾淨，容易滋生細菌，增加家長洗滌與衛生疑慮。",
        correctText: "學校會配合設置高溫殺菌烘碗設備，並定期抽檢校內餐飲衛生以確保安全。",
        incorrectText: "家長可以每天幫孩子準備兩套乾淨餐具，這本來就是家庭環境教育的一環。"
      },
      teacher: {
        question: "推動無紙化教學與太陽能設備巡檢維修，會大幅增加導師的行政負擔！",
        correctText: "無紙化將提供專業數位助教，太陽能維護則由外包專業廠商全權負責，不佔用教師時間。",
        incorrectText: "這是綠能轉型的必要犧牲，教師作為教育推手，應該主動承擔巡檢重任。"
      }
    }
  };
  
  return database[billId]?.[concern] || {
    question: "你對這個法案有什麼具體想法？",
    correctText: "我們有完善的配套措施，一定會兼顧各方權益。",
    incorrectText: "法案已經寫好了，請各位直接簽字支持就對了。"
  };
}

function initStage1() {
  gameState.signaturesCollected = 0;
  gameState.sigTimeLeft = 35;
  gameState.sigGameActive = false;
  gameState.satisfaction = { student: 50, parent: 50, teacher: 50 }; // 重置滿意度
  
  sigCountSpan.textContent = "0";
  sigTimerSpan.textContent = "35";
  
  // 顯示起草任務，隱藏連署與典禮
  draftingGameContainer.classList.remove('hidden');
  sigGameContainer.classList.add('hidden');
  firstReadingCeremony.classList.add('hidden');
  btnToStage2.classList.add('hidden');
  
  // 清理連署大廳座位與對話框，保留開始覆蓋層
  sigPlayArea.querySelectorAll('.lobby-seat-card, .lobby-dialogue-overlay').forEach(el => el.remove());
  sigStartOverlay.classList.remove('hidden');
  
  // 生成起草政策選項卡
  const billInfo = BILLS[gameState.selectedBill];
  draftingOptionsContainer.innerHTML = "";
  
  billInfo.drafting.options.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'draft-opt-card';
    card.dataset.id = opt.id;
    
    // 生成影響標籤字串
    const getImpactText = (val) => val > 0 ? `+${val}` : `${val}`;
    
    card.innerHTML = `
      <div class="draft-opt-title">${opt.title}</div>
      <div class="draft-opt-desc">${opt.desc}</div>
      <div class="draft-opt-impact">
        <span class="student"><i class="fas fa-child"></i> 學生: ${getImpactText(opt.impact.student)}%</span>
        <span class="parent"><i class="fas fa-user-friends"></i> 家長: ${getImpactText(opt.impact.parent)}%</span>
        <span class="teacher"><i class="fas fa-chalkboard-teacher"></i> 教師: ${getImpactText(opt.impact.teacher)}%</span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      playSound('click');
      document.querySelectorAll('.draft-opt-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      // 保存玩家起草抉擇
      gameState.draftChoice = opt.route;
      
      // 延遲更新滿意度 HUD 並解鎖下一步
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

// 連署遊說大廳小遊戲
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
  
  initLobby();
});

function initLobby() {
  // 清除任何殘留內容
  sigPlayArea.querySelectorAll('.lobby-seat-card, .lobby-dialogue-overlay').forEach(el => el.remove());
  
  // 建立立委遊說狀態
  gameState.legislatorsState = legislatorsData.map((leg, index) => ({
    id: index,
    ...leg,
    status: 'uncontacted',
    clickProgress: 0
  }));

  gameState.legislatorsState.forEach(leg => {
    const card = document.createElement('div');
    card.className = 'lobby-seat-card uncontacted';
    card.dataset.id = leg.id;
    card.innerHTML = `
      <div class="seat-avatar"><i class="fas ${leg.icon}"></i></div>
      <div class="seat-name">${leg.name}</div>
      <div class="seat-party">${leg.party}</div>
      <div class="seat-badge">未遊說</div>
      <div class="lobby-click-progress hidden">
        <div class="lobby-click-fill" style="width: 0%"></div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      handleLegislatorClick(leg.id, card);
    });
    
    sigPlayArea.appendChild(card);
  });
}

function handleLegislatorClick(legId, card) {
  if (!gameState.sigGameActive) return;
  
  const leg = gameState.legislatorsState[legId];
  if (!leg) return;
  
  if (leg.status === 'signed') return;
  
  if (leg.status === 'skeptical') {
    // 進行快速連點說服
    leg.clickProgress++;
    playSound('click');
    
    const progressFill = card.querySelector('.lobby-click-fill');
    const progressPercent = (leg.clickProgress / 5) * 100;
    progressFill.style.width = `${progressPercent}%`;
    
    const badge = card.querySelector('.seat-badge');
    badge.textContent = `說服中 (${leg.clickProgress}/5)`;
    
    if (leg.clickProgress >= 5) {
      playSound('success');
      leg.status = 'signed';
      card.className = 'lobby-seat-card signed';
      card.querySelector('.seat-badge').textContent = '已連署';
      
      const progressDiv = card.querySelector('.lobby-click-progress');
      progressDiv.classList.add('hidden');
      
      gameState.signaturesCollected++;
      sigCountSpan.textContent = gameState.signaturesCollected;
      
      if (gameState.signaturesCollected >= 15) {
        clearInterval(gameState.sigTimer);
        endSigGame(true);
      }
    }
    return;
  }
  
  if (leg.status === 'uncontacted') {
    // 開啟遊說對話覆蓋層
    const dialog = getLegislatorDialogue(gameState.selectedBill, leg.concern);
    const correctIsFirst = Math.random() < 0.5;
    const option1Text = correctIsFirst ? dialog.correctText : dialog.incorrectText;
    const option2Text = correctIsFirst ? dialog.incorrectText : dialog.correctText;
    
    const overlay = document.createElement('div');
    overlay.className = 'lobby-dialogue-overlay';
    overlay.innerHTML = `
      <div class="lobby-dialogue-box">
        <div class="lobby-dialogue-header">
          <i class="fas ${leg.icon}"></i> ${leg.name} (${leg.party}) — 關注：${getConcernChinese(leg.concern)}
        </div>
        <div class="lobby-dialogue-question">
          「${dialog.question}」
        </div>
        <div class="lobby-dialogue-options">
          <button class="lobby-dialogue-btn" data-correct="${correctIsFirst}">${option1Text}</button>
          <button class="lobby-dialogue-btn" data-correct="${!correctIsFirst}">${option2Text}</button>
        </div>
      </div>
    `;
    
    overlay.querySelectorAll('.lobby-dialogue-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCorrect = btn.dataset.correct === "true";
        overlay.remove(); // 關閉對話框
        
        if (isCorrect) {
          playSound('success');
          leg.status = 'signed';
          card.className = 'lobby-seat-card signed';
          card.querySelector('.seat-badge').textContent = '已連署';
          
          gameState.signaturesCollected++;
          sigCountSpan.textContent = gameState.signaturesCollected;
          
          if (gameState.signaturesCollected >= 15) {
            clearInterval(gameState.sigTimer);
            endSigGame(true);
          }
        } else {
          playSound('fail');
          leg.status = 'skeptical';
          leg.clickProgress = 0;
          card.className = 'lobby-seat-card skeptical';
          card.querySelector('.seat-badge').textContent = '疑慮 (請連點 5 次說服)';
          
          const progressDiv = card.querySelector('.lobby-click-progress');
          progressDiv.classList.remove('hidden');
          card.querySelector('.lobby-click-fill').style.width = '0%';
        }
      });
    });
    
    sigPlayArea.appendChild(overlay);
  }
}

function endSigGame(isWon) {
  gameState.sigGameActive = false;
  
  // 移除未完成的遊說對話框
  sigPlayArea.querySelectorAll('.lobby-dialogue-overlay').forEach(el => el.remove());
  
  if (isWon) {
    playSound('success');
    ceremonyBillTitle.textContent = BILLS[gameState.selectedBill].title;
    firstReadingCeremony.classList.remove('hidden');
    btnStrikeGavelS1.classList.remove('hidden');
    firstReadingCeremony.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    alert("連署時間到！我們需要至少 15 位立委簽名才能提案。請再挑戰一次！");
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

// --- 3. 第二關：公聽會與協商邏輯 ---
const hearingGameContainer = document.getElementById('hearing-game-container');
const hearingWorkspace = document.getElementById('hearing-workspace');
const hearingOptionsContainer = document.getElementById('hearing-options-container');
const negGameContainer = document.getElementById('negotiation-game-container');
const btnToStage3 = document.getElementById('btn-to-stage3');

// 協商拉桿對應
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
  
  // 載入第一個利害關係人提問
  loadHearingQuestion();
  
  // 初始化協商拉桿
  sliders.a.value = 20;
  sliders.b.value = 80;
  sliders.c.value = 50;
  updateNegotiationSliders();
}

function loadHearingQuestion() {
  const billInfo = BILLS[gameState.selectedBill];
  
  if (gameState.hearingCurrentStakeholder < billInfo.hearing.length) {
    const qData = billInfo.hearing[gameState.hearingCurrentStakeholder];
    
    // 渲染對話氣泡
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
    
    // 渲染答辯選項
    hearingOptionsContainer.innerHTML = "";
    qData.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'hearing-opt-btn';
      btn.textContent = opt.text;
      
      btn.addEventListener('click', () => {
        playSound('click');
        // 保存決策
        gameState.hearingChoices[qData.stakeholder] = opt.text;
        
        // 增減滿意度
        adjustSatisfaction(opt.impact);
        
        // 載入下一個利害關係人或進入協商
        gameState.hearingCurrentStakeholder++;
        hearingWorkspace.classList.add('hidden'); // 轉場閃爍
        setTimeout(() => {
          hearingWorkspace.classList.remove('hidden');
          loadHearingQuestion();
        }, 400);
      });
      
      hearingOptionsContainer.appendChild(btn);
    });
  } else {
    // 公聽會結束，開啟朝野協商
    hearingGameContainer.classList.add('hidden');
    negGameContainer.classList.remove('hidden');
    
    // 素養動態難度機制：
    // 計算三方支持度的「標準差/分歧度」。若某一方極度不滿，協商共識發光區會縮小！
    const vals = Object.values(gameState.satisfaction);
    const minVal = Math.min(...vals);
    
    // 如果有任一方支持度低於 35%，共識發光區縮小至 5% (難度增加！)，否則為 10%
    if (minVal < 35) {
      targetGlowZone.style.left = "48%";
      targetGlowZone.style.width = "4%";
      document.querySelector('.target-label').textContent = "意見嚴重對立！極小共識區 (48%~52%)";
      negFeedback.textContent = "🚨 注意：因公聽會上有利益代表非常不滿，導致朝野政黨對立，協商共識範圍大幅縮減！";
      negFeedback.style.color = "var(--color-danger)";
    } else {
      targetGlowZone.style.left = "45%";
      targetGlowZone.style.width = "10%";
      document.querySelector('.target-label').textContent = "朝野共識區 (45%~55%)";
      negFeedback.textContent = "公聽會順利結束，利益相對平衡，朝野協商難度適中。請對齊指針！";
      negFeedback.style.color = "var(--color-warning)";
    }
    
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
  
  // 檢查是否都在共識區
  const vals = Object.values(gameState.satisfaction);
  const minVal = Math.min(...vals);
  
  // 根據是否有嚴重衝突，決定共識區的界線
  let minTarget = 45;
  let maxTarget = 55;
  if (minVal < 35) {
    minTarget = 48;
    maxTarget = 52;
  }
  
  if (valA >= minTarget && valA <= maxTarget &&
      valB >= minTarget && valB <= maxTarget &&
      valC >= minTarget && valC <= maxTarget) {
    
    if (!gameState.negotiationSolved) {
      gameState.negotiationSolved = true;
      playSound('success');
      negFeedback.textContent = "🎉 協商成功！各黨完成讓步，本案送出審查報告，進入二讀會！";
      negFeedback.style.color = "var(--color-success)";
      btnToStage3.classList.remove('hidden');
    }
  } else {
    gameState.negotiationSolved = false;
    if (minVal < 35) {
      negFeedback.textContent = "🚨 政黨意見陷入冰點，請小心微調讓指針重合在紅色極窄共識區內！";
      negFeedback.style.color = "var(--color-danger)";
    } else {
      negFeedback.textContent = "朝野協商中，努力調和立場...（請將三方指針都調整至發光的共識區）";
      negFeedback.style.color = "var(--color-warning)";
    }
    btnToStage3.classList.add('hidden');
  }
}

btnToStage3.addEventListener('click', () => {
  switchScreen('stage3');
});

// --- 4. 第三關：二讀會大辯論 (比例原則思辨) ---
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
    
    if (qData.type === "fill") {
      // 渲染填充題輸入框與送出按鈕
      quizOptionsContainer.innerHTML = `
        <div class="quiz-fill-container">
          <input type="text" id="quiz-blank-input" class="quiz-fill-input" placeholder="請在此輸入答案..." autocomplete="off">
          <button id="btn-submit-blank" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: bold; border-radius: 8px;">提交答案</button>
        </div>
      `;
      
      const inputField = document.getElementById('quiz-blank-input');
      const submitBtn = document.getElementById('btn-submit-blank');
  
      function submitAnswer() {
        const userAns = inputField.value.trim();
        if (userAns === "") {
          alert("請先輸入答案再提交唷！");
          return;
        }
        handleQuizAnswer(userAns, submitBtn, true);
      }
  
      submitBtn.addEventListener('click', submitAnswer);
      inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitAnswer();
        }
      });
      inputField.focus();
    } else {
      // 渲染選擇題選項按鈕
      quizOptionsContainer.innerHTML = "";
      qData.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleQuizAnswer(idx, btn, false));
        quizOptionsContainer.appendChild(btn);
      });
    }
  } else {
    quizQNum.textContent = "現場答辯結束";
    quizQuestion.textContent = "辯論完畢！全案進行二讀逐條討論與表決！";
    quizOptionsContainer.innerHTML = "";
    votingTriggerOverlay.classList.remove('hidden');
  }
}

function handleQuizAnswer(userAns, clickedElement, isFill) {
  const qData = QUIZ_QUESTIONS[gameState.quizCurrentQuestion];
  
  if (isFill) {
    const inputField = document.getElementById('quiz-blank-input');
    const submitBtn = clickedElement;
    
    inputField.disabled = true;
    submitBtn.disabled = true;
    submitBtn.style.pointerEvents = 'none';
    
    const cleanAns = userAns.trim().toLowerCase();
    const isCorrect = qData.answers.some(ans => ans.trim().toLowerCase() === cleanAns);
    
    if (isCorrect) {
      playSound('success');
      gameState.quizScore++;
      inputField.classList.add('correct');
      
      quizFeedbackBox.classList.remove('hidden');
      quizFeedbackText.innerHTML = `<strong>答對了！非常優秀！</strong><br>${qData.explanation}`;
      quizFeedbackText.style.color = "var(--color-success)";
      
      // 答對加 8 席 (10題答對=80席，剩餘由民意機率表決)
      convinceLegislators(true, 8);
      adjustSatisfaction({ student: 3, parent: 3, teacher: 3 });
    } else {
      playSound('fail');
      inputField.classList.add('wrong');
      
      quizFeedbackBox.classList.remove('hidden');
      const displayCorrect = qData.answers.join(" 或 ");
      quizFeedbackText.innerHTML = `<strong>答錯了。</strong>正確答案為：<strong>【${displayCorrect}】</strong>。<br>${qData.explanation}`;
      quizFeedbackText.style.color = "var(--color-danger)";
      
      // 答錯加 5 席反對
      convinceLegislators(false, 5);
    }
  } else {
    // 選擇題
    const selectedIdx = userAns;
    const clickedBtn = clickedElement;
    const allBtns = quizOptionsContainer.querySelectorAll('.quiz-opt-btn');
    
    allBtns.forEach(btn => btn.style.pointerEvents = 'none');
    
    if (selectedIdx === qData.answer) {
      playSound('success');
      gameState.quizScore++;
      clickedBtn.classList.add('correct');
      
      quizFeedbackBox.classList.remove('hidden');
      quizFeedbackText.innerHTML = `<strong>答對了！非常優秀！</strong><br>${qData.explanation}`;
      quizFeedbackText.style.color = "var(--color-success)";
      
      convinceLegislators(true, 8);
      adjustSatisfaction({ student: 3, parent: 3, teacher: 3 });
    } else {
      playSound('fail');
      clickedBtn.classList.add('wrong');
      allBtns[qData.answer].classList.add('correct');
      
      quizFeedbackBox.classList.remove('hidden');
      quizFeedbackText.innerHTML = `<strong>答錯了。</strong>正確答案為：<strong>【${qData.options[qData.answer]}】</strong>。<br>${qData.explanation}`;
      quizFeedbackText.style.color = "var(--color-danger)";
      
      convinceLegislators(false, 5);
    }
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
  
  // 素養答題影響機率與利害關係人滿意度均值加權
  const satisfactionAverage = Object.values(gameState.satisfaction).reduce((a,b)=>a+b, 0) / 3;
  let passProbability = 0.2; // 基礎投贊成率
  
  // 答對題數加權
  const correctRatio = gameState.quizScore / QUIZ_QUESTIONS.length;
  if (correctRatio >= 0.8) passProbability += 0.5;       // 答對 8 題以上
  else if (correctRatio >= 0.5) passProbability += 0.3;  // 答對 5 題以上
  else if (correctRatio >= 0.3) passProbability += 0.15; // 答對 3 題以上
  else if (correctRatio < 0.1) passProbability -= 0.1;
  
  // 民意支持度加權
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
    alert(`二讀表決通過！\n贊成：${gameState.yesVotes}票，反對：${gameState.noVotes}票。\n法案成功維持過半數優勢，通過二讀會！`);
    btnToStage4.classList.remove('hidden');
    btnToStage4.scrollIntoView({ behavior: 'smooth' });
  } else {
    playSound('fail');
    alert(`表決被否決！\n贊成：${gameState.yesVotes}票，反對：${gameState.noVotes}票。\n因利益衝突未調和或法理答辯失敗，支持票未達57票門檻。請重新答辯爭取立委支持！`);
    initStage3();
  }
}

btnToStage4.addEventListener('click', () => {
  switchScreen('stage4');
});

// --- 5. 第四關：三讀會 (合憲性審查) ---
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
  proofreadBillTitle.textContent = billInfo.title + " (草案最終審)";
  proofreadBillContent.innerHTML = billInfo.unconstitutional.content;
  
  // 綁定違憲下底線點擊事件
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
  
  // 產生修正條文按鈕
  constitutionModalOptions.innerHTML = "";
  billInfo.unconstitutional.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'modal-opt-btn';
    btn.textContent = opt.text;
    
    btn.addEventListener('click', () => {
      if (opt.isCorrect) {
        playSound('success');
        btn.classList.add('correct');
        
        // 修正條文
        const target = document.getElementById('typo-unconstitutional');
        target.textContent = opt.text;
        target.className = "typo-target fixed";
        
        gameState.constitutionCorrected = true;
        proofreadCorrectedCount.textContent = "已合憲修正";
        proofreadCorrectedCount.style.color = "var(--color-success)";
        proofreadFeedback.textContent = opt.feedback;
        
        // 增加各方滿意度 (保護隱私與人權)
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
        alert(`${opt.feedback} 請重新審查與衡平考量！`);
      }
    });
    
    constitutionModalOptions.appendChild(btn);
  });
  
  constitutionModal.classList.remove('hidden');
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

// --- 6. 第五關：總統公布與行政院覆議挑戰 ---
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
  
  // 生成覆議答辯決策選項
  const billInfo = BILLS[gameState.selectedBill];
  vetoOptionsContainer.innerHTML = "";
  
  billInfo.veto.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'veto-opt-btn';
    btn.textContent = opt.text;
    
    btn.addEventListener('click', () => {
      playSound('click');
      gameState.vetoChoice = opt.route;
      
      // 更新滿意度影響
      adjustSatisfaction(opt.impact);
      
      // 如果選擇的是「撤回/放棄」，直接失敗結束
      if (opt.clicks === 0) {
        vetoAlertContainer.classList.add('hidden');
        playSound('fail');
        vetoFailBox.classList.remove('hidden');
        vetoFailMessage.textContent = "您選擇了『撤回法案』放棄政策防衛。本法規草案就此宣告失效，挑戰失敗！";
        return;
      }
      
      // 設定覆議點擊門檻
      gameState.vetoClicksRequired = opt.clicks;
      
      // 進入點擊小遊戲
      vetoAlertContainer.classList.add('hidden');
      startVetoClickGame();
    });
    
    vetoOptionsContainer.appendChild(btn);
  });
}

function startVetoClickGame() {
  vetoGameContainer.classList.remove('hidden');
  gameState.vetoGameActive = true;
  
  // 設定指令說明
  vetoGameInstruction.innerHTML = `
    <i class="fas fa-mouse-pointer animate-ping"></i> 
    您的防衛策略為：<strong>${gameState.vetoChoice}</strong>。<br>
    需在 8 秒內狂點按鈕累計滿 <strong>${gameState.vetoClicksRequired} 次</strong>（過半數席次）以維持原案！
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
  
  // 換算票數比例： 達到所需點擊數 = 58 票。
  // 票數 = Math.floor((點擊數 / 所需點擊數) * 58) 
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
    vetoFailMessage.textContent = `覆議挑戰失敗！\n贊成維持原案票數僅 ${finalVotes} 票，未達過半數 57 票門檻，法案就此失效。請重擬政策辯護防線！`;
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
  
  // 設定當前民國日期
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  certDateYear.textContent = (year - 1911).toString();
  certDateMonth.textContent = month.toString();
  certDateDay.textContent = day.toString();
  
  // 評估學生素養指標：利益平衡度 (即學生、家長、教師滿意度是否差距很大)
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
    draft: gameState.draftChoice,               // 起草路線
    balance: `${balanceRating} (差值:${Math.max(...Object.values(gameState.satisfaction))-Math.min(...Object.values(gameState.satisfaction))}%)`, // 滿意度差
    score: gameState.quizScore,                 // 比例原則得分
    vetoStrategy: gameState.vetoChoice,         // 覆議答辯路線
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
console.log("立法大師：素養思辨挑戰賽載入完成！");
