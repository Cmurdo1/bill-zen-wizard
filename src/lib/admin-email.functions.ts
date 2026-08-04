import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sendResendEmail, SENDER_ADDRESSES } from "@/lib/resend";

const AdminEmailInput = z.object({
  from: z.enum(SENDER_ADDRESSES),
  fromName: z.string().trim().max(80).optional(),
  to: z.string().trim().email().max(255),
  cc: z.string().trim().max(500).optional(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  replyTo: z.string().trim().email().max(255).optional(),
});

function toHtml(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#111827;font-size:15px">
    ${paragraphs}
    <p style="margin-top:28px;color:#6b7280;font-size:12px">Honest Invoice · honestinvoice.com</p>
  </div>`;
}

export const sendAdminEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminEmailInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admins only.");

    const cc = (data.cc ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

    const result = await sendResendEmail({
      from: `${data.fromName?.trim() || "Honest Invoice"} <${data.from}>`,
      to: data.to,
      subject: data.subject,
      html: toHtml(data.body),
      text: data.body,
      ...(cc.length ? { cc } : {}),
      ...(data.replyTo ? { replyTo: data.replyTo } : { replyTo: data.from }),
    });

    return { sent: true, id: result.id, to: data.to, from: data.from };
  });
