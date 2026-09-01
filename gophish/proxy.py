from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# === 配置區 ===
GOPHISH_API_KEY = "YOUR_GOPHISH_API_KEY"
GOPHISH_URL = "https://127.0.0.1:3333"
ACCESS_TOKEN = os.environ.get("ACCESS_TOKEN", "YOUR_ACCESS_TOKEN")
TIMEOUT = 10

# 關閉 SSL 警告（僅限開發環境）
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

@app.route("/send", methods=["POST"])
def send_campaign():
    """發送 Campaign"""
    token = request.headers.get("x-access-token")
    if token != ACCESS_TOKEN:
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        payload = request.get_json(force=True)
        url = f"{GOPHISH_URL}/api/campaigns/?api_key={GOPHISH_API_KEY}"
        
        print(f"[CAMPAIGN] Sending to GoPhish: {url}")
        print(f"[CAMPAIGN] Payload: {payload}")
        
        r = requests.post(url, json=payload, timeout=TIMEOUT, verify=False)
        
        print(f"[CAMPAIGN] Response: {r.status_code} - {r.text}")
        
        return jsonify({
            "status_code": r.status_code,
            "gophish_response": r.text
        }), r.status_code
        
    except Exception as e:
        print(f"[CAMPAIGN ERROR] {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/<path:endpoint>", methods=["GET", "POST", "PUT", "DELETE"])
def proxy_api(endpoint):
    """轉發所有 API 請求到 GoPhish"""
    try:
        # 構建完整的 API URL
        url = f"{GOPHISH_URL}/api/{endpoint}"
        
        # 保留原始的 query string
        if request.query_string:
            url += f"?{request.query_string.decode()}"
        
        print(f"[API] {request.method} {url}")
        
        # 根據 HTTP 方法轉發請求
        if request.method == "GET":
            r = requests.get(url, timeout=TIMEOUT, verify=False)
        elif request.method == "POST":
            payload = request.get_json(force=True) if request.data else None
            print(f"[API] POST payload: {payload}")
            r = requests.post(url, json=payload, timeout=TIMEOUT, verify=False)
        elif request.method == "PUT":
            payload = request.get_json(force=True) if request.data else None
            print(f"[API] PUT payload: {payload}")
            r = requests.put(url, json=payload, timeout=TIMEOUT, verify=False)
        elif request.method == "DELETE":
            r = requests.delete(url, timeout=TIMEOUT, verify=False)
        else:
            return jsonify({"error": "Method not allowed"}), 405
        
        print(f"[API] Response: {r.status_code}")
        
        # 返回 GoPhish 的原始響應
        return r.text, r.status_code, {"Content-Type": "application/json"}
        
    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/", methods=["GET"])
def index():
    """檢查"""
    return jsonify({
        "message": "GoPhish Proxy is running",
        "status": "ok",
        "endpoints": {
            "/send": "POST - Send campaign",
            "/api/*": "ALL - Proxy to GoPhish API"
        }
    })


if __name__ == "__main__":
    print("=" * 50)
    print("GoPhish Proxy Starting...")
    print(f"GoPhish URL: {GOPHISH_URL}")
    print(f"Listening on: http://127.0.0.1:8000")
    print("=" * 50)
    app.run(host="127.0.0.1", port=8000, debug=True)
