export function generateEmailHtml(body: string, templateConfig: any, footerVars: string): string {
  const config = templateConfig || {};
  const bgColor = config.backgroundColor || '#f8fafc';
  const primaryColor = config.primaryColor || '#4f46e5';
  const footerText = config.footerText || '© {{store_name}}. Todos os direitos reservados.';
  const logoUrl = config.logoUrl || '';

  // Replace vars in footer
  const footer = footerText.replace(/\{\{store_name\}\}/g, footerVars || 'Sua Loja');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: sans-serif;">
  <div style="background-color: ${bgColor}; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      ${logoUrl ? `<div style="text-align: center; margin-bottom: 24px;"><img src="${logoUrl}" alt="Logo" style="max-height: 48px;" /></div>` : ''}
      <div style="white-space: pre-wrap; color: #333333; line-height: 1.6; font-size: 15px;">${body}</div>
      <div style="text-align: center; margin-top: 32px; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; padding-top: 16px;">
        ${footer}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
