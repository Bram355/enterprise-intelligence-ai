# Northwind SDK and Plugin Troubleshooting (SAMPLE)

This is a synthetic sample document for development. Northwind Payments is a fictional company.

## Supported versions

The Node SDK supports Node.js 18 and later. The PHP SDK supports PHP 8.1 and later. Older runtimes fail with "Unsupported runtime" at start-up.

## SDK requests time out

The SDKs time out after 30 seconds by default. Check that the server can reach api.northwind.test on port 443, then raise the timeout option only if a firewall or proxy is confirmed to be slow.

## WooCommerce plugin: payments stay "Pending"

The order stays Pending when the plugin never receives the payment webhook.

1. In WooCommerce > Settings > Northwind, check that the webhook URL ends with /wc-api/northwind.
2. Copy the webhook signing secret from the Northwind dashboard into the plugin settings again.
3. Use "Send test webhook" in the dashboard. The plugin log should show "Webhook verified".

## Plugin update broke checkout

Clear the site cache and any CDN cache after updating. If checkout still fails, roll back to the previous plugin version from the Releases page and report the version numbers.

## When to escalate

Escalate to the Integrations team if a test webhook is still not verified after re-entering the secret, or if checkout fails on the latest plugin version with caches cleared. Include the plugin and platform versions, the plugin log, and the merchant ID.
