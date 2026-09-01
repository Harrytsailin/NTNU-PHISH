# NTNU-Phish: Phishing Awareness Simulation System

NTNU-Phish 是一套用於**資安研究與釣魚警覺性訓練**的模擬系統。本研究以 NTNU Moodle 登入情境為例，整合 Google Forms、Google Apps Script、GoPhish、BigQuery、Cloud Run、Playwright 與 GPT-4o，建立可控制網頁視覺條件的釣魚模擬流程，並蒐集前測、後測與去識別化互動紀錄。

系統支援前測、實驗條件分配、模擬登入頁面產生、授權模擬郵件寄送、互動紀錄蒐集、後測，以及個人化資安教育回饋。GPT-4o 主要用於產生 overlay CSS，以調整頁面的視覺呈現；原始 HTML 結構與基本登入流程則維持一致。

---

## 1. Repository Structure

```text
.
├── Dataset Files/
│   ├── introduction.txt
│   ├── post_survey.csv
│   └── pre_survey.csv
│
├── apps_script/
│   ├── post_survey.gs
│   └── pre_survey.gs
│
├── gophish/
│   ├── config.json
│   └── proxy.py
│
└── README.md
```

各目錄用途如下：

- `Dataset Files/`：存放 Study 2 的去識別化前測與後測資料，以及資料集說明文件。
- `apps_script/`：存放前測與後測的 Google Apps Script 程式碼。`pre_survey.gs` 負責前測、實驗條件分配、模擬流程啟動與互動紀錄接收；`post_survey.gs` 負責後測資料處理與個人化資安教育回饋產生。
- `gophish/`：存放 GoPhish 相關設定與後端服務。`config.json` 為 GoPhish 伺服器設定檔；`proxy.py` 負責在 Google Apps Script 與 GoPhish Admin API 之間轉送請求。
- `README.md`：說明整體系統架構、資料流程、部署方式與公開資料內容。
- Cloud Run 頁面擷取服務為獨立部署元件，主要使用 Playwright 取得目標登入頁面的截圖與 DOM Tree，因此未包含於本 repository 的目錄結構中。

---

## 2. System Overview

系統主要由下列元件組成：

| 元件 | 技術 | 主要用途 |
|---|---|---|
| Pre-survey | Google Forms + Apps Script | 收集前測、分配實驗條件並啟動模擬流程 |
| Post-survey | Google Forms + Apps Script | 收集後測並產生個人化教育回饋 |
| GoPhish | GoPhish | 建立授權模擬 campaign 與提供 landing page |
| Backend proxy | Python + Flask | 在 Apps Script 與 GoPhish Admin API 之間轉送請求 |
| Page extraction | Cloud Run + Playwright | 取得目標登入頁面的截圖與 DOM Tree |
| LLM-assisted CSS generation | GPT-4o | 依實驗條件產生 overlay CSS |
| Research data storage | BigQuery | 儲存前測、後測與互動紀錄 |

---

## 3. Experimental Workflow

Study 2 的主要流程如下：

1. 受試者完成前測問卷。
2. 系統以 **systematic count balancing** 將受試者分配至五種網頁視覺條件之一。
3. Cloud Run container 使用 Playwright 取得目標登入頁面的截圖與 DOM Tree。
4. 系統對 DOM Tree 進行簡化與壓縮，移除與後續頁面處理較不相關的輔助性 HTML 節點與重複樣式資訊。
5. GPT-4o 根據指定條件產生 overlay CSS，以建立不同的網頁視覺版本。
6. GoPhish 建立授權的模擬 campaign，並提供對應的模擬登入頁面。
7. 系統記錄去識別化的互動事件與停留資訊。
8. 受試者完成後測問卷。
9. 系統整合前測、後測與互動紀錄，產生個人化資安教育回饋。

### Data linkage

在系統執行期間，前測、後測與互動紀錄會以受試者的 **Email** 進行內部資料串接，以支援資料查詢與個人化回饋寄送。

在統計分析與公開資料釋出前，Email 等直接識別資訊會被移除，並以匿名的 `participant_id` 取代。公開資料中的前測與後測可透過 `participant_id`（`P0001`–`P0209`）進行連結。

---

## 4. Webpage Visual Conditions

Study 2 使用五種網頁視覺條件：

| Variant | Condition | 說明 |
|---|---|---|
| A | Original baseline | 保留原始基準外觀 |
| B | Color shift | 調整主要配色 |
| C | Logo missing | 移除主要品牌 Logo |
| D | Icon missing | 移除部分介面 Icon |
| E | Low fidelity | 降低整體頁面擬真程度 |

---

## 5. Pre-survey Module

`pre_survey.gs` 負責前測與主要實驗流程，包括：

- 接收前測問卷提交結果。
- 以 systematic count balancing 分配 A–E 實驗條件。
- 將前測資料與實驗條件寫入 BigQuery。
- 呼叫 Cloud Run 頁面擷取服務。
- 取得 GPT-4o 產生的 overlay CSS。
- 建立授權模擬 campaign。
- 接收並寫入互動紀錄。

部署時，API keys、URLs 與其他敏感設定應放在 **Script Properties** 或環境變數中，不應直接寫入公開程式碼。

