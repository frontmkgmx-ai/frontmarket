const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

serverCode = serverCode.replace(
  "const decodedToken = await admin.auth().verifyIdToken(token);",
  "const { getAuth } = require('firebase-admin/auth');\n      const decodedToken = await getAuth(admin).verifyIdToken(token);"
);

serverCode = serverCode.replace(
  "const decodedToken = await admin.auth().verifyIdToken(token);",
  "const { getAuth } = require('firebase-admin/auth');\n      const decodedToken = await getAuth(admin).verifyIdToken(token);"
);

fs.writeFileSync('server.ts', serverCode);

let finServiceCode = fs.readFileSync('server-financial-service.ts', 'utf8');
finServiceCode = finServiceCode.replace(
  "    return await db.runTransaction(async (t: any) => {",
  "    const result = await db.runTransaction(async (t: any) => {"
);
fs.writeFileSync('server-financial-service.ts', finServiceCode);

