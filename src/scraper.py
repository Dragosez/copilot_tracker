import requests
import re
from bs4 import BeautifulSoup
from .config import load_session

def get_copilot_data():
    session_cookie = load_session()
    if not session_cookie:
        raise Exception("AUTH_EXPIRED")

    headers = {
        "Cookie": f"user_session={session_cookie}",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }

    try:
        url = "https://github.com/settings/billing/premium_requests_usage"
        response = requests.get(url, headers=headers, timeout=15)
        
        if "/login" in response.url or "/sessions/two-factor" in response.url:
            raise Exception("AUTH_EXPIRED")

        html = response.text
        soup = BeautifulSoup(html, "html.parser")
        body_text = soup.get_text()

        # 1. Extract billed amount
        billed = "$0.00"
        prices = re.findall(r"\$[\d,]+\.\d{2}", body_text)
        for price in prices:
            if price not in ["$10.00", "$100.00", "$0.00"]:
                billed = price
                break
        
        additional_match = re.search(r"Additional usage.*?(\$[\d,]+\.\d{2})", body_text, re.IGNORECASE | re.DOTALL)
        if additional_match:
            billed = additional_match.group(1)

        # 2. Try to get more precise data from API if customer_id is found
        consumed = "0"
        total = "300"
        
        customer_match = re.search(r'customer_id=(\d+)', html) or re.search(r'"customerId":(\d+)', html)
        if customer_match:
            customer_id = customer_match.group(1)
            api_url = f"https://github.com/settings/billing/copilot_usage_card?customer_id={customer_id}&period=3&query="
            api_headers = headers.copy()
            api_headers.update({
                "github-verified-fetch": "true",
                "x-requested-with": "XMLHttpRequest",
                "accept": "application/json"
            })
            try:
                api_res = requests.get(api_url, headers=api_headers, timeout=10)
                if api_res.status_code == 200:
                    json_data = api_res.json()
                    consumed = str(json_data.get("discountQuantity") or json_data.get("netQuantity") or "0")
                    total = str(json_data.get("userPremiumRequestEntitlement") or "300")
                    if json_data.get("totalAmount") and float(json_data.get("totalAmount")) > 0:
                        billed = "$" + str(json_data.get("totalAmount"))
                    return {"consumed": consumed, "total": total, "billed": billed}
            except:
                pass

        # Fallback scraping
        patterns = [
            r"([\d,]+(?:\.\d+)?)\s*(?:of|/)\s*([\d,]+(?:\.\d+)?)\s*(?:requests|included)",
            r"([\d,]+(?:\.\d+)?)\s*requests\s*used",
            r"usage\s*([\d,]+(?:\.\d+)?)\s*/\s*([\d,]+(?:\.\d+)?)"
        ]

        for pattern in patterns:
            match = re.search(pattern, body_text, re.IGNORECASE)
            if match:
                consumed = match.group(1).replace(",", "")
                if len(match.groups()) > 1 and match.group(2):
                    total = match.group(2).replace(",", "")
                break

        return {
            "consumed": consumed,
            "total": total,
            "billed": billed
        }

    except requests.exceptions.RequestException as e:
        raise Exception(f"NETWORK_ERROR: {str(e)}")
