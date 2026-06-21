# 立法三讀素養思辨網頁遊戲：開發與維護技能指南 (Skill Guide)

本文件將「立法三讀素養思辨遊戲」的完整開發、除錯、擴充與後端整合步驟打包為一項重複可用的技術技能（Skill），供未來維護或重構類似專案時參考。

---

## 🎯 技能概述 (Skill Overview)
本專案為一個符合 108 課綱公民科「素養導向」設計的互動式網頁遊戲，模擬台灣立法程序（提案、公聽會、二讀會、三讀會、覆議案與總統公布）。此技能涵蓋前端狀態機管理、動態 DOM 渲染、比例原則法理思辨設計、以及無 CORS 阻礙的 Google Sheets 數據同步。

---

## 🏗️ 核心架構與狀態設計 (Game Architecture)

### 1. 遊戲狀態機 (Game State)
遊戲採用單一全域狀態對象 `gameState` 進行控制，主要欄位包含：
```javascript
const gameState = {
  playerName: "",         // 玩家姓名
  playerClass: "",        // 班級
  playerSeat: "",         // 座號
  selectedBill: "",       // 選擇的法案 (homework / lunch / green)
  currentStage: 0,        // 當前關卡索引
  satisfaction: {         // 利害關係人滿意度
    student: 50,
    parent: 50,
    teacher: 50
  },
  quizCurrentQuestion: 0, // 二讀會當前問題索引
  quizScore: 0,           // 答對題數
  yesVotes: 0,            // 贊成票
  noVotes: 0,             // 反對票
  vetoChoice: "",         // 覆議答辯策略
  vetoClicks: 0           // 覆議點擊次數
};
```

### 2. 五大關卡互動設計與擴充技巧

#### 🟢 第一關：一讀提案與連署 (Signature Game)
- **機制**：玩家在時限（預設 20 秒）內，在動態漂浮的氣泡中點擊「立委連署」氣泡以收集 15 人連署。
- **擴充技巧**：若需調整難度，可修改 `sigTimer` 的倒數秒數，或調整 `createFloatingSignature()` 中氣泡生成的隨機速度。

#### 🟡 第二關：公聽會與利益衝突調和 (Public Hearing & Dialogue)
- **機制**：玩家針對學生、家長、教師代表的質疑選擇答辯路線。偏袒特定群體會拉大三方滿意度差距，並使接下來的「朝野協商」拉桿難度變高（共識區域會縮窄至 4%）。
- **協商拉桿公式**：
  ```javascript
  const diff = Math.max(...satisfaction) - Math.min(...satisfaction);
  const successRange = Math.max(4, 25 - Math.floor(diff / 3)); // 滿意度差距越大，發光成功區間越窄
  ```

#### 🔵 第三關：二讀會公民素養答題與表決 (Second Reading Quiz & Vote)
- **機制**：10 題涵蓋法律保留原則、法律位階、比例原則、權力分立的情境選擇題。
- **動態反饋機制**：選項不可寫死正確答案順序。答錯時應動態呈現正確選項文字：
  ```javascript
  quizFeedbackText.innerHTML = `<strong>答錯了。</strong>正確答案為：<strong>【${qData.options[qData.answer]}】</strong>。<br>${qData.explanation}`;
  ```
- **席次比例縮放**：113 席立委中，每題答對加 `8` 席支持，答錯加 `5` 席反對，以確保 10 題答完不會溢出席次，並將剩餘未定席次交由電子表決模擬。
- **模擬通過率公式**：
  ```javascript
  const correctRatio = gameState.quizScore / QUIZ_QUESTIONS.length;
  let passProbability = 0.2; // 基礎機率
  if (correctRatio >= 0.8) passProbability += 0.5; // 高分加權
  else if (correctRatio >= 0.5) passProbability += 0.3;
  ```

