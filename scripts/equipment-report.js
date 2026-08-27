const admin = require("firebase-admin");
const { Resend } = require("resend");

// ============================================================
// Configuration
// ============================================================

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REPORT_FROM = process.env.REPORT_FROM;

const REPORT_RECIPIENTS = (process.env.REPORT_RECIPIENTS || "")
  .split(",")
  .map(email => email.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  throw new Error("Missing FIREBASE_DATABASE_URL");
}

if (!SERVICE_ACCOUNT_JSON) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
}

if (!RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY");
}

if (!REPORT_FROM) {
  throw new Error("Missing REPORT_FROM");
}

if (REPORT_RECIPIENTS.length === 0) {
  throw new Error("Missing REPORT_RECIPIENTS");
}

// ============================================================
// Firebase
// ============================================================

let serviceAccount;

try {
  serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
} catch (error) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT contains invalid JSON");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

// ============================================================
// Resend
// ============================================================

const resend = new Resend(RESEND_API_KEY);

// ============================================================
// Helpers
// ============================================================

function formatDate(timestamp) {
  if (!timestamp) return "Невідомо";

  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(Number(timestamp)));
}

function getDurationText(timestamp) {
  if (!timestamp) return "";

  const diff = Date.now() - Number(timestamp);

  if (diff < 0) return "";

  const totalMinutes = Math.floor(diff / 60000);

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days} д.`);
  }

  if (hours > 0) {
    parts.push(`${hours} год.`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} хв.`);
  }

  return parts.join(" ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// Get data
// ============================================================

async function getFirebaseData() {
  const [equipmentSnapshot, historySnapshot] = await Promise.all([
    db.ref("equipment").once("value"),
    db.ref("equipmentHistory").once("value")
  ]);

  return {
    equipment: equipmentSnapshot.val() || {},
    history: historySnapshot.val() || {}
  };
}

// ============================================================
// Find latest checkout
// ============================================================

function getLatestCheckout(historyForEquipment) {
  if (!historyForEquipment) {
    return null;
  }

  const events = Object.values(historyForEquipment);

  const checkouts = events
    .filter(event => event && event.type === "checkout")
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

  return checkouts.length > 0 ? checkouts[0] : null;
}

// ============================================================
// Build report
// ============================================================

function findIssuedEquipment(equipment, history) {
  const issued = [];

  for (const [equipmentId, item] of Object.entries(equipment)) {
    if (!item) continue;

    if (item.status !== "issued") {
      continue;
    }

    const latestCheckout = getLatestCheckout(history[equipmentId]);

    issued.push({
      id: equipmentId,
      name: item.name || "Без назви",
      surname: latestCheckout?.surname || "Невідомо",
      timestamp: latestCheckout?.timestamp || null
    });
  }

  issued.sort((a, b) => {
    return Number(a.timestamp || 0) - Number(b.timestamp || 0);
  });

  return issued;
}

// ============================================================
// HTML email
// ============================================================

function buildEmailHtml(issuedEquipment) {
  const now = new Date();

  const reportDate = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);

  let content = "";

  if (issuedEquipment.length === 0) {
    content = `
      <div style="
        background:#ecfdf3;
        border:1px solid #a7f3d0;
        border-radius:12px;
        padding:24px;
        margin-top:20px;
      ">
        <div style="font-size:28px;">🟢</div>

        <div style="
          font-size:18px;
          font-weight:600;
          color:#065f46;
          margin-top:8px;
        ">
          Уся техніка повернута
        </div>

        <div style="
          color:#047857;
          margin-top:6px;
        ">
          Станом на момент формування звіту неповернутої техніки немає.
        </div>
      </div>
    `;
  } else {
    const rows = issuedEquipment.map(item => {
      const duration = getDurationText(item.timestamp);

      return `
        <div style="
          border:1px solid #e5e7eb;
          border-radius:12px;
          padding:18px;
          margin-top:14px;
          background:#ffffff;
        ">
          <div style="
            font-size:17px;
            font-weight:600;
            color:#111827;
          ">
            🔴 ${escapeHtml(item.name)}
          </div>

          <div style="
            margin-top:10px;
            color:#4b5563;
            font-size:14px;
          ">
            <strong>Взяв:</strong>
            ${escapeHtml(item.surname)}
          </div>

          <div style="
            margin-top:5px;
            color:#4b5563;
            font-size:14px;
          ">
            <strong>Видано:</strong>
            ${escapeHtml(formatDate(item.timestamp))}
          </div>

          ${
            duration
              ? `
                <div style="
                  margin-top:5px;
                  color:#dc2626;
                  font-size:14px;
                  font-weight:600;
                ">
                  Не повернуто: ${escapeHtml(duration)}
                </div>
              `
              : ""
          }
        </div>
      `;
    }).join("");

    content = `
      <div style="
        background:#fef2f2;
        border:1px solid #fecaca;
        border-radius:12px;
        padding:20px;
        margin-top:20px;
      ">
        <div style="font-size:28px;">🔴</div>

        <div style="
          font-size:18px;
          font-weight:600;
          color:#991b1b;
          margin-top:8px;
        ">
          Неповернута техніка: ${issuedEquipment.length}
        </div>
      </div>

      ${rows}
    `;
  }

  return `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="
  margin:0;
  padding:0;
  background:#f5f7fb;
  font-family:Arial,Helvetica,sans-serif;
  color:#111827;
">

  <div style="
    max-width:620px;
    margin:0 auto;
    padding:32px 20px;
  ">

    <div style="
      background:#ffffff;
      border-radius:16px;
      padding:28px;
      border:1px solid #e5e7eb;
    ">

      <div style="
        font-size:24px;
        font-weight:700;
      ">
        EdVault
      </div>

      <div style="
        font-size:20px;
        font-weight:600;
        margin-top:8px;
      ">
        Звіт по техніці
      </div>

      <div style="
        color:#6b7280;
        font-size:14px;
        margin-top:6px;
      ">
        ${escapeHtml(reportDate)}
      </div>

      ${content}

      <div style="
        margin-top:28px;
        padding-top:18px;
        border-top:1px solid #e5e7eb;
        color:#9ca3af;
        font-size:12px;
      ">
        Автоматичний звіт EdVault
      </div>

    </div>

  </div>

</body>
</html>
  `;
}

