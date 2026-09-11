import { Resend } from 'resend';

// Inicializa o cliente Resend apenas com variável de ambiente (nunca usar strings fixas no código)
// Usamos uma string vazia como fallback para evitar quebra no construtor se a chave não existir,
// mas a lógica de verificação antes do envio deve capturar chaves inválidas.
const resend = new Resend(process.env.RESEND_API_KEY || '');

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Serviço centralizado para disparo de e-mails transacionais via Resend.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Resend Email Service] RESEND_API_KEY não configurada. E-mail simulado e ignorado.');
      console.log(`[Email Mock] Para: ${to} | Assunto: ${subject}`);
      return { success: true, mocked: true };
    }

    const response = await resend.emails.send({
      from: 'entrega@frontmk.online', // Domínio validado pelo usuário
      to,
      subject,
      html,
      text
    });

    if (response.error) {
      console.error('[Resend Email Service] Falha na API do Resend:', response.error);
      return { success: false, error: response.error };
    }

    console.log(`[Resend Email Service] E-mail enviado com sucesso. ID: ${response.data?.id}`);
    return { success: true, data: response.data };
  } catch (err: any) {
    // Trata erros sem derrubar a aplicação
    console.error('[Resend Email Service] Exceção ao enviar e-mail:', err.message || err);
    return { success: false, error: err };
  }
}
