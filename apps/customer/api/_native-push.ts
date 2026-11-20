import { connect } from "node:http2";
import { createSign } from "node:crypto";

// Push to the native apps, next to web push in push-hook.ts. Each side is off until its credentials are set:
// Android (Firebase Cloud Messaging): FCM_SERVICE_ACCOUNT = the Firebase service account JSON (one line).
// iPhone (APNs): APNS_KEY (the .p8 key, \n for new lines), APNS_KEY_ID, APNS_TEAM_ID; APNS_BUNDLE_ID (default com.drivex.app);
// APNS_SANDBOX=1 for builds run from Xcode (development tokens).

export type Note = { title: string; body: string; url: string; tag: string; urgent: boolean };
/** "sent", "gone" (the token is dead: delete it) or "failed". */
type Result = "sent" | "gone" | "failed";

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function jwt(header: object, claims: object, key: string, alg: "RSA-SHA256" | "SHA256", dsa = false) {
  const data = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
  const sig = createSign(alg).update(data).sign(dsa ? { key, dsaEncoding: "ieee-p1363" } : key);
  return `${data}.${b64(sig)}`;
}

// ---------- Android: FCM HTTP v1, with an OAuth token from the service account (cached for most of its hour)
let fcmToken: { value: string; until: number } | null = null;

async function fcmAccess(sa: { client_email: string; private_key: string }) {
  if (fcmToken && fcmToken.until > Date.now()) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }, sa.private_key, "RSA-SHA256");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const out = await r.json();
  if (!r.ok) throw new Error(`fcm auth ${r.status}`);
  fcmToken = { value: out.access_token, until: Date.now() + 50 * 60_000 };
  return fcmToken.value;
}

export const fcmOn = () => !!process.env.FCM_SERVICE_ACCOUNT;

export async function sendFcm(token: string, n: Note): Promise<Result> {
  const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await fcmAccess(sa)}`, "Content-Type": "application/json" },
    // A notification message: Android shows it itself while the app is closed; tapping it opens the app with `url`.
    body: JSON.stringify({ message: {
      token,
      notification: { title: n.title, body: n.body },
      data: { url: n.url },
      android: { priority: n.urgent ? "HIGH" : "NORMAL", notification: { tag: n.tag, channel_id: "drivex" } },
    } }),
  });
  if (r.ok) return "sent";
  const err = await r.text();
  if (r.status === 404 || err.includes("UNREGISTERED")) return "gone";
  console.error("[push fcm]", r.status, err.slice(0, 300));
  return "failed";
}

// ---------- iPhone: APNs over HTTP/2 with a provider token (ES256, valid up to an hour; reused for 40 minutes)
let apnsJwt: { value: string; until: number } | null = null;

export const apnsOn = () => !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

export function sendApns(token: string, n: Note): Promise<Result> {
  if (!apnsJwt || apnsJwt.until < Date.now()) {
    const key = process.env.APNS_KEY!.replace(/\\n/g, "\n");
    apnsJwt = { value: jwt({ alg: "ES256", kid: process.env.APNS_KEY_ID }, { iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }, key, "SHA256", true), until: Date.now() + 40 * 60_000 };
  }
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const body = JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: "default", "thread-id": n.tag }, url: n.url });
  return new Promise((resolve) => {
    const client = connect(host);
    client.on("error", (e) => { console.error("[push apns]", e.message); resolve("failed"); });
    const req = client.request({
      ":method": "POST", ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsJwt!.value}`, "apns-topic": process.env.APNS_BUNDLE_ID || "com.drivex.app",
      "apns-push-type": "alert", "apns-priority": n.urgent ? "10" : "5", "apns-collapse-id": n.tag.slice(0, 64),
    });
    let status = 0, text = "";
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.on("data", (c) => { text += c; });
    req.on("end", () => {
      client.close();
      if (status === 200) return resolve("sent");
      // BadDeviceToken is not "gone": it is also what a sandbox token gets on production (APNS_SANDBOX set wrong)
      if (status === 410 || text.includes("Unregistered")) return resolve("gone");
      console.error("[push apns]", status, text.slice(0, 300));
      resolve("failed");
    });
    req.end(body);
  });
}
