const p = PropertiesService.getScriptProperties();
const CONFIG = {
  GOPHISH_API_URL: p.getProperty('GOPHISH_API_URL'),
  GOPHISH_API_KEY: p.getProperty('GOPHISH_API_KEY'),
  SMTP_ID: 2,
  SMTP_NAME: 'NTNU',
  GROUP_ID: 51,
  GROUP_NAME: 'NTNU',
  PHISHING_URL: p.getProperty('PHISHING_URL'),

  OPENAI_API_KEY: p.getProperty('OPENAI_API_KEY'),
  GPT_MODEL: 'gpt-4o-mini',
  ADMIN_EMAIL: 'YOUR_ADMIN_EMAIL@example.com',
  WEB_APP_URL: p.getProperty('WEB_APP_URL'), // 部署後更新這個
};

const BIGQUERY_CONFIG = {
  PROJECT_ID: 'ntnu-phishing-training',
  DATASET_ID: 'phishing_training',
  EVENTS_TABLE: 'user_events',
  PRE_SURVEY_TABLE: 'pre_survey',
  POST_SURVEY_TABLE: 'post_survey'
};

const VARIANT_COUNTER_KEY = 'VARIANT_COUNTER';

const VARIANT_PROMPTS = {

  A: {
    name: 'UI-A: original_baseline',
    literature: 'Dhamija et al. (2006), Canfield et al. (2016)',
    ui_manipulation: {
      type: 'original_baseline',
      description: '外觀與官方 Moodle 登入頁面一致，作為實驗中的原始基準模板',
      css_requirements: [
        '正確 Logo 比例與解析度，無任何濾鏡',
        '官方藍色登入按鈕 (#0066cc)，維持原始配色',
        '無破圖、無異常元素',
        '專業一致排版，元件間距正常',
        '無動畫、無警告元素'
      ]
    },
    email_manipulation: {
      type: 'neutral_administrative',
      tone: '冷靜、官方、標準格式',
      features: [
        '無時間壓力',
        '無威脅字眼',
        '標準行政用語',
        '完整資訊呈現',
        '學習以下內容(你好，你已經啟動了校務行政資訊入口網重設密碼機制。請點選下列網址進行重設密碼動作。),你好前面要放系統帶入暱稱',
        '信封主旨使用 國立臺灣師範大學 校務行政資訊入口網 重設密碼啟動通知信'
      ],
      avoid: ['緊急', '立即', '馬上', '否則', '刪除', '停權']
    },
    typos: 0
  },

  B: {
    name: 'UI-B: color_shift',
    literature: 'Canfield et al. (2016), Steves et al. (2020)',
    ui_manipulation: {
      type: 'color_shift',
      description: '調整按鈕、背景與局部元件色彩，使頁面配色與原始網站不一致',
      css_requirements: [
        '登入按鈕改為灰色 (#888888)，與官方藍色 (#0066cc) 明顯不同',
        '登入面板背景改為淡灰色 (#f0f0f0)',
        '輸入框邊框顏色改為橘色 (#e8a000)，與整體配色不協調',
        'Logo 套用色相偏移濾鏡 hue-rotate(40deg)，顏色偏離原始品牌色',
        '其餘版面結構保持不變，配色不一致為唯一操弄變因'
      ]
    },
    email_manipulation: {
      type: 'neutral_administrative',
      tone: '冷靜、官方、標準格式',
      features: [
        '無時間壓力',
        '無威脅字眼',
        '標準行政用語',
        '完整資訊呈現',
        '學習以下內容(你好，你已經啟動了校務行政資訊入口網重設密碼機制。請點選下列網址進行重設密碼動作。),你好前面要放系統帶入暱稱',
        '信封主旨使用 國立臺灣師範大學 校務行政資訊入口網 重設密碼啟動通知信'
      ],
      avoid: ['緊急', '立即', '馬上', '否則', '刪除', '停權']
    },
    typos: 0
  },

  C: {
    name: 'UI-C: logo_missing',
    literature: 'Dhamija et al. (2006), Downs et al. (2006)',
    ui_manipulation: {
      type: 'logo_missing',
      description: '移除或隱藏頁面中的 Logo，使頁面缺少主要品牌識別線索',
      css_requirements: [
        '使用 display:none 完全隱藏 Logo 圖片（.row.logo img）',
        '使用 display:none 隱藏 Logo 容器（.row.logo）',
        '其餘版面元素（登入按鈕、輸入框、說明文字）維持官方原始樣式',
        '登入按鈕維持官方藍色 (#0066cc)',
        'Logo 缺失為唯一操弄變因，其餘元素不做任何修改'
      ]
    },
    email_manipulation: {
      type: 'neutral_administrative',
      tone: '冷靜、官方、標準格式',
      features: [
        '無時間壓力',
        '無威脅字眼',
        '標準行政用語',
        '完整資訊呈現',
        '學習以下內容(你好，你已經啟動了校務行政資訊入口網重設密碼機制。請點選下列網址進行重設密碼動作。),你好前面要放系統帶入暱稱',
        '信封主旨使用 國立臺灣師範大學 校務行政資訊入口網 重設密碼啟動通知信'
      ],
      avoid: ['緊急', '立即', '馬上', '否則', '刪除', '停權']
    },
    typos: 0
  },

  D: {
    name: 'UI-D: icon_missing',
    literature: 'Dhamija et al. (2006), Egelman et al. (2008)',
    ui_manipulation: {
      type: 'icon_missing',
      description: '移除或隱藏登入表單附近之 icon，使頁面呈現局部圖標缺失',
      css_requirements: [
        '隱藏登入欄位左側的 input-group-addon 圖示區塊（.input-group-addon { display: none !important; }），模擬資源載入失敗',
        '隱藏左側說明區塊的所有 FontAwesome 圖示（.col-md-7.instructions i { display: none !important; }）',
        '其餘版面元素維持官方原始樣式',
        '登入按鈕維持官方藍色 (#0066cc)',
        'icon 缺失為唯一操弄變因，不做其他視覺修改'
      ]
    },
    email_manipulation: {
      type: 'neutral_administrative',
      tone: '冷靜、官方、標準格式',
      features: [
        '無時間壓力',
        '無威脅字眼',
        '標準行政用語',
        '完整資訊呈現',
        '學習以下內容(你好，你已經啟動了校務行政資訊入口網重設密碼機制。請點選下列網址進行重設密碼動作。),你好前面要放系統帶入暱稱',
        '信封主旨使用 國立臺灣師範大學 校務行政資訊入口網 重設密碼啟動通知信'
      ],
      avoid: ['緊急', '立即', '馬上', '否則', '刪除', '停權']
    },
    typos: 0
  },

  E: {
    name: 'UI-E: low_fidelity',
    literature: 'Vishwanath (2015), Canfield et al. (2016)',
    ui_manipulation: {
      type: 'low_fidelity',
      description: '呈現較低擬真程度，包含色彩不一致、版面不協調、元件間距異常或 Logo 比例不同等多重視覺線索',
      css_requirements: [
        'Logo 放大至異常比例 scale(1.3) 並套用色相偏移 hue-rotate(30deg)，比例與配色同時不正常',
        '登入按鈕改為與品牌無關的顏色 (#e8832a)，與整體配色不協調',
        '登入面板整體歪斜 rotate(-1deg)，版面不協調',
        '輸入框之間間距異常（margin-bottom: 20px 改為 30px），元件排列鬆散',
        '左側說明區塊背景色與右側表單背景色不一致（左側 #f5f0ff，右側 #fff8f0）',
        '多重視覺異常同時出現，整體擬真度明顯下降'
      ]
    },
    email_manipulation: {
      type: 'neutral_administrative',
      tone: '冷靜、官方、標準格式',
      features: [
        '無時間壓力',
        '無威脅字眼',
        '標準行政用語',
        '完整資訊呈現',
        '學習以下內容(你好，你已經啟動了校務行政資訊入口網重設密碼機制。請點選下列網址進行重設密碼動作。),你好前面要放系統帶入暱稱',
        '信封主旨使用 國立臺灣師範大學 校務行政資訊入口網 重設密碼啟動通知信'
      ],
      avoid: ['緊急', '立即', '馬上', '否則', '刪除', '停權']
    },
    typos: 0
  }

};
const EMAIL_TONE_LIBRARY = {
  NEUTRAL: {
    name: 'Email-1: 中性行政通知',
    prompt_modifier: '使用標準IT部門公告格式，語氣專業冷靜，無時間壓力',
    avoid_words: ['緊急', '立即', '馬上', '警告']
  },

  URGENCY: {
    name: 'Email-2: 緊急威脅型',
    prompt_modifier: '強調「帳號即將停權」，明確deadline，製造時間壓力',
    key_phrases: ['24小時內', '否則將', '立即處理', '已偵測異常']
  },

  AUTHORITY: {
    name: 'Email-3: 權威型',
    prompt_modifier: '來自「系統管理員」或「資安部門」，引用內規，使用正式頭銜',
    key_phrases: ['根據校規', '系統管理員通知', '安全政策要求']
  },

  SUPPORT: {
    name: 'Email-4: 協助型',
    prompt_modifier: '「我們偵測到異常，協助您確認」，低威脅高親和，客服語氣',
    key_phrases: ['為了保護您', '協助您', '我們注意到', '請確認是否為您本人']
  },

  PERSONALIZED: {
    name: 'Email-5: 個人化學習平台',
    prompt_modifier: '提及Moodle、課程、作業，高度情境化，貼近學生使用場景',
    key_phrases: ['您的課程', 'Moodle作業', '教材更新', '成績查詢']
  }
};
// Assign one of the five variants (A-E) with balanced distribution
function getBalancedVariant() {
  const props = PropertiesService.getScriptProperties();
  let counter = JSON.parse(props.getProperty(VARIANT_COUNTER_KEY) || '{"A":0,"B":0,"C":0,"D":0,"E":0}');

  const minCount = Math.min(...Object.values(counter));
  const leastUsed = Object.keys(counter).filter(v => counter[v] === minCount);

  const selected = leastUsed[Math.floor(Math.random() * leastUsed.length)];

  counter[selected]++;
  props.setProperty(VARIANT_COUNTER_KEY, JSON.stringify(counter));

  Logger.log(` 變體使用統計: ${JSON.stringify(counter)}`);
  Logger.log(` 選擇變體: ${selected}`);
  return selected;
}

// Frontend script that records input/click/dwell events and posts them back
function getTrackingScript() {
  const webAppUrl = CONFIG.WEB_APP_URL;

  return `
<script>
(function() {
  console.log(' 追蹤腳本已載入');

  const params = new URLSearchParams(window.location.search);
  const campaignId = params.get('c') || 'unknown';
  const variant = params.get('v') || 'A';

  const rid = params.get('survey_rid') || params.get('rid') || null;

  console.log(' 追蹤參數:', {
    campaignId,
    variant,
    rid,
    source: params.get('survey_rid') ? 'survey_rid (正確)' : (params.get('rid') ? 'rid (GoPhish生成)' : 'missing')
  });

  if (!rid) {
    console.error(' Missing RID parameter - tracking data will NOT be sent');
    console.error(' URL should contain: ?c=...&v=...&survey_rid=...');
    return;
  }

  const isValidRid = rid.length > 20 && rid.includes('-');
  if (!isValidRid) {
    console.warn(' RID 格式可能不正確:', rid);
    console.warn(' 預期格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    console.warn(' 實際長度:', rid.length);
  }

  const startTime = Date.now();
  let mouseMoveCount = 0;
  let lastMove = 0;

  document.addEventListener('mousemove', () => {
    const now = Date.now();
    if (now - lastMove > 150) {
      mouseMoveCount++;
      lastMove = now;
    }
  });

  function sendEvents(actionType) {
    if (!rid) {
      console.warn(' RID missing, skip sending', actionType);
      return;
    }

    const payload = {
      rid: rid,
      campaign_id: campaignId,
      variant: variant,
      event_type: actionType,
      behavior_metrics: {
        dwell_time_seconds: (Date.now() - startTime) / 1000,
        mouse_activity_score: mouseMoveCount
      },
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };

    console.log(' [' + actionType + '] 準備發送:', payload);

    if (navigator.sendBeacon && (actionType === 'LEAVE' || actionType === 'SUBMIT')) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json'
      });
      const success = navigator.sendBeacon('${webAppUrl}', blob);
      console.log(' sendBeacon 結果:', success);
      return;
    }

    fetch('${webAppUrl}', {
      method: 'POST',
      body: JSON.stringify(payload),
      mode: 'no-cors',
      keepalive: true
    })
    .then(() => {
      console.log(' [' + actionType + '] 資料已發送');
    })
    .catch(err => {
      console.error(' [' + actionType + '] 發送失敗:', err);

      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json'
      });
      navigator.sendBeacon('${webAppUrl}', blob);
      console.log(' 已使用 sendBeacon 重試');
    });
  }

  setTimeout(() => sendEvents('PAGE_VIEW'), 500);

  const form = document.querySelector('form');
  if (form) {
    console.log(' 已綁定表單提交事件');
    form.addEventListener('submit', (e) => {
      console.log(' 表單提交觸發');
      sendEvents('SUBMIT');
    });
  }

  window.addEventListener('beforeunload', () => {
    console.log(' 使用者離開');
    sendEvents('LEAVE');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log(' 頁面隱藏');
      sendEvents('HIDDEN');
    }
  });

  console.log(' 追蹤腳本初始化完成');
})();
</script>`;
}

// Duplicate definition (last one wins)
function doPost(e) {
  try {
    var rawContent = e.postData.contents;
    if (!rawContent) {
      Logger.log(" 接收到空數據");
      return responseJson({ status: "error", message: "No content" });
    }

    var data = JSON.parse(rawContent);
    Logger.log(' 成功接收數據，RID: ' + (data.rid || "N/A"));

    var result = writeEventsToBigQuery(data);

    return responseJson({
      status: result.success ? "success" : "error",
      error: result.error || null
    });

  } catch (error) {
    Logger.log(' doPost 執行出錯: ' + error.toString());
    return responseJson({ status: "error", message: error.toString() });
  }
}

