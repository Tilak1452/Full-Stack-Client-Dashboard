import requests, os
from dotenv import load_dotenv
load_dotenv()

results = {}

# 1. Finnhub
key = os.getenv("FINNHUB_API_KEY_1", "")
try:
    r = requests.get(f"https://finnhub.io/api/v1/quote?symbol=AAPL&token={key}", timeout=8)
    results["Finnhub"] = f"OK {r.status_code}" if r.status_code == 200 else f"FAIL {r.status_code}: {r.text[:80]}"
except Exception as e:
    results["Finnhub"] = f"ERROR: {e}"

# 2. FMP
key = os.getenv("FMP_API_KEY_1", "")
try:
    r = requests.get(f"https://financialmodelingprep.com/api/v3/quote/AAPL?apikey={key}", timeout=8)
    results["FMP"] = f"OK {r.status_code}" if r.status_code == 200 else f"FAIL {r.status_code}: {r.text[:80]}"
except Exception as e:
    results["FMP"] = f"ERROR: {e}"

# 3. Alpha Vantage
key = os.getenv("ALPHA_VANTAGE_KEY_1", "")
try:
    r = requests.get(f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey={key}", timeout=8)
    body = r.json()
    gq = body.get("Global Quote", {})
    if gq:
        results["AlphaVantage"] = "OK 200"
    elif "Note" in body:
        results["AlphaVantage"] = "RATE_LIMIT: " + body["Note"][:80]
    elif "Information" in body:
        results["AlphaVantage"] = "INFO: " + body["Information"][:80]
    else:
        results["AlphaVantage"] = "UNEXPECTED: " + str(body)[:80]
except Exception as e:
    results["AlphaVantage"] = f"ERROR: {e}"

# 4. NewsAPI
key = os.getenv("NEWS_API_KEY_1", "")
try:
    r = requests.get(f"https://newsapi.org/v2/top-headlines?country=in&pageSize=1&apiKey={key}", timeout=8)
    results["NewsAPI"] = f"OK {r.status_code}" if r.status_code == 200 else f"FAIL {r.status_code}: {r.text[:80]}"
except Exception as e:
    results["NewsAPI"] = f"ERROR: {e}"

# 5. FRED
key = os.getenv("FRED_API_KEY_1", "")
try:
    r = requests.get(f"https://api.stlouisfed.org/fred/series?series_id=GDP&api_key={key}&file_type=json", timeout=8)
    results["FRED"] = f"OK {r.status_code}" if r.status_code == 200 else f"FAIL {r.status_code}: {r.text[:80]}"
except Exception as e:
    results["FRED"] = f"ERROR: {e}"

print()
for name, status in results.items():
    if status.startswith("OK"):
        icon = "PASS"
    elif "RATE_LIMIT" in status or "INFO" in status:
        icon = "WARN"
    else:
        icon = "FAIL"
    print(f"  [{icon}]  {name:<15} {status}")
print()
