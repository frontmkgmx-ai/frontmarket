import express from 'express';
import { Webhook } from 'svix';

// Usar o db unificado admin (se necessário)
// import { getAdminDb } from './server-firebase-admin.js';

export function setupResendRoutes(app: express.Application) {
  
  // Endpoint de Webhook (Recebe POST /api/webhooks/resend)
  // Requer body raw para validação de assinatura Svix
  app.post(
    '/api/webhooks/resend',
    express.raw({ type: 'application/json' }),
    async (req: express.Request, res: express.Response) => {
      try {
        const payload = req.body;
        const headers = req.headers;
        
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
          console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET não configurado. Rejeitando.');
          return res.status(400).json({ error: 'Webhook secret missing on server' });
        }

        const svix_id = headers['svix-id'] as string;
        const svix_timestamp = headers['svix-timestamp'] as string;
        const svix_signature = headers['svix-signature'] as string;

        if (!svix_id || !svix_timestamp || !svix_signature) {
          return res.status(400).json({ error: 'Missing svix headers' });
        }

        const wh = new Webhook(webhookSecret);
        let evt: any;

        try {
          evt = wh.verify(payload, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
          });
        } catch (err: any) {
          console.error('[Resend Webhook] Verificação de assinatura falhou:', err.message);
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const eventType = evt?.type;
        const eventData = evt?.data;
        const emailTo = eventData?.to?.[0] || 'unknown';

        console.log(`[Resend Webhook] Evento verificado com sucesso. Tipo: ${eventType} | Email: ${emailTo} | ID: ${svix_id}`);

        // Apenas registrar por enquanto
        // Não implementar lógica de negócio de chave/produto
        
        res.status(200).json({ success: true, message: 'Webhook processado (logged)' });
      } catch (err: any) {
        console.error('[Resend Webhook] Erro crítico no endpoint:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
}