// Return a JSON HTTP response
function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Duplicate definition, can be removed
function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Write pre-survey data to the BigQuery pre_survey table
function writePreSurveyToBigQuery(email, formData, timestamp) {
  const maxRetries = 3;
  const retryDelayMs = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.log(` BigQuery 寫入嘗試 ${attempt}/${maxRetries}...`);

      const row = {
        rid: formData.rid,
        email: email, // 直接用第一個參數
        timestamp: (timestamp instanceof Date ? timestamp.toISOString() : timestamp) || new Date().toISOString(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
        moodle_usage: formData.moodleUsage,
        security_training: formData.securityTraining,
        urgency_susceptibility: parseInt(formData.urgencySusceptibility) || null,
        check_sender: parseInt(formData.checkSender) || null,
        check_url: parseInt(formData.checkUrl) || null,
        self_confidence: parseInt(formData.selfConfidence) || null,
        suspicious_handling: formData.suspiciousHandling,
        comments: formData.comments || null,
        variant_assigned: formData.variant
      };

      const request = {
        rows: [{
          insertId: `${email}_pre_${new Date().getTime()}`,
          json: row
        }]
      };

      const result = BigQuery.Tabledata.insertAll(
        request,
        BIGQUERY_CONFIG.PROJECT_ID,
        BIGQUERY_CONFIG.DATASET_ID,
        BIGQUERY_CONFIG.PRE_SURVEY_TABLE
      );

      if (result.insertErrors && result.insertErrors.length > 0) {
        Logger.log(' BigQuery insertErrors: ' + JSON.stringify(result.insertErrors));
        return { success: false, error: JSON.stringify(result.insertErrors) };
      }

      Logger.log(' Pre-survey 寫入 BigQuery 成功');
      return { success: true };

    } catch (error) {
      const errMsg = error.toString();
      Logger.log(` 第 ${attempt} 次寫入失敗: ${errMsg}`);

      if (errMsg.includes('Empty response') && attempt < maxRetries) {
        Logger.log(` 等待 ${retryDelayMs * attempt}ms 後重試...`);
        Utilities.sleep(retryDelayMs * attempt);
        continue;
      }

      Logger.log(' BigQuery 寫入最終失敗: ' + errMsg);
      return { success: false, error: errMsg };
    }
  }

  return { success: false, error: '已達最大重試次數' };
}

// Web App POST endpoint: receive tracking events and survey data
function doPost(e) {
  try {
    Logger.log('=== 收到 POST 請求 ===');

    if (e && e.postData) {
      Logger.log('Content Type: ' + e.postData.type);
      Logger.log('Raw Content: ' + e.postData.contents);
    }

    var rawContent = e.postData.contents;
    if (!rawContent) {
      Logger.log(" 接收到空數據");
      return responseJson({ status: "error", message: "No content" });
    }

    var data = JSON.parse(rawContent);
    Logger.log(' 成功解析 JSON');
    Logger.log('收到的資料: ' + JSON.stringify(data));

    var result = writeEventsToBigQuery(data);

    Logger.log('寫入結果: ' + JSON.stringify(result));

    return responseJson({
      status: result.success ? "success" : "error",
      error: result.error || null
    });

  } catch (error) {
    Logger.log(' doPost 執行出錯: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return responseJson({ status: "error", message: error.toString() });
  }
}

// Duplicate definition, can be removed
function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Write tracked user behavior events to the BigQuery user_events table
function writeEventsToBigQuery(data) {
  try {
    Logger.log(' 開始寫入 BigQuery...');
    Logger.log('收到的資料: ' + JSON.stringify(data));

    const timestamp = new Date().toISOString();

    let eventDataStr = '';
    if (data.behavior_metrics) {
      eventDataStr = JSON.stringify(data.behavior_metrics);
    } else if (data.event_data) {
      eventDataStr = typeof data.event_data === 'string'
        ? data.event_data
        : JSON.stringify(data.event_data);
    }

    let email = data.email || null;

    if (!email && data.rid && data.rid !== 'unknown' && data.rid.length > 10) {
      Logger.log(' 嘗試從 pre_survey 查詢 email...');
      Logger.log(' 使用 RID: ' + data.rid);

      try {
        const query = `
          SELECT email
          FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.PRE_SURVEY_TABLE}\`
          WHERE rid = @rid
          LIMIT 1
        `;

        const request = {
          query: query,
          useLegacySql: false,
          parameterMode: 'named',
          queryParameters: [{
            name: 'rid',
            parameterType: { type: 'STRING' },
            parameterValue: { value: data.rid }
          }]
        };

        const queryResult = BigQuery.Jobs.query(request, BIGQUERY_CONFIG.PROJECT_ID);

        if (queryResult.rows && queryResult.rows.length > 0) {
          email = queryResult.rows[0].f[0].v;
          Logger.log(' 找到對應 email: ' + email);
        } else {
          Logger.log(' 找不到對應的 pre_survey 記錄');
          Logger.log(' 這可能是因為：');
          Logger.log(' 1. 使用者還沒填寫問卷');
          Logger.log(' 2. RID 不匹配');
          Logger.log(' 3. pre_survey 寫入失敗');
        }
      } catch (lookupError) {
        Logger.log(' Email 查詢失敗: ' + lookupError.toString());
        Logger.log('Stack: ' + lookupError.stack);
      }
    }

    const row = {
      rid: data.rid || 'unknown',
      email: email,
      campaign_id: data.campaign_id || null,
      variant: data.variant || null,
      timestamp: timestamp,
      event_type: data.event_type || 'TRACKING',
      event_data: eventDataStr,
      page_url: data.page_url || null,
      user_agent: data.user_agent || null
    };

    Logger.log(' 準備寫入的資料:');
    Logger.log(JSON.stringify(row, null, 2));

    const request = {
      rows: [{
        insertId: `${data.rid || 'unknown'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        json: row
      }]
    };

    Logger.log(' 發送到 BigQuery...');

    const response = BigQuery.Tabledata.insertAll(
      request,
      BIGQUERY_CONFIG.PROJECT_ID,
      BIGQUERY_CONFIG.DATASET_ID,
      BIGQUERY_CONFIG.EVENTS_TABLE
    );

    Logger.log(' BigQuery 回應: ' + JSON.stringify(response));

    if (response.insertErrors && response.insertErrors.length > 0) {
      const errors = response.insertErrors[0].errors;
      Logger.log(' BigQuery 寫入錯誤:');
      errors.forEach(err => {
        Logger.log(` - ${err.reason}: ${err.message}`);
        Logger.log(` Location: ${err.location}`);
      });
      return {
        success: false,
        error: errors.map(e => `${e.location}: ${e.message}`).join('; ')
      };
    }

    Logger.log(' 事件資料已成功寫入 BigQuery');
    return { success: true };

  } catch (error) {
    Logger.log(' BigQuery 寫入異常: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

// Main per-recipient flow: build page, apply variant CSS and tracking, send campaign
function runPhishingWithGPT(email, first, last, variant, rid) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd_HHmmss');
  const name = `${first} ${last}`;
  const v = VARIANT_PROMPTS[variant];

  Logger.log(`\n=== 開始生成 (修正版): ${v.name} ===`);
  Logger.log(`文獻依據: ${v.literature}`);
  Logger.log(`RID: ${rid}`);

  Logger.log('\n 步驟 1: 更新群組');
  if (!updateGroup(email, first, last)) {
    return { success: false, error: 'Group update failed' };
  }
  Logger.log(' 群組更新成功');

  Logger.log('\n 步驟 2: 生成 Email');
  const emailPrompt = buildResearchEmailPrompt(name, variant);
  const emailResult = callGPT(emailPrompt, 500);

  if (!emailResult.success) {
    return { success: false, error: 'Email generation failed: ' + emailResult.error };
  }

  let emailData;
  try {
    emailData = parseEmailResponse(emailResult.text, name);
    Logger.log(' Email 解析成功');
    Logger.log(` 主旨: ${emailData.subject}`);
  } catch (e) {
    Logger.log(' Email 解析失敗: ' + e.toString());
    return { success: false, error: 'Email parse failed: ' + e.toString() };
  }

Logger.log('\n 步驟 3: 取得 Base HTML');
const baseHtml = getFullBaseHtml();
Logger.log(` Base HTML: ${baseHtml.length} 字元`);

Logger.log('\n 步驟 4: 生成 CSS (使用簡化 DOM)');
let css;

if (variant === 'TEST') {
  css = '/* TEST: no manipulation */';
  Logger.log(' ℹ TEST 變體跳過 CSS 生成');
} else {
  const simplifiedDom = getSimplifiedDom();

  if (!simplifiedDom) {
    Logger.log(' 找不到簡化 DOM,使用 Fallback CSS');
    css = getResearchBasedCssClean(variant);
  } else {
    Logger.log(' 載入簡化 DOM');
    Logger.log(` 節點數: ${countDomNodes(simplifiedDom)}`);

    const prompt = buildCssPromptWithSimplifiedDom(simplifiedDom, variant);
    Logger.log(` Prompt 長度: ${prompt.length} 字元`);

    const res = callGPT(prompt, 1500);
    css = res.success ? parseGPTCssResponse(res.text, variant) : null;

    if (!css || css.trim().length < 30) {
      Logger.log(' GPT CSS 無效,使用 Fallback CSS');
      css = getResearchBasedCssClean(variant);
    } else {
      Logger.log(` CSS 生成成功 (${css.length} 字元)`);
    }
  }
}

Logger.log(` CSS 長度: ${css.length} 字元`);

Logger.log(` CSS 長度: ${css.length} 字元`);

 Logger.log('\n 步驟 5: 取得追蹤腳本');
const trackingScript = getTrackingScript();
const transparentScript = getTransparentFixScript(); // 加這行
const combinedScript = trackingScript + '\n' + transparentScript;
Logger.log(` Tracking: ${trackingScript.length} 字元`);
Logger.log(` TransparentFix: ${transparentScript.length} 字元`);

  Logger.log('\n 步驟 6: 組合 HTML（使用修正版）');
  const finalHtml = applyCssAndTracking(baseHtml, css, combinedScript);
  Logger.log(` Final HTML: ${finalHtml.length} 字元`);

  Logger.log('\n 步驟 7: 最終驗證');
const verification = {
  htmlLength : finalHtml.length,
  hasRealAssets : finalHtml.includes('moodle3.ntnu.edu.tw'),
  hasLoginForm : finalHtml.includes('id="login"'),
  hasStyle : finalHtml.includes('<style>'),
  hasStyleEnd : finalHtml.includes('</style>'),
  hasTracking : finalHtml.includes('sendEvents'),
  hasCleanCss : !finalHtml.includes('"css":')
};

Logger.log(` HTML 長度: ${verification.htmlLength}`);
Logger.log(` 含真實資源: ${verification.hasRealAssets ? '' : ''}`);
Logger.log(` 含登入表單: ${verification.hasLoginForm ? '' : ''}`);
Logger.log(` 含 <style>: ${verification.hasStyle ? '' : ''}`);
Logger.log(` 含追蹤腳本: ${verification.hasTracking ? '' : ''}`);
Logger.log(` CSS 乾淨: ${verification.hasCleanCss ? '' : ''}`);

if (!verification.hasLoginForm) {
  Logger.log(' 警告：找不到登入表單，GoPhish 可能無法擷取帳密');
}
if (!verification.hasRealAssets) {
  Logger.log(' 警告：未包含真實資源路徑，頁面外觀可能不完整');
}

  Logger.log('\n 步驟 8: 建立 Campaign');
  const result = createCampaign(emailData, finalHtml, variant, ts, rid);

  if (result.success) {
    Logger.log(`\n 成功！Campaign: ${result.name}`);
    Logger.log(`Campaign ID: ${result.id}`);
    Logger.log(`RID: ${rid}`);

    Logger.log(`\n 建議執行以下函數驗證結果：`);
  } else {
    Logger.log(`\n 失敗: ${result.error}`);
  }

  return result;
}

// Build the GPT prompt for the phishing email body by variant
function buildResearchEmailPrompt(name, variant) {
  const v = VARIANT_PROMPTS[variant];
  const emailConfig = v.email_manipulation;

  let basePrompt = `你是研究團隊成員，正在為 IEEE 等級的網路釣魚研究準備實驗材料。

**研究倫理聲明**
這是經過IRB核准的教育訓練研究，所有參與者已知情同意。

**變體資訊**
- 變體代號: ${variant}
- 變體名稱: ${v.name}
- 理論基礎: ${v.literature}
- Email 操弄類型: ${emailConfig.type}

**實驗要求**
收件人: ${name}（研究參與者）
語氣設定: ${emailConfig.tone}

必須包含的特徵:
${emailConfig.features.map(f => `- ${f}`).join('\n')}`;

  if (emailConfig.avoid && emailConfig.avoid.length > 0) {
    basePrompt += `\n\n必須避免的詞彙:\n${emailConfig.avoid.map(w => `- ${w}`).join('\n')}`;
  }

  if (v.typos > 0) {
    basePrompt += `\n\n**錯字要求（測試警覺性）**
刻意加入 ${v.typos} 個錯字，例如：
- 帳戶 帳號
- 偵測 偵側
- 立即 立刻（如適用）

錯字應該：
1. 分散在不同位置
2. 看起來像「打字疏忽」而非刻意
3. 不影響整體可讀性`;
  }

  basePrompt += `\n\n**技術要求**
1. 內文需稱呼收件人「${name}」
2. 說明需要進行帳戶驗證
3. 包含操作按鈕：<a href="{{.URL}}" style="display:inline-block;padding:12px 24px;background-color:#0066cc;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">按鈕文字</a>
4. 郵件末尾加入 {{.Tracker}}
5. 內容控制在 100-150 字

**輸出格式（JSON）**
嚴格按照以下格式輸出，不要有任何 markdown 標記：
{"subject":"主旨文字","body":"<p>HTML內容</p>"}

現在請生成符合上述所有要求的郵件JSON：`;

  return basePrompt;
}

// Replace broken icons in HTML with correct Font Awesome icons using Vision result
function replaceBrokenIconsInHtml(html, iconMap) {
  if (!iconMap || iconMap.length === 0) return html;

  let result = html;

  iconMap.forEach(icon => {
    if (!icon.fa_class) return;

    const hints = (icon.url_hint || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);

    hints.forEach(hint => {
      const pattern = new RegExp(
        `(class="[^"]*?)((?:slicon|glyphicon|icon|fa)-${hint}[^"\\s]*)`,
        'gi'
      );

      result = result.replace(pattern, (match, prefix, iconClass) => {
        return prefix + iconClass + ' fa ' + icon.fa_class;
      });
    });
  });

  return result;
}

// Extract basic structural info from HTML
function extractHtmlStructure(html) {
  const styleBlocks = [];
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (styleMatches) {
    styleBlocks.push(...styleMatches.map(s => s.substring(0, 800)));
  }

  const classMatches = html.match(/class="([^"]+)"/g) || [];
  const idMatches = html.match(/id="([^"]+)"/g) || [];

  const classes = [...new Set(
    classMatches.flatMap(m => m.replace('class="', '').replace('"', '').split(' '))
  )].filter(c => c.length > 0);

  const ids = [...new Set(
    idMatches.map(m => m.replace('id="', '').replace('"', ''))
  )].filter(i => i.length > 0);

  const bodyIdMatch = html.match(/<body[^>]*id="([^"]+)"/);
  const bodyId = bodyIdMatch ? bodyIdMatch[1] : null;

  const bodyStart = html.indexOf('<body');
  const structureSnippet = bodyStart !== -1
    ? html.substring(bodyStart, bodyStart + 2000)
    : html.substring(0, 2000);

  return {
    bodyId,
    classes: classes.slice(0, 50), // 最多50個避免token爆炸
    ids: ids.slice(0, 30),
    existingStyles: styleBlocks.slice(0, 2).join('\n\n--- next style block ---\n\n'),
    structureSnippet
  };
}

