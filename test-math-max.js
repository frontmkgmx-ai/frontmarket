// Simulate the Math.max fix
let curPending = 50;
let netAmountCents = 100;
try {
  if (curPending < netAmountCents) {
    throw new Error('Invariante violada: saldo pendente insuficiente para cobrir o release. Corrupção financeira detectada.');
  }
  console.log("Success");
} catch (e) {
  console.log("Error caught: " + e.message);
}
