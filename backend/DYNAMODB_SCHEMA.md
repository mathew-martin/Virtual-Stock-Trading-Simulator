# DynamoDB Schema Specification

**For: Teammate responsible for DynamoDB**

This document specifies the exact DynamoDB table structure required for the Stock Data Fetcher Lambda function.

---

## Table Configuration

### Table Name
```
stock-price-cache
```

### Capacity Mode
- **Recommended:** On-Demand (PAY_PER_REQUEST)
- **Alternative:** Provisioned (5 RCU / 5 WCU for testing)

### Encryption
- Use AWS managed keys (default)

---

## Table Schema

### Primary Key Structure

| Key Type | Attribute Name | Data Type | Description |
|----------|----------------|-----------|-------------|
| Partition Key (HASH) | `symbol` | String | Stock ticker symbol (e.g., "AAPL", "MSFT") |
| Sort Key (RANGE) | `dataType` | String | Type of data (always "quote" for now) |

**Why this structure?**
- Allows future expansion for different data types (e.g., "quote", "history", "news")
- Efficient queries for specific stocks
- Supports multiple cache types per symbol

### Attributes

| Attribute Name | Data Type | Required | Description |
|----------------|-----------|----------|-------------|
| `symbol` | String | Yes | Stock ticker (partition key) |
| `dataType` | String | Yes | Data type identifier (sort key) |
| `data` | Map | Yes | The actual stock quote data |
| `ttl` | Number | Yes | Unix timestamp for automatic deletion |
| `timestamp` | Number | Yes | Unix timestamp when cached |
| `updatedAt` | String | No | ISO 8601 timestamp for debugging |

---

## TTL (Time To Live) Configuration

**CRITICAL: Must enable TTL for automatic cache expiration**

### TTL Settings
- **TTL Attribute:** `ttl`
- **Unit:** Unix timestamp (seconds since epoch)
- **Deletion:** Automatic (within 48 hours of expiration)

### How to Enable TTL

**Via AWS Console:**
1. Go to DynamoDB → Tables → stock-price-cache
2. Click **Additional settings** tab
3. Under **Time to Live (TTL)**, click **Manage TTL**
4. Enter `ttl` as the TTL attribute name
5. Click **Enable**

**Via AWS CLI:**
```bash
aws dynamodb update-time-to-live \
  --table-name stock-price-cache \
  --time-to-live-specification "Enabled=true, AttributeName=ttl"
```

**Via CloudFormation/SAM:**
```yaml
TimeToLiveSpecification:
  AttributeName: ttl
  Enabled: true
```

---

## Sample Items

### Example 1: AAPL Stock Quote (Cached)
```json
{
  "symbol": "AAPL",
  "dataType": "quote",
  "data": {
    "symbol": "AAPL",
    "price": 178.45,
    "change": 2.34,
    "changePct": 1.33,
    "volume": 58123456,
    "latestTradingDay": "2024-01-15",
    "previousClose": 176.11,
    "open": 177.20,
    "high": 179.00,
    "low": 176.50
  },
  "ttl": 1705329000,
  "timestamp": 1705328955,
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Example 2: MSFT Stock Quote
```json
{
  "symbol": "MSFT",
  "dataType": "quote",
  "data": {
    "symbol": "MSFT",
    "price": 405.78,
    "change": -1.22,
    "changePct": -0.30,
    "volume": 24567890,
    "latestTradingDay": "2024-01-15",
    "previousClose": 407.00,
    "open": 406.50,
    "high": 408.20,
    "low": 404.90
  },
  "ttl": 1705329045,
  "timestamp": 1705329000,
  "updatedAt": "2024-01-15T10:31:00.000Z"
}
```

---

## CloudFormation Template (For Reference)

If you're using SAM or CloudFormation to create the table:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: DynamoDB table for stock price caching

Resources:
  StockPriceCacheTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: stock-price-cache

      # Key schema
      AttributeDefinitions:
        - AttributeName: symbol
          AttributeType: S
        - AttributeName: dataType
          AttributeType: S

      KeySchema:
        - AttributeName: symbol
          KeyType: HASH
        - AttributeName: dataType
          KeyType: RANGE

      # Billing
      BillingMode: PAY_PER_REQUEST

      # TTL configuration
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

      # Tags
      Tags:
        - Key: Project
          Value: VirtualStockTrading
        - Key: Component
          Value: StockPriceCache
        - Key: ManagedBy
          Value: Teammate

Outputs:
  TableName:
    Description: DynamoDB table name
    Value: !Ref StockPriceCacheTable
    Export:
      Name: StockPriceCacheTableName

  TableArn:
    Description: DynamoDB table ARN
    Value: !GetAtt StockPriceCacheTable.Arn
    Export:
      Name: StockPriceCacheTableArn
```

