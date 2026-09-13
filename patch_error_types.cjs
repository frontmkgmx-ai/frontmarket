const fs = require('fs');

function patchFile(path) {
  let code = fs.readFileSync(path, 'utf8');
  // Substituir (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.name)
  // Por String(emailRes.error)
  code = code.replace(/typeof emailRes\.error === 'string' \? emailRes\.error : emailRes\.error\.name/g, "String(emailRes.error)");
  code = code.replace(/typeof emailRes\.error === 'string' \? emailRes\.error : emailRes\.error\.message/g, "String(emailRes.error)");
  
  code = code.replace(/typeof prodEmailRes\.error === 'string' \? prodEmailRes\.error : prodEmailRes\.error\.name/g, "String(prodEmailRes.error)");
  code = code.replace(/typeof prodEmailRes\.error === 'string' \? prodEmailRes\.error : prodEmailRes\.error\.message/g, "String(prodEmailRes.error)");

  fs.writeFileSync(path, code);
}

patchFile('server-email-retry.ts');
patchFile('server-email-triggers.ts');
patchFile('server-notification-service.ts');
