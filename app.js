import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Guest promo payment routes extracted from the supplied original server.
export function createApp({pool, publicDir, gatewayFetch = globalThis.fetch}) {
 const app = express();
 const fetch = gatewayFetch;
 const appUrl = new URL(process.env.APP_URL);
 if (!['https:','http:'].includes(appUrl.protocol)) throw new Error('APP_URL must be an HTTP(S) URL');
 app.set('trust proxy', 1);
 app.use(express.json());
 app.use(express.urlencoded({extended:true}));
 function createToken(bytes = 24) {return crypto.randomBytes(bytes).toString('base64url');}
 function getXolvisAuthHeader() {
   return 'Basic ' + Buffer.from(`${process.env.XOLVIS_API_USER}:${process.env.XOLVIS_API_PASSWORD}`).toString('base64');
 }
 app.get('/health',async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true});});
 app.get('/',(req,res)=>res.redirect('/xo-cl1-2-ls.html'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'')));
 app.get('/c/:token',async(req,res)=>{
  try {
   const result=await pool.query('SELECT * FROM promo_checkout_links WHERE token=$1 AND expires_at>NOW() AND used_at IS NULL',[req.params.token]);
   if(!result.rows.length) return res.status(404).send('Not found');
   const checkout=result.rows[0];
   if(!/^[a-zA-Z0-9_-]+\.html$/.test(checkout.step2_file)) return res.status(404).send('Not found');
   let html=await fs.readFile(path.join(publicDir,checkout.step2_file),'utf8');
   const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c');
   html=html.replace('</head>',`<script>window.PROMO_CHECKOUT_TOKEN=${safe(req.params.token)};window.CHECKOUT_PLAN=${safe(checkout.plan)};window.XOLVIS_PUBLIC_INTEGRATION_KEY=${safe(process.env.XOLVIS_PUBLIC_INTEGRATION_KEY||'')};</script></head>`);
   res.send(html);
  } catch(error){console.error('Promo page error:',error.code||error.name);res.status(500).send('Could not open checkout');}
 });

