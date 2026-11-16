# Northwind POS Terminal Troubleshooting (SAMPLE)

This is a synthetic sample document for development. Northwind Payments is a fictional company.

## Terminal offline (error T-102)

T-102 means the terminal cannot reach the Northwind gateway.

1. Check the network icon on the terminal home screen. A red icon means no network connection.
2. For wired terminals, reseat the Ethernet cable and confirm the router port light is on.
3. For Wi-Fi terminals, open Settings > Network and reconnect to the store network. The terminal needs outbound access to gateway.northwind.test on port 443.
4. Restart the terminal by holding the power button for 10 seconds. It should show "Ready" within 2 minutes.

## Card reader errors (error T-205)

T-205 means the card could not be read.

1. Ask the customer to tap or insert the card again instead of swiping.
2. Clean the chip reader slot with a dry card-cleaning swab.
3. If every card fails, run Settings > Diagnostics > Card reader test. The test should finish with "Reader OK".

## Terminal not activated (error T-310)

T-310 appears when the terminal has not been linked to a merchant account. Enter the 8-digit activation code from the merchant dashboard under Devices. Activation codes expire after 24 hours.

## Receipt printer problems

If receipts print blank, the paper roll is upside down. The shiny side must face the print head.

## When to escalate

Escalate to Field Engineering if the terminal is still offline after a restart and a working network has been confirmed, if the Card reader test fails, or if the screen shows "Tamper detected". Include the terminal serial number (on the sticker underneath), the store ID, the error code, and the steps already tried. Never open a terminal that shows "Tamper detected"; take it out of service.
