# Quick Start Guide - Lambda Setup Checklist

**For: Neil (Lambda)**

This is your step-by-step checklist to get the Stock Data Fetcher Lambda up and running.

---

## Phase 1: Prerequisites (One-Time Setup)

### Step 1: Check Node.js

```bash
node --version
```

- ✅ If you see `v18.x.x` or higher → Continue
- ❌ If not installed → Download from [nodejs.org](https://nodejs.org/)

### Step 2: Install AWS CLI

```bash
brew install awscli
aws --version
```

### Step 3: Install SAM CLI

```bash
brew tap aws/tap
brew install aws-sam-cli
sam --version
```

### Step 4: Get Alpha Vantage API Key

1. Go to: https://www.alphavantage.co/support/#api-key
2. Fill out form
3. Save your API key (looks like: `2SRTSBGAJZW1533D`)

### Step 5: Configure AWS Credentials

```bash
aws configure
```

Enter:

- **Access Key ID:** [Get from team]
- **Secret Access Key:** [Get from team]
- **Region:** `us-east-1`
- **Output format:** `json`

Verify:

```bash
aws sts get-caller-identity
```

---

## Phase 2: Install Dependencies

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend/lambdas/stock-data-fetcher
npm install
```

You should see:

```
added 2 packages
```

---

## Phase 3: Build and Test Locally

### Step 1: Build

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend
sam build
```

Expected output:

```
Build Succeeded
```

### Step 2: Test Locally (Optional)

```bash
sam local invoke StockDataFetcherFunction \
  --event test-events/api-gateway-event.json
```

**Note:** This may show DynamoDB errors (that's OK - table doesn't exist yet)

---

## Phase 4: Deploy to AWS

### Step 1: First Deployment (Interactive)

```bash
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend
sam deploy --guided
```

### Step 2: Answer Prompts

| Prompt                                              | Your Answer                |
| --------------------------------------------------- | -------------------------- |
| Stack Name                                          | `stock-trading-lambda-dev` |
| AWS Region                                          | `us-east-1`                |
| Parameter AlphaVantageApiKey                        | `[paste your API key]`     |
| Parameter DynamoDBTableName                         | `stock-price-cache`        |
| Parameter Environment                               | `dev`                      |
| Confirm changes before deploy                       | `Y`                        |
| Allow SAM CLI IAM role creation                     | `Y`                        |
| Disable rollback                                    | `n`                        |
| StockDataFetcherFunction may not have authorization | `y`                        |
| Save arguments to configuration file                | `Y`                        |
| SAM configuration file                              | `[Enter]` (use default)    |
| SAM configuration environment                       | `[Enter]` (use default)    |

### Step 3: Wait for Deployment

You'll see:

```
Deploying with following values
===============================
Stack name                   : stock-trading-lambda-dev
Region                       : us-east-1
Confirm changeset           : True
...

CREATE_COMPLETE AWS::CloudFormation::Stack stock-trading-lambda-dev
```

### Step 4: Copy Outputs

When deployment succeeds, you'll see:

```
CloudFormation outputs from deployed stack
---------------------------------------------------------------------------
Outputs
---------------------------------------------------------------------------
Key                 StockDataFetcherFunctionArn
Value               arn:aws:lambda:us-east-1:725726881036:function:stock-data-fetcher-dev
---------------------------------------------------------------------------
Key                 StockDataFetcherRoleArn
Description         Lambda IAM Role ARN - May be needed for permissions troubleshooting
Value               arn:aws:iam::725726881036:role/sam-app-StockDataFetcherFunctionRole-
GsKRZzwqyL0R
```

**⚠️ IMPORTANT:** Copy this ARN and save it!

---

## Phase 5: Test Your Lambda

### Method 1: AWS Console (Easy)

1. Go to: https://console.aws.amazon.com/lambda
2. Find function: `stock-data-fetcher-dev`
3. Click **Test** tab
4. Click **Create new event**
5. Name: `test-aapl`
6. Paste this JSON:

```json
{
  "queryStringParameters": {
    "symbols": "AAPL"
  }
}
```

7. Click **Save**
8. Click **Test** button
9. Check results - should see stock price for AAPL

### Method 2: SAM CLI

```bash
sam remote invoke StockDataFetcherFunction \
  --stack-name stock-trading-lambda-dev \
  --event test-events/api-gateway-event.json
```

---

## Phase 6: Share with Team

### For Matthew (API Gateway)

Send him:

1. **Lambda ARN:** `arn:aws:lambda:us-east-1:123456789012:function:stock-data-fetcher-dev`
2. **HTTP Method:** GET
3. **Query Parameter:** `symbols` (comma-separated)
4. **Example:** `?symbols=AAPL,MSFT,TSLA`

### For Teammate (DynamoDB)

Send him:

1. **File:** `backend/DYNAMODB_SCHEMA.md`
2. **Table Name:** `stock-price-cache`
3. **Ask:** "Have you created the DynamoDB table yet?"

---

## Phase 7: Monitor Your Lambda

### View Logs

```bash
sam logs --stack-name stock-trading-lambda-dev --tail
```

Or in AWS Console:

1. Go to CloudWatch
2. Click **Log groups**
3. Find: `/aws/lambda/stock-data-fetcher-dev`
4. Click to view logs

---

## Future Deployments

After first deployment, updating is easy:

```bash
# Make code changes to index.js

# Build and deploy
cd /Users/neilnoronha/Desktop/Repos/virtual-stock-trading-simulator/backend
sam build && sam deploy

# That's it! Uses saved config from samconfig.toml
```

---

## Troubleshooting

### "command not found: sam"

```bash
brew tap aws/tap
brew install aws-sam-cli
```

### "Unable to locate credentials"

```bash
aws configure
# Enter your team's access keys
```

### "npm: command not found"

Download Node.js from: https://nodejs.org/

### Lambda works but returns empty data

- Wait for teammate to create DynamoDB table
- Check table name matches: `stock-price-cache`
- For now, Lambda will fetch from API but can't cache

### "API rate limit exceeded"

- You hit Alpha Vantage's 5 calls/minute limit
- Wait 1 minute and try again
- Once DynamoDB exists, caching will prevent this

---

## Status Checklist

Track your progress:

- [ ] Node.js installed
- [ ] AWS CLI installed and configured
- [ ] SAM CLI installed
- [ ] Alpha Vantage API key obtained
- [ ] Dependencies installed (`npm install`)
- [ ] Lambda built (`sam build`)
- [ ] Lambda deployed (`sam deploy --guided`)
- [ ] Lambda ARN copied and saved
- [ ] Lambda tested via AWS Console
- [ ] ARN shared with Matthew
- [ ] DynamoDB schema shared with teammate
- [ ] Logs monitored (no errors)

---

## What's Next?

1. **Coordinate with teammate** - Wait for DynamoDB table creation
2. **Test with Matthew** - Once API Gateway is set up, test end-to-end
3. **Update frontend** - Once API is ready, update `docs/app.js` to call real endpoint
4. **Monitor costs** - Check AWS billing dashboard (should be < $1/month)

---

## Need Help?

1. **Check detailed docs:** `backend/README.md`
2. **DynamoDB questions:** See `backend/DYNAMODB_SCHEMA.md`
3. **AWS errors:** Check CloudWatch Logs
4. **Teammate coordination:** Share ARN and table name

---

**You're all set! 🚀**