// Parse the CSS string returned by GPT and pass it to the cleaner
function parseGPTCssResponse(text, variant) {
  Logger.log('\n 開始解析 CSS...');

  try {
    Logger.log(' 嘗試策略 1: 標準 JSON 解析');

    let cleaned = text.trim();

    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    Logger.log(` 清理後的文字（前 100 字元）: ${cleaned.substring(0, 100)}...`);

    const data = JSON.parse(cleaned);

    if (data.css && typeof data.css === 'string') {
      Logger.log(' 策略 1 成功！');
      return cleanCssForGoPhish(data.css);
    } else {
      Logger.log(' JSON 解析成功但沒有 css 欄位');
    }
  } catch (e) {
    Logger.log(` 策略 1 失敗: ${e.message}`);
  }

  try {
    Logger.log(' 嘗試策略 2: 正則表達式提取');

    const cssMatch = text.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*)"/s);

    if (cssMatch && cssMatch[1]) {
      Logger.log(' 策略 2 成功！');

      let css = cssMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');

      return cleanCss(css);
    } else {
      Logger.log(' 策略 2 失敗: 未找到匹配');
    }
  } catch (e) {
    Logger.log(` 策略 2 失敗: ${e.message}`);
  }

  try {
    Logger.log(' 嘗試策略 3: CSS 代碼塊識別');

    const cssPattern = /([#.\w\-\s:(),>+~*\[\]="']+\s*\{[^}]+\})/gs;
    const matches = text.match(cssPattern);

    if (matches && matches.length > 0) {
      Logger.log(` 找到 ${matches.length} 個 CSS 規則`);
      Logger.log(' 策略 3 成功！');

      const css = matches.join('\n');
      return cleanCss(css);
    } else {
      Logger.log(' 策略 3 失敗: 未找到 CSS 模式');
    }
  } catch (e) {
    Logger.log(` 策略 3 失敗: ${e.message}`);
  }

  try {
    Logger.log(' 嘗試策略 4: 寬鬆 JSON 解析');

    let relaxed = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/'/g, '"')
      .trim();

    const jsonStart = relaxed.indexOf('{');
    const jsonEnd = relaxed.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1) {
      relaxed = relaxed.substring(jsonStart, jsonEnd + 1);

      const data = JSON.parse(relaxed);

      if (data.css && typeof data.css === 'string') {
        Logger.log(' 策略 4 成功！');
        return cleanCssForGoPhish(data.css);
      }
    }
  } catch (e) {
    Logger.log(` 策略 4 失敗: ${e.message}`);
  }

  Logger.log(' 所有解析策略都失敗');
  return null;
}

