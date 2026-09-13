const fs = require('fs');

const code = `import { Resend } from 'resend';

// Inicializa o cliente Resend apenas com variável de ambiente (nunca usar strings fixas no código)
const resend = new Resend(process.env.RESEND_API_KEY || '');

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  email = email.trim();
  if (email.length < 5 || email.length > 254) return false;
  // Basic sanity check for email
  const regex = /^[^@]+@[^@]+\.[^@]+$/;
  return regex.test(email);
}

/**
 * Serviço centralizado para disparo de e-mails transacionais via Resend.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    // 1. Validations
    if (!process.env.RESEND_API_KEY) {
      return { success: false, provider: 'resend', error: 'CONFIGURATION_ERROR: RESEND_API_KEY not configured' };
    }

    if (!to) {
      return { success: false, provider: 'resend', error: 'VALIDATION_ERROR: Recipient missing' };
    }

    const recipients = Array.isArray(to) ? to : [to];
    for (const r of recipients) {
      if (!isValidEmail(r)) {
        return { success: false, provider: 'resend', error: 'VALIDATION_ERROR: Invalid recipient format' };
      }
    }

    if (!subject || typeof subject !== 'string' || subject.trim() === '' || subject.length > 200) {
      return { success: false, provider: 'resend', error: 'VALIDATION_ERROR: Invalid subject' };
    }

    if (!html || typeof html !== 'string' || html.trim() === '') {
      return { success: false, provider: 'resend', error: 'VALIDATION_ERROR: Invalid HTML content' };
    }

    // 2. Enviar via provider
    const response = await resend.emails.send({
      from: 'entrega@frontmk.online', // Domínio validado
      to: recipients,
      subject: subject.trim(),
      html,
      text: text || ''
    });

    if (response.error) {
      console.error('[Resend Email Service] Provider error:', response.error.name);
      return { success: false, provider: 'resend', error: 'PROVIDER_ERROR: ' + response.error.message };
    }

    console.log(\`[Resend Email Service] Email sent successfully. providerMessageId: \${response.data?.id}\`);
    return { success: true, provider: 'resend', providerMessageId: response.data?.id };
  } catch (err: any) {
    console.error('[Resend Email Service] Network/Internal error:', err.name);
    return { success: false, provider: 'resend', error: 'INTERNAL_ERROR: ' + err.message };
  }
}
`;

fs.writeFileSync('server-email.ts', code);