// ============================================================
// Send email
// ============================================================

async function sendReport(issuedEquipment) {
  const count = issuedEquipment.length;

  const subject =
    count === 0
      ? "🟢 EdVault — вся техніка повернута"
      : `🔴 EdVault — ${count} од. техніки не повернуто`;

  const html = buildEmailHtml(issuedEquipment);

  const { data, error } = await resend.emails.send({
    from: REPORT_FROM,
    to: REPORT_RECIPIENTS,
    subject,
    html
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  console.log("Email sent successfully.");
  console.log("Resend ID:", data?.id || "unknown");
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("========================================");
  console.log("EdVault Equipment Report");
  console.log("========================================");

  console.log("Reading Firebase...");

  const { equipment, history } = await getFirebaseData();

  console.log(
    `Found ${Object.keys(equipment).length} equipment records.`
  );

  const issuedEquipment = findIssuedEquipment(
    equipment,
    history
  );

  console.log(
    `Currently issued: ${issuedEquipment.length}`
  );

  if (issuedEquipment.length > 0) {
    console.log("Issued equipment:");

    for (const item of issuedEquipment) {
      console.log(
        `- ${item.name} | ${item.surname} | ${formatDate(item.timestamp)}`
      );
    }
  }

  await sendReport(issuedEquipment);

  console.log("Report completed successfully.");
}

main()
  .catch(error => {
    console.error("REPORT FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await admin.app().delete();
    } catch {
      // Ignore cleanup errors
    }
  });