// Clean generated CSS: strip comments, unescape, fix URL protocol, normalize spacing
function cleanCssForGoPhish(css) {
  if (!css) return '';

  Logger.log(' 開始清理 CSS...');
  Logger.log('原始長度: ' + css.length);

  let cleaned = css;

  cleaned = cleaned.replace(/^\s*["{]*\s*css["']?\s*:\s*['"]/i, '');
  cleaned = cleaned.replace(/['"]\s*["}]*\s*$/, '');

  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');

  cleaned = cleaned.replace(/(https?):\s+\/\//gi, '$1://');

  cleaned = cleaned
    .replace(/\/\*[^*]*[\u4e00-\u9fff][^*]*\*\//g, '')
    .replace(/\/\/.*[\u4e00-\u9fff].*/g, '')
    .replace(/\n\s*\n/g, '\n');

  cleaned = cleaned
    .replace(/\bkeyframes\s+/g, '@keyframes ')
    .replace(/\b(import|media|font-face|supports)\s+/g, '@$1 ')
    .replace(/['"]\s*:\s*['"]/g, ': ')
    .replace(/['"]\s*}/g, ' }')
    .replace(/{\s*['"]/g, '{ ');

  var urlPlaceholders = [];
  cleaned = cleaned.replace(/url\(([^)]*)\)/gi, function(match) {
    urlPlaceholders.push(match);
    return '__URL_PLACEHOLDER_' + (urlPlaceholders.length - 1) + '__';
  });

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*/g, ' { ')
    .replace(/\s*}\s*/g, ' }\n')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*:\s*/g, ': ')
    .trim();

  cleaned = cleaned.replace(/__URL_PLACEHOLDER_(\d+)__/g, function(m, idx) {
    var original = urlPlaceholders[parseInt(idx, 10)] || '';
    return original.replace(/(https?):\s*\/\//gi, '$1://');
  });

  const hasSelectors = cleaned.includes('{') && cleaned.includes('}');
  const hasProperties = cleaned.includes(':');
  const hasChineseChars = /[\u4e00-\u9fff]/.test(cleaned);

  if (!hasSelectors || !hasProperties) {
    Logger.log(' CSS 結構異常');
  }

  if (hasChineseChars) {
    Logger.log(' 警告：CSS 中仍包含中文字符，可能導致編碼問題');
    Logger.log(' 建議移除所有中文註解');
  }

  Logger.log('清理後長度: ' + cleaned.length);
  Logger.log('包含 @keyframes: ' + cleaned.includes('@keyframes'));
  Logger.log('包含紅色: ' + (cleaned.includes('#e53e3e') || cleaned.includes('red')));
  Logger.log('包含中文: ' + (hasChineseChars ? '是（可能有問題）' : '否'));

  return cleaned;
}

// Parse the GPT email response into subject and body
function parseEmailResponse(text, recipientName) {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/);
    const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]+?)(?:"\s*}|$)/);

    if (subjectMatch && bodyMatch) {
      data = {
        subject: subjectMatch[1],
        body: bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
      };
    } else {
      throw new Error('Cannot extract email data');
    }
  }

  data.body = data.body.replace(/\\n/g, '\n').replace(/\\"/g, '"');

  if (!data.body.includes('{{.URL}}')) {
    data.body += '<p style="text-align:center;margin:20px 0;"><a href="{{.URL}}" style="display:inline-block;padding:12px 24px;background-color:#0066cc;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">立即驗證</a></p>';
  }

  if (!data.body.includes('{{.Tracker}}')) {
    data.body += '{{.Tracker}}';
  }

  return data;
}

// Create and send a GoPhish campaign with the landing page HTML
function createCampaign(emailData, finalHtml, variant, ts, rid) {

  function compressHtml(html) {
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/ +/g, ' ')
      .trim();
  }

  const tplName = `Training_Tpl_${variant}_${ts}`;
  const tpl = apiPost('templates/', {
    name: tplName,
    subject: emailData.subject,
    html: emailData.body,
    text: '',
    envelope_sender: 'noreply@ntnu.edu.tw'
  });

  if (!tpl.id) return { success: false, error: 'Template creation failed' };

  const pageName = `Training_Page_${variant}_${ts}`;
  const page = apiPost('pages/', {
    name: pageName,
    html: compressHtml(finalHtml), // 壓縮後再傳
    capture_credentials: true,
    capture_passwords: true,
    redirect_url: 'https://moodle.ntnu.edu.tw/login/index.php'
  });

  if (!page.id) return { success: false, error: 'Page creation failed' };

  const campId = `${variant}_${ts}`;
  const trackingUrl = `${CONFIG.PHISHING_URL}?c=${campId}&v=${variant}&survey_rid=${rid}`;

  Logger.log(` 追蹤 URL: ${trackingUrl}`);
  Logger.log(` GoPhish 會自動加上: &rid={{.RId}}`);
  Logger.log(` 前端會優先使用: survey_rid=${rid}`);

  const campName = `Training_Camp_${variant}_${ts}`;

  const camp = apiPost('campaigns/', {
    name: campName,
    template: { name: tplName },
    page: { name: pageName },
    smtp: { name: CONFIG.SMTP_NAME },
    url: trackingUrl,
    groups: [{ name: CONFIG.GROUP_NAME }],
    launch_date: new Date().toISOString()
  });

  if (camp.id) {
    Logger.log(' Training campaign created! ');
    Logger.log('Campaign URL: ' + trackingUrl);
    Logger.log('Survey RID: ' + rid);
    return { success: true, name: campName, id: camp.id, rid: rid };
  }

  return { success: false, error: 'Campaign creation failed' };
}

// Inject the CSS and tracking script into the base HTML
function applyCssAndTracking(baseHtml, css, trackingScript) {
  Logger.log('\n 使用修正版 applyCssAndTracking');

  if (!baseHtml || baseHtml.length < 100) {
    Logger.log(' Base HTML 無效');
    return baseHtml;
  }

  if (!css || css.trim().length === 0) {
    Logger.log(' CSS 是空的，只注入追蹤腳本');
    css = '/* No custom CSS */';
  }

  if (!trackingScript || trackingScript.trim().length === 0) {
    Logger.log(' 追蹤腳本是空的');
    trackingScript = '<!-- No Tracking -->';
  }

  Logger.log(`輸入驗證:`);
  Logger.log(` Base HTML: ${baseHtml.length} 字元`);
  Logger.log(` CSS: ${css.length} 字元`);
  Logger.log(` Tracking: ${trackingScript.length} 字元`);

  const cleanedCss = cleanCssForGoPhish(css);

  const styleBlock = `
<!-- ==================== -->
<!-- Variant Custom Styles -->
<!-- ==================== -->
<style type="text/css">
${cleanedCss}
</style>`;

  const trackingBlock = `
<!-- ==================== -->
<!-- Tracking Script -->
<!-- ==================== -->
${trackingScript}`;

  const fullInjection = styleBlock + '\n' + trackingBlock + '\n</head>';

  Logger.log(`\n注入內容長度: ${fullInjection.length} 字元`);

  let result = baseHtml;

  if (baseHtml.includes('</head>')) {
    result = baseHtml.replace('</head>', fullInjection);
    Logger.log(' 成功替換 </head>');
  } else {
    Logger.log(' 找不到 </head>，嘗試在 <body> 前注入');
    if (baseHtml.includes('<body')) {
      result = baseHtml.replace('<body', styleBlock + '\n<body');
    } else {
      Logger.log(' HTML 結構異常，無法注入');
      return baseHtml;
    }
  }

  Logger.log(`\n結果驗證:`);
  Logger.log(` 總長度: ${result.length} 字元`);
  Logger.log(` 包含 <style>: ${result.includes('<style>')}`);
  Logger.log(` 包含 </style>: ${result.includes('</style>')}`);
  Logger.log(` 包含紅色: ${result.includes('#e53e3e') || result.includes('red')}`);
  Logger.log(` 包含動畫: ${result.includes('@keyframes')}`);

  const styleStart = result.indexOf('<!-- Variant Custom Styles -->');
  if (styleStart !== -1) {
    const preview = result.substring(styleStart, styleStart + 500);
    Logger.log(`\n注入內容預覽 (前 500 字元):`);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(preview);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  return result;
}

// Generic OpenAI Chat API call, returns text
function callGPT(prompt, maxTokens) {
  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
      payload: JSON.stringify({
        model: CONFIG.GPT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7
      }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('GPT API error: ' + code);
      return { success: false, error: 'HTTP ' + code };
    }

    const data = JSON.parse(res.getContentText());
    Logger.log(`Token usage: ${data.usage.total_tokens}`);

    return { success: true, text: data.choices[0].message.content };

  } catch (error) {
    Logger.log('GPT error: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Read the full base HTML from chunked Properties cache
function getFullBaseHtml() {
  const props = PropertiesService.getScriptProperties();
  const chunks = parseInt(props.getProperty('FIXED_HTML_CHUNKS') || '0');

  if (chunks === 0) {
    Logger.log(' 没有快取，请先执行 runSiteAnalysisPipeline()');
    return '';
  }

  let html = '';
  for (let i = 0; i < chunks; i++) {
    const chunk = props.getProperty('FIXED_HTML_' + i);
    if (!chunk) {
      Logger.log(' 快取损坏，第 ' + i + ' 段遗失');
      return '';
    }
    html += chunk;
  }

  Logger.log(' Cache HTML loaded, length: ' + html.length);
  return html;
}

// GoPhish API POST request wrapper
function apiPost(endpoint, payload) {
try {
const url = CONFIG.GOPHISH_API_URL + '/api/' + endpoint + '?api_key=' + CONFIG.GOPHISH_API_KEY;
const res = UrlFetchApp.fetch(url, {
method: 'post',
contentType: 'application/json',
payload: JSON.stringify(payload),
muteHttpExceptions: true,
validateHttpsCertificates: false
});
const code = res.getResponseCode();
const text = res.getContentText();

if (code < 200 || code >= 300) {
  Logger.log(' HTTP Error: ' + code);
  return { error: 'HTTP ' + code };
}

return JSON.parse(text);
} catch (e) {
Logger.log(' API error: ' + e.toString());
return { error: e.toString() };
}
}
// GoPhish API PUT request wrapper
function apiPut(endpoint, payload) {
try {
const url = CONFIG.GOPHISH_API_URL + '/api/' + endpoint + '?api_key=' + CONFIG.GOPHISH_API_KEY;
const res = UrlFetchApp.fetch(url, {
method: 'put',
contentType: 'application/json',
payload: JSON.stringify(payload),
muteHttpExceptions: true,
validateHttpsCertificates: false
});
return res.getResponseCode() === 200;
} catch (e) {
return false;
}
}
// Update a GoPhish recipient group
function updateGroup(email, first, last) {
const url = CONFIG.GOPHISH_API_URL + '/api/groups/' + CONFIG.GROUP_ID + '?api_key=' + CONFIG.GOPHISH_API_KEY;
try {
const grp = JSON.parse(UrlFetchApp.fetch(url, {
muteHttpExceptions: true,
validateHttpsCertificates: false
}).getContentText());
return apiPut('groups/' + CONFIG.GROUP_ID, {
  id: CONFIG.GROUP_ID,
  name: grp.name,
  targets: [{ email: email, first_name: first, last_name: last, position: '' }]
});
} catch (e) {
return false;
}
}
// Log recipient and send status to a spreadsheet
function logSheet(email, first, last, status) {
try {
const ss = SpreadsheetApp.getActiveSpreadsheet();
let sh = ss.getSheetByName('發送記錄');
if (!sh) {
sh = ss.insertSheet('發送記錄');
sh.appendRow(['時間', 'Email', '姓', '名', '狀態', '變體']);
sh.getRange('A1:F1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#fff');
}
const variantMatch = status.match(/Variant ([A-E])/);
const variant = variantMatch ? variantMatch[1] : '';

sh.appendRow([new Date(), email, last, first, status, variant]);
} catch (e) {
Logger.log('Sheet error: ' + e);
}
}
// Google Form submit trigger that starts the flow for a recipient
function onFormSubmit(e) {
  try {
    Logger.log('=== 開始處理表單 ===');

    if (!e || !e.response) {
      logSheet('ERROR', 'ERROR', 'ERROR', '觸發器錯誤');
      return;
    }

    const email = e.response.getRespondentEmail();
    const items = e.response.getItemResponses();
    const timestamp = new Date();

    Logger.log('=== 表單原始資料 ===');
    for (let i = 0; i < items.length; i++) {
      const q = items[i].getItem().getTitle();
      const a = items[i].getResponse();
      Logger.log(`Q${i}: "${q}"`);
      Logger.log(`A${i}: "${a}"`);
    }

    const formData = {
      fullName: '',
      firstName: '',
      lastName: '',
      role: '',
      moodleUsage: '',
      securityTraining: '',
      urgencySusceptibility: '',
      checkSender: '',
      checkUrl: '',
      selfConfidence: '',
      suspiciousHandling: '',
      comments: '',
      variant: ''
    };

    for (let i = 0; i < items.length; i++) {
      const rawQuestion = items[i].getItem().getTitle();
      const answer = items[i].getResponse().toString().trim();
      const question = rawQuestion.replace(/\s+/g, '');

      if (question === '姓名' || question.includes('姓名')) {
        formData.fullName = answer;
        formData.firstName = answer;
        formData.lastName = '';
      }
      else if (question.includes('身分') || question.includes('系級')) {
        formData.role = answer;
      }
      else if (question.includes('Moodle') || question.includes('moodle')) {
        formData.moodleUsage = answer;
      }
      else if (question.includes('信心') && question.includes('辨識')) {
        formData.selfConfidence = answer;
      }
      else if (question.includes('懷疑') && question.includes('處理')) {
        formData.suspiciousHandling = answer;
      }
      else if (question.includes('資安') || question.includes('釣魚') || question.includes('訓練')) {
        formData.securityTraining = answer;
      }
      else if (question.includes('緊急') && (question.includes('點擊') || question.includes('回應'))) {
        formData.urgencySusceptibility = answer;
      }
      else if (question.includes('寄件者') || (question.includes('Email') && !question.includes('懷疑'))) {
        formData.checkSender = answer;
      }
      else if (question.includes('連結') && (question.includes('網址') || question.includes('真實'))) {
        formData.checkUrl = answer;
      }
      else if (question.includes('意見') || question.includes('建議') || question.includes('其他')) {
        formData.comments = answer;
      }
    }

    Logger.log('\n=== 解析結果總覽 ===');
    Logger.log(' Email: ' + email);
    Logger.log(' 姓名: ' + (formData.firstName || ' 未填寫'));
    Logger.log(' 身分: ' + (formData.role || ' 未填寫'));

    const requiredFields = [
      { key: 'firstName', name: '姓名', value: formData.firstName },
      { key: 'role', name: '身分', value: formData.role },
      { key: 'urgencySusceptibility', name: '緊急易感', value: formData.urgencySusceptibility },
      { key: 'selfConfidence', name: '辨識信心', value: formData.selfConfidence }
    ];

    const missingFields = requiredFields.filter(f => !f.value);

    if (missingFields.length > 0) {
      const errorMsg = '缺少必填欄位: ' + missingFields.map(f => f.name).join(', ');
      Logger.log('\n ' + errorMsg);
      logSheet(email, '', '', 'ERROR: ' + errorMsg);
      return;
    }

    const rid = Utilities.getUuid();
    formData.rid = rid;
    Logger.log(`\n 生成 RID: ${rid}`);

    const variant = getBalancedVariant();
    formData.variant = variant;
    Logger.log(` 分配變體: ${variant} (${VARIANT_PROMPTS[variant].name})`);

    try {
      const bqResult = writePreSurveyToBigQuery(email, formData, timestamp);
      Logger.log(' BigQuery: ' + (bqResult.success ? '' : ' ' + bqResult.error));

      if (!bqResult.success) {
        Logger.log(' BigQuery 寫入失敗，但繼續執行');
      }
    } catch (bqError) {
      Logger.log(' BigQuery 錯誤（不中斷流程）: ' + bqError.toString());
    }

    Logger.log('\n 開始生成訓練郵件...');
    Logger.log(` 使用 RID: ${rid}`);

    const result = runPhishingWithGPT(
      email,
      formData.firstName,
      formData.lastName,
      variant,
      rid // 傳遞剛剛生成的 RID
    );

    const statusMsg = result.success
      ? `SUCCESS: ${result.name} (Variant ${variant}, RID: ${rid})`
      : `FAILED: ${result.error}`;

    Logger.log(' 最終狀態: ' + statusMsg);

    logSheet(
      email,
      formData.lastName || '',
      formData.firstName,
      statusMsg
    );

    if (CONFIG.ADMIN_EMAIL) {
      const subject = result.success ? ' 訓練郵件已發送' : ' 發送失敗';
      const body = `
目標: ${email}
姓名: ${formData.firstName}
變體: ${variant} (${VARIANT_PROMPTS[variant].name})
RID: ${rid}
狀態: ${result.success ? '成功' : result.error}

時間: ${timestamp.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
`;

      MailApp.sendEmail(CONFIG.ADMIN_EMAIL, subject, body);
    }

    Logger.log('\n 表單處理完成！');

  } catch (error) {
    Logger.log('\n FATAL ERROR ');
    Logger.log('錯誤: ' + error.toString());
    Logger.log('堆疊: ' + error.stack);

    logSheet('ERROR', 'ERROR', 'ERROR', error.toString());

    if (CONFIG.ADMIN_EMAIL) {
      MailApp.sendEmail(
        CONFIG.ADMIN_EMAIL,
        ' 系統嚴重錯誤',
        `錯誤訊息: ${error.toString()}\n\n堆疊追蹤:\n${error.stack}`
      );
    }
  }
}

// Duplicate definition, can be removed
function logSheet(email, first, last, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('發送記錄');

    if (!sh) {
      sh = ss.insertSheet('發送記錄');
      sh.appendRow(['時間', 'Email', '姓', '名', '狀態', '變體']);
      sh.getRange('A1:F1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#fff');
    }

    const variantMatch = status.match(/Variant ([A-E])/);
    const variant = variantMatch ? variantMatch[1] : '';

    sh.appendRow([new Date(), email, last, first, status, variant]);
  } catch (e) {
    Logger.log('Sheet error: ' + e);
  }
}

// Built-in fallback CSS per variant when GPT generation fails
function getResearchBasedCssClean(variant) {
  Logger.log(`\n 使用無中文註解 CSS: ${variant}`);

  const iconFix = `
i.fa-fw,
i.text-info,
.fa.fa-fw,
.icon.fa.slicon-question {
  background: none !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

i.fa-fw::before,
.text-info::before {
  background: transparent !important;
  background-color: transparent !important;
}

.text-info {
  color: #17a2b8 !important; /* Bootstrap info blue */
  background: none !important;
}

i::before,
i::after {
  background: none !important;
}
`;

  const standardCss = {
    'A': `
${iconFix}
`,

    'B': `
${iconFix}

.card.loginpanel {
  border: 1px solid #999 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  background: #f8f8f8 !important;
  transform: rotate(-0.5deg) !important;
}

.col-md-7.instructions h2 {
  color: #666 !important;
  font-weight: 400 !important;
}

.col-md-5.form button[type="submit"],
.col-md-5.form .btn-primary {
  background: #888 !important;
  background-color: #888 !important;
  background-image: none !important;
  border: none !important;
  border-radius: 2px !important;
  box-shadow: none !important;
  color: #fff !important;
}

.row.logo img {
  filter: contrast(0.8) brightness(0.9) !important;
}

.col-md-5.form button:hover {
  background: #777 !important;
  background-color: #777 !important;
}
`,

    'C': `
${iconFix}

.row.logo img {
  transform: scale(1.15) !important;
  filter: hue-rotate(20deg) saturate(0.7) !important;
}

.card.loginpanel {
  border: 2px solid #0066cc !important;
  background: #ffffff !important;
  box-shadow: 0 8px 24px rgba(0, 102, 204, 0.25) !important;
}

.col-md-7.instructions h2 {
  color: #0066cc !important;
}

.col-md-5.form button[type="submit"],
.col-md-5.form .btn-primary {
  background: #0066cc !important;
  background-color: #0066cc !important;
  background-image: none !important;
  border: none !important;
  color: #ffffff !important;
}
`,

    'D': `
${iconFix}

.row.logo img,
.row.logo .img-fluid,
img[src*="Moodle_logo"] {
  display: none !important;
}

.row.logo {
  display: flex !important;
  flex-direction: row !important; /* 改為橫向排列，縮小高度 */
  align-items: center !important;
  justify-content: center !important;

  padding: 10px 20px !important; /* 減少內邊距 */
  max-width: 500px; /* 限制最大寬度，不佔滿全螢幕 */
  margin: 15px auto !important; /* 置中並減少上下邊距 */
  min-height: 50px !important; /* 大幅降低最小高度 */

  border: 2px dashed #d9534f;
  background-color: #fff5f5;
  border-radius: 4px; /* 加一點圓角讓它更好看 */
}

.row.logo::before {
  content: "";
  font-size: 20px; /* 縮小圖示 */
  margin-right: 15px; /* 改為右邊距，與文字分開 */
  margin-bottom: 0 !important;
}

.row.logo::after {
  content: "Error: Resource 'Moodle_logo.png' failed to load."; /* 簡化文字 */
  display: block !important;
  color: #d9534f;
  font-family: 'Courier New', monospace;
  font-size: 12px; /* 縮小字體 */
  text-align: left !important;
}

.input-group-addon i,
.fa-user-circle,
.fa-lock {
  display: none !important;
}
`,

    'E': `
${iconFix}

body#page-login-index {
  background: linear-gradient(135deg, #ffe0e0 0%, #ffcccc 100%) !important;
  background-attachment: fixed !important;
}

.card.loginpanel {
  background: #fff5f5 !important;
  border: 4px solid #e53e3e !important;
  box-shadow: 0 0 20px rgba(229, 62, 62, 0.5) !important;
  animation: subtle-shake 0.8s ease-in-out infinite !important;
}

@keyframes subtle-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

.col-md-7.instructions h2 {
  color: #c53030 !important;
  font-weight: 700 !important;
}

.col-md-5.form button[type="submit"],
.col-md-5.form .btn-primary {
  background: #e53e3e !important;
  background-color: #e53e3e !important;
  background-image: none !important;
  border: 2px solid #c53030 !important;
  border-color: #c53030 !important;
  color: #ffffff !important;
  animation: pulse-warning 1.5s ease-in-out infinite !important;
}

@keyframes pulse-warning {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}

.row.logo img {
  filter: hue-rotate(180deg) saturate(2) !important;
  transform: scale(1.3) !important;
}
`
  };

  const css = standardCss[variant] || standardCss['A'];
  Logger.log(` 使用 ${variant} 的無中文 CSS (${css.length} 字元)`);

  return css;
}

// Call Cloud Run (Playwright) to fetch the page screenshot and DOM tree
function extractDomWithCloudRun(targetUrl) {
  const endpoint = PropertiesService.getScriptProperties()
    .getProperty('CLOUD_RUN_URL') + '/extract-dom';
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty('CLOUD_RUN_API_KEY');

  const payload = {
    url: targetUrl,
    includeHtml: true,
    includeScreenshot: true
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log('Calling Cloud Run: ' + endpoint);
    const response = UrlFetchApp.fetch(endpoint, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log('Cloud Run error: ' + response.getContentText());
      return { success: false, error: 'HTTP ' + statusCode };
    }

    const result = JSON.parse(response.getContentText());
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      domTree: result.domTree,
      renderedHtml: result.renderedHtml,
      screenshotBase64: result.screenshotBase64
    };

  } catch (error) {
    Logger.log('Cloud Run exception: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Count total nodes in a DOM tree
function countDomNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countDomNodes(child);
    }
  }
  return count;
}

// Test: verify BigQuery connection and write permission
function testBigQueryConnection() {
  try {
    const query = `SELECT COUNT(*) as count FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.PRE_SURVEY_TABLE}\``;

    const request = {
      query: query,
      useLegacySql: false
    };

    const queryResults = BigQuery.Jobs.query(request, BIGQUERY_CONFIG.PROJECT_ID);
    Logger.log(' BigQuery 連線成功');
    Logger.log('Pre-survey 記錄數: ' + queryResults.rows[0].f[0].v);
    return true;

  } catch (error) {
    Logger.log(' BigQuery 連線失敗: ' + error.toString());
    Logger.log('請確認:');
    Logger.log('1. BigQuery API 已在「服務」中啟用');
    Logger.log('2. 專案 ID、資料集、資料表名稱正確');
    Logger.log('3. Apps Script 執行身分有 BigQuery 權限');
    return false;
  }
}
function doOptions(e) {
  Logger.log('=== OPTIONS 請求 ===');
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  Logger.log('=== doGet 被觸發 ===');
  Logger.log('時間: ' + new Date().toISOString());

  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>追蹤端點測試</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
          }
          .success { color: green; font-weight: bold; }
          .error { color: red; font-weight: bold; }
          button {
            padding: 10px 20px;
            font-size: 16px;
            margin: 10px 5px;
            cursor: pointer;
          }
          pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <h1 class="success"> Web App 運作正常！</h1>
        <p>部署時間: ${new Date().toISOString()}</p>
        <p>如果你能看到這個頁面，表示 Web App 已成功部署。</p>

        <div class="section">
          <h2>測試 1：簡單 POST 請求</h2>
          <button onclick="testSimplePost()">發送測試資料</button>
          <pre id="result1">點擊按鈕開始測試...</pre>
        </div>

        <div class="section">
          <h2>測試 2：完整追蹤資料</h2>
          <button onclick="testFullTracking()">發送完整追蹤</button>
          <pre id="result2">點擊按鈕開始測試...</pre>
        </div>

        <div class="section">
          <h2>測試 3：使用 sendBeacon</h2>
          <button onclick="testBeacon()">測試 sendBeacon</button>
          <pre id="result3">點擊按鈕開始測試...</pre>
        </div>

        <script>
          const endpoint = window.location.href;

          function testSimplePost() {
            document.getElementById('result1').textContent = '發送中...';

            const payload = {
              rid: 'simple_test_' + Date.now(),
              campaign_id: 'SIMPLE_TEST',
              variant: 'A',
              event_type: 'SIMPLE_TEST'
            };

            console.log(' 發送簡單測試:', payload);

            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            .then(response => {
              console.log('回應狀態:', response.status);
              return response.text();
            })
            .then(text => {
              console.log('回應內容:', text);
              document.getElementById('result1').textContent =
                ' 成功！\\n\\n回應:\\n' + text;
            })
            .catch(error => {
              console.error('錯誤:', error);
              document.getElementById('result1').textContent =
                ' 失敗！\\n\\n錯誤:\\n' + error.toString();
            });
          }

          function testFullTracking() {
            document.getElementById('result2').textContent = '發送中...';

            const payload = {
              rid: 'full_test_' + Date.now(),
              campaign_id: 'FULL_TEST',
              variant: 'B',
              event_type: 'PAGE_VIEW',
              behavior_metrics: {
                dwell_time_seconds: 5.5,
                mouse_activity_score: 25
              },
              page_url: window.location.href,
              user_agent: navigator.userAgent
            };

            console.log(' 發送完整測試:', payload);

            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            .then(response => response.text())
            .then(text => {
              console.log('回應:', text);
              document.getElementById('result2').textContent =
                ' 成功！\\n\\n' +
                'RID: ' + payload.rid + '\\n' +
                '請到 BigQuery 查詢:\\n' +
                'SELECT * FROM \`ntnu-phishing-training.phishing_training.user_events\`\\n' +
                'WHERE rid = \\'' + payload.rid + '\\'\\n\\n' +
                '回應: ' + text;
            })
            .catch(error => {
              console.error('錯誤:', error);
              document.getElementById('result2').textContent =
                ' 失敗！\\n\\n' + error.toString();
            });
          }

          function testBeacon() {
            const payload = {
              rid: 'beacon_test_' + Date.now(),
              campaign_id: 'BEACON_TEST',
              variant: 'C',
              event_type: 'BEACON_TEST',
              behavior_metrics: {
                dwell_time_seconds: 1.0,
                mouse_activity_score: 5
              },
              page_url: window.location.href,
              user_agent: navigator.userAgent
            };

            console.log(' 發送 Beacon 測試:', payload);

            const blob = new Blob([JSON.stringify(payload)], {
              type: 'application/json'
            });

            const success = navigator.sendBeacon(endpoint, blob);

            document.getElementById('result3').textContent =
              success ?
              ' sendBeacon 回報成功！\\n\\nRID: ' + payload.rid + '\\n請檢查 Apps Script 執行記錄' :
              ' sendBeacon 回報失敗';

            console.log('sendBeacon 結果:', success);
          }
        </script>
      </body>
    </html>
  `);
}

// Test: diagnose GoPhish API connection and settings
function diagnoseGoPhishConnection() {
  Logger.log('=== GoPhish 連線診斷 ===\n');

  Logger.log('[Test 1] 測試基本 API 連線...');
  const testUrl = CONFIG.GOPHISH_API_URL + '/api/campaigns/?api_key=' + CONFIG.GOPHISH_API_KEY;
  Logger.log('URL: ' + testUrl);

  try {
    const res = UrlFetchApp.fetch(testUrl, {
      method: 'get',
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });

    const code = res.getResponseCode();
    const text = res.getContentText();

    Logger.log('Response Code: ' + code);
    Logger.log('Response: ' + text.substring(0, 200) + (text.length > 200 ? '...' : ''));

    if (code === 200) {
      Logger.log(' API 連線正常\n');
    } else if (code === 401) {
      Logger.log(' API Key 無效\n');
      return false;
    } else if (code === 1033 || code === 403) {
      Logger.log(' 可能被 Cloudflare 阻擋（Error 1033）\n');
      Logger.log('解決方法：');
      Logger.log('1. 確認 GoPhish URL 是否正確');
      Logger.log('2. 檢查是否有 Cloudflare 保護');
      Logger.log('3. 改用 Proxy URL (如 http://127.0.0.1:8000)');
      return false;
    } else {
      Logger.log(' 未知錯誤: ' + code + '\n');
      return false;
    }
  } catch (error) {
    Logger.log(' 連線失敗: ' + error.toString() + '\n');
    return false;
  }

  Logger.log('[Test 2] 測試群組存取...');
  const groupUrl = CONFIG.GOPHISH_API_URL + '/api/groups/' + CONFIG.GROUP_ID + '?api_key=' + CONFIG.GOPHISH_API_KEY;

  try {
    const res = UrlFetchApp.fetch(groupUrl, {
      method: 'get',
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });

    const code = res.getResponseCode();

    if (code === 200) {
      const group = JSON.parse(res.getContentText());
      Logger.log(' 群組找到: ' + group.name);
      Logger.log(' 目前目標數: ' + group.targets.length + '\n');
    } else {
      Logger.log(' 群組不存在 (ID: ' + CONFIG.GROUP_ID + ')\n');
      return false;
    }
  } catch (error) {
    Logger.log(' 群組存取失敗: ' + error.toString() + '\n');
    return false;
  }

  Logger.log(' 所有診斷通過！');
  return true;
}
// Use GPT-4o Vision to analyze the screenshot and detect icons
function analyzeScreenshotWithVision(screenshotBase64, html) {
  const structure = extractHtmlStructure(html);

  const prompt = `You are a visual analyst examining a webpage screenshot.

Your task: Find every small icon (typically 12-24px) visible on this page.
For each icon, describe ONLY what you visually see, then map it to Font Awesome 4.7.

HTML context (for selector hints only):
Body ID: ${structure.bodyId || 'none'}
Classes: ${structure.classes.slice(0, 30).map(c => '.' + c).join(', ')}

STRICT RULES:
1. Describe the icon's visual shape first, independently of its context.
   Good: "circle with a question mark inside"
   Bad: "help icon" (you assumed purpose, not shape)

2. Choose fa_class based on visual shape only.
   - Circle with "?" inside fa-question-circle
   - Circle with "i" inside fa-info-circle
   - Circle with "!" inside fa-exclamation-circle
   - Triangle with "!" inside fa-exclamation-triangle
   - Human silhouette, no circle fa-user
   - Human silhouette inside circle fa-user-circle
   - Human silhouette inside circle, outline only fa-user-circle-o
   - Closed padlock fa-lock
   - Open padlock fa-unlock
   - Checkmark inside circle fa-check-circle
   - Checkmark inside circle, outline fa-check-circle-o
   - Plain checkmark, no circle fa-check
   - Magnifying glass fa-search
   - Gear / cogwheel fa-cog
   - Envelope / mail fa-envelope
   - Calendar fa-calendar
   - Home / house shape fa-home
   - Bell shape fa-bell
   - Star shape fa-star
   - Heart shape fa-heart
   - Trash / bin shape fa-trash
   - Pencil / edit shape fa-pencil
   - X mark / close fa-times
   - Plus / add fa-plus
   - Minus / remove fa-minus
   - Arrow pointing right fa-arrow-right
   - Arrow pointing left fa-arrow-left
   - Arrow pointing up fa-arrow-up
   - Arrow pointing down fa-arrow-down
   - Three horizontal lines (hamburger) fa-bars
   - List / bullet lines fa-list
   - Eye shape (visible) fa-eye
   - Eye with slash (hidden) fa-eye-slash
   - Flag shape fa-flag
   - Tag / label shape fa-tag
   - Link / chain shape fa-link
   - Upload arrow fa-upload
   - Download arrow fa-download
   - Share / export arrow fa-share
   - Refresh / circular arrows fa-refresh
   - Power button fa-power-off
   - Globe / world fa-globe

3. url_hint: a SHORT keyword (1-2 words) likely to appear in the image's
   src URL or CSS class name. Think about what the developer named this icon.
   Examples: "help", "user", "lock", "check", "info", "warn", "close"

4. nearby_text: copy the actual visible text closest to this icon on screen.
   Example: "Cookies", "Username", "Password", "Sign in"

5. color: the exact hex color you see, or "#999999" if unclear.

6. If you cannot clearly identify the shape, skip that icon entirely.
   Do NOT guess. Do NOT include uncertain icons.

Output ONLY valid JSON, no explanation, no markdown:
{
  "icon_library": "font-awesome-4",
  "cdn_replacement": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css",
  "icon_map": [
    {
      "description": "circle with a question mark inside",
      "nearby_text": "Cookies",
      "url_hint": "help",
      "fa_class": "fa-question-circle",
      "color": "#17a2b8",
      "size_px": 16
    }
  ],
  "color_scheme": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex"
  }
}`;

  try {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
      payload: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: (() => {
                  const detected = autoDetectImageFormat(screenshotBase64);
                  return 'data:' + detected.mimeType + ';base64,' + detected.data;
                })(),
                detail: 'high'
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('Vision API HTTP ' + code + ': ' + res.getContentText());
      return null;
    }

    const data = JSON.parse(res.getContentText());
    Logger.log('Vision token usage: ' + JSON.stringify(data.usage));

    const text = data.choices[0].message.content;
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      Logger.log('No JSON in Vision response');
      return null;
    }

    const result = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));

    if (!result.elements) result.elements = [];
    if (!result.broken_resources) result.broken_resources = [];
    if (!result.icon_map) result.icon_map = [];

    if (result.icon_map.length > 0) {
      Logger.log('Vision identified ' + result.icon_map.length + ' icons:');
      result.icon_map.forEach(function(icon) {
        Logger.log(' [' + icon.fa_class + '] ' + icon.description + ' (near: "' + icon.nearby_text + '", hint: "' + icon.url_hint + '")');
      });
      PropertiesService.getScriptProperties().setProperty(
        'VISION_ICON_MAP',
        JSON.stringify(result.icon_map)
      );
    }

    return result;

  } catch (error) {
    Logger.log('analyzeScreenshotWithVision error: ' + error.toString());
    return null;
  }
}

// Fix base HTML resources: remove dead CSS links, inject CDN, replace broken icons
function applyHtmlFixes(html, visionResult, baseUrl) {
  Logger.log('Applying fixes...');

  let fixed = html;

  if (visionResult.cdn_replacement) {
    const cdnTag = '<link rel="stylesheet" href="' + visionResult.cdn_replacement + '">';
    if (visionResult.icon_library && visionResult.icon_library.includes('font-awesome')) {
      fixed = fixed.replace(/<link[^>]*font-awesome[^>]*>/gi, '');
      Logger.log('Removed broken Font Awesome links');
    }
    if (!fixed.includes(visionResult.cdn_replacement)) {
      fixed = fixed.replace('</head>', cdnTag + '\n</head>');
      Logger.log('Injected CDN: ' + visionResult.cdn_replacement);
    }
  }

  if (visionResult.broken_resources && visionResult.broken_resources.length > 0) {
    visionResult.broken_resources.forEach(resource => {
      if (resource.fix_type === 'cdn_replace' && resource.fix_value) {
        const cdnTag = '<link rel="stylesheet" href="' + resource.fix_value + '">';
        if (!fixed.includes(resource.fix_value)) {
          fixed = fixed.replace('</head>', cdnTag + '\n</head>');
          Logger.log('Fixed: ' + resource.description);
        }
      }
      if (resource.fix_type === 'css_inject' && resource.fix_value) {
        const styleTag = '<style>' + resource.fix_value + '</style>';
        fixed = fixed.replace('</head>', styleTag + '\n</head>');
        Logger.log('CSS injected for: ' + resource.description);
      }
    });
  }

  if (visionResult.color_scheme && visionResult.color_scheme.primary) {
    PropertiesService.getScriptProperties().setProperty(
      'SITE_COLOR_SCHEME',
      JSON.stringify(visionResult.color_scheme)
    );
    Logger.log('Color scheme cached');
  }

  if (visionResult.icon_map && visionResult.icon_map.length > 0) {
    fixed = replaceBrokenIconsInHtml(fixed, visionResult.icon_map);
    Logger.log('Broken icons replaced in HTML');
  }

  fixed = fixed.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function(match, content) {
    const cleaned = content
      .replace(/\/\*[^*]*[\u4e00-\u9fff][^*]*\*\//g, '')
      .replace(/\/\/.*[\u4e00-\u9fff].*/g, '');
    return match.replace(content, cleaned);
  });

  return fixed;
}

// Detect image format (PNG/JPEG/etc) from base64 content
function autoDetectImageFormat(base64) {
  const header = base64.substring(0, 20);

  if (header.startsWith('iVBORw0KGgo')) {
    Logger.log(' 偵測到圖片格式: PNG');
    return { mimeType: 'image/png', data: base64 };
  }

  if (header.startsWith('/9j/')) {
    Logger.log(' 偵測到圖片格式: JPEG');
    return { mimeType: 'image/jpeg', data: base64 };
  }

  if (header.startsWith('R0lGOD')) {
    Logger.log(' 偵測到圖片格式: GIF');
    return { mimeType: 'image/gif', data: base64 };
  }

  if (header.startsWith('UklGR')) {
    Logger.log(' 偵測到圖片格式: WebP');
    return { mimeType: 'image/webp', data: base64 };
  }

  if (base64.includes('data:image/')) {
    const mimeMatch = base64.match(/data:(image\/[^;]+);base64,/);
    if (mimeMatch) {
      Logger.log(' 偵測到 data URI 前綴: ' + mimeMatch[1]);
      return {
        mimeType: mimeMatch[1],
        data: base64.split('base64,')[1]
      };
    }
  }

  Logger.log(' 無法判斷圖片格式，預設使用 JPEG');
  return { mimeType: 'image/jpeg', data: base64 };
}

// Frontend script that fixes transparent background and icon rendering
function getTransparentFixScript() {
  let iconMap = [];
  try {
    const cached = PropertiesService.getScriptProperties().getProperty('VISION_ICON_MAP');
    if (cached) iconMap = JSON.parse(cached);
  } catch(e) {}

  const iconMapJson = JSON.stringify(iconMap);

  return `
<script>
(function() {

  var visionIconMap = ${iconMapJson};

  function findBestFaIcon(el) {
    var elClass = (el.className || '').toLowerCase();
    var elTitle = (el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
    var nearbyText = '';
    var parent = el.parentElement;
    if (parent) nearbyText = (parent.textContent || '').toLowerCase().trim().substring(0, 100);
    var combined = elClass + ' ' + elTitle + ' ' + nearbyText;

    if (visionIconMap.length > 0) {
      var bestScore = -1;
      var bestIcon = null;
      for (var i = 0; i < visionIconMap.length; i++) {
        var icon = visionIconMap[i];
        var score = 0;
        var hint = (icon.url_hint || '').toLowerCase();
        var desc = (icon.description || '').toLowerCase();
        var near = (icon.nearby_text || '').toLowerCase();
        if (hint && combined.includes(hint)) score += 10;
        desc.split(/\\s+/).filter(function(w){ return w.length > 3; }).forEach(function(w) {
          if (combined.includes(w)) score += 3;
        });
        near.split(/\\s+/).filter(function(w){ return w.length > 3; }).forEach(function(w) {
          if (combined.includes(w)) score += 2;
        });
        if (score > bestScore) { bestScore = score; bestIcon = icon; }
      }
      if (bestIcon && bestScore > 0) {
        return { faClass: bestIcon.fa_class || 'fa-question-circle', color: bestIcon.color || '#999' };
      }
      if (visionIconMap.length > 0) {
        return { faClass: visionIconMap[0].fa_class || 'fa-question-circle', color: visionIconMap[0].color || '#999' };
      }
    }
    return { faClass: 'fa-question-circle', color: '#999' };
  }

  var _canvas = document.createElement('canvas');
  _canvas.width = 24;
  _canvas.height = 24;
  var _ctx = _canvas.getContext('2d');

  function getPixelHash(fontStr, char) {
    _ctx.clearRect(0, 0, 24, 24);
    _ctx.font = fontStr;
    _ctx.fillStyle = '#000';
    _ctx.fillText(char, 2, 18);
    var data = _ctx.getImageData(0, 0, 24, 24).data;
    var sum = 0;
    for (var i = 3; i < data.length; i += 4) sum += data[i];
    return sum;
  }

  var _blankCache = {};

  function getBlankHash(fontStr) {
    if (_blankCache[fontStr] !== undefined) return _blankCache[fontStr];
    var hash = getPixelHash(fontStr, '\\uE000');
    _blankCache[fontStr] = hash;
    return hash;
  }

  function isIconCharacterBlank(el) {
    var style = window.getComputedStyle(el, ':before');
    var content = style.getPropertyValue('content');
    var fontFamily = style.getPropertyValue('font-family');
    var fontSize = style.getPropertyValue('font-size') || '16px';

    if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") {
      return true;
    }

    var char = content.replace(/^["']|["']$/g, '');
    if (!char || char.length === 0) return true;

    if (char.startsWith('\\\\')) {
      try {
        char = String.fromCodePoint(parseInt(char.replace('\\\\', ''), 16));
      } catch(e) {
        return true;
      }
    }

    var fontStr = fontSize + ' ' + fontFamily;

    var charHash = getPixelHash(fontStr, char);
    var blankHash = getBlankHash(fontStr);

    return Math.abs(charHash - blankHash) < 5;
  }

  function replaceBrokenIconElements() {
  var icons = document.querySelectorAll('i');
  var count = 0;

  for (var i = 0; i < icons.length; i++) {
    var el = icons[i];

    var cls = el.className || '';
    if (!cls.trim()) continue;

    if (!isIconCharacterBlank(el)) continue;

    var result = findBestFaIcon(el);

    var newEl = document.createElement('i');
    var keepClasses = (el.className || '').split(' ').filter(function(c) {
      return c.trim().length > 0;
    });
    keepClasses.push('fa');
    keepClasses.push(result.faClass);

    newEl.className = keepClasses.filter(function(c, idx, arr) {
      return arr.indexOf(c) === idx;
    }).join(' ');

    newEl.style.color = result.color;
    newEl.setAttribute('aria-hidden', 'true');

    var title = el.getAttribute('title');
    var aria = el.getAttribute('aria-label');
    if (title) newEl.setAttribute('title', title);
    if (aria) newEl.setAttribute('aria-label', aria);

    if (el.parentNode) {
      el.parentNode.replaceChild(newEl, el);
      count++;
    }
  }

  if (count > 0) console.log('[IconFix] Replaced ' + count + ' broken icon elements');
}

  function replaceBrokenImages() {
    var images = document.querySelectorAll('img');
    for (var i = 0; i < images.length; i++) {
      (function(img) {
        function doReplace() {
          var result = findBestFaIcon(img);
          var icon = document.createElement('i');
          icon.className = 'fa ' + result.faClass;
          icon.style.color = result.color;
          icon.style.fontSize = '16px';
          icon.style.verticalAlign = 'middle';
          icon.setAttribute('aria-hidden', 'true');
          if (img.parentNode) img.parentNode.replaceChild(icon, img);
        }
        if (img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
          doReplace();
        } else {
          img.addEventListener('error', doReplace);
        }
      })(images[i]);
    }
  }

  function isWhiteOrLight(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return false;
    var rgba = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!rgba) return false;
    var r = parseInt(rgba[1]);
    var g = parseInt(rgba[2]);
    var b = parseInt(rgba[3]);
    var a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
    if (a < 0.1) return false;
    return (r > 235 && g > 235 && b > 235);
  }

  function findLoginContainer() {
    var candidates = [
      'form#login', 'form[action*="login"]', 'form[id*="login"]',
      'form[class*="login"]', '#login-form', '.login-form', 'form[method="post"]'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = document.querySelector(candidates[i]);
      if (el) return el;
    }
    return null;
  }

  function removeWhiteBackgrounds() {
  var bodyBg = window.getComputedStyle(document.body).backgroundImage;
  if (!bodyBg || bodyBg === 'none') return;

  var loginForm = findLoginContainer();
  if (!loginForm) return;

  var cardSelectors = [
    '.card', '.loginpanel', '.card.loginpanel',
    '.card-block', '.card-body', '.card-header',
    '[class*="loginpanel"]', '[class*="login-panel"]'
  ];
  cardSelectors.forEach(function(sel) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest('nav') || el.closest('header')) continue;
      var computed = window.getComputedStyle(el);
      if (isWhiteOrLight(computed.backgroundColor)) {
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
      }
    }
  });

  var el = loginForm.parentElement;
  if (!el) return;
  el = el.parentElement; // start from grandparent
  if (!el) return;

  while (el && el !== document.documentElement) {
    if (el === document.body) { el = el.parentElement; continue; }

    var tag = el.tagName.toLowerCase();
    if (tag === 'nav' || tag === 'header') { el = el.parentElement; continue; }
    if (el.classList.contains('navbar') ||
        el.classList.contains('header') ||
        el.classList.contains('topbar')) { el = el.parentElement; continue; }

    var computed = window.getComputedStyle(el);
    var bgColor = computed.backgroundColor;
    var bgImage = computed.backgroundImage;

    if (isWhiteOrLight(bgColor) && (bgImage === 'none' || !bgImage)) {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
    }

    el = el.parentElement;
  }
}

  function runAll() {
    removeWhiteBackgrounds();
    replaceBrokenImages();
  }

  function runIconFix() {
    removeWhiteBackgrounds();
    replaceBrokenIconElements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    runAll();
  }

  window.addEventListener('load', runIconFix);

  window.addEventListener('load', function() {
    setTimeout(runIconFix, 1500);
  });

})();
</script>`;
}

// GPT call used for element/attribute rating
function callGPTForRating(prompt) {
  try {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
      payload: JSON.stringify({
        model: CONFIG.GPT_MODEL,
        temperature: 0.2,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      Logger.log(' 評分 GPT API error: ' + code);
      return null;
    }
    const data = JSON.parse(res.getContentText());
    return data.choices[0].message.content.trim();
  } catch (e) {
    Logger.log(' 評分 GPT 例外: ' + e.toString());
    return null;
  }
}

// Parse rating JSON from GPT (supports {"results":[...]} or a bare array)
function parseRatingJSON(text) {
  if (!text) return null;
  var clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  var objStart = clean.indexOf('{');
  var objEnd = clean.lastIndexOf('}');
  var arrStart = clean.indexOf('[');
  var arrEnd = clean.lastIndexOf(']');

  try {
    if (objStart !== -1 && objEnd !== -1 && objStart < arrStart) {
      var obj = JSON.parse(clean.substring(objStart, objEnd + 1));
      if (obj && Array.isArray(obj.results)) return obj.results;
      if (Array.isArray(obj)) return obj;
    }
  } catch (e) { /* 落到下面試陣列 */ }

  try {
    if (arrStart !== -1 && arrEnd !== -1) {
      return JSON.parse(clean.substring(arrStart, arrEnd + 1));
    }
  } catch (e) { /* fallthrough */ }

  Logger.log(' 評分 JSON 解析失敗，摘要: ' + text.substring(0, 120));
  return null;
}

// Collect actual tags and attributes by walking the DOM tree
function extractDynamicFeatures(node, tagsSet, attrsSet) {
  if (!node || typeof node !== 'object') return;
  if (node.tag) tagsSet[node.tag.toLowerCase()] = true;

  Object.keys(node).forEach(function(key) {
    if (['tag', 'children', 'text', 'computedStyle', 'bbox', 'isVisible',
         'isIcon', 'iconClass', 'depth'].indexOf(key) === -1) {
      attrsSet[key.toLowerCase()] = true;
    }
  });

  if (node.children && node.children.length > 0) {
    node.children.forEach(function(child) {
      extractDynamicFeatures(child, tagsSet, attrsSet);
    });
  }
}

// Rating step 1: GPT classifies HTML tags
function llmClassifyElements() {
  const prompt =
    "You are an expert cybersecurity researcher specializing in human factors of phishing defenses and automated visual manipulation. " +
    "When evaluating HTML tags for generating custom CSS override templates on institutional login pages (to manipulate logos, input fields, buttons, and text alerts for phishing simulations), " +
    "what distinct categories/classes of HTML tags exist based on their role in layout preservation, visual cues, and behavioral telemetry hooking? " +
    "Crucially, define an 'other' category specifically for tags that do NOT contribute to visual rendering or specific element positioning on login interfaces. " +
    "Provide clear semantic definitions for each identified category.";
  Logger.log(' [評分] 步驟一：元素分類');
  return callGPTForRating(prompt); // 回傳分類定義文字，供步驟二引用
}

// Rating step 2: GPT scores each tag importance (0-1)
function llmRateTags(dynamicTagList, classificationText) {
  const prompt =
    "You are an expert CSS template engineer evaluating the structural security components of a login interface.\n\n" +
    "INPUT WEBPAGE TAGS:\n" +
    "The target webpage currently utilizes only the following specific HTML tags under a live DOM tree:\n" +
    JSON.stringify(dynamicTagList) + "\n\n" +
    "Category definitions from the previous step:\n" +
    (classificationText ? classificationText.substring(0, 400) : "struct / form / interactive / text / media / other") + "\n\n" +
    "TASK:\n" +
    "1. Evaluate and classify EVERY single tag provided in the list above into one of the categories defined in the previous step.\n" +
    "2. If a tag has absolutely NO direct value for visual styling overrides, layout positioning, or identity tampering (e.g., script, meta, link, title, comment tags), you MUST classify it into the 'other' category and assign an importance score ('S') of exactly 0.0.\n" +
    "3. Score each tag's importance ('S') for generating precision CSS override rules that target login forms on a scale of [0.0, 1.0].\n\n" +
    "OUTPUT FORMAT:\n" +
    "You MUST respond with a JSON object containing the array list. No markdown, no explanation. Schema:\n" +
    '{"results": [\n' +
    ' {"tag": "div", "T": "struct", "S": 0.9},\n' +
    ' {"tag": "meta", "T": "other", "S": 0.0}\n' +
    ']}';
  Logger.log(' [評分] 步驟二：標籤評分（' + dynamicTagList.length + ' 種）');
  const resp = callGPTForRating(prompt);
  return parseRatingJSON(resp); // [{tag,T,S}, ...]
}

// Rating step 3: GPT scores each attribute importance (0-1)
function llmRateAttributes(dynamicAttrList) {
  const prompt =
    "You are an expert browser rendering and security auditing engineer.\n\n" +
    "INPUT WEBPAGE ATTRIBUTES:\n" +
    "The target interface utilizing the following live attributes within its DOM structure:\n" +
    JSON.stringify(dynamicAttrList) + "\n\n" +
    "TASK:\n" +
    "1. Score each attribute's structural importance ('S') with regard to how useful it is for generating precision CSS override selectors targeting login elements on a rational scale of [0.0, 1.0].\n" +
    "2. If an attribute has zero impact on visual override targeting or telemetry hook identification (e.g., aria-*, role, accessibility values), assign a score threshold below 0.3.\n\n" +
    "OUTPUT FORMAT:\n" +
    "You MUST respond with a JSON object containing the array list. No markdown, no explanation. Schema:\n" +
    '{"results": [\n' +
    ' {"attribute": "id", "S": 0.9},\n' +
    ' {"attribute": "role", "S": 0.1}\n' +
    ']}';
  Logger.log(' [評分] 步驟三：屬性評分（' + dynamicAttrList.length + ' 種）');
  const resp = callGPTForRating(prompt);
  return parseRatingJSON(resp); // [{attribute,S}, ...]
}

// Build per-page tag/attribute rating tables, fall back to static tables on failure
function generateDynamicRatingTables(domTree) {
  Logger.log('\n [動態評分] GPT-4o 針對當前頁面產生評分表');

  var tagsSet = {}, attrsSet = {};
  extractDynamicFeatures(domTree, tagsSet, attrsSet);
  var dynamicTags = Object.keys(tagsSet);
  var dynamicAttrs = Object.keys(attrsSet);
  Logger.log(' 偵測到 ' + dynamicTags.length + ' 種標籤、' + dynamicAttrs.length + ' 種屬性');

  if (dynamicTags.length === 0) {
    Logger.log(' 未偵測到任何標籤，改用硬編碼 fallback 表');
    return null;
  }

  var classification = llmClassifyElements();
  Utilities.sleep(1500);
  var tagRatings = llmRateTags(dynamicTags, classification);
  Utilities.sleep(1500);
  var attrRatings = llmRateAttributes(dynamicAttrs);

  if (!tagRatings || !attrRatings) {
    Logger.log(' 評分回傳不完整，改用硬編碼 fallback 表');
    return null;
  }

  var elementRatings = {};
  tagRatings.forEach(function(t) {
    if (!t || !t.tag) return;
    elementRatings[t.tag.toLowerCase()] = {
      "class": (t.T || 'other').toLowerCase(),
      "score": typeof t.S === 'number' ? t.S : 0.0
    };
  });

  var attributeRatings = {};
  attrRatings.forEach(function(a) {
    if (!a || !a.attribute) return;
    attributeRatings[a.attribute.toLowerCase()] = (typeof a.S === 'number' ? a.S : 0.0);
  });

  Logger.log(' 動態評分表建立完成（element: ' +
    Object.keys(elementRatings).length + '、attribute: ' +
    Object.keys(attributeRatings).length + '）');

  return { elementRatings: elementRatings, attributeRatings: attributeRatings };
}

const STYLE_DELTA_EMPTY_VALUES = ['', 'none', 'transparent', 'rgba(0, 0, 0, 0)'];

// Compress computedStyle: drop values equal to parent, keep only the styleDelta
function compressStyleDelta(node, parentStyle) {
  if (!node) return;
  if (parentStyle === undefined || parentStyle === null) parentStyle = {};

  var fullStyle;

  if (node.computedStyle && typeof node.computedStyle === 'object') {
    var currentStyle = node.computedStyle;
    var deltaStyle = {};

    Object.keys(currentStyle).forEach(function(field) {
      var val = currentStyle[field];
      if (!(field in parentStyle) || parentStyle[field] !== val) {
        if (!(field in parentStyle) && STYLE_DELTA_EMPTY_VALUES.indexOf(val) !== -1) {
          return;
        }
        deltaStyle[field] = val;
      }
    });

    fullStyle = Object.assign({}, parentStyle, currentStyle);

    delete node.computedStyle;
    if (Object.keys(deltaStyle).length > 0) {
      node.styleDelta = deltaStyle;
    }
  } else {
    fullStyle = parentStyle;
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach(function(child) {
      compressStyleDelta(child, fullStyle);
    });
  }
}

let D2SNAP_ELEMENT_RATINGS = {

  "button": {"class": "visual-critical", "score": 1.00},
  "input": {"class": "visual-critical", "score": 1.00},
  "img": {"class": "visual-critical", "score": 0.95},
  "svg": {"class": "visual-critical", "score": 0.90},
  "form": {"class": "visual-critical", "score": 0.90},
  "i": {"class": "visual-critical", "score": 0.85},
  "select": {"class": "visual-critical", "score": 0.85},
  "textarea": {"class": "visual-critical", "score": 0.85},

  "div": {"class": "container", "score": 0.80},
  "body": {"class": "container", "score": 0.50},
  "main": {"class": "container", "score": 0.40},
  "section": {"class": "container", "score": 0.35},
  "footer": {"class": "container", "score": 0.30},
  "header": {"class": "container", "score": 0.30},
  "nav": {"class": "container", "score": 0.25},
  "article": {"class": "container", "score": 0.20},
  "aside": {"class": "container", "score": 0.15},
  "figure": {"class": "container", "score": 0.15},
  "ol": {"class": "container", "score": 0.15},
  "ul": {"class": "container", "score": 0.15},
  "table": {"class": "container", "score": 0.10},
  "tbody": {"class": "container", "score": 0.10},
  "tr": {"class": "container", "score": 0.10},

  "label": {"class": "content", "score": 0.75},
  "span": {"class": "content", "score": 0.70},
  "h1": {"class": "content", "score": 0.60},
  "h2": {"class": "content", "score": 0.55},
  "h3": {"class": "content", "score": 0.50},
  "h4": {"class": "content", "score": 0.45},
  "h5": {"class": "content", "score": 0.40},
  "h6": {"class": "content", "score": 0.35},
  "p": {"class": "content", "score": 0.30},
  "li": {"class": "content", "score": 0.20},
  "address": {"class": "content", "score": 0.10},
  "b": {"class": "content", "score": 0.10},
  "blockquote": {"class": "content", "score": 0.10},
  "code": {"class": "content", "score": 0.10},
  "em": {"class": "content", "score": 0.10},
  "figcaption": {"class": "content", "score": 0.10},
  "hr": {"class": "content", "score": 0.10},
  "pre": {"class": "content", "score": 0.10},
  "small": {"class": "content", "score": 0.10},
  "strong": {"class": "content", "score": 0.10},
  "sub": {"class": "content", "score": 0.10},
  "sup": {"class": "content", "score": 0.10},
  "td": {"class": "content", "score": 0.10},
  "th": {"class": "content", "score": 0.10},
  "summary": {"class": "content", "score": 0.10},

  "a": {"class": "interactive", "score": 0.40},
  "details": {"class": "interactive", "score": 0.10},

  "canvas": {"class": "other", "score": 0.10},
  "video": {"class": "other", "score": 0.10},
  "br": {"class": "other", "score": 0.05},
  "base": {"class": "other", "score": 0.00},
  "head": {"class": "other", "score": 0.00},
  "html": {"class": "other", "score": 0.00},
  "link": {"class": "other", "score": 0.00},
  "meta": {"class": "other", "score": 0.00},
  "noscript": {"class": "other", "score": 0.00},
  "script": {"class": "other", "score": 0.00},
  "source": {"class": "other", "score": 0.00},
  "style": {"class": "other", "score": 0.00},
  "template": {"class": "other", "score": 0.00},
  "title": {"class": "other", "score": 0.00},
  "track": {"class": "other", "score": 0.00},
};

let D2SNAP_ATTRIBUTE_RATINGS = {
  "id": 1.00,
  "class": 1.00,
  "type": 0.95,
  "name": 0.95,
  "placeholder": 0.85,
  "aria-label": 0.80,
  "role": 0.75,
  "alt": 0.70,
  "required": 0.65,
  "disabled": 0.60,
  "readonly": 0.55,
  "for": 0.50,
  "autocomplete": 0.45,
  "value": 0.40,
  "href": 0.35,
  "src": 0.35,
  "aria-describedby":0.30,
  "aria-required": 0.30,
  "checked": 0.30,
  "selected": 0.30,
  "maxlength": 0.25,
  "minlength": 0.25,
  "pattern": 0.25,
  "autofocus": 0.20,
  "tabindex": 0.20,
  "data-testid": 0.10,
  "data-id": 0.10,
  "data-name": 0.10,
  "action": 0.10,
  "method": 0.10,
  "multiple": 0.10,
  "size": 0.10,
  "wrap": 0.10,
  "accept": 0.10,
  "enctype": 0.10,
  "novalidate": 0.10,
  "title": 0.10,
  "lang": 0.10,
  "contenteditable": 0.10,
  "draggable": 0.10,
  "spellcheck": 0.10,
  "form": 0.10,
  "target": 0.10,
  "rel": 0.10,
  "hidden": 0.05,
  "style": 0.00,
  "http-equiv": 0.00,
  "content": 0.00,
};

const VISUAL_CRITICAL_TAGS = [
  "img", "i", "svg", "button", "form", "input",
  "select", "textarea"
];

const D2SNAP_PARAMS = {
  theta_tag: 0.3,
  theta_attr: 0.5,
  l: 0.5 // 文字降採樣比例（D2SnapText）
};

// Attribute pruning: remove attributes scoring below theta_attr
function D2SnapAttribute(node, theta_attr) {
  if (!node) return;

  const attrFields = [
    "id", "className", "role", "ariaLabel",
    "href", "src", "type", "name", "placeholder"
  ];

  attrFields.forEach(function(field) {
    if (node[field] === undefined || node[field] === "") {
      return;
    }

    const attrName =
      field === "className" ? "class" :
      field === "ariaLabel" ? "aria-label" :
      field;

    const rating = D2SNAP_ATTRIBUTE_RATINGS[attrName];

    if (rating === undefined) {
      delete node[field];
      return;
    }

    if (rating < theta_attr) {
      delete node[field];
    }
  });
}

const CSS_SELECTOR_WHITELIST = [
  'id', // CSS #id selector
  'class', // CSS .class selector
  'type', // input[type="password"]
  'name', // [name="username"]
  'for', // label[for="username"]
  'required', // [required]
  'disabled', // [disabled]
  'readonly', // [readonly]
  'placeholder', // [placeholder]
  'alt', // [alt]
  'role', // [role]
  'aria-label' // [aria-label]
];

// DOM pruning by theta_tag (nodes) and theta_attr (attributes)
function applyD2Snap(domTree, params) {
  Logger.log("\n [階段 2] Two-Stage Adaptive Pruning");
  Logger.log(
    " 參數: theta_tag=" + params.theta_tag +
    ", theta_attr=" + params.theta_attr +
    ", l=" + params.l
  );

  if (!domTree) return null;

  const totalHeight = calculateDomHeight(domTree);
  Logger.log(" DOM 樹高度: " + totalHeight);

  const stats = {
    visualCriticalKept: 0,
    containerMerged: 0,
    interactiveKept: 0,
    contentKept: 0,
    otherRemoved: 0,
    textTruncated: 0,
  };

  function processNode(node, depth) {
    if (!node || !node.tag) return null;

    const tagLower = node.tag.toLowerCase();

    if (tagLower === "html" || tagLower === "body") {
      if (node.children && node.children.length > 0) {
        node.children = node.children
          .map(function(child) {
            return processNode(child, depth + 1);
          })
          .filter(function(child) { return child !== null; });
      }
      return node;
    }

    if (
      VISUAL_CRITICAL_TAGS.indexOf(tagLower) !== -1 ||
      node.isIcon === true
    ) {
      if (node.children && node.children.length > 0) {
        node.children = node.children
          .map(function(child) {
            return processNode(child, depth + 1);
          })
          .filter(function(child) { return child !== null; });
      }
      D2SnapAttribute(node, params.theta_attr);
      stats.visualCriticalKept++;
      return node;
    }

    const rating = D2SNAP_ELEMENT_RATINGS[tagLower];

    const tagScore = rating ? rating.score : 0.0;
    if (!rating || tagScore < params.theta_tag) {
      stats.otherRemoved++;
      return null;
    }

    if (node.children && node.children.length > 0) {
      node.children = node.children
        .map(function(child) {
          return processNode(child, depth + 1);
        })
        .filter(function(child) { return child !== null; });
    }

    switch (rating.class) {

      case "visual-critical":
      case "form":
        D2SnapAttribute(node, params.theta_attr);
        stats.visualCriticalKept++;
        return node;

      case "container":
      case "struct":
        D2SnapElement(node, 0.3, totalHeight, depth);
        D2SnapAttribute(node, params.theta_attr);
        stats.containerMerged++;
        return node;

      case "content":
      case "text":
        if (node.text && node.text.length > 0) {
          node.text = D2SnapText(node.text, params.l);
          stats.textTruncated++;
        }
        D2SnapAttribute(node, params.theta_attr);
        stats.contentKept++;
        return node;

      case "interactive":
      case "media":
        D2SnapAttribute(node, params.theta_attr);
        stats.interactiveKept++;
        return node;

      case "other":
        stats.otherRemoved++;
        return null;

      default:
        return node;
    }
  }

  const result = processNode(domTree, 0);

  Logger.log(
    " Visual-Critical 保留: " + stats.visualCriticalKept
  );
  Logger.log(" Container 處理: " + stats.containerMerged);
  Logger.log(" Interactive 保留: " + stats.interactiveKept);
  Logger.log(" Content 保留: " + stats.contentKept);
  Logger.log(" Other 移除: " + stats.otherRemoved);
  Logger.log(" 最終節點: " + countDomNodes(result));

  return result;
}

// Compute the maximum depth of a DOM tree
function calculateDomHeight(node, currentDepth = 0) {
  if (!node) return currentDepth;
  if (!node.children || node.children.length === 0) {
    return currentDepth;
  }
  return Math.max(
    ...node.children.map(c => calculateDomHeight(c, currentDepth + 1))
  );
}

// Element pruning: merge/simplify container nodes by depth and k
function D2SnapElement(node, k, totalHeight, currentDepth) {
  if (!node || !node.tag) return;

  const mergeDepth = Math.max(1, Math.floor(k * totalHeight));

  if (currentDepth % mergeDepth !== 0) {
    return;
  }

  if (
    node.children &&
    node.children.length === 1 &&
    D2SNAP_ELEMENT_RATINGS[node.children[0].tag?.toLowerCase()]?.class === 'container'
  ) {
    const child = node.children[0];

    if (node.className && child.className) {
      child.className = node.className + ' ' + child.className;
    } else if (node.className) {
      child.className = node.className;
    }

    if (node.id && !child.id) {
      child.id = node.id;
    }

    Object.assign(node, child);
  }
}

// Downsample long text content by ratio l
function D2SnapText(text, l) {
  if (!text || text.length < 50) {
    return text;
  }

  const sentences = text
    .split(/[。!?.!?]/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length <= 1) {
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  }

  const scored = sentences.map((sentence, idx) => {
    let score = 0;

    score += Math.min(sentence.length / 10, 5);

    if (idx === 0) score += 3; // 第一句
    if (idx === sentences.length - 1) score += 2; // 最後一句

    const keywords = ['登入', 'login', '密碼', 'password', '帳號', 'username',
                     '驗證', 'verify', '重設', 'reset'];
    keywords.forEach(kw => {
      if (sentence.toLowerCase().includes(kw.toLowerCase())) {
        score += 2;
      }
    });

    return { sentence, score, idx };
  });

  scored.sort((a, b) => b.score - a.score);

  const keepCount = Math.max(1, Math.ceil(sentences.length * (1 - l)));
  const kept = scored.slice(0, keepCount);

  kept.sort((a, b) => a.idx - b.idx);

  let result = kept.map(s => s.sentence).join('。');

  if (result.length > 80) {
    result = result.substring(0, 80) + '...';
  }

  return result;
}

// Serialize the simplified DOM tree into JSON for GPT (styleDelta/bbox/icon)
function serializeSimplifiedDom(node, depth = 0) {
  if (!node || !node.tag) return null;

  const result = {
    tag: node.tag
  };

  if (node.id) result.id = node.id;
  if (node.className) result.class = node.className;
  if (node.type) result.type = node.type;
  if (node.name) result.name = node.name;
  if (node.placeholder) result.placeholder = node.placeholder;
  if (node.role) result.role = node.role;
  if (node.ariaLabel) result['aria-label'] = node.ariaLabel;
  if (node.href) result.href = node.href;
  if (node.src) result.src = node.src;

  if (node.text && node.text.length > 0) {
    result.text = node.text;
  }

  if (node.styleDelta) {
    result.styleDelta = node.styleDelta;
  } else if (node.computedStyle) {
    result.styleDelta = node.computedStyle;
  }

  if (node.bbox && (node.bbox.width > 0 || node.bbox.height > 0)) {
    result.bbox = node.bbox;
  }

  if (node.isIcon) {
    result.isIcon = true;
    if (node.iconClass) result.iconClass = node.iconClass;
  }

  if (node.children && node.children.length > 0) {
    const serializedChildren = node.children
      .map(child => serializeSimplifiedDom(child, depth + 1))
      .filter(c => c !== null);

    if (serializedChildren.length > 0) {
      result.children = serializedChildren;
    }
  }

  return result;
}

// Build the GPT prompt for override CSS from the variant template and simplified DOM
function buildCssPromptWithSimplifiedDom(simplifiedDom, variant) {
  const v = VARIANT_PROMPTS[variant];
  const uiConfig = v.ui_manipulation;

  const domJson = JSON.stringify(simplifiedDom, null, 2);

  return `You are an HCI research frontend engineer creating CSS for a
phishing research stimulus.

## Experimental Condition
- Variant: ${variant} - ${v.name}
- Literature basis: ${v.literature}
- UI manipulation type: ${uiConfig.type}
- Research purpose: ${uiConfig.description}

## Manipulation Requirements
${uiConfig.css_requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Simplified Page DOM (full structure)

The DOM below was produced by a CSS-oriented simplification pipeline:
1. GPT-4o dynamic rating (per-page tag/attribute scoring)
2. Two-stage adaptive pruning (node threshold theta_tag, attribute threshold theta_attr)
3. computedStyle inheritance compression (only per-node style deltas kept)

Each element may include:
- tag: HTML tag name
- id, class: CSS selectors
- type, name, placeholder: form attributes
- text: visible text content
- styleDelta: style properties that differ from the parent element. Properties
  equal to the parent are omitted and inherited from the nearest ancestor that
  defines them.
- bbox: position and size {x, y, width, height}
- isIcon: true if Font Awesome icon
- children: nested elements

Reference the styleDelta and bbox fields to understand each element's appearance.
A property absent from an element's styleDelta is inherited from its ancestors.

\`\`\`json
${domJson}
\`\`\`

## Absolute Rules
1. ONLY use selectors that appear in the DOM above (id, class, tag, attributes)
2. ALL properties must use !important
3. Reference the 'style' field to understand original appearance
4. Use 'bbox' for positioning context if needed
5. NO Chinese characters anywhere (including comments)
6. NO markdown formatting in output
7. Output PURE JSON only
8. Use single quotes for CSS string values inside the JSON
9. CSS property values must NOT be wrapped in quotes. Write: color: #888888 NOT color: '#888888'
10. hue-rotate() is a filter function, not a transform function. Use: filter: hue-rotate(Xdeg) NOT transform: hue-rotate(Xdeg)

## Output Format (pure JSON, nothing else)
{"css":"/* Variant ${variant} */\\n.your-selector { property: value !important; }"}

Now generate the CSS JSON for variant ${variant}:`;
}

// Site pipeline: fetch, rate, prune, compress, serialize, fix icons, store final HTML
function runSiteAnalysisPipeline() {
  Logger.log('\n=== Site Analysis Pipeline (D2Snap-CSS) ===\n');

  const props = PropertiesService.getScriptProperties();

  const KEEP_KEYS = [
    'TARGET_LOGIN_URL', 'CLOUD_RUN_URL', 'CLOUD_RUN_API_KEY',
    'OPENAI_API_KEY', 'GOPHISH_API_URL', 'GOPHISH_API_KEY',
    'PHISHING_URL', 'WEB_APP_URL', 'VARIANT_COUNTER'
  ];
  const allProps = props.getProperties();
  let removedCount = 0;
  Object.keys(allProps).forEach(function(key) {
    if (KEEP_KEYS.indexOf(key) === -1) {
      props.deleteProperty(key);
      removedCount++;
    }
  });
  Logger.log(' 舊快取已清除（移除 ' + removedCount + ' 個快取 key，保留設定）\n');

  const targetUrl = props.getProperty('TARGET_LOGIN_URL');
  if (!targetUrl) return { success: false, error: 'TARGET_LOGIN_URL not set' };

  Logger.log(' 步驟 1: Cloud Run 抓取頁面');
  const cloudRunResult = extractDomWithCloudRun(targetUrl);
  if (!cloudRunResult.success) {
    return { success: false, error: 'Cloud Run failed: ' + cloudRunResult.error };
  }
  const originalNodeCount = countDomNodes(cloudRunResult.domTree);
  Logger.log(` HTML 長度: ${cloudRunResult.renderedHtml.length}`);
  Logger.log(` DOM 節點數: ${originalNodeCount}`);

  const dynamicTables = generateDynamicRatingTables(cloudRunResult.domTree);
  if (dynamicTables) {
    D2SNAP_ELEMENT_RATINGS = dynamicTables.elementRatings;
    D2SNAP_ATTRIBUTE_RATINGS = dynamicTables.attributeRatings;
    Logger.log(' 已套用 GPT 動態評分表');
  } else {
    Logger.log(' 沿用硬編碼 fallback 評分表');
  }

  Logger.log('\n 步驟 2: 雙維度自適應壓縮（θtag/θattr）');
  const simplifiedDom = applyD2Snap(cloudRunResult.domTree, D2SNAP_PARAMS);
  if (!simplifiedDom) return { success: false, error: 'D2Snap failed' };
  const afterD2Snap = countDomNodes(simplifiedDom);
  Logger.log(` 原始節點: ${originalNodeCount}`);
  Logger.log(` D2Snap 後: ${afterD2Snap} (-${Math.round((1 - afterD2Snap/originalNodeCount) * 100)}%)`);

  Logger.log('\n 步驟 2.5: computedStyle 繼承式壓縮（styleDelta）');
  compressStyleDelta(simplifiedDom, {});
  Logger.log(' styleDelta 壓縮完成');

  Logger.log('\n 步驟 3: 序列化並儲存簡化 DOM');
  const serialized = serializeSimplifiedDom(simplifiedDom);
  const serializedStr = JSON.stringify(serialized);
  const chunkSize = 8000;
  const domChunks = Math.ceil(serializedStr.length / chunkSize);
  props.setProperty('SIMPLIFIED_DOM_CHUNKS', String(domChunks));
  for (let i = 0; i < domChunks; i++) {
    props.setProperty('SIMPLIFIED_DOM_' + i,
      serializedStr.substring(i * chunkSize, (i + 1) * chunkSize));
  }
  Logger.log(` 簡化 DOM 已儲存 (${domChunks} 段, ${serializedStr.length} 字元)`);

  Logger.log('\n 步驟 4: GPT Vision 分析截圖');
  const visionResult = analyzeScreenshotWithVision(
    cloudRunResult.screenshotBase64,
    cloudRunResult.renderedHtml
  );
  if (!visionResult) return { success: false, error: 'Vision analysis failed' };
  Logger.log(` Icon map: ${visionResult.icon_map?.length || 0} 個`);

  Logger.log('\n 步驟 5: 修復 HTML 資源');
  const baseUrl = targetUrl.match(/^(https?:\/\/[^\/]+)/)[1];
  const fixedHtml = applyHtmlFixes(cloudRunResult.renderedHtml, visionResult, baseUrl);

  Logger.log('\n 步驟 6: 儲存最終 HTML');
  props.setProperty('SITE_ANALYSIS', JSON.stringify({
    timestamp: new Date().toISOString(),
    targetUrl: targetUrl,
    iconCount: (visionResult && visionResult.icon_map) ? visionResult.icon_map.length : 0,
    htmlLength: fixedHtml.length,
    simplificationStats: {
      originalNodes: originalNodeCount,
      afterD2Snap: afterD2Snap,
      reductionRate: Math.round((1 - afterD2Snap/originalNodeCount) * 100)
    }
  }));

  const htmlChunks = Math.ceil(fixedHtml.length / chunkSize);
  props.setProperty('FIXED_HTML_CHUNKS', String(htmlChunks));
  for (let i = 0; i < htmlChunks; i++) {
    props.setProperty('FIXED_HTML_' + i,
      fixedHtml.substring(i * chunkSize, (i + 1) * chunkSize));
  }
  Logger.log(` HTML 已儲存 (${htmlChunks} 段)`);

  return {
    success: true,
    htmlLength: fixedHtml.length,
    domNodes: afterD2Snap,
    reductionRate: Math.round((1 - afterD2Snap/originalNodeCount) * 100),
    visionIcons: visionResult.icon_map?.length || 0
  };
}

// Clear site analysis cache from Properties to free storage
function clearAllSiteCache() {
  const props = PropertiesService.getScriptProperties();

  const chunks = parseInt(props.getProperty('FIXED_HTML_CHUNKS') || '0');
  for (let i = 0; i < chunks; i++) {
    props.deleteProperty('FIXED_HTML_' + i);
  }
  props.deleteProperty('FIXED_HTML_CHUNKS');

  props.deleteProperty('SITE_ANALYSIS');
  props.deleteProperty('VISION_ICON_MAP');
  props.deleteProperty('LOGIN_SUBGRAPH');
  props.deleteProperty('LOGIN_SUBGRAPH_SOURCE');
  props.deleteProperty('SITE_COLOR_SCHEME');

  const ssChunks = parseInt(props.getProperty('SCREENSHOT_CHUNKS') || '0');
  for (let i = 0; i < ssChunks; i++) {
    props.deleteProperty('SCREENSHOT_' + i);
  }
  props.deleteProperty('SCREENSHOT_CHUNKS');

  Logger.log(' 所有网站缓存已清除');
}

// Send a single phishing email to a specified address
function sendToSpecificEmail() {
  const email = 'YOUR_TARGET_EMAIL@example.com'; // 改成目標 email
  const firstName = '同學'; // 改成姓名
  const variant = 'E'; // 變體 A/B/C/D/E

  const rid = Utilities.getUuid();
  const timestamp = new Date();

  Logger.log(` 目標: ${email} | 姓名: ${firstName} | 變體: ${variant} | RID: ${rid}`);

  const formData = {
rid: rid,
    firstName: firstName,
    lastName: '',
    role: '大學',
    moodleUsage: '幾乎不用',
    securityTraining: '有',
    urgencySusceptibility: 3,
    checkSender: 5,
    checkUrl: 5,
    selfConfidence: 5,
    suspiciousHandling: '刪除',
    comments: '補發',
    variant: variant
  };

  const bqResult = writePreSurveyToBigQuery(email, formData, timestamp);
  Logger.log(' BigQuery: ' + (bqResult.success ? '' : ' ' + bqResult.error));

  const result = runPhishingWithGPT(email, firstName, '', variant, rid);

  if (result.success) {
    Logger.log(' 成功！Campaign: ' + result.name + ' | RID: ' + rid);
  } else {
    Logger.log(' 失敗: ' + result.error);
  }
}

// Read the serialized simplified DOM from chunked Properties cache
function getSimplifiedDom() {
  const props = PropertiesService.getScriptProperties();
  const chunks = parseInt(props.getProperty('SIMPLIFIED_DOM_CHUNKS') || '0');

  if (chunks === 0) {
    Logger.log(' 找不到 SIMPLIFIED_DOM 快取');
    return null;
  }

  let str = '';
  for (let i = 0; i < chunks; i++) {
    str += props.getProperty('SIMPLIFIED_DOM_' + i) || '';
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    Logger.log(' SIMPLIFIED_DOM 解析失敗: ' + e.toString());
    return null;
  }
}


// ============================================
// UPDATE NOTES
// ============================================
// Pipeline: fetch page (Cloud Run) -> GPT dynamic tag/attribute rating
//   -> DOM pruning (theta_tag=0.3, theta_attr=0.5) -> styleDelta compression
//   -> serialize -> Vision icon fix -> store final HTML -> generate override
//   CSS per variant -> inject CSS + tracking -> send via GoPhish.
//
// Rating tables are generated per page at runtime; static tables are used
//   only as a fallback when generation fails.
//
// styleDelta: a node keeps only the style properties that differ from its
//   parent; identical values are dropped and inherited.
//
// CSS cleaner protects url() contents and fixes broken URL protocols.
//
// Only two test helpers are kept: diagnoseGoPhishConnection and
//   testBigQueryConnection. Personal emails are placeholders
//   (YOUR_ADMIN_EMAIL@example.com / YOUR_TARGET_EMAIL@example.com);
//   set real values before use. API keys and URLs are read from
//   Script Properties.
// ============================================
