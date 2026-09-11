const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

if (!rules.includes('match /notifications/{notificationId}')) {
  rules = rules.replace(
    /match \/activity\/\{activityId\} \{\s+allow read, write: if isStoreOwner\(storeId\);\s+\}/g,
    "match /activity/{activityId} {\n        allow read, write: if isStoreOwner(storeId);\n      }\n      match /notifications/{notificationId} {\n        allow read, write: if isStoreOwner(storeId);\n      }"
  );
  fs.writeFileSync('firestore.rules', rules);
}
