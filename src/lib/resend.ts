/**
 * Direct Resend transport for every email the app sends.
 * The key lives in RESEND_API_KEY and is only read inside these calls.
 */

export const SENDER_ADDRESSES = [
  "murdoch@honestinvoice.com",
  "support@honestinvoice.com",
] as const;

export type SenderAddress = (typeof SENDER_ADDRESSES)[number];

export const DEFAULT_SENDER: SenderAddress = "support@honestinvoice.com";

export type ResendEmail = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
};

export async function sendResendEmail(email: ResendEmail): Promise<{ id: string }> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("Email is not configured — RESEND_API_KEY is missing.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: email.from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      ...(email.text ? { text: email.text } : {}),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.cc?.length ? { cc: email.cc } : {}),
      ...(email.bcc?.length ? { bcc: email.bcc } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed [${res.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as { id?: string };
  return { id: payload.id ?? "" };
}