常見設定項目包括：

```text
GOPHISH_API_URL
GOPHISH_API_KEY
PHISHING_URL
OPENAI_API_KEY
WEB_APP_URL
TARGET_LOGIN_URL
CLOUD_RUN_URL
```

---

## 6. Post-survey Module

`post_survey.gs` 為另一個獨立的 Apps Script 專案，負責：

- 接收後測問卷。
- 將後測資料寫入 BigQuery。
- 依 Email 取得同一受試者的前測、後測與互動資料。
- 整合相關研究資料。
- 產生個人化資安教育回饋並寄送給受試者。

後測中的主要研究變項包括：

- `perceived webpage credibility`
- `perceived simulation realism`
- `self-reported awareness improvement`

其他問卷項目則可作為個人化教育回饋的輔助資訊。

---

## 7. Backend Proxy

`proxy.py` 為 Apps Script 與 GoPhish Admin API 之間的後端服務。其主要用途是接收 Apps Script 的授權請求，並將必要的 campaign 設定轉送至 GoPhish。

敏感資訊應透過環境變數或私有設定保存，例如：

```bash
export ACCESS_TOKEN="your_access_token"
```

公開 repository 中不應包含：

- GoPhish API key
- OpenAI API key
- Google Cloud service-account credentials
- Access tokens
- SMTP credentials
- 其他可直接存取研究環境的秘密資訊

---

## 8. Cloud Run Page Extraction Service

Cloud Run container 使用 Playwright 開啟目標登入頁面，取得後續頁面處理所需的資訊，包括：

- rendered webpage screenshot
- DOM Tree
- element bounding boxes
- computed styles

這些資訊用於後續 DOM Tree 簡化、頁面結構分析與 overlay CSS 產生。

Cloud Run 服務與 Apps Script 專案分開部署。部署完成後，將服務端點設定於 `CLOUD_RUN_URL`。

> 本 repository 若未包含 Cloud Run 原始碼，則該服務需依研究環境另行部署。

---

## 9. Research Data Storage

研究系統主要使用三類資料：

- `pre_survey`：前測資料與實驗條件
- `user_events`：互動紀錄
- `post_survey`：後測資料

在系統執行期間，這些資料以 Email 進行內部串接，以支援個人化回饋與資料查詢。

在分析階段，直接識別資訊會被移除，並改用匿名的 `participant_id`。公開資料集中不包含姓名、Email、學號、真實登入憑證或精確時間戳記。

---

## 10. Dataset

`data/` 目錄包含 Study 2 的去識別化前測與後測資料，共 209 位有效受試者。

### `pre_survey.csv`

包含：

- participant background
- Moodle usage
- prior cybersecurity training
- urgency susceptibility
- sender-checking habits
- URL-checking habits
- suspicious-email response behavior
- phishing-detection self-confidence
- assigned visual condition

### `post_survey.csv`

包含：

- suspicious cues noticed by participants
- perceived webpage credibility
- self-reported awareness improvement
- preferred training topics
- perceived simulation realism

兩份公開資料可透過 `participant_id` 進行連結。

`variant` 的編碼如下：

```text
A = Original baseline
B = Color shift
C = Logo missing
D = Icon missing
E = Low fidelity
```

公開資料已移除姓名、Email、學號、精確時間戳記及其他直接識別資訊。

---

## 11. Basic Setup

部署前需準備：

- Google account with access to Google Forms and Apps Script
- Google Cloud project with BigQuery enabled
- Cloud Run page-extraction service
- OpenAI API access
- Authorized GoPhish environment
- Python 3 environment for the backend proxy

啟動順序如下：

1. 啟動授權的 GoPhish 測試環境。
2. 啟動 backend proxy。
3. 確認 Cloud Run 頁面擷取服務可用。
4. 確認 Apps Script、BigQuery 與必要的 Script Properties 已完成設定。
5. 完成內部測試後，再開始經核准的研究或訓練流程。


---

## 12. Troubleshooting

### 模擬頁面無法正常顯示

確認頁面擷取流程已完成，並檢查 Cloud Run 回傳的 DOM Tree 與頁面資料是否有效。

### Apps Script 無法連線至後端

確認 backend proxy 正常執行，並檢查 `GOPHISH_API_URL` 與相關存取設定。

### 無法寫入 BigQuery

確認 Apps Script 已啟用 BigQuery service，且執行帳號具有對應資料集的存取權限。

### 無法收到互動紀錄

確認 Web App 已正確部署，且 `WEB_APP_URL` 與 BigQuery 設定一致。

### 後測回饋未產生

確認 post-survey 專案的觸發器、BigQuery 設定與 LLM API 設定皆可正常使用。

---

## 13. Privacy and Research Use

本 repository 為研究系統的公開版本。公開內容應符合研究倫理核准、資料管理與去識別化要求。

為降低重新識別風險：

- 公開資料不包含姓名、Email、學號等直接識別資訊。
- Email 僅用於研究系統執行期間的資料串接與回饋寄送。
- 統計分析與公開資料使用匿名 `participant_id`。
- 真實登入憑證不應被收集或保留。


---

