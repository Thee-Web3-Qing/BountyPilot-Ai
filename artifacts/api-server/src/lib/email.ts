import { Resend } from "resend";
import { logger } from "./logger.js";

export type EmailProvider = "resend" | "dev";

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "dev") as EmailProvider;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

function hasProvider(): boolean {
  if (EMAIL_PROVIDER === "dev") return true;
  if (EMAIL_PROVIDER === "resend") return !!RESEND_API_KEY;
  return false;
}

export async function sendEmail({ to, subject, text, html }: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean }> {
  if (!hasProvider()) {
    logger.warn({ to, subject }, "No email provider configured");
    return { sent: false };
  }

  if (EMAIL_PROVIDER === "dev") {
    logger.info({ to, subject }, "[DEV EMAIL] Would send email — set EMAIL_PROVIDER=resend to send real emails");
    return { sent: true };
  }

  if (EMAIL_PROVIDER === "resend") {
    try {
      const { data, error } = await getResend().emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      });
      if (error) {
        throw new Error(error.message);
      }
      logger.info({ emailId: data?.id, to }, "Email sent via Resend");
      return { sent: true };
    } catch (e: any) {
      logger.error({ err: e.message, to }, "Resend email failed");
      return { sent: false };
    }
  }

  return { sent: false };
}

export function sendOTPEmail(to: string, code: string, purpose: "login" | "signup" | "reset"): Promise<{ sent: boolean }> {
  const subjectMap = {
    login: "Your BountyPilot Login Code",
    signup: "Verify Your BountyPilot Account",
    reset: "Your BountyPilot Password Reset Code",
  };

  const purposeLabel = purpose === "login" ? "login" : purpose === "signup" ? "verification" : "password reset";
  const expiryLabel = purpose === "reset" ? "1 hour" : "10 minutes";

  const html = `
    <div style="font-family:monospace;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:8px;border:1px solid #222">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#c8ff00;width:48px;height:48px;border-radius:4px;line-height:48px;font-size:24px;color:#0a0a0a">⊕</div>
        <h2 style="margin:12px 0 4px;font-size:20px;letter-spacing:2px;text-transform:uppercase">BountyPilot AI</h2>
        <p style="margin:0;color:#666;font-size:12px">Your creator revenue autopilot</p>
      </div>
      <p style="color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1px">Your ${purposeLabel} code</p>
      <div style="background:#111;border:1px solid #333;border-radius:6px;padding:24px;text-align:center;margin:16px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#c8ff00">${code}</span>
        <p style="margin:12px 0 0;font-size:11px;color:#555">Expires in ${expiryLabel}</p>
      </div>
      <p style="color:#555;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#333;font-size:11px;margin-top:24px;border-top:1px solid #1a1a1a;padding-top:16px">— BountyPilot AI Team</p>
    </div>
  `;

  const text = `Your BountyPilot ${purposeLabel} code is: ${code}\n\nExpires in ${expiryLabel}.\n\nIf you didn't request this, ignore this email.\n\n— BountyPilot AI Team`;

  return sendEmail({ to, subject: subjectMap[purpose], text, html });
}

export function sendLaunchpadStatusEmail(
  to: string,
  opts: { bountyTitle: string; status: "approved" | "rejected"; adminNote?: string | null }
): Promise<{ sent: boolean }> {
  const { bountyTitle, status, adminNote } = opts;

  const isApproved = status === "approved";
  const subject = isApproved
    ? `Your BountyPilot application was approved!`
    : `Update on your BountyPilot application`;

  const accentColor = isApproved ? "#c8ff00" : "#ff4444";
  const statusLabel = isApproved ? "APPROVED ✓" : "NOT SELECTED";
  const headline = isApproved
    ? "Congratulations — your application has been approved!"
    : "Thank you for applying to this bounty.";
  const body = isApproved
    ? "The team has reviewed your submission and you're in. Keep an eye on your inbox for next steps."
    : "The team reviewed your submission but went in a different direction this time. We encourage you to apply to future bounties — new ones drop regularly.";

  const adminNoteHtml = adminNote
    ? `<div style="background:#111;border-left:3px solid ${accentColor};border-radius:4px;padding:14px 16px;margin:20px 0">
        <p style="margin:0 0 6px;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px">Admin note</p>
        <p style="margin:0;color:#ccc;font-size:13px">${adminNote}</p>
      </div>`
    : "";

  const adminNoteText = adminNote ? `\nAdmin note: ${adminNote}\n` : "";

  const html = `
    <div style="font-family:monospace;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:8px;border:1px solid #222">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;background:#c8ff00;width:48px;height:48px;border-radius:4px;line-height:48px;font-size:24px;color:#0a0a0a">⊕</div>
        <h2 style="margin:12px 0 4px;font-size:20px;letter-spacing:2px;text-transform:uppercase">BountyPilot AI</h2>
        <p style="margin:0;color:#666;font-size:12px">Your creator revenue autopilot</p>
      </div>
      <div style="background:#111;border:1px solid #222;border-radius:6px;padding:20px;margin-bottom:20px">
        <p style="margin:0 0 8px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px">Bounty</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#fff">${bountyTitle}</p>
        <div style="margin-top:12px;display:inline-block;background:${accentColor};color:#0a0a0a;font-size:11px;font-weight:bold;letter-spacing:2px;padding:4px 10px;border-radius:3px">${statusLabel}</div>
      </div>
      <p style="color:#ccc;font-size:14px;margin:0 0 8px">${headline}</p>
      <p style="color:#888;font-size:13px;margin:0">${body}</p>
      ${adminNoteHtml}
      <p style="color:#555;font-size:12px;margin-top:28px">Questions? Reply to this email or visit <a href="https://bountypilot.xyz" style="color:#c8ff00;text-decoration:none">bountypilot.xyz</a>.</p>
      <p style="color:#333;font-size:11px;margin-top:16px;border-top:1px solid #1a1a1a;padding-top:16px">— BountyPilot AI Team</p>
    </div>
  `;

  const text = [
    `BountyPilot AI — Launchpad Application Update`,
    ``,
    `Bounty: ${bountyTitle}`,
    `Status: ${statusLabel}`,
    ``,
    headline,
    body,
    adminNoteText,
    `Questions? Visit https://bountypilot.xyz`,
    ``,
    `— BountyPilot AI Team`,
  ].join("\n");

  return sendEmail({ to, subject, text, html });
}

export function getEmailProvider(): { provider: EmailProvider; ready: boolean } {
  return { provider: EMAIL_PROVIDER, ready: hasProvider() };
}
