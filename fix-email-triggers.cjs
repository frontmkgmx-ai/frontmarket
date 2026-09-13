const fs = require('fs');
let code = fs.readFileSync('server-email-triggers.ts', 'utf8');

// The replacement was messed up because of regex backreferences.
// Reverting to the old version first
code = code.replace(
  /const emailRes = await sendEmail\(\{[\s\S]*?FieldValue\.serverTimestamp\(\) : null\s*\}\);/g,
  ""
);

// I will just download the original file content from git, or just rewrite the function
