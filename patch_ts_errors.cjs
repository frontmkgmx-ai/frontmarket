const fs = require('fs');
let content1 = fs.readFileSync('server-financial-service.ts', 'utf-8');
content1 = content1.replace(
  "    requestId?: string;\n    confirmedAtMillis?: number;\n  })",
  "    requestId?: string;\n    requestHost?: string;\n    confirmedAtMillis?: number;\n  })"
);
content1 = content1.replace(
  "  static async processWithdrawal(",
  "  static async processWithdrawal("
); // No-op just in case
let paramsIndex = content1.indexOf("static async processWithdrawal");
if (paramsIndex !== -1) {
    let paramsEnd = content1.indexOf("{", paramsIndex);
    let signature = content1.substring(paramsIndex, paramsEnd);
    if (!signature.includes("requestHost")) {
        content1 = content1.replace("      requestId?: string;\n    }", "      requestId?: string;\n      requestHost?: string;\n    }");
    }
}
fs.writeFileSync('server-financial-service.ts', content1);

let content2 = fs.readFileSync('server-misticpay.ts', 'utf-8');
content2 = content2.replace(
  "export type MisticActiveCheckResult =",
  "export type MisticActiveCheckResult ="
);
let checkResultIndex = content2.indexOf("export type MisticActiveCheckResult");
if (checkResultIndex !== -1) {
    let checkResultEnd = content2.indexOf(";", checkResultIndex);
    let typeDef = content2.substring(checkResultIndex, checkResultEnd);
    if (!typeDef.includes("PENDING")) {
        content2 = content2.substring(0, checkResultEnd) + " | { status: 'PENDING'; state: string; data: any }" + content2.substring(checkResultEnd);
    }
}
fs.writeFileSync('server-misticpay.ts', content2);
