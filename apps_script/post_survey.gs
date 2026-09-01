const CONFIG = {
  REPORT_SENDER_NAME: '台師大資安訓練系統',
  REPORT_SUBJECT: ' 個人化資安風險評估報告'
};
const BIGQUERY_CONFIG = {
  PROJECT_ID: 'YOUR_GCP_PROJECT_ID',
  DATASET_ID: 'YOUR_BIGQUERY_DATASET',
  EVENTS_TABLE: 'user_events',
  PRE_SURVEY_TABLE: 'pre_survey',
  POST_SURVEY_TABLE: 'post_survey'
};

const VARIANT_PROMPTS = {
  A: {
    name: "高可信外觀（Professional UI）",
    email: "高質感 UI、標準格式、看起來非常正式的通知信"
  },
  B: {
    name: "中可信（Neutral UI）",
    email: "一般行政通知樣式，中性語氣"
  },
  C: {
    name: "弱可信（Poor UI / 錯字）",
    email: "存在明顯錯字、不一致排版、低品質 Logo"
  },
  D: {
    name: "緊急詐騙風格（Urgent tone）",
    email: "大量使用急迫語氣、令人慌張的提示訊息"
  }
};
// Post-survey form submit trigger: parse, store, and generate the report
function onPostSurveySubmit(e) {
  try {
    Logger.log('=== 開始處理後測問卷 ===');

    if (!e || !e.response) {
      Logger.log(' 觸發器錯誤');
      return;
    }

    const email = e.response.getRespondentEmail();
    const items = e.response.getItemResponses();
    const timestamp = new Date();

    Logger.log(` Email: ${email || '未收集'}`);

    if (!email) {
      Logger.log(' 未收集到電子郵件地址');
      logReportSent('NO_EMAIL', 'ERROR: 表單未收集 Email');
      return;
    }

    Logger.log(' 開始解析問卷...');
    const postData = parsePostSurvey(items, email, timestamp);

    try {
      const bqResult = writePostSurveyToBigQuery(postData);
      Logger.log(` BigQuery: ${bqResult.success ? '' : ' ' + bqResult.error}`);
    } catch (bqError) {
      Logger.log(' BigQuery 寫入失敗（不影響報告生成）: ' + bqError.toString());
    }

    Logger.log(` 開始為 ${email} 生成報告...`);

    const report = generatePersonalizedReportDirect(email, postData);

    if (report.success) {
      const emailSent = sendReportEmail(email, report.html, report.summary);

      if (emailSent) {
        Logger.log(' 報告已成功寄出');
        logReportSent(email, 'SUCCESS');
      } else {
        Logger.log(' 報告寄送失敗');
        logReportSent(email, 'FAILED: 郵件寄送失敗');
      }

    } else {
      Logger.log(` 報告生成失敗: ${report.error}`);
      logReportSent(email, 'FAILED: ' + report.error);

      if (CONFIG.ADMIN_EMAIL) {
        MailApp.sendEmail(
          CONFIG.ADMIN_EMAIL,
          ' 報告生成失敗',
          `受測者: ${email}\n錯誤: ${report.error}\n時間: ${new Date().toLocaleString('zh-TW')}`
        );
      }
    }

    Logger.log('=== 後測問卷處理完成 ===\n');

  } catch (error) {
    Logger.log(' 致命錯誤: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);

    try {
      logReportSent('FATAL_ERROR', error.toString());

      if (CONFIG.ADMIN_EMAIL) {
        MailApp.sendEmail(
          CONFIG.ADMIN_EMAIL,
          ' 後測系統錯誤',
          `錯誤: ${error.toString()}\n\nStack:\n${error.stack}`
        );
      }
    } catch (e) {
      Logger.log('連記錄錯誤都失敗了: ' + e.toString());
    }
  }
}

// Generate the personalized report directly from parsed post-survey data
function generatePersonalizedReportDirect(email, postData) {
  try {
    Logger.log(` 開始為 ${email} 生成報告...`);

    const preData = getPreSurveyData(email);
    if (!preData) {
      Logger.log(' 找不到前測資料');
      Logger.log('');
      Logger.log(' 可能原因：');
      Logger.log('  1. 此 Email 尚未完成前測問卷');
      Logger.log('  2. 前測問卷使用不同的 Email');
      Logger.log('  3. BigQuery 前測資料表為空');
      Logger.log('');
      Logger.log(` 建議：檢查 ${email} 是否已完成前測`);

      return { success: false, error: '找不到前測資料' };
    }

    Logger.log(' 前測資料撈取完成');
    Logger.log(`  變體: ${preData.variant_assigned}`);
    Logger.log(`  前測信心: ${preData.self_confidence}/5`);

    Logger.log(' 使用剛提交的後測資料');
    Logger.log(`  警覺提升: ${postData.awareness_improvement}/5`);
    Logger.log(`  真實度: ${postData.realism_score}/5`);

    Logger.log(' 撈取網頁行為數據...');
    const behaviorData = getUserBehaviorData(email);

    if (behaviorData && behaviorData.dwell_time) {
      postData.dwell_time = behaviorData.dwell_time;
      postData.mouse_activity_score = behaviorData.mouse_activity_score;
      Logger.log(` 網頁行為數據: 停留 ${postData.dwell_time} 秒, 活動分數 ${postData.mouse_activity_score}`);
    } else {
      Logger.log(' 找不到網頁行為數據，將使用 N/A');
      postData.dwell_time = null;
      postData.mouse_activity_score = null;
    }

    Logger.log(' 呼叫 GPT 生成報告...');
    const gptReport = generateReportWithGPT(preData, postData);

    if (!gptReport.success) {
      return { success: false, error: 'GPT 生成失敗: ' + gptReport.error };
    }

    Logger.log(' GPT 報告生成完成');
    Logger.log(`  風險等級: ${gptReport.content.risk_level || 'N/A'}`);
    Logger.log(`  風險分數: ${gptReport.content.risk_score || 'N/A'}/100`);

    const htmlReport = buildReportHTML(preData, postData, gptReport.content);

    Logger.log(' 報告生成完成');

    return {
      success: true,
      html: htmlReport,
      summary: gptReport.content.summary || '報告已生成'
    };

  } catch (error) {
    Logger.log(' 報告生成錯誤: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Parse post-survey form items into a structured object
function parsePostSurvey(items, email, timestamp) {
  const data = {
    email: email,
    timestamp: timestamp.toISOString(),
    suspicious_elements: [],
    near_click_score: null,
    page_trust_score: null,
    recognition_reason: [],
    awareness_improvement: null,
    preferred_learning: null,
    realism_score: null
  };

  for (let i = 0; i < items.length; i++) {
    const question = items[i].getItem().getTitle().trim();
    const answer = items[i].getResponse();

    Logger.log(`Q: ${question}`);
    Logger.log(`A: ${answer}`);

    const q = question;

    if (q.includes("最可疑的地方")) {
      data.suspicious_elements = Array.isArray(answer) ? answer : [answer];
    }

    else if (q.includes("多接近點擊") || q.includes("輸入密碼")) {
      data.near_click_score = parseInt(answer) || null;
    }

    else if (q.includes("可信度如何")) {
      data.page_trust_score = parseInt(answer) || null;
    }

    else if (q.includes("意識到是假網站")) {
      data.recognition_reason = Array.isArray(answer) ? answer : [answer];
    }

    else if (q.includes("警覺性") && q.includes("提升")) {
      data.awareness_improvement = parseInt(answer) || null;
    }

    else if (q.includes("加強") && q.includes("反詐騙")) {
      data.preferred_learning = answer;
    }

    else if (q.includes("真實度")) {
      data.realism_score = parseInt(answer) || null;
    }
  }

  Logger.log(" 問卷解析完成");
  return data;
}

// Write post-survey data to the BigQuery post_survey table
function writePostSurveyToBigQuery(postData) {
  try {
    const row = {
      email: postData.email,
      timestamp: postData.timestamp,
      detected_suspicious: postData.detected_suspicious,
      self_reported_click: postData.self_reported_click,
      self_reported_submit: postData.self_reported_submit,
      suspicious_elements: postData.suspicious_elements,
      near_click_score: postData.near_click_score,
      page_trust_score: postData.page_trust_score,
      recognition_reason: postData.recognition_reason,
      awareness_improvement: postData.awareness_improvement,
      preferred_learning: postData.preferred_learning,
      realism_score: postData.realism_score,
      feedback_comments: postData.feedback_comments,
      variant_received: postData.variant_received,
      campaign_id: postData.campaign_id
    };

    const request = {
      rows: [{
        insertId: `${postData.email}_post_${new Date().getTime()}`,
        json: row
      }]
    };

    BigQuery.Tabledata.insertAll(
      request,
      BIGQUERY_CONFIG.PROJECT_ID,
      BIGQUERY_CONFIG.DATASET_ID,
      BIGQUERY_CONFIG.POST_SURVEY_TABLE
    );

    Logger.log(' Post-survey 寫入 BigQuery 成功');
    return { success: true };

  } catch (error) {
    Logger.log(' BigQuery 寫入錯誤: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Generate the personalized risk report for a given email
function generatePersonalizedReport(email) {
  try {
    Logger.log(` 開始為 ${email} 生成報告...`);

    const preData = getPreSurveyData(email);
    if (!preData) {
      return { success: false, error: '找不到前測資料' };
    }

    const postData = getPostSurveyData(email);
    if (!postData) {
      return { success: false, error: '找不到後測資料' };
    }

    Logger.log(' 資料撈取完成');
    Logger.log(`  變體: ${preData.variant_assigned}`);
    Logger.log(`  前測信心: ${preData.self_confidence}/5`);
    Logger.log(`  後測警覺提升: ${postData.awareness_improvement}/5`);

    Logger.log(' 撈取網頁行為數據...');
    const behaviorData = getUserBehaviorData(email);

    if (behaviorData && behaviorData.dwell_time) {
      postData.dwell_time = behaviorData.dwell_time;
      postData.mouse_activity_score = behaviorData.mouse_activity_score;
      Logger.log(` 停留時間: ${postData.dwell_time} 秒`);
    } else {
      Logger.log(' 找不到網頁行為數據');
      postData.dwell_time = null;
    }

    const gptReport = generateReportWithGPT(preData, postData);

    if (!gptReport.success) {
      return { success: false, error: 'GPT 生成失敗: ' + gptReport.error };
    }

    const htmlReport = buildReportHTML(preData, postData, gptReport.content);

    Logger.log(' 報告生成完成');

    return {
      success: true,
      html: htmlReport,
      summary: gptReport.content.summary
    };

  } catch (error) {
    Logger.log(' 報告生成錯誤: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Fetch pre-survey data for an email from BigQuery
function getPreSurveyData(email) {
  try {
    const query = `
      SELECT *
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.PRE_SURVEY_TABLE}\`
      WHERE email = '${email}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const request = {
      query: query,
      useLegacySql: false,
      timeoutMs: 30000  //  新增：等待最多 30 秒
    };

    const result = BigQuery.Jobs.query(request, BIGQUERY_CONFIG.PROJECT_ID);

    if (!result.jobComplete) {
      Logger.log(' 查詢未在時限內完成，結果可能不完整');
    }

    if (!result.rows || result.rows.length === 0) {
      Logger.log(' 找不到前測資料');
      return null;
    }

    const row = result.rows[0];
    const schema = result.schema.fields;
    const data = {};

    for (let i = 0; i < schema.length; i++) {
      data[schema[i].name] = row.f[i].v;
    }

    return data;

  } catch (error) {
    Logger.log(' 撈取前測資料錯誤: ' + error.toString());
    return null;
  }
}

// Fetch post-survey data for an email from BigQuery
function getPostSurveyData(email) {
  try {
    const query = `
      SELECT *
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.POST_SURVEY_TABLE}\`
      WHERE email = '${email}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const request = {
      query: query,
      useLegacySql: false,
      timeoutMs: 30000  //  新增：等待最多 30 秒
    };

    const result = BigQuery.Jobs.query(request, BIGQUERY_CONFIG.PROJECT_ID);

    if (!result.jobComplete) {
      Logger.log(' 後測查詢未在時限內完成，結果可能不完整');
    }

    if (!result.rows || result.rows.length === 0) {
      Logger.log(' 找不到後測資料');
      return null;
    }

    const row = result.rows[0];
    const schema = result.schema.fields;
    const data = {};

    for (let i = 0; i < schema.length; i++) {
      data[schema[i].name] = row.f[i].v;
    }

    return data;

  } catch (error) {
    Logger.log(' 撈取後測資料錯誤: ' + error.toString());
    return null;
  }
}
// Fetch tracked behavior data for an email from BigQuery
function getUserBehaviorData(email) {
  try {
    Logger.log(` 查詢 ${email} 的網頁行為數據...`);

    const ridQuery = `
      SELECT rid
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.PRE_SURVEY_TABLE}\`
      WHERE email = '${email}'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const ridRequest = {
      query: ridQuery,
      useLegacySql: false,
      timeoutMs: 30000  //  新增：等待最多 30 秒
    };

    const ridResult = BigQuery.Jobs.query(ridRequest, BIGQUERY_CONFIG.PROJECT_ID);

    if (!ridResult.jobComplete) {
      Logger.log(' RID 查詢未在時限內完成，結果可能不完整');
    }

    if (!ridResult.rows || ridResult.rows.length === 0) {
      Logger.log(' 找不到此 Email 的 RID（可能未完成前測）');
      return null;
    }

    const rid = ridResult.rows[0].f[0].v;
    Logger.log(` 找到 RID: ${rid}`);

    const query = `
      SELECT
        JSON_EXTRACT_SCALAR(event_data, '$.dwell_time_seconds') AS dwell_time,
        JSON_EXTRACT_SCALAR(event_data, '$.mouse_activity_score') AS mouse_activity_score
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASET_ID}.${BIGQUERY_CONFIG.EVENTS_TABLE}\`
      WHERE rid = '${rid}'
        AND event_type IN ('HIDDEN', 'LEAVE', 'SUBMIT')
        AND JSON_EXTRACT_SCALAR(event_data, '$.dwell_time_seconds') IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const request = {
      query: query,
      useLegacySql: false,
      timeoutMs: 30000  //  新增：等待最多 30 秒
    };

    const result = BigQuery.Jobs.query(request, BIGQUERY_CONFIG.PROJECT_ID);

    if (!result.jobComplete) {
      Logger.log(' 行為數據查詢未在時限內完成，結果可能不完整');
    }

    if (!result.rows || result.rows.length === 0) {
      Logger.log(' 找不到此 RID 的網頁行為數據');
      Logger.log('   可能原因：');
      Logger.log('   1. 受測者未實際訪問釣魚頁面');
      Logger.log('   2. 追蹤腳本未正確觸發');
      Logger.log('   3. sendBeacon/fetch 失敗');
      return null;
    }

    const row = result.rows[0];
    const dwellTime = parseFloat(row.f[0].v) || null;
    const mouseScore = parseInt(row.f[1].v) || null;

    Logger.log(` 找到網頁行為數據:`);
    Logger.log(`   停留時間: ${dwellTime} 秒`);
    Logger.log(`   滑鼠活動: ${mouseScore}`);

    return {
      dwell_time: dwellTime,
      mouse_activity_score: mouseScore
    };

  } catch (error) {
    Logger.log(' 撈取行為數據錯誤: ' + error.toString());
    return null;
  }
}
// Use GPT to generate the report content from survey and behavior data
function generateReportWithGPT(preData, postData) {
  try {
    const variant = preData.variant_assigned || 'B';
    const variantName = VARIANT_PROMPTS[variant]?.name || '標準通知';

    const prompt = `你是具備網路安全心理學背景的專業分析師。請根據以下資料生成一份「個人化資安認知診斷報告」，基於 Heuristic-Systematic Model (HSM) 和 Protection Motivation Theory (PMT) 進行分析。

**受測者背景（前測問卷）**
- 姓名：${preData.first_name || ''} ${preData.last_name || ''}
- 身分：${preData.role || '未提供'}
- Moodle 使用頻率：${preData.moodle_usage || '未提供'}
- 資安訓練經驗：${preData.security_training || '無'}
- 緊急性易感度：${preData.urgency_susceptibility || 'N/A'}/5
- 檢查寄件者習慣：${preData.check_sender || 'N/A'}/5
- 檢查網址習慣：${preData.check_url || 'N/A'}/5
- 初始辨識信心：${preData.self_confidence || 'N/A'}/5

**訓練情境**
- 分配變體：${variant} - ${variantName}
- 變體描述：${VARIANT_PROMPTS[variant]?.email || '標準通知郵件'}

**後測表現（後測問卷）**
- 是否察覺異常：${postData.detected_suspicious || '未填寫'}
- 是否點擊連結：${postData.self_reported_click || '未填寫'}
- 是否輸入帳密：${postData.self_reported_submit || '未填寫'}
- 差點點擊程度：${postData.near_click_score || 'N/A'}/5
- 頁面可信度：${postData.page_trust_score || 'N/A'}/5
- 察覺的可疑特徵：${postData.suspicious_elements?.join(', ') || '無'}
- 辨識方法：${postData.recognition_reason?.join(', ') || '無'}
- 警覺性提升：${postData.awareness_improvement || 'N/A'}/5
- 真實感評分：${postData.realism_score || 'N/A'}/5
- 頁面停留時間：${postData.dwell_time || 'N/A'} 秒

**請生成以下內容（JSON 格式）：**

1. **cognitive_profile**（100字）：
   基於 HSM 理論分析受測者的認知處理模式：
   - 若急迫感高且停留時間短：診斷為「啟發式處理」（Heuristic Processing）
   - 若停留時間長且檢查習慣佳：診斷為「系統性處理」（Systematic Processing）
   - 分析受測者在壓力下的決策傾向

2. **metacognitive_gap**（80字）：
   對比「初始信心」與「實際偵測能力」：
   - 若信心高但未發現線索：指出 Dunning-Kruger 效應風險
   - 若信心低但成功辨識：鼓勵建立自我效能感
   - 量化「自我認知」與「真實能力」的差距

3. **visual_cue_analysis**（120字）：
   針對「${variantName}」變體的視覺線索分析：
   - 列出此變體設計的異常特徵（如：Logo、網址、色彩、版面）
   - 分析哪些線索被受測者識別，哪些被忽略
   - 解釋為何特定線索容易被漏看（如：急迫性分散注意力）

4. **decision_path**（字串）："啟發式處理" / "系統性處理" / "混合模式"
   基於行為數據判斷受測者的主要決策路徑

5. **threat_perception**（字串）："低" / "中" / "高"
   基於 PMT 理論評估受測者的威脅感知能力

6. **behavioral_recommendations**（陣列，4項）：
   提供基於理論的具體建議：
   - 針對啟發式處理者：建議「強制停頓策略」
   - 針對系統性處理者：提供「進階辨識技巧」
   - 每項建議需可操作且具體（如：登入前先核對 URL 頂級網域）

7. **cognitive_strengths**（陣列，2-3項）：
   從認知角度肯定受測者的優勢
   - 例：展現良好的元認知監控、能抵禦時間壓力等

8. **cognitive_vulnerabilities**（陣列，2-3項）：
   指出認知弱點而非行為結果
   - 例：對權威線索過度信任、急迫性分散注意力等

9. **learning_pathway**（150字）：
   根據 preferred_learning 和認知特徵推薦學習資源：
   - 影片學習者：推薦視覺化解構釣魚郵件的教材
   - 閱讀學習者：推薦結構化的偵測指南
   - 實作學習者：推薦互動式模擬訓練

**輸出格式（嚴格 JSON，無 markdown）：**
{
  "cognitive_profile": "...",
  "metacognitive_gap": "...",
  "visual_cue_analysis": "...",
  "decision_path": "啟發式處理",
  "threat_perception": "中",
  "behavioral_recommendations": ["...", "...", "...", "..."],
  "cognitive_strengths": ["...", "..."],
  "cognitive_vulnerabilities": ["...", "..."],
  "learning_pathway": "..."
}`;

    const response = callGPT(prompt, 1000);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const content = safeParseJSON(response.text);
    Logger.log(' GPT 認知診斷報告生成成功');
    return { success: true, content: content };

  } catch (error) {
    Logger.log(' GPT 報告生成錯誤: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Build the HTML body of the personalized report
function buildReportHTML(preData, postData, gptContent) {

  const name = `${preData.first_name || ''} ${preData.last_name || ''}`.trim() || '受測者';
  const variant = preData.variant_assigned || 'B';
  const variantName = VARIANT_PROMPTS[variant]?.name || '標準通知';

  const pathLabels = {
    '啟發式處理': 'Heuristic Processing',
    '系統性處理': 'Systematic Processing',
    '混合模式':   'Mixed Mode'
  };
  const pathLabel = pathLabels[gptContent.decision_path] || 'Mixed Mode';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500&display=swap');

body {
  font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
  background: #f0ebe0;
  margin: 0;
  padding: 30px 20px;
  line-height: 1.8;
  color: #3a3530;
}

.container {
  background: #faf8f5;
  max-width: 900px;
  margin: 0 auto;
  border: 0.5px solid #d6cfc4;
}

.header {
  background: #faf8f5;
  border-bottom: 1px solid #c9a96e;
  text-align: center;
  padding: 52px 40px 40px;
}

.header h1 {
  font-size: 22px;
  font-weight: 400;
  color: #3a3530;
  letter-spacing: 4px;
  margin: 0 0 12px 0;
}

.subtitle {
  font-size: 12px;
  color: #9a9088;
  letter-spacing: 2px;
  margin: 5px 0;
  font-weight: 300;
}

.academic-badge {
  display: inline-block;
  border: 0.5px solid #c9a96e;
  color: #9a7a50;
  padding: 5px 18px;
  margin-top: 18px;
  font-size: 11px;
  letter-spacing: 1px;
}

.decorative-line {
  width: 50px;
  height: 1px;
  background: #c9a96e;
  margin: 18px auto;
}

.section-divider {
  border: none;
  height: 1px;
  background: #e8e2d8;
  margin: 36px 0;
}

.content { padding: 44px 52px; }

.cognitive-dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 28px 0;
}

.cognitive-card {
  background: #fdfcf9;
  border: 0.5px solid #ddd8d0;
  border-top: 2px solid #c9a96e;
  padding: 28px;
  text-align: center;
}

.cognitive-label {
  font-size: 10px;
  color: #9a9088;
  letter-spacing: 2.5px;
  margin-bottom: 12px;
  font-weight: 400;
  text-transform: uppercase;
}

.cognitive-value {
  font-size: 20px;
  font-weight: 400;
  color: #3a3530;
  margin-bottom: 6px;
}

.cognitive-sublabel {
  font-size: 11px;
  color: #b0a898;
  font-style: italic;
}

.info-card {
  background: #fdfcf9;
  border: 0.5px solid #ddd8d0;
  padding: 28px 30px;
  margin: 24px 0;
}

.info-card.highlight {
  border-left: 2px solid #c9a96e;
}

.card-title {
  font-size: 12px;
  color: #9a7a50;
  font-weight: 400;
  letter-spacing: 2px;
  margin-bottom: 22px;
  padding-bottom: 14px;
  border-bottom: 0.5px solid #e8e2d8;
  display: flex;
  align-items: center;
  text-transform: uppercase;
}

.theory-badge {
  display: inline-block;
  border: 0.5px solid #c9a96e;
  color: #9a7a50;
  padding: 2px 10px;
  font-size: 10px;
  margin-left: auto;
  font-weight: 400;
  letter-spacing: 1px;
}

.analysis-text {
  line-height: 2.1;
  color: #5a5248;
  font-size: 15px;
  padding: 18px 22px;
  background: #f5f0e8;
  border-left: 2px solid #c9a96e;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.data-item {
  padding: 14px 18px;
  background: #f5f0e8;
  border-left: 2px solid #c9a96e;
}

.data-label {
  font-size: 10px;
  color: #9a9088;
  letter-spacing: 2px;
  margin-bottom: 6px;
  font-weight: 400;
  text-transform: uppercase;
}

.data-value {
  font-size: 16px;
  color: #3a3530;
  font-weight: 400;
}

.list-section { margin: 28px 0; }

.list-item {
  padding: 16px 22px;
  margin: 10px 0;
  background: #fdfcf9;
  border: 0.5px solid #ddd8d0;
  border-left: 2px solid #c9a96e;
  line-height: 1.9;
  font-size: 14px;
  color: #5a5248;
}

.strength    { background: #fdfcf9; border-left-color: #c9a96e; }
.vulnerability { background: #fdfcf9; border-left-color: #c9a96e; }
.recommendation { background: #fdfcf9; border-left-color: #c9a96e; }

.visual-analysis {
  background: #f5f0e8;
  border: 0.5px solid #ddd8d0;
  padding: 22px;
  margin: 16px 0;
}

.visual-title {
  font-size: 11px;
  color: #9a7a50;
  letter-spacing: 2px;
  margin-bottom: 14px;
  font-weight: 400;
  text-transform: uppercase;
}

.visual-content {
  line-height: 2;
  color: #5a5248;
  font-size: 14px;
}

.learning-path {
  background: #f5f0e8;
  padding: 22px;
  border-left: 2px solid #c9a96e;
  line-height: 2;
  color: #5a5248;
  font-size: 14px;
}

.footer {
  background: #3a3530;
  color: #c9b99a;
  text-align: center;
  padding: 32px;
  font-size: 12px;
  line-height: 2;
  letter-spacing: 1px;
}

.footer p { margin: 6px 0; }
</style>
</head>

<body>
<div class="container">

  <div class="header">
    <h1>個人化資安認知診斷報告</h1>
    <div class="decorative-line"></div>
    <div class="subtitle">台灣師範大學資安意識訓練系統</div>
    <div class="subtitle">生成時間：${new Date().toLocaleString('zh-TW')}</div>
    <div class="academic-badge">基於 HSM & PMT 理論框架</div>
  </div>

  <div class="content">

    <div class="info-card">
      <div class="card-title">受測者資訊</div>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">姓名</div>
          <div class="data-value">${name}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Email</div>
          <div class="data-value">${preData.email}</div>
        </div>
        <div class="data-item">
          <div class="data-label">身分</div>
          <div class="data-value">${preData.role || '未提供'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">實驗變體</div>
          <div class="data-value">${variant} — ${variantName}</div>
        </div>
      </div>
    </div>

    <div class="cognitive-dashboard">
      <div class="cognitive-card">
        <div class="cognitive-label">決策處理路徑</div>
        <div class="cognitive-value">${gptContent.decision_path}</div>
        <div class="cognitive-sublabel">${pathLabel}</div>
      </div>
      <div class="cognitive-card">
        <div class="cognitive-label">威脅感知能力</div>
        <div class="cognitive-value">${gptContent.threat_perception}</div>
        <div class="cognitive-sublabel">Threat Perception (PMT)</div>
      </div>
    </div>

    <div class="info-card highlight">
      <div class="card-title">
        認知特徵分析
        <span class="theory-badge">HSM Theory</span>
      </div>
      <div class="analysis-text">${gptContent.cognitive_profile}</div>
    </div>

    <div class="info-card highlight">
      <div class="card-title">
        元認知缺口診斷
        <span class="theory-badge">Metacognition</span>
      </div>
      <div class="analysis-text">${gptContent.metacognitive_gap}</div>
    </div>

    <hr class="section-divider">

    <div class="info-card">
      <div class="card-title">針對「${variantName}」的視覺線索分析</div>
      <div class="visual-analysis">
        <div class="visual-title">視覺設計異常特徵</div>
        <div class="visual-content">${gptContent.visual_cue_analysis}</div>
      </div>
    </div>

    <hr class="section-divider">

    <div class="list-section">
      <div class="card-title">您的認知優勢</div>
      ${gptContent.cognitive_strengths.map(s => `
        <div class="list-item strength">${s}</div>
      `).join('')}
    </div>

    <div class="list-section">
      <div class="card-title">需要強化的認知面向</div>
      ${gptContent.cognitive_vulnerabilities.map(v => `
        <div class="list-item vulnerability">${v}</div>
      `).join('')}
    </div>

    <div class="list-section">
      <div class="card-title">
        基於理論的行為建議
        <span class="theory-badge">Evidence-Based</span>
      </div>
      ${gptContent.behavioral_recommendations.map((r, i) => `
        <div class="list-item recommendation">
          <strong>${i + 1}.</strong> ${r}
        </div>
      `).join('')}
    </div>

    <hr class="section-divider">

    <div class="info-card">
      <div class="card-title">前後測認知指標比較</div>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">初始辨識信心</div>
          <div class="data-value">${preData.self_confidence || 'N/A'} / 5</div>
        </div>
        <div class="data-item">
          <div class="data-label">訓練後警覺性提升</div>
          <div class="data-value">${postData.awareness_improvement || 'N/A'} / 5</div>
        </div>
        <div class="data-item">
          <div class="data-label">緊急性易感度</div>
          <div class="data-value">${preData.urgency_susceptibility || 'N/A'} / 5</div>
        </div>
        <div class="data-item">
          <div class="data-label">頁面停留時間</div>
          <div class="data-value">${postData.dwell_time || 'N/A'} 秒</div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-title">個人化學習路徑建議</div>
      <div class="learning-path">${gptContent.learning_pathway}</div>
    </div>

  </div>

  <div class="footer">
    <p>理論基礎　Heuristic-Systematic Model (HSM) & Protection Motivation Theory (PMT)</p>
    <p>此報告由系統基於學術理論自動生成</p>
  </div>

</div>
</body>
</html>
`;

  return html;
}

// Send the report email to the recipient
function sendReportEmail(email, htmlContent, summary) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: CONFIG.REPORT_SUBJECT,
      htmlBody: htmlContent,
      name: CONFIG.REPORT_SENDER_NAME
    });

    Logger.log(` 報告已寄送至 ${email}`);

    if (CONFIG.ADMIN_EMAIL) {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `[副本] ${CONFIG.REPORT_SUBJECT} - ${email}`,
        htmlBody: `<p><strong>受測者：</strong>${email}</p><p><strong>摘要：</strong>${summary}</p><hr>${htmlContent}`,
        name: CONFIG.REPORT_SENDER_NAME
      });
    }

    return true;
  } catch (error) {
    Logger.log(' 郵件寄送失敗: ' + error.toString());
    return false;
  }
}

// Log report send status to a spreadsheet
function logReportSent(email, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('報告記錄');

    if (!sheet) {
      sheet = ss.insertSheet('報告記錄');
      sheet.appendRow(['時間', 'Email', '狀態']);
      sheet.getRange('A1:C1')
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('#fff');
    }

    sheet.appendRow([new Date(), email, status]);

  } catch (error) {
    Logger.log(' Sheet 記錄失敗: ' + error.toString());
  }
}

// Generic OpenAI Chat API call, returns text
function callGPT(prompt, maxTokens) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "你是專業的資安訓練分析模型，負責生成 JSON 格式的個人化評估報告。"
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: maxTokens || 800,
    temperature: 0.3
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.error) {
      return {
        success: false,
        error: result.error.message
      };
    }

    return {
      success: true,
      text: result.choices[0].message.content
    };

  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}
