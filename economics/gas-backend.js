/**
 * 國中經濟學供需動畫遊戲 - 後端 Google Apps Script (GAS) 程式碼
 * 
 * 部署說明：
 * 1. 在 Google 雲端硬碟建立一個新的「Google 試算表」。
 * 2. 點選選單的「擴充功能」->「Apps Script」。
 * 3. 將原本編輯器中的內容清空，貼上此段程式碼。
 * 4. 點選上方儲存專案（存檔圖示）。
 * 5. 點選右上角的「部署」 -> 「新增部署」。
 * 6. 類型選擇「網頁應用程式 (Web App)」。
 * 7. 設定「專案負責人」為您的 Google 帳號；「誰有權限存取」必須選擇「任何人 (Anyone)」。
 * 8. 點選「部署」，完成授權設定後，複製產生的「網頁應用程式 URL」。
 * 9. 將該 URL 貼到遊戲前台 app.js 的 GOOGLE_SHEET_APP_URL 變數中。
 */

function doPost(e) {
  // 建立鎖定，防止多個學生同時寫入造成資料衝突
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 鎖定最多等待 10 秒
  
  try {
    // 取得當前的 Google 試算表與工作表
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();
    
    // 解析前端傳來的 JSON 資料
    var data = JSON.parse(e.postData.contents);
    
    // 如果工作表還是空的，先初始化標題列 (Headers)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "班級",
        "座號",
        "學生姓名",
        "經營商品名稱",
        "市場方針路線",
        "供需平衡分數",
        "供需法則得分 (滿分10)",
        "危機應變策略",
        "市場通關狀態",
        "通關提交時間"
      ]);
      
      // 美化標題列：加粗並調整背景色
      var headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f3f4f6");
      headerRange.setHorizontalAlignment("center");
    }
    
    // 寫入學生的作答資料
    sheet.appendRow([
      data.class,
      data.seat,
      data.name,
      data.bill,
      data.draft,
      data.balance,
      data.score,
      data.vetoStrategy,
      data.passed,
      data.timestamp
    ]);
    
    // 回傳成功訊息給前端
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "資料寫入成功！" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // 發生錯誤時回傳錯誤訊息
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } finally {
    // 釋放鎖定，讓下一個排隊的請求可以寫入
    lock.releaseLock();
  }
}
