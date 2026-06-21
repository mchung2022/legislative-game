# 教師指南：串接 Google 試算表 (Google Sheets) 收集學生學習成果

這是一份給老師的設定說明書。只要按照以下 **4 個步驟**，您就可以在 **10 分鐘內** 架設好免費的雲端後端，學生的姓名、班級、座號、作答得分、通關時間將會自動填寫到您的 Google 試算表中！

---

## 📅 步驟 1：建立 Google 試算表 (Google Sheets)
1. 登入您的 Google 帳號，並開啟 [Google 試算表首頁](https://docs.google.com/spreadsheets/)。
2. 點選 **「建立新試算表」**（空白試算表）。
3. 在左上角將試算表重新命名（例如：`8年級公民立法三讀成果登錄表`）。
4. ⚠️ **注意：請保持試算表內容完全空白**，不需手動輸入任何標題欄，程式會在學生第一次通關時自動生成標題與格式。

---

## 💻 步驟 2：開啟並設定 Google Apps Script
1. 在剛剛建立的試算表視窗上方選單中，點選 **「擴充功能」 (Extensions)** -> **「Apps Script」**。
2. 網頁會開啟一個新的程式碼專案。請將編輯器中預設的 `function myFunction() { ... }` 代碼**全部清空**。
3. 開啟本專案中的 [gas-backend.js](gas-backend.js) 檔案，**複製裡面的全部程式碼**。
4. 將複製的程式碼**貼上**到 Apps Script 編輯器中。
5. 點選編輯器上方的 **「儲存專案」** 按鈕（存檔圖示 💾）。
6. (選用) 將專案名稱重新命名（例如：`立法遊戲後端`）。

---

## 🌐 步驟 3：部署為網頁應用程式 (Deploy as Web App)
為了讓前台網頁能把資料傳送給這個試算表，我們需要將其部署成一個公開的 API：

1. 點選 Apps Script 網頁右上角的 **「部署」 (Deploy)** 按鈕 -> 選擇 **「新增部署」 (New deployment)**。
2. 在彈出的視窗中，點選「選取類型」左邊的 **齒輪圖示** ⚙️，選擇 **「網頁應用程式」 (Web app)**。
3. 填寫部署設定：
   * **說明 (Description)**：`立法遊戲成績收集 API`（可自由填寫）。
   * **委託發行執行身分 (Execute as)**：選擇 **「我」 (Me)**（您的 Google 帳號）。
   * **誰有權限存取 (Who has access)**：**重要！請務必改為「任何人」 (Anyone)**。
     *(注意：這只允許程式將作答結果寫入，學生並不能直接觀看或修改您的試算表，請放心)*
4. 點選底部的 **「部署」 (Deploy)**。
5. **首次部署需要授權**：
   * 彈出授權視窗時，點選 **「核對權限」 (Authorize access)**，並選擇您的 Google 帳號。
   * 畫面若顯示「Google 還未驗證此應用程式」，請點選左下角的 **「進階」 (Advanced)** -> 再點選底部的 **「前往『未命名專案』(不安全)」**。
   * 接著點選 **「允許」 (Allow)** 以完成授權。
6. 部署成功後，會顯示一組「網頁應用程式 URL」網址。**請點選「複製」將該 URL 網址複製下來**。
   *(網址格式類似：`https://script.google.com/macros/s/AKfycb.../exec`)*

---

## 🔗 步驟 4：將 URL 填入遊戲前端代碼
現在您要把前台網頁與剛才產生的後端網址綁定：

1. 用文字編輯器（如 Notepad++、VS Code）打開本遊戲專案目錄下的 [app.js](app.js) 檔案。
2. 找到最上方的 `GOOGLE_SHEET_APP_URL` 變數（約在第 8 行）：
   ```javascript
   // --- 後端配置 ---
   // 教師部署 Google Apps Script 後，請將產生的網頁應用程式 URL 貼在下方雙引號內：
   // 例如："https://script.google.com/macros/s/AKfycb.../exec"
   const GOOGLE_SHEET_APP_URL = ""; 
   ```
3. 將您剛才複製的 **網頁應用程式 URL** 貼上到雙引號中，例如：
   ```javascript
   const GOOGLE_SHEET_APP_URL = "https://script.google.com/macros/s/AKfycbxxxxxxx/exec"; 
   ```
4. **存檔** `app.js`。
5. 使用 Git 將更新後的程式碼 `git commit` 並 `git push` 到您的 GitHub 倉庫，或直接將更新後的 `app.js` 重新拖曳上傳至 GitHub 網頁。
6. 完成！現在只要學生在您的 GitHub Pages 網址玩遊戲通關，您就能即時在 Google 試算表中看到每一位同學的學習成果囉！
