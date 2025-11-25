/**
 * Enhanced Stock Data Fetcher Lambda
 * Supports:
 *  - API Gateway: GET /stock/{symbol}
 *  - API Gateway: GET /stock?symbols=AAPL,MSFT
 *  - Scheduled events: { "symbols": [...] }
 */

const AWS = require('aws-sdk');
const axios = require('axios');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const CACHE_TABLE = process.env.CACHE_TABLE_NAME || 'stock-price-cache';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '45');
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'TSLA', 'META', 'GOOGL', 'BRK.B', 'JPM', 'JNJ'];

exports.handler = async (event) => {
    console.log("===== EVENT RECEIVED =====");
    console.log(JSON.stringify(event, null, 2));

    try {
        let symbols = [];

        // -----------------------------------------
        // 1️⃣ Highest priority: API Gateway path param /stock/{symbol}
        // -----------------------------------------
        if (event.pathParameters && event.pathParameters.symbol) {
            const symbol = event.pathParameters.symbol.trim().toUpperCase();
            console.log(`Path parameter symbol detected: ${symbol}`);
            symbols = [symbol];
        }

        // -----------------------------------------
        // 2️⃣ Query param: /stock?symbols=AAPL,MSFT
        // -----------------------------------------
        else if (event.queryStringParameters && event.queryStringParameters.symbols) {
            symbols = event.queryStringParameters.symbols
                .split(',')
                .map(s => s.trim().toUpperCase());

            console.log(`Query parameter symbols detected: ${symbols.join(", ")}`);
        }

        // -----------------------------------------
        // 3️⃣ CloudWatch scheduled event
        // -----------------------------------------
        else if (event.symbols && Array.isArray(event.symbols)) {
            symbols = event.symbols.map(s => s.trim().toUpperCase());
            console.log(`Scheduled event symbols: ${symbols.join(", ")}`);
        }

        // -----------------------------------------
        // 4️⃣ Default to predefined symbols
        // -----------------------------------------
        else {
            symbols = DEFAULT_SYMBOLS;
            console.log("No symbols passed, using DEFAULT_SYMBOLS");
        }

        if (symbols.length === 0) {
            return errorResponse("No symbols provided.");
        }

        console.log(`Fetching quotes for: ${symbols.join(", ")}`);

        const quotes = await Promise.all(symbols.map(fetchQuoteWithCache));
        const validQuotes = quotes.filter(q => q !== null);

        // If using /stock/{symbol}, return a SINGLE quote
        if (event.pathParameters && event.pathParameters.symbol) {
            if (validQuotes.length === 0) {
                return errorResponse(`Stock symbol '${symbols[0]}' not found.`);
            }

            return successResponse({
                symbol: symbols[0],
                quote: validQuotes[0],
                cached: validQuotes[0].cached || false
            });
        }

        // Otherwise return multi-symbol response
        return successResponse({
            quotes: validQuotes,
            timestamp: new Date().toISOString(),
            cached: validQuotes.filter(q => q.cached).length,
            fresh: validQuotes.filter(q => !q.cached).length
        });

    } catch (err) {
        console.error("Handler error:", err);
        return errorResponse(err.message || "Unknown error");
    }
};

function successResponse(body) {
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        body: JSON.stringify(body)
    };
}

function errorResponse(message) {
    return {
        statusCode: 400,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        })
    };
}

/* ---------------- CACHE + API LOGIC (unchanged) ---------------- */

async function fetchQuoteWithCache(symbol) {
    try {
        const cached = await getFromCache(symbol);
        if (cached) {
            console.log(`Cache HIT for ${symbol}`);
            return { ...cached, cached: true };
        }

        console.log(`Cache MISS for ${symbol}`);
        const quote = await fetchFromAlphaVantage(symbol);

        if (!quote) return null;

        await saveToCache(symbol, quote);
        return { ...quote, cached: false };

    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
    }
}

async function getFromCache(symbol) {
    try {
        const params = {
            TableName: CACHE_TABLE,
            Key: {
                symbol: symbol,
                dataType: 'quote'
            }
        };

        const result = await dynamodb.get(params).promise();
        if (result.Item && result.Item.ttl > Math.floor(Date.now() / 1000)) {
            return result.Item.data;
        }
        return null;

    } catch (error) {
        console.error(`Cache read error (${symbol}):`, error);
        return null;
    }
}

async function saveToCache(symbol, data) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const params = {
            TableName: CACHE_TABLE,
            Item: {
                symbol,
                dataType: 'quote',
                data,
                ttl: now + CACHE_TTL,
                timestamp: now,
                updatedAt: new Date().toISOString()
            }
        };
        await dynamodb.put(params).promise();
        console.log(`Saved ${symbol} to cache`);

    } catch (error) {
        console.error(`Cache save error (${symbol}):`, error);
    }
}

async function fetchFromAlphaVantage(symbol) {
    try {
        if (!API_KEY) throw new Error("ALPHA_VANTAGE_API_KEY not configured");

        const url = `https://www.alphavantage.co/query`;
        const params = {
            function: "GLOBAL_QUOTE",
            symbol,
            apikey: API_KEY
        };

        console.log(`Fetching from Alpha Vantage: ${symbol}`);
        const response = await axios.get(url, { params, timeout: 10000 });

        if (response.data["Error Message"]) throw new Error(response.data["Error Message"]);
        if (response.data["Note"]) throw new Error("API rate limit exceeded");

        const global = response.data["Global Quote"];
        if (!global || Object.keys(global).length === 0) throw new Error(`No data found`);

        return {
            symbol,
            price: parseFloat(global["05. price"]) || 0,
            change: parseFloat(global["09. change"]) || 0,
            changePct: parseFloat(global["10. change percent"]?.replace("%", "")) || 0,
            volume: parseInt(global["06. volume"]) || 0,
            latestTradingDay: global["07. latest trading day"] || "",
            previousClose: parseFloat(global["08. previous close"]) || 0,
            open: parseFloat(global["02. open"]) || 0,
            high: parseFloat(global["03. high"]) || 0,
            low: parseFloat(global["04. low"]) || 0
        };

    } catch (error) {
        console.error(`Alpha Vantage error (${symbol}):`, error.message);
        return null;
    }
}
