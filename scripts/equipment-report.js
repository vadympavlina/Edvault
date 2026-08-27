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


// ============================================================
// Validate configuration
// ============================================================

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
  if (!timestamp) {
    return "Невідомо";
  }

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
  if (!timestamp) {
    return "";
  }

  const diff = Date.now() - Number(timestamp);

  if (diff < 0) {
    return "";
  }

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
// Get Firebase data
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
// Find latest checkout from history
// ============================================================

function getLatestCheckout(historyForEquipment) {
  if (!historyForEquipment) {
    return null;
  }

  const events = Object.values(historyForEquipment);

  const checkouts = events
    .filter(event => event && event.type === "checkout")
    .sort(
      (a, b) =>
        Number(b.timestamp || 0) -
        Number(a.timestamp || 0)
    );

  return checkouts.length > 0
    ? checkouts[0]
    : null;
}


// ============================================================
// Find currently taken equipment
//
// EdVault structure:
//
// status: "available" → equipment is returned
// status: "taken"     → equipment is currently borrowed
//
// currentHolder → person who took the equipment
// takenAt       → timestamp when equipment was taken
// ============================================================

function findTakenEquipment(equipment, history) {
  const taken = [];

  for (const [equipmentId, item] of Object.entries(equipment)) {
    if (!item) {
      continue;
    }

    // EdVault uses "taken" for currently borrowed equipment.
    if (item.status !== "taken") {
      continue;
    }

    // Get history as fallback.
    const latestCheckout = getLatestCheckout(
      history[equipmentId]
    );

    const surname =
      item.currentHolder ||
      latestCheckout?.surname ||
      "Невідомо";

    const timestamp =
      item.takenAt ||
      latestCheckout?.timestamp ||
      null;

    taken.push({
      id: equipmentId,
      name: item.name || "Без назви",
      surname,
      timestamp
    });
  }

  // Oldest borrowed equipment first.
  taken.sort((a, b) => {
    return (
      Number(a.timestamp || 0) -
      Number(b.timestamp || 0)
    );
  });

  return taken;
}


// ============================================================
// Build HTML email
// ============================================================

