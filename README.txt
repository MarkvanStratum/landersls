LEGENDSPEAK - CHILE CHECKOUT ON DIGITALOCEAN

WHAT THIS PACKAGE DOES
Serves the uploaded Chile pages and the guest promo checkout/payment routes.
The pages are unchanged. Start at /xo-cl1-2-ls.html. No ref parameter is required.
Step one creates a 30-minute token and loads step two through /c/:token.
Do not test step two by opening its HTML directly: it needs the token and public
integration key injected by /c/:token.

PAYMENT BEHAVIOR PRESERVED FROM YOUR UPLOADED SERVER
- Chile page chooses plan 2695 and charges GBP 26.95.
- Other source-server plans remain: 2295 = GBP22.95, 3795/lifetime = GBP37.95.
- Original customer data, Xolvis Basic authentication, card metadata and
  affiliate parameters are retained.
- Visa/Mastercard rules and configured blocked BINs are retained.
- Original maximum three unsuccessful/blocked attempts per email in 24 hours
  is retained. This server differs from the German server in counting BLOCKED
  attempts; this package deliberately follows THIS uploaded server.
- Xolvis returns the customer to /payment-result after success/cancel/error.
- That page waits for the real callback status, then redirects to the original
  successful, cancelled or failed destination. It polls every two seconds for
  up to 300 attempts, just as the original server does.
- Successful destinations preserve the original query string and ref.
- Cancel/error destinations map sub1 to sub3, sub2 to sub4, and retain ref.
- Funnel event collection used by step two is included.

IMPORTANT DATABASE AND CALLBACK REQUIREMENT
Use the EXISTING LEGENDSPEAK DATABASE, not the German app's database and not a
new empty database. Keep the existing LegendSpeak server running and copy its
XOLVIS_CALLBACK_URL exactly, including any query string.

Why: the original LegendSpeak webhook updates payment status in that database,
grants account access, and creates receipts. This small checkout app reads the
same payment record to complete the redirect. A new separate database would
break that link: the original webhook could not find these transactions and
customers could wait indefinitely for confirmation.

The existing LegendSpeak server retains its account, receipt, refund and admin
functions. This package does not contain those routes or a new webhook handler.
Do not stop that existing server or change the callback to this new app.
This is a separate checkout front end, not a full replacement for LegendSpeak.

If you require a completely separate database, the callback and fulfillment
need a further migration before taking payments; this package is not that mode.

FILES
server.js       DigitalOcean startup, configuration and database certificate
app.js          Extracted checkout, payment, result and funnel routes
schema.sql      Creates required tables if missing; adds payment result column
package.json    npm start and npm test
package-lock.json
Procfile        web: npm start
public/xo-cl1-2-ls.html
public/xo-cl2-2-ls.html
verify.mjs      Simulated gateway verification (no real charge)
README.txt      This file

CODE CHANGES
- Removed the AI, login, chat, admin and other unrelated application routes.
- Guest checkout stays guest checkout; no authentication system is loaded.
- Added validated filenames for serving more uploaded promo pages safely.
- Replaced the hardcoded https://legendspeak.net/payment-result host with the
  new APP_URL. The result page and its decisions otherwise use original logic.
- Added database CA-certificate support and safe script injection.
- Added /health and a root redirect to the Chile step-one page.
- HTML files are byte-for-byte copies of your uploads; no visual or payment
  script edits were made. They already use relative API URLs.

CREATE THE NEW GITHUB REPOSITORY
1. Unzip legendspeak-digitalocean-checkout.zip on your Windows laptop.
2. Create a separate repository, e.g. legendspeak-checkout.
3. Upload the CONTENTS of the extracted folder, including public and its pages.
4. package.json, server.js and app.js must be at the repository root.
5. Do not upload node_modules, .env or passwords.

CREATE THE DIGITALOCEAN APP
1. App Platform -> Create App -> GitHub -> the new repository, branch main.
2. Component type: Web Service (not Static Site).
3. Source directory: /.
4. Build command: leave blank; Node buildpack installs dependencies.
5. Run command: npm start.
6. HTTP port: 8080. Route: / (preserve full paths).
7. Health check path: /health, if setting an HTTP health check.
8. Enable deploy on push if desired.
9. Add the environment variables below before deploying.

VARIABLES - PUT THEM ON THIS NEW WEB SERVICE
Use Run time scope. Run and build time also works for ordinary literal values,
but DigitalOcean bindable values must be available at runtime.
Encrypt credentials and the database connection URL.

