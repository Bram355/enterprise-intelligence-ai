# Northwind API HTTP Error Reference (SAMPLE)

This is a synthetic sample document for development. Northwind Payments is a fictional company.

## 400 Bad Request

The request body is not valid JSON or a required field is missing. The response body lists the invalid fields in "errors". Fix the fields and send the request again.

## 401 Unauthorized

The API key is missing or invalid. Send the key in the Authorization header as "Bearer <key>". Sandbox keys start with sk_test_ and only work against the sandbox host. See the Payments API troubleshooting guide for error PAY-401.

## 403 Forbidden

The key is valid but does not have permission for this endpoint. Restricted keys need the matching scope, for example payouts:read for the payouts endpoints. Ask a merchant admin to add the scope in the dashboard under API keys.

## 404 Not Found

The resource ID does not exist in this environment. Sandbox and live IDs are separate: a payment created in sandbox cannot be fetched with a live key.

## 422 Unprocessable Entity

The request is valid JSON but breaks a business rule, for example a refund larger than the original payment. The "code" field explains the rule.

## 429 Too Many Requests

The default limit is 100 requests per second per merchant. Wait for the number of seconds in the Retry-After header, then retry with exponential backoff. Do not retry immediately in a loop.

## 500, 502 and 503 Server errors

These are Northwind-side errors. Retry up to 3 times with exponential backoff, reusing the same idempotency key so a payment is never taken twice. Check status.northwind.test for incidents.

## When to escalate

Escalate to the Platform on-call team if 5xx errors continue for more than 10 minutes with no incident on the status page. Include the request ID from the X-Request-Id response header, the endpoint, the timestamp in UTC and the environment.
