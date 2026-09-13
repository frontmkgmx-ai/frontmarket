const text = "Hello {{customer_name}}";
const res = text.replace(/\{\{customer_name\}\}/g, "Joao");
console.log(res);
