const fs = require('fs');
let content = fs.readFileSync('server-webhook-service.ts', 'utf-8');

content = content.replace(
  "  } catch (jsonErr: any) {\n    const err: any = new Error(jsonErr.message || 'Formato JSON inválido no corpo do webhook.');\n    err.statusCode = jsonErr.statusCode || 400;\n    throw err;\n  }",
  "  } catch (jsonErr: any) {\n    if (rawStr.includes('=') && !rawStr.startsWith('{') && !rawStr.startsWith('[')) {\n      const qs = require('querystring');\n      parsed = qs.parse(rawStr);\n    } else {\n      const err: any = new Error(jsonErr.message || 'Formato JSON inválido no corpo do webhook.');\n      err.statusCode = jsonErr.statusCode || 400;\n      throw err;\n    }\n  }"
);

fs.writeFileSync('server-webhook-service.ts', content);
