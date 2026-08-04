import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

// Notifications must never break the action that triggered them, so every
// failure here is logged and swallowed rather than thrown.
export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  if (provider === "console") {
    console.info(`[email] to=${message.to} subject=${message.subject}\n${message.body}`);
    return;
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY or EMAIL_FROM is unset");
      return;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.body }),
      });
      if (!response.ok) {
        console.error(`[email] Resend responded ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      console.error("[email] Failed to send:", err);
    }
    return;
  }

  console.error(`[email] Unknown EMAIL_PROVIDER: ${provider}`);
}
