# Render Shell Debug Commands

Go to your Render dashboard:
1. https://dashboard.render.com/
2. Click on `stockwise-pro-api` service
3. Click **Shell** tab
4. Run these commands:

## Check if API key is set
```bash
echo "API Key: $ALPHA_VANTAGE_API_KEY"
```

## Test Alpha Vantage directly from Render
```bash
curl -s "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=$ALPHA_VANTAGE_API_KEY"
```

## Check rate limit status
```bash
curl -s "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=$ALPHA_VANTAGE_API_KEY"
```

## Test search endpoint
```bash
curl -s "https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=apple&apikey=$ALPHA_VANTAGE_API_KEY"
```

## Check your server's public IP (to see if shared)
```bash
curl -s https://api.ipify.org
curl -s https://ipinfo.io
```

## Test your backend locally
```bash
curl -s http://localhost:10000/api/stocks/search?q=AAPL
curl -s http://localhost:10000/api/stocks/quote/AAPL
```

## View server logs
```bash
# In the Shell tab, logs are streamed automatically
# Or check the Logs tab in Render dashboard
```

## Expected Results:

**If API key works:**
```json
{"Global Quote": {"01. symbol": "AAPL", "05. price": "257.4600"...}}
```

**If rate limited:**
```json
{"Information": "We have detected your API key... rate limit is 25 requests per day"}
```

**If key not set:**
```bash
API Key:   # (empty)
```