#### 🟣 第四關：三讀會合憲性審查 (Third Reading Constitutionality Review)
- **機制**：玩家閱讀法案草案，點擊黃色底線標註的「違憲侵害人權條文」（例如以警察機關直接拘留、沒收財產等違反法官保留原則與比例原則的文字），並在彈窗中選擇「合憲修正案」。

#### 🔴 第五關：總統公布與行政院覆議挑戰 (Executive Yuan Veto Challenge)
- **機制**：行政院退回法案要求覆議，玩家選擇折衷、強硬或棄案答辯，並在 8 秒內狂點按鈕累計票數維持原案。
- **關鍵 Bug 防範**：在初始化第五關時，必須確保 `index.html` 中存在 `#veto-bill-title` 元素來動態注入當前法案標題，否則 JavaScript 會因為 null 綁定拋出 `TypeError` 阻斷後續策略按鈕渲染。
  ```html
  <span id="veto-bill-title" class="highlight-text">《法案名稱》</span>
  ```

---

## 💾 Google Sheets 雲端同步技術 (CORS-Safe Sync)

為了收集學生的學習成果，網頁會以 `POST` 發送 JSON 數據至 Google Apps Script Web App。

### 1. Apps Script 部署程式碼 (`gas-backend.js`)
在 Google 試算表之「擴充功能 > Apps Script」中寫入以下代碼。注意**不可包含額外的 CORS 標頭與 OPTIONS 請求處理**，否則會引發 Google Apps Script 執行引擎報錯：

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 取得 POST 傳入的 JSON 資料
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": "Invalid JSON"}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 依序寫入欄位
  sheet.appendRow([
    new Date(),
    data.name,
    data.className,
    data.seat,
    data.billTitle,
    data.billRoute,
    data.conflictDiff,
    data.score,
    data.vetoChoice,
    data.balanceRating
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
                       .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. 前端安全傳輸設定
Apps Script Web App 限制非 CORS 直接存取，前端 Fetch 必須使用 `mode: 'no-cors'`，這樣雖然無法讀取 HTTP Response 內容，但能確保資料順利送達試算表：
```javascript
fetch(GOOGLE_SHEET_APP_URL, {
  method: "POST",
  mode: "no-cors", // 繞過跨來源阻擋
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
})
```

---

## 🛠️ Windows 環境與代碼維護技巧 (Windows Coding Hacks)

在 Windows 系統下使用自動化指令修改檔案時，常會因為換行符（LF `\n` 與 CRLF `\r\n`）不一致，導致多行文本取代（`replace_file_content`）發生匹配失敗。

### 💡 解決方法：使用 Python 二進位/萬用編碼腳本
撰寫一個短小的 Python 腳本來進行程式碼區塊取代。它能自動處理編碼，並同時嘗試 LF 與 CRLF 匹配：
```python
import os

file_path = "app.js"
with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

target = "待取代之舊程式碼區塊"
replacement = "新程式碼區塊"

if target in content:
    content = content.replace(target, replacement)
else:
    # 嘗試適應 CRLF 換行符
    target_crlf = target.replace("\n", "\r\n")
    replacement_crlf = replacement.replace("\n", "\r\n")
    if target_crlf in content:
        content = content.replace(target_crlf, replacement_crlf)
    else:
        print("Error: Target code block not found!")
        exit(1)

with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
```

---

## 🚀 部署流程 (Deployment Pipeline)

當代碼修改完成後，使用以下標準 Git 指令推送至 GitHub：

```powershell
# 1. 檢查變更狀態
git status

# 2. 暫存檔案
git add index.html app.js

# 3. 提交變更並備註
git commit -m "feat: redesign Stage 3 with 10 competency quiz questions and fix stage 5 null crash"

# 4. 推送至遠端儲存庫
git push origin main
```
推送完成後，GitHub Pages 會在 1-2 分鐘內自動構建並上線。使用者若要驗證變更，需在瀏覽器中按 **`Ctrl + F5`**（或使用無痕視窗）以略過舊有快取。