---

## Access Patterns

### Read Pattern (Lambda → DynamoDB)
```python
# The Lambda function will query like this:
GetItem(
  TableName='stock-price-cache',
  Key={
    'symbol': 'AAPL',
    'dataType': 'quote'
  }
)
```

### Write Pattern (Lambda → DynamoDB)
```python
# The Lambda function will write like this:
PutItem(
  TableName='stock-price-cache',
  Item={
    'symbol': 'AAPL',
    'dataType': 'quote',
    'data': {...},
    'ttl': 1705329000,
    'timestamp': 1705328955,
    'updatedAt': '2024-01-15T10:30:00Z'
  }
)
```

---

## Permissions Required

The Lambda function needs these IAM permissions on your table:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/stock-price-cache"
    }
  ]
}
```

**Note:** The Lambda's SAM template already includes these permissions. You just need to create the table.

---

## Testing Your Table

### Manual Test via AWS Console

1. Go to DynamoDB → Tables → stock-price-cache
2. Click **Explore table items**
3. Click **Create item**
4. Switch to JSON view and paste:

```json
{
  "symbol": {
    "S": "TEST"
  },
  "dataType": {
    "S": "quote"
  },
  "data": {
    "M": {
      "symbol": {"S": "TEST"},
      "price": {"N": "100.50"}
    }
  },
  "ttl": {
    "N": "1999999999"
  },
  "timestamp": {
    "N": "1705328955"
  }
}
```

5. Click **Create item**
6. Verify the item appears in the table

### Test via AWS CLI

```bash
# Put an item
aws dynamodb put-item \
  --table-name stock-price-cache \
  --item '{
    "symbol": {"S": "TEST"},
    "dataType": {"S": "quote"},
    "data": {"M": {
      "symbol": {"S": "TEST"},
      "price": {"N": "100.50"}
    }},
    "ttl": {"N": "1999999999"},
    "timestamp": {"N": "1705328955"}
  }'

# Get the item back
aws dynamodb get-item \
  --table-name stock-price-cache \
  --key '{
    "symbol": {"S": "TEST"},
    "dataType": {"S": "quote"}
  }'
```

---

## Cost Estimation

**On-Demand Pricing (pay per request):**
- Reads: $0.25 per million requests
- Writes: $1.25 per million requests

**Expected Usage (with caching):**
- ~1,000 reads/day
- ~100 writes/day
- **Estimated cost:** < $0.01/day

**For testing:** On-Demand is cheaper and easier to manage.

---

## Checklist

- [ ] Create table named `stock-price-cache`
- [ ] Set partition key to `symbol` (String)
- [ ] Set sort key to `dataType` (String)
- [ ] Enable TTL on `ttl` attribute
- [ ] Choose On-Demand billing mode
- [ ] Add tags: Project=VirtualStockTrading
- [ ] Test table by inserting a sample item
- [ ] Verify TTL is enabled
- [ ] Share table name with Neil (should be `stock-price-cache`)
- [ ] Confirm Lambda has permissions to access table

---

## Questions?

If you have questions about the schema:
1. Check the Lambda code: `backend/lambdas/stock-data-fetcher/index.js`
2. Look at functions: `getFromCache()`, `saveToCache()`
3. Ask Neil for clarification