REQUIRED
DATABASE_URL
  Public/external connection string to the EXISTING LEGENDSPEAK PostgreSQL DB.
  An old host's private/internal database hostname generally cannot be used
  from DigitalOcean. Get its external connection string from that host.
  Permit the new app to connect if the database has access restrictions.
  Do not paste the German DigitalOcean database connection string here.

APP_URL
  The public HTTPS origin of this NEW checkout app (no page filename).
  To avoid needing a domain before the first deployment, use the runtime value:
  ${_self.PUBLIC_URL}
  Or enter the new app's literal HTTPS .ondigitalocean.app address/custom domain.
  Do not enter the old LegendSpeak website URL here.

XOLVIS_BASE_URL
XOLVIS_CONNECTOR_API_KEY
XOLVIS_API_USER
XOLVIS_API_PASSWORD
XOLVIS_PUBLIC_INTEGRATION_KEY
  Copy each from the existing LEGENDSPEAK host.

XOLVIS_CALLBACK_URL
  Copy the existing LEGENDSPEAK callback URL exactly. The existing server must
  remain accessible and must use the same database as this checkout app.
  Do not point this at the new checkout app; it has no webhook handler.

XOLVIS_CANCEL_URL
  Copy the original cancel destination.

XOLVIS_ERROR_URL
  Copy the original error destination. If absent, source behavior falls back
  to XOLVIS_CANCEL_URL. Configure both to preserve distinct destinations.

DATABASE CERTIFICATE - IF REQUIRED BY THE EXISTING DATABASE
DATABASE_CA_CERT
  Supply the actual PEM CA certificate supplied by the EXISTING database host,
  including BEGIN CERTIFICATE and END CERTIFICATE lines.
  The server also accepts literal backslash-n line separators.
  Do not use ${db.CA_CERT} unless db is actually the SAME database attached to
  this app. The German app's certificate does not belong to this database.
  TLS certificate verification stays enabled.

OPTIONAL / COPY IF PRESENT ON THE ORIGINAL HOST
BLOCKED_CARD_BINS
  Copy the original comma-separated list. Omitting it removes configured BIN
  blocks, so copy it if you want the same blocking behavior.
XOLVIS_SUCCESS_URL
XOLVIS_SUCCESS_URL_2295
XOLVIS_SUCCESS_URL_2695
XOLVIS_SUCCESS_URL_3795
  Copy the existing destinations for other pages. The supplied Chile step-one
  page sends its own BeMob success URL, which takes precedence over these.
NODE_ENV=production
  Recommended environment mode; it does not change the checkout flow.
PORT=8080
  Optional; the server uses DigitalOcean's PORT or defaults to 8080.

NOT NEEDED IN THIS NEW APP
OpenAI/OpenRouter keys, JWT secrets, admin password, email/R2 keys and webhook
secrets from unrelated logic are not needed here. The existing full LegendSpeak
server still needs its own original configuration.

AFTER DEPLOYMENT
1. Deploy logs should show Checkout server ready.
2. Open https://YOUR-NEW-APP-DOMAIN/xo-cl1-2-ls.html.
3. Enter your name and email and continue. Check that card fields load on /c/...
4. Verify the existing callback is receiving transactions from this app and
   updating the shared xolvis_payments record before sending live traffic.
5. Confirm success, cancellation and decline destinations using your payment
   provider's approved test process. Confirm affiliate tracking, website access
   and receipts in the old LegendSpeak system.
6. Add the custom domain in this new app's Networking -> Domains section.
   DNS setup does not require changing the HTML files.

ADDING MORE PAGES
Upload them into public. Step one must send the correct step2File filename,
use an existing supported plan, and call the relative /api routes. Step two must
use the injected PROMO_CHECKOUT_TOKEN. Arbitrary new plan values are not accepted.

VALIDATION AND LIMITS
npm test passed with PostgreSQL-compatible PGlite and a mocked gateway:
plan amounts, GBP, tokens, affiliate fields, callback address, pending/success/
cancel/error decisions, BIN/brand rules, original attempt limit, funnel events,
missing ref and invalid filenames. Uploaded HTML files are unchanged.
No live payment was made. Your database credentials, TLS CA, callback delivery,
external receipt/account server and public deployment cannot be verified locally.

Official deployment references:
https://docs.digitalocean.com/products/app-platform/how-to/create-apps/
https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/
https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/