function buildEmailHtml(takenEquipment) {
  const now = new Date();

  const reportDate = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);


  const equipmentCards = takenEquipment
    .map(item => {
      const duration = getDurationText(item.timestamp);

      return `
        <div style="
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:14px;
          padding:20px;
          margin-top:12px;
        ">

          <div style="
            font-size:17px;
            line-height:1.4;
            font-weight:600;
            color:#111827;
          ">
            ${escapeHtml(item.name)}
          </div>


          <div style="
            margin-top:16px;
            font-size:14px;
            color:#6b7280;
          ">
            Взяв
          </div>

          <div style="
            margin-top:3px;
            font-size:15px;
            font-weight:500;
            color:#111827;
          ">
            ${escapeHtml(item.surname)}
          </div>


          <div style="
            margin-top:14px;
            font-size:14px;
            color:#6b7280;
          ">
            Видано
          </div>

          <div style="
            margin-top:3px;
            font-size:15px;
            color:#111827;
          ">
            ${escapeHtml(formatDate(item.timestamp))}
          </div>


          ${
            duration
              ? `
                <div style="
                  margin-top:14px;
                  padding-top:14px;
                  border-top:1px solid #f0f0f0;
                  font-size:14px;
                  color:#dc2626;
                ">
                  Не повернуто:
                  <strong>${escapeHtml(duration)}</strong>
                </div>
              `
              : ""
          }

        </div>
      `;
    })
    .join("");


  return `
<!DOCTYPE html>

<html lang="uk">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>EdVault — Звіт по техніці</title>
</head>


<body style="
  margin:0;
  padding:0;
  background:#f5f7fa;
  font-family:Arial,Helvetica,sans-serif;
  color:#111827;
">


  <div style="
    width:100%;
    padding:32px 16px;
    box-sizing:border-box;
  ">


    <div style="
      max-width:600px;
      margin:0 auto;
    ">


      <!-- Main card -->

      <div style="
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:18px;
        overflow:hidden;
      ">


        <!-- Header -->

        <div style="
          padding:26px 28px;
          border-bottom:1px solid #eef0f3;
        ">

          <div style="
            font-size:13px;
            font-weight:600;
            letter-spacing:0.04em;
            color:#2563eb;
            text-transform:uppercase;
          ">
            EdVault
          </div>


          <div style="
            margin-top:7px;
            font-size:24px;
            line-height:1.25;
            font-weight:700;
            color:#111827;
          ">
            Звіт по техніці
          </div>


          <div style="
            margin-top:7px;
            font-size:13px;
            color:#6b7280;
          ">
            ${escapeHtml(reportDate)}
          </div>

        </div>


        <!-- Summary -->

        <div style="
          padding:24px 28px 10px 28px;
        ">

          <div style="
            background:#eff6ff;
            border:1px solid #dbeafe;
            border-radius:14px;
            padding:18px 20px;
          ">

            <div style="
              font-size:13px;
              color:#2563eb;
              font-weight:600;
            ">
              ПОТРІБНА УВАГА
            </div>


            <div style="
              margin-top:5px;
              font-size:21px;
              font-weight:700;
              color:#111827;
            ">
              ${takenEquipment.length}
              ${
                takenEquipment.length === 1
                  ? "одиниця"
                  : "одиниць"
              }
              не повернуто
            </div>


            <div style="
              margin-top:5px;
              font-size:14px;
              color:#6b7280;
            ">
              Перевірте повернення техніки.
            </div>

          </div>

        </div>


        <!-- Equipment list -->

        <div style="
          padding:4px 28px 28px 28px;
        ">

          ${equipmentCards}

        </div>


        <!-- Footer -->

        <div style="
          padding:18px 28px;
          border-top:1px solid #eef0f3;
          background:#fafbfc;
        ">

          <div style="
            font-size:12px;
            line-height:1.5;
            color:#9ca3af;
          ">
            Це автоматичний звіт про техніку,
            яка наразі має статус «Видано».
          </div>

        </div>


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

async function sendReport(takenEquipment) {

  const count = takenEquipment.length;


  // ==========================================================
  // IMPORTANT:
  // If everything is returned, DO NOT send an email.
  // ==========================================================

  if (count === 0) {

    console.log(
      "All equipment is returned."
    );

    console.log(
      "No email will be sent."
    );

    return;
  }


  // ==========================================================
  // There is at least one piece of equipment not returned.
  // Send the report.
  // ==========================================================

  const subject =
    `🔴 EdVault — ${count} од. техніки не повернуто`;


  const html =
    buildEmailHtml(takenEquipment);


  const { data, error } =
    await resend.emails.send({

      from: REPORT_FROM,

      to: REPORT_RECIPIENTS,

      subject,

      html

    });


  if (error) {

    throw new Error(
      `Resend error: ${JSON.stringify(error)}`
    );

  }


  console.log(
    "Email sent successfully."
  );

  console.log(
    "Resend ID:",
    data?.id || "unknown"
  );
}


// ============================================================
// Main
// ============================================================

async function main() {

  console.log(
    "========================================"
  );

  console.log(
    "EdVault Equipment Report"
  );

  console.log(
    "========================================"
  );


  console.log(
    "Reading Firebase..."
  );


  const {
    equipment,
    history
  } = await getFirebaseData();


  console.log(
    `Found ${
      Object.keys(equipment).length
    } equipment records.`
  );


  const takenEquipment =
    findTakenEquipment(
      equipment,
      history
    );


  console.log(
    `Currently taken: ${
      takenEquipment.length
    }`
  );


  if (takenEquipment.length > 0) {

    console.log(
      "Taken equipment:"
    );


    for (
      const item of takenEquipment
    ) {

      console.log(
        `- ${item.name} | ` +
        `${item.surname} | ` +
        `${formatDate(item.timestamp)}`
      );

    }

  }


  await sendReport(
    takenEquipment
  );


  console.log(
    "Report completed successfully."
  );
}


// ============================================================
// Run
// ============================================================

main()

  .catch(error => {

    console.error(
      "REPORT FAILED"
    );

    console.error(error);

    process.exit(1);

  })

  .finally(async () => {

    try {

      await admin
        .app()
        .delete();

    } catch {

      // Ignore cleanup errors

    }

  });