app.post("/api/promo-funnel-event", async (req, res) => {
  try {
    const {
  flowId,
  eventName,
  pageUrl,
  affiliateRef,
  eventDetails
} = req.body || {};

    const cleanFlowId =
      String(flowId || "").trim();

    const cleanEventName =
      String(eventName || "").trim();

    if (!cleanFlowId) {
      return res.status(400).json({
        ok: false,
        error: "Missing flow ID"
      });
    }

    const allowedEvents = [
  "PAGE1_LOADED",
  "PAGE1_BUTTON_CLICKED",
  "CHECKOUT_LINK_CREATED",
  "PAGE2_LOADED",
  "PAYMENT_FIELDS_READY",
  "PAYMENT_INIT_FAILED",
  "PAYMENT_BUTTON_CLICKED",
  "PAYMENT_TOKEN_CREATED",
  "PAYMENT_TOKEN_FAILED",
  "XOLVIS_TRANSACTION_CREATED"
];

    if (!allowedEvents.includes(cleanEventName)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid funnel event"
      });
    }

    const cleanEventDetails =
  String(eventDetails || "")
    .slice(0, 5000);

await pool.query(
  `
  INSERT INTO promo_funnel_events
  (
    flow_id,
    event_name,
    page_url,
    affiliate_ref,
    user_agent,
    ip,
    event_details
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)

  ON CONFLICT (flow_id, event_name)
  DO UPDATE SET
    event_details =
      CASE
        WHEN EXCLUDED.event_details IS NOT NULL
             AND EXCLUDED.event_details <> ''
        THEN EXCLUDED.event_details
        ELSE promo_funnel_events.event_details
      END
  `,
  [
    cleanFlowId,
    cleanEventName,
    pageUrl || null,
    affiliateRef || null,
    req.headers["user-agent"] || "",
    req.ip || null,
    cleanEventDetails || null
  ]
);

    return res.json({
      ok: true
    });

  } catch (err) {
    console.error(
      "PROMO FUNNEL EVENT ERROR:",
      err
    );

    return res.status(500).json({
      ok: false
    });
  }
});
app.post("/api/create-promo-checkout-link", async (req, res) => {
  try {
    const {
      plan,
      step2File,
      sourcePage,
      firstName,
      lastName,
      name,
      email,
      phonePrefix,
      phone,
      address,
      postcode,
      city,
      country,
      ref,
      originalQueryString,
      successUrl
    } = req.body || {};

    const loggedInUser =
  null;

// Main website checkout must always belong
// to a logged-in user account.
if (
  step2File === "checkout.html" &&
  !loggedInUser
) {
  return res.status(401).json({
    error: "Please log in before continuing to checkout"
  });
}

const checkoutUserId =
  loggedInUser?.id || null;

const checkoutEmail =
  loggedInUser?.email ||
  email?.trim().toLowerCase();

if (!checkoutEmail) {
  return res.status(400).json({
    error: "Email is required"
  });
}

const token = createToken(18);

    if (!/^[a-zA-Z0-9_-]+\.html$/.test(step2File || '') || step2File === 'checkout.html') {
      return res.status(400).json({error:'Invalid checkout page'});
    }
    try { await fs.access(path.join(publicDir, step2File)); }
    catch { return res.status(400).json({error:'Checkout page not found'}); }
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    );

    await pool.query(
      `
      INSERT INTO promo_checkout_links
      (
        token,
        step2_file,
        plan,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        address,
        postcode,
        city,
        country,
        affiliate_ref,
        source_page,
        original_query_string,
success_url,
user_id,
ip,
user_agent,
expires_at      )
            VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      `,
      [
        token,
        step2File || "sth-fi-uk2.html",
        plan || "lifetime",
        firstName || null,
        lastName || null,
        name || null,
checkoutEmail,
`${phonePrefix || ""}${phone || ""}`,
        address || null,
        postcode || null,
        city || null,
        country || "United Kingdom",
        ref || null,
        sourcePage || null,
        originalQueryString || null,
successUrl || null,
checkoutUserId,
req.ip,
        req.headers["user-agent"] || "",
        expiresAt      ]
    );

    res.json({
      url: `/c/${token}`
    });

  } catch (err) {
    console.error("Create promo checkout link error:", err);

    res.status(500).json({
      error: "Could not create promo checkout link"
    });
  }
});
app.post("/api/create-promo-payment", async (req, res) => {
  try {
    const {
  checkoutToken,
  cardholderName,
  transactionToken,
  cardData,
  flowId,
  clickid,
  affiliate_source
} = req.body || {};

    if (!checkoutToken) {
      return res.status(400).json({ error: "Missing checkout token" });
    }

    if (!transactionToken) {
      return res.status(400).json({ error: "Missing Xolvis transaction token" });
    }

// --------------------------------------------
// SAFE CARD METADATA FROM XOLVIS PAYMENT.JS
// --------------------------------------------

const cardBin =
  String(
    cardData?.first_six_digits ||
    cardData?.bin_digits ||
    ""
  )
    .replace(/\D/g, "")
    .slice(0, 8);

const cardType =
  typeof cardData?.card_type === "string"
    ? cardData.card_type.trim().toLowerCase()
    : "";

const cardLastFour =
  String(cardData?.last_four_digits || "")
    .replace(/\D/g, "")
    .slice(-4);

const cardCountry =
  String(
    cardData?.bin_country ||
    cardData?.binCountry ||
    cardData?.country_alpha2 ||
    cardData?.country ||
    ""
  )
    .trim()
    .toUpperCase();


console.log("SAFE CARD METADATA:", {
  bin: cardBin,
  cardType,
  lastFour: cardLastFour
});


    const result = await pool.query(
      `
      SELECT *
      FROM promo_checkout_links
      WHERE token = $1
      AND expires_at > NOW()
      AND used_at IS NULL
      `,
      [checkoutToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invalid or expired checkout link" });
    }

    const checkout = result.rows[0];

const originalParams =
  new URLSearchParams(checkout.original_query_string || "");

const affiliateSource =
  originalParams.get("ref") ||
  checkout.affiliate_ref ||
  originalParams.get("affiliate_source") ||
  affiliate_source ||
  "";

const trafficSource =
  originalParams.get("source") || "";

const binomClickid =
  originalParams.get("clickid") || clickid || "";

const subId =
  originalParams.get("sub_id") || "";

const email =
  String(checkout.email || "")
    .trim()
    .toLowerCase();

const selectedPlan =
  checkout.plan || "3795";

const amounts = {
  "2295": 22.95,
  "2695": 26.95,
  "3795": 37.95,
  "lifetime": 37.95
};

const amount = amounts[selectedPlan];

if (!amount) {
  return res.status(400).json({
    error: "Invalid promo plan"
  });
}


// --------------------------------------------
// MAXIMUM 3 PAYMENT ATTEMPTS PER EMAIL / 24 HOURS
// --------------------------------------------

const previousAttemptsResult =
  await pool.query(
    `
    SELECT COUNT(*)::int AS attempt_count
    FROM xolvis_payments
    WHERE LOWER(email) = $1
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND reference LIKE 'promo-%'
      AND UPPER(COALESCE(status, '')) NOT IN (
        'OK',
        'FINISHED',
        'SUCCESSFUL'
      )
    `,
    [email]
  );

const previousAttempts =
  Number(
    previousAttemptsResult.rows[0]?.attempt_count || 0
  );

console.log(
  "PAYMENT ATTEMPTS FOR EMAIL:",
  email,
  previousAttempts
);

if (previousAttempts >= 3) {
  console.warn(
    "PAYMENT BLOCKED: TOO MANY ATTEMPTS:",
    email
  );

  return res.status(429).json({
    success: false,
    error:
      "You have reached the maximum number of payment attempts. Please try again later.",
    code: "TOO_MANY_PAYMENT_ATTEMPTS"
  });
}
    
let mainSiteSuccessUrl;

if (selectedPlan === "2295") {
  mainSiteSuccessUrl =
    process.env.XOLVIS_SUCCESS_URL_2295;

} else if (selectedPlan === "2695") {
  mainSiteSuccessUrl =
    process.env.XOLVIS_SUCCESS_URL_2695;

} else if (
  selectedPlan === "3795" ||
  selectedPlan === "lifetime"
) {
  mainSiteSuccessUrl =
    process.env.XOLVIS_SUCCESS_URL_3795;
}
const selectedSuccessUrl =
  checkout.success_url ||
  mainSiteSuccessUrl ||
  process.env.XOLVIS_SUCCESS_URL;
    if (!selectedSuccessUrl) {
      return res.status(500).json({
        error: "No payment success URL configured"
      });
    }

    let finalSuccessUrl;

    try {
      const successUrlObject =
        new URL(selectedSuccessUrl);

      if (checkout.original_query_string) {
        const originalParameters =
          new URLSearchParams(
            checkout.original_query_string
          );

        for (
          const [key, value]
          of originalParameters.entries()
        ) {
          successUrlObject.searchParams.set(
            key,
            value
          );
        }
      }

      if (checkout.affiliate_ref) {
        successUrlObject.searchParams.set(
          "ref",
          checkout.affiliate_ref
        );
      }

      finalSuccessUrl =
        successUrlObject.toString();

    } catch (error) {
      console.error(
        "Invalid success URL:",
        selectedSuccessUrl,
        error
      );

      return res.status(500).json({
        error: "Invalid payment success URL"
      });
    }

    const reference = `promo-${selectedPlan}-${Date.now()}`;



// --------------------------------------------
// BLOCK UNSUPPORTED CARD BRANDS
// --------------------------------------------

const normalizedCardType =
  String(cardType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const supportedCardTypes = [
  "visa",
  "mastercard",
  "mastercarddebit",
  "mastercardcredit",
  "mc"
];

const isUnsupportedCardType =
  Boolean(normalizedCardType) &&
  !supportedCardTypes.includes(normalizedCardType);

if (isUnsupportedCardType) {
  console.warn("PAYMENT BLOCKED BY CARD TYPE RULE:", {
    cardType,
    normalizedCardType,
    bin: cardBin,
    lastFour: cardLastFour
  });

   await pool.query(
    `
    INSERT INTO xolvis_payments
    (
      reference,
      email,
      plan,
      amount,
      status,
      xolvis_payload,
      user_id,
      binom_clickid,
      affiliate_source,
      traffic_source,
      sub_id,
      card_bin,
      card_type,
      last_four
    )
    VALUES ($1, $2, $3, $4, 'BLOCKED', $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (reference) DO NOTHING
    `,
    [
      reference,
      email,
      selectedPlan,
      amount,
      {
        result: "BLOCKED",
        message: "CARD_TYPE_NOT_SUPPORTED",
        binCountry: cardCountry || null,
        cardType: cardType || null,
        cardBin: cardBin || null,
        lastFour: cardLastFour || null
      },
      checkout.user_id || null,
      binomClickid || null,
      affiliateSource || null,
      trafficSource || null,
      subId || null,
      cardBin || null,
      cardType || null,
      cardLastFour || null
    ]
  );

  return res.status(400).json({
    success: false,
    error:
      "Only Visa and Mastercard are accepted. Please use another card.",
    code: "CARD_TYPE_NOT_SUPPORTED"
  });
}

// --------------------------------------------
// CHECK CONFIGURED BLOCKED BINS
// --------------------------------------------

const blockedCardBins =
  String(process.env.BLOCKED_CARD_BINS || "")
    .split(",")
    .map(bin => bin.trim().replace(/\D/g, ""))
    .filter(Boolean);

const isBlockedBin =
  Boolean(cardBin) &&
  blockedCardBins.includes(cardBin);

if (isBlockedBin) {
  console.warn("PAYMENT BLOCKED BY BIN RULE:", {
    bin: cardBin,
    cardType,
    lastFour: cardLastFour
  });

  await pool.query(
    `

      INSERT INTO xolvis_payments
    (
      reference,
      email,
      plan,
      amount,
      status,
      xolvis_payload,
      user_id,
      binom_clickid,
            affiliate_source,
      traffic_source,
      sub_id,
      card_bin,
      card_type,
      last_four
    )
    VALUES ($1, $2, $3, $4, 'BLOCKED', $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (reference) DO NOTHING
    `,
    [
      reference,
      email,
      selectedPlan,
      amount,
      {
        result: "BLOCKED",
        message: "CARD_BIN_BLOCKED",
        binCountry: cardCountry || null,
        cardType: cardType || null,
        cardBin: cardBin || null,
        lastFour: cardLastFour || null
      },
      checkout.user_id || null,
      binomClickid || null,
      affiliateSource || null,
      trafficSource || null,
      subId || null,
      cardBin || null,
      cardType || null,
      cardLastFour || null
]
  );

  return res.status(400).json({
    success: false,
    error:
      "This card cannot be accepted. Please use another payment method.",
    code: "CARD_BIN_BLOCKED"
  });
}

const paymentResultUrl =
  new URL("/payment-result", appUrl).toString() + "?reference=" +
  encodeURIComponent(reference);

await pool.query(
  `
  INSERT INTO xolvis_payments
  (
    reference,
    email,
    plan,
    amount,
    user_id,
    binom_clickid,
    affiliate_source,
    traffic_source,
    sub_id,
    card_bin,
    card_type,
    last_four,
    final_redirect_url
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  ON CONFLICT (reference) DO NOTHING
  `,
  [
    reference,
    email,
    selectedPlan,
    amount,
    checkout.user_id || null,
    binomClickid || null,
    affiliateSource || null,
    trafficSource || null,
    subId || null,
    cardBin || null,
    cardType || null,
    cardLastFour || null,
    finalSuccessUrl
  ]
);

const trackingCallbackUrl =
  process.env.XOLVIS_CALLBACK_URL;

if (!trackingCallbackUrl) {
  return res.status(500).json({
    error: "XOLVIS_CALLBACK_URL is not configured"
  });
}

    const response = await fetch(
  `${process.env.XOLVIS_BASE_URL}/transaction/${process.env.XOLVIS_CONNECTOR_API_KEY}/debit`,
  {
    method: "POST",
    headers: {
      Authorization: getXolvisAuthHeader(),
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json"
    },
    body: JSON.stringify({
      merchantTransactionId: reference,
      transactionToken: transactionToken,
      amount: amount.toFixed(2),
      currency: "GBP",
      description: "Legend Speak Access",

      successUrl: paymentResultUrl,
      cancelUrl: paymentResultUrl,
      errorUrl: paymentResultUrl,

      callbackUrl: trackingCallbackUrl,
      customer: {
        email: email,
        firstName: checkout.first_name || "",
        lastName: checkout.last_name || "",
        ipAddress: req.ip || "127.0.0.1"
      },
      language: "en"
    })
  }
);

const rawText = await response.text();

console.log("PROMO XOLVIS STATUS:", response.status);
console.log("PROMO XOLVIS RAW RESPONSE:", rawText);

let data = {};

try {
  data = rawText ? JSON.parse(rawText) : {};
} catch {
  data = { raw: rawText };
}

await pool.query(
  `
  UPDATE xolvis_payments
  SET xolvis_payload = $1,
      xolvis_uuid = $2,
      status = $3
  WHERE reference = $4
  `,
  [
    data,
    data.uuid || null,
    data.returnType || "created",
    reference
  ]
);

if (
  !response.ok ||
  data.success === false ||
  data.returnType === "ERROR"
) {
  return res.status(500).json({
    error: "Xolvis error",
    details: data
  });
}


// --------------------------------------------
// FUNNEL: XOLVIS TRANSACTION CREATED
// --------------------------------------------

const cleanFlowId =
  String(flowId || "").trim();

if (cleanFlowId) {
  try {
    await pool.query(
      `
      INSERT INTO promo_funnel_events
      (
        flow_id,
        event_name,
        page_url,
        affiliate_ref,
        user_agent,
        ip
      )
      VALUES ($1, $2, $3, $4, $5, $6)

      ON CONFLICT (flow_id, event_name)
      DO NOTHING
      `,
      [
  cleanFlowId,
  "XOLVIS_TRANSACTION_CREATED",
  null,
  affiliateSource || null,
  req.headers["user-agent"] || "",
  req.ip || null
]
    );

    console.log(
      "FUNNEL EVENT: XOLVIS_TRANSACTION_CREATED",
      cleanFlowId
    );

  } catch (funnelError) {
    console.error(
      "XOLVIS FUNNEL TRACKING ERROR:",
      funnelError
    );
  }
}


res.json({
  ...data,
  amount: amount.toFixed(2),
  currency: "GBP",
  plan: selectedPlan,
  paymentResultUrl: paymentResultUrl
});

  } catch (err) {
    console.error("Promo Xolvis payment error:", err);
    res.status(500).json({ error: "Could not create promo payment" });
  }
});
app.get("/api/payment-result-status", async (req, res) => {
  try {
    const reference =
      String(req.query.reference || "").trim();

    if (!reference) {
      return res.status(400).json({
        ok: false,
        error: "Missing payment reference"
      });
    }

    const result = await pool.query(
      `
      SELECT
        reference,
        status,
        paid_at,
        final_redirect_url,
        xolvis_payload
      FROM xolvis_payments
      WHERE reference = $1
      LIMIT 1
      `,
      [reference]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Payment not found"
      });
    }

    const payment = result.rows[0];

const trackingResult = await pool.query(
  `
  SELECT original_query_string, affiliate_ref
  FROM promo_checkout_links
  WHERE email = (
    SELECT email
    FROM xolvis_payments
    WHERE reference = $1
    LIMIT 1
  )
  ORDER BY created_at DESC
  LIMIT 1
  `,
  [reference]
);

const trackingCheckout =
  trackingResult.rows[0] || {};

const originalParameters =
  new URLSearchParams(
    trackingCheckout.original_query_string || ""
  );

const incomingSub1 =
  originalParameters.get("sub1");

const incomingSub2 =
  originalParameters.get("sub2");

function buildFailureRedirectUrl(baseUrl) {
  if (!baseUrl) return "";

  const urlObject =
    new URL(baseUrl);

  if (incomingSub1) {
    urlObject.searchParams.set(
      "sub3",
      incomingSub1
    );
  }

  if (incomingSub2) {
    urlObject.searchParams.set(
      "sub4",
      incomingSub2
    );
  }

  if (trackingCheckout.affiliate_ref) {
    urlObject.searchParams.set(
      "ref",
      trackingCheckout.affiliate_ref
    );
  }

  return urlObject.toString();
}

const finalCancelUrl =
  buildFailureRedirectUrl(
    process.env.XOLVIS_CANCEL_URL
  );

const finalErrorUrl =
  buildFailureRedirectUrl(
    process.env.XOLVIS_ERROR_URL ||
    process.env.XOLVIS_CANCEL_URL
  );

    const status =
      String(payment.status || "")
        .trim()
        .toUpperCase();

    const payload =
      payment.xolvis_payload || {};

    const gatewayMessage =
      String(payload.message || "")
        .trim()
        .toLowerCase();

    const adapterMessage =
      String(payload.adapterMessage || "")
        .trim()
        .toLowerCase();

    const gatewayCode =
      String(payload.code || "")
        .trim();

    // --------------------------------------------
    // REAL SUCCESS
    // --------------------------------------------

    if (
      payment.paid_at &&
      payment.final_redirect_url
    ) {
      return res.json({
        ok: true,
        final: true,
        successful: true,
        resultType: "SUCCESS",
        status: status,
        redirectUrl: payment.final_redirect_url
      });
    }

    // --------------------------------------------
    // EXPLICIT USER CANCELLATION
    // --------------------------------------------

    const isUserCancelled =
      gatewayCode === "1003" ||
      gatewayMessage === "user cancelled" ||
      adapterMessage === "cancelled by user";

    if (isUserCancelled) {
      return res.json({
        ok: true,
        final: true,
        successful: false,
        resultType: "CANCEL",
        status: status,
redirectUrl:
  finalCancelUrl      });
    }

    // --------------------------------------------
    // ALL OTHER FINAL FAILURES
    // --------------------------------------------

    const isFailure =
      status === "ERROR" ||
      status === "FAILED" ||
      status === "DECLINED" ||
      status === "CANCELLED" ||
      status === "BLOCKED";

    if (isFailure) {
      return res.json({
        ok: true,
        final: true,
        successful: false,
        resultType: "ERROR",
        status: status,
        redirectUrl:
  finalErrorUrl
      });
    }

    // --------------------------------------------
    // STILL WAITING FOR FINAL WEBHOOK
    // --------------------------------------------

    return res.json({
      ok: true,
      final: false,
      successful: false,
      resultType: "PENDING",
      status: status || "UNKNOWN"
    });

  } catch (err) {
    console.error(
      "PAYMENT RESULT STATUS ERROR:",
      err
    );

    return res.status(500).json({
      ok: false,
      error: "Could not check payment status"
    });
  }
});
app.get("/payment-result", (req, res) => {
  const reference =
    String(req.query.reference || "").trim();

  if (!reference) {
    return res.status(400).send(
      "Invalid payment reference."
    );
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>Checking Payment</title>
</head>

<body style="
  font-family: Arial, sans-serif;
  text-align: center;
  padding: 80px 20px;
">

  <h2 id="title">
    Checking your payment...
  </h2>

  <p id="message">
    Please wait while we confirm your transaction.
  </p>

  <script>
    const reference =
      ${JSON.stringify(reference).replace(/</g, "\\u003c")};

    let attempts = 0;

    const maxAttempts = 300;

    async function checkPayment() {
      attempts++;

      try {
        const response = await fetch(
          "/api/payment-result-status?reference=" +
          encodeURIComponent(reference),
          {
            cache: "no-store"
          }
        );

        const data =
          await response.json();

        if (
          data.ok === true &&
          data.final === true &&
          data.redirectUrl
        ) {
          window.location.replace(
            data.redirectUrl
          );

          return;
        }

      } catch (error) {
        console.error(
          "Payment check failed:",
          error
        );
      }

      if (attempts < maxAttempts) {
        setTimeout(
          checkPayment,
          2000
        );

        return;
      }

      document.getElementById(
        "title"
      ).textContent =
        "Payment still processing";

      document.getElementById(
        "message"
      ).textContent =
        "We have not yet received confirmation of your payment. Please do not submit another payment.";
    }

    checkPayment();
  </script>

</body>
</html>
  `);
});
 app.use(express.static(publicDir));
 return app;
}
