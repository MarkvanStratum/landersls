LEGENDSPEAK CRM UPDATE

Replace app.js, server.js, schema.sql, package.json and package-lock.json in your GitHub repository with these files. Replace public/admin-transactions.html. Keep all your other public pages and existing files.

Set ADMIN_DASHBOARD_PASSWORD in DigitalOcean to your private admin password, with Runtime scope. Keep your existing payment variables. Redeploy, then open /admin-transactions.html.

The dashboard reads the database configured by DATABASE_URL. Old records and payment/refund callbacks require the same database as the existing LegendSpeak server. A separate new database will not receive those callbacks. Keep XOLVIS_CALLBACK_URL on the existing LegendSpeak server.

Includes original authenticated transaction listing, chargeback listing/import and refund backend. The supplied HTML has no refund button; adding the backend does not add one. No live refunds or payments were performed.
