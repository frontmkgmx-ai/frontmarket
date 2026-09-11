const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

code = code.replace(
  "return res.json({ success: true });\n    } catch (err: any) {",
  "}\n      return res.json({ success: true });\n    } catch (err: any) {"
);

fs.writeFileSync('server-misticpay.ts', code);
