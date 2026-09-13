import fs from 'fs';

async function runTests() {
  console.log("TAP version 13");
  console.log("# Subtest: Testes de Segurança - Bundle");
  
  let passed = true;
  
  if (!fs.existsSync('dist/')) {
    console.log("not ok 1 - dist/ folder missing. Build first.");
    return;
  }

  // Very basic search, normally done by the CI bash script
  const buildFiles = fs.readdirSync('dist/assets').filter(f => f.endsWith('.js'));
  let foundSecret = false;
  
  for (const file of buildFiles) {
    const content = fs.readFileSync('dist/assets/' + file, 'utf8');
    if (content.includes('RESEND_API_KEY') || content.includes('DIDIT_API_KEY') || content.includes('MISTIC_PAY_WEBHOOK_SECRET')) {
      console.log(`not ok 1 - Exposed secret in ${file}`);
      foundSecret = true;
      passed = false;
    }
  }
  
  if (!foundSecret) {
    console.log("ok 1 - No exposed secrets in frontend bundle");
  }
  
  const serverContent = fs.readFileSync('dist/server.cjs', 'utf8');
  if (serverContent.includes('export const DIDIT_API_KEY = "sk_test_') || serverContent.includes('const RESEND_API_KEY = "re_')) {
    console.log("not ok 2 - Hardcoded secret found in server bundle");
    passed = false;
  } else {
    console.log("ok 2 - No hardcoded secrets in server bundle");
  }

  console.log("1..2");
  if (passed) {
    console.log("ok 1 - Bundle Security Tests");
  } else {
    console.log("not ok 1 - Bundle Security Tests");
    process.exit(1);
  }
}

runTests().catch(console.error);
