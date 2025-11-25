# Stock Data Fetcher Lambda - Setup Guide

This guide will help you set up and deploy the Stock Data Fetcher Lambda function for the Virtual Stock Trading Simulator.

## Table of Contents
1. [Prerequisites Setup](#prerequisites-setup)
2. [Getting Alpha Vantage API Key](#getting-alpha-vantage-api-key)
3. [Configuring AWS Credentials](#configuring-aws-credentials)
4. [Testing Locally](#testing-locally)
5. [Deploying to AWS](#deploying-to-aws)
6. [Team Coordination](#team-coordination)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites Setup

### 1. Install Node.js

Check if Node.js is installed:
```bash
node --version
```

If not installed, download from [nodejs.org](https://nodejs.org/) (LTS version recommended, 18.x or higher).

### 2. Install AWS CLI

**macOS:**
```bash
# Using Homebrew
brew install awscli

# Verify installation
aws --version
```

**Alternative (any OS):**
Download from [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

### 3. Install AWS SAM CLI

**macOS:**
```bash
# Install using Homebrew
brew tap aws/tap
brew install aws-sam-cli

# Verify installation
sam --version
```

**Alternative:**
Follow the [SAM CLI Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

Expected output: `SAM CLI, version 1.x.x` or higher

---

## Getting Alpha Vantage API Key

Alpha Vantage provides free real-time stock data with these limits:
- **5 API calls per minute**
- **500 API calls per day**

### Steps to get your API key:

1. Go to [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Fill out the form (use your .edu email if possible for premium features)
3. You'll receive your API key immediately
4. **SAVE THIS KEY** - you'll need it during deployment

**Example API key format:** `ABC123XYZ456DEF789`

---

## Configuring AWS Credentials

Since you're using a **shared team AWS account**, you'll need the account credentials from your team.

### Step 1: Get AWS Credentials from Your Team

You need:
- AWS Account ID
- IAM username
- Password (or Access Key ID + Secret Access Key)

### Step 2: Configure AWS CLI

**Option A: Using Access Keys (Recommended for CLI)**

```bash
aws configure
```

When prompted, enter:
```
AWS Access Key ID: [Your-Access-Key]
AWS Secret Access Key: [Your-Secret-Key]
Default region name: us-east-1
Default output format: json
```

**Option B: Using SSO (if your team uses it)**

```bash
aws configure sso
```

### Step 3: Verify Configuration

```bash
# Check your identity
aws sts get-caller-identity

# Should return something like:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/YourUsername"
# }
```

---

## Testing Locally

Before deploying to AWS, test your Lambda function locally.

### Step 1: Install Dependencies

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend/lambdas/stock-data-fetcher
npm install
```

### Step 2: Build the SAM Application

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend
sam build
```

You should see:
```
Build Succeeded
Built Artifacts: .aws-sam/build
```

### Step 3: Create a Test Event

Create a file `backend/test-events/api-gateway-event.json`:

```json
{
  "queryStringParameters": {
    "symbols": "AAPL,MSFT,TSLA"
  }
}
```

### Step 4: Test Locally (Mock Mode - No AWS Connection)

```bash
# Test with mock event (won't call real Alpha Vantage API without env vars)
sam local invoke StockDataFetcherFunction --event test-events/api-gateway-event.json
```

### Step 5: Test with Real API

Create `backend/.env` file (this is gitignored - won't be committed):

```bash
ALPHA_VANTAGE_API_KEY=your-api-key-here
CACHE_TABLE_NAME=stock-price-cache
CACHE_TTL=45
```

Then run:

```bash
sam local invoke StockDataFetcherFunction \
  --event test-events/api-gateway-event.json \
  --env-vars .env
```

**Note:** This will call the real Alpha Vantage API but won't connect to DynamoDB (since it doesn't exist yet).

---

## Deploying to AWS

### Step 1: First-Time Deployment (Guided)

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend
sam deploy --guided
```

You'll be prompted for:

1. **Stack Name:** `stock-trading-lambda-dev` (or any name you prefer)
2. **AWS Region:** `us-east-1` (or your team's preferred region)
3. **Parameter AlphaVantageApiKey:** `[paste your API key]`
4. **Parameter DynamoDBTableName:** `stock-price-cache` (confirm with teammate!)
5. **Parameter Environment:** `dev`
6. **Confirm changes before deploy:** `Y`
7. **Allow SAM CLI IAM role creation:** `Y`
8. **Disable rollback:** `n`
9. **StockDataFetcherFunction may not have authorization defined:** `y`
10. **Save arguments to configuration file:** `Y`
11. **SAM configuration file:** `samconfig.toml` (default)
12. **SAM configuration environment:** `default` (default)

### Step 2: Deployment Process

SAM will:
1. Package your code
2. Upload to S3
3. Create CloudFormation stack
4. Deploy Lambda function
5. Display outputs

**Expected output:**
```
CloudFormation outputs from deployed stack
---------------------------------------------------------------------------
Outputs
---------------------------------------------------------------------------
Key                 StockDataFetcherFunctionArn
Description         Lambda Function ARN - Share this with Matthew
Value               arn:aws:lambda:us-east-1:123456789012:function:stock-data-fetcher-dev
---------------------------------------------------------------------------
```

### Step 3: Save Important Information

**Copy these values** (you'll need them later):

1. **Lambda Function ARN** → Share with Matthew (API Gateway)
2. **Lambda Function Name** → Use for testing
3. **DynamoDB Table Name** → Confirm with teammate

### Step 4: Subsequent Deployments

After the first deployment, you can use:

```bash
sam build && sam deploy
```

This will use the saved configuration from `samconfig.toml`.

---

## Team Coordination

### For Your Teammate (DynamoDB)

The Lambda function expects a DynamoDB table with this schema:

**Table Name:** `stock-price-cache`

**Primary Key:**
- Partition Key: `symbol` (String) - e.g., "AAPL"
- Sort Key: `dataType` (String) - e.g., "quote"

**Attributes:**
- `data` (Map) - The cached stock quote data
- `ttl` (Number) - Unix timestamp for TTL expiration
- `timestamp` (Number) - Unix timestamp when cached
- `updatedAt` (String) - ISO timestamp for debugging

**TTL Configuration:**
- Enable TTL on the `ttl` attribute
- This automatically deletes expired cache entries

**Example Item:**
```json
{
  "symbol": "AAPL",
  "dataType": "quote",
  "data": {
    "symbol": "AAPL",
    "price": 178.45,
    "change": 2.34,
    "changePct": 1.33,
    "volume": 58123456
  },
  "ttl": 1700000000,
  "timestamp": 1699999955,
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### For Matthew (API Gateway)

Share these values with Matthew:

1. **Lambda Function ARN:** (from deployment outputs)
   - Example: `arn:aws:lambda:us-east-1:123456789012:function:stock-data-fetcher-dev`

2. **HTTP Method:** `GET`

3. **Expected Query Parameters:**
   - `symbols` (optional) - Comma-separated stock symbols
   - Example: `?symbols=AAPL,MSFT,TSLA`

4. **CORS Configuration:**
   - Already configured in Lambda response headers
   - Origin: `*` (or restrict to CloudFront domain)
   - Methods: `GET, OPTIONS`
   - Headers: `Content-Type`

5. **API Endpoint Path (Suggested):**
   - `/api/stock/quotes` or `/stock/quotes`

6. **Response Format:**
```json
{
  "success": true,
  "quotes": [
    {
      "symbol": "AAPL",
      "price": 178.45,
      "change": 2.34,
      "changePct": 1.33,
      "cached": true
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z",
  "cached": 2,
  "fresh": 1
}
```

---

## Testing Your Deployed Lambda

### Test via AWS Console

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Find your function: `stock-data-fetcher-dev`
3. Click **Test** tab
4. Create a new test event with this JSON:
```json
{
  "queryStringParameters": {
    "symbols": "AAPL,MSFT"
  }
}
```
5. Click **Test** button
6. Check the **Execution result** - should show stock prices

### Test via SAM CLI

```bash
sam remote invoke StockDataFetcherFunction \
  --stack-name stock-trading-lambda-dev \
  --event test-events/api-gateway-event.json
```

### Monitor Logs

```bash
sam logs --stack-name stock-trading-lambda-dev --tail
```

Or in AWS Console:
1. Go to CloudWatch → Log groups
2. Find `/aws/lambda/stock-data-fetcher-dev`
3. View recent logs

---

## Troubleshooting

### Issue: "Unable to import module 'index'"

**Solution:**
```bash
cd backend/lambdas/stock-data-fetcher
npm install
cd ../..
sam build
sam deploy
```

### Issue: "Alpha Vantage API rate limit exceeded"

**Symptoms:** Error message: "API rate limit exceeded"

**Cause:** Free tier allows only 5 calls/minute, 500/day

**Solutions:**
1. Implement caching (already in code)
2. Reduce CloudWatch Events frequency
3. Upgrade to premium Alpha Vantage plan

### Issue: "AccessDeniedException: User is not authorized to perform: dynamodb:PutItem"

**Cause:** Lambda doesn't have permissions to access DynamoDB

**Solution:**
1. Check that DynamoDB table name matches what you specified during deployment
2. Verify IAM role permissions in SAM template
3. Redeploy: `sam build && sam deploy`

### Issue: "Table does not exist: stock-price-cache"

**Cause:** Teammate hasn't created the DynamoDB table yet

**Solution:**
1. Coordinate with teammate to create table
2. Confirm table name matches what Lambda expects
3. For now, Lambda will log errors but won't crash

### Issue: "No data returned for [symbol]"

**Possible Causes:**
1. Invalid stock symbol
2. Market closed (Alpha Vantage may not return data)
3. API key invalid or rate limited

**Debug:**
```bash
# Check CloudWatch logs
sam logs --stack-name stock-trading-lambda-dev --tail
```

### Issue: AWS CLI not configured

```bash
aws configure
# Enter your access keys when prompted
```

### Issue: SAM build fails

```bash
# Clean previous builds
rm -rf .aws-sam

# Rebuild
sam build --use-container
```

---

## Next Steps

After successful deployment:

1. **Share Lambda ARN with Matthew** for API Gateway integration
2. **Confirm DynamoDB table name** with teammate
3. **Test the Lambda function** using AWS Console
4. **Monitor CloudWatch Logs** for errors
5. **Update frontend** (once API Gateway is ready) to call the real API endpoint

---

## API Usage Limits

**Alpha Vantage Free Tier:**
- 5 API calls per minute
- 500 API calls per day

**Cache Strategy:**
- Cache TTL: 45 seconds
- Cache reduces API calls by ~95%
- Example: 10 users → ~1 API call/minute instead of 50+

**Recommended CloudWatch Schedule:**
- Development: Every 5 minutes
- Production: Every 1 minute (during market hours only)

---

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Alpha Vantage API Docs](https://www.alphavantage.co/documentation/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)

---

## Support

If you encounter issues:
1. Check CloudWatch Logs
2. Review this troubleshooting guide
3. Ask teammates for help with their components (DynamoDB, API Gateway)
4. Check AWS service health: [status.aws.amazon.com](https://status.aws.amazon.com)
