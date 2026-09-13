const fs = require('fs');
let code = fs.readFileSync('server-email.ts', 'utf8');

code = code.replace(
  "export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {",
  "export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; provider: string; providerMessageId?: string | null; error?: string | null }> {"
);

fs.writeFileSync('server-email.ts', code);