// Safely parse JSON text, tolerating markdown fences
function safeParseJSON(rawText) {
  try {
    let cleaned = rawText.replace(/```json/g, "")
                         .replace(/```/g, "")
                         .trim();

    const firstBrace = cleaned.indexOf("{");
    if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);

    cleaned = cleaned
      .replace(/:\s*([a-zA-Z\- ]+)(,|\n|\r|\s*})/g, function(match, word, end) {
        const num = wordToNumber(word.trim());
        if (num !== null) return `: ${num}${end}`;
        return match;
      });

    return JSON.parse(cleaned);

  } catch (err) {
    Logger.log(" JSON 修復失敗: " + err);
    Logger.log("原始文本:\n" + rawText);
    throw err;
  }
}

// Convert an English number word to an integer
function wordToNumber(word) {

  word = word.toLowerCase();

  const map = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90
  };

  const parts = word.split(/[- ]+/);
  let total = 0;

  for (const p of parts) {
    if (map[p] != null) total += map[p];
    else return null; // 不認得就不處理
  }

  return total;
}

// Install the post-survey submit trigger for the linked form
function installPostSurveyTriggerFromSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const formUrl = sheet.getFormUrl();

    if (!formUrl) {
      Logger.log(' 此 Sheet 沒有連結到任何表單');
      Logger.log(' 請確認：');
      Logger.log('  1. 這是後測問卷的回覆 Sheet 嗎？');
      Logger.log('  2. 表單  回覆  查看試算表（綠色按鈕）');
      return false;
    }

    const form = FormApp.openByUrl(formUrl);

    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onPostSurveySubmit') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp.newTrigger('onPostSurveySubmit')
      .forForm(form)
      .onFormSubmit()
      .create();

    Logger.log(' 後測問卷觸發器已安裝');
    Logger.log(` 表單名稱: ${form.getTitle()}`);
    Logger.log(` Sheet 名稱: ${sheet.getName()}`);

    return true;

  } catch (error) {
    Logger.log(' 安裝失敗: ' + error.toString());
    return false;
  }
}


// ============================================
// UPDATE NOTES
// ============================================
// Post-survey flow: form submit trigger -> parse survey -> write to BigQuery
//   -> fetch pre-survey, post-survey and behavior data -> GPT report
//   -> build HTML -> send report email.
//
// Run installPostSurveyTriggerFromSheet once to install the submit trigger.
//
// Test and diagnostic helpers have been removed.
// Before use, set these:
//   Script Property OPENAI_API_KEY = your OpenAI API key
//   BIGQUERY_CONFIG.PROJECT_ID     = your GCP project id
//   BIGQUERY_CONFIG.DATASET_ID     = your BigQuery dataset
//   CONFIG.REPORT_SENDER_NAME      = your sender display name
// ============================================
