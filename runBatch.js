// File: runBatch.js
const fs = require('fs');
const path = require('path');
const { processOrder } = require('./ruleEngine');

// Directory waar de testbestanden staan
const targetDir = __dirname;

function runBatchProcessing() {
  console.log("=== STARTING BATCH PROCESSING ===");
  
  // Zoek alle .txt bestanden (of simuleer meerdere bestanden)
  const files = fs.readdirSync(targetDir).filter(file => file.endsWith('.txt'));

  let totalOriginalSum = 0;
  let totalExtraSum = 0;
  let totalNewSum = 0;
  let processedCount = 0;

  files.forEach(file => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Simpele extractie van codes uit het tekstbestand
    const foundCodes = [];
    const matches = content.match(/MO-\d{4}|DO-\d{4}/g);
    if (matches) {
      matches.forEach(code => {
        if (!foundCodes.includes(code)) {
          foundCodes.push(code);
        }
      });
    }

    // Bouw order-object op voor de Rule Engine
    const orderData = {
      id: file,
      text: content,
      items: foundCodes.map(code => ({ code: code, quantity: 1 }))
    };

    const result = processOrder(orderData);

    processedCount++;
    totalOriginalSum += result.originalAmount;
    totalExtraSum += result.extraAmount;
    totalNewSum += result.newTotalAmount;

    console.log(`\n[Bestand: ${file}]`);
    console.log(`- Gedetecteerde codes: ${foundCodes.join(', ') || 'Geen'}`);
    console.log(`- Origineel: € ${result.originalAmount.toFixed(2)} | Extra Marge: € ${result.extraAmount.toFixed(2)} | Totaal: € ${result.newTotalAmount.toFixed(2)}`);
  });

  console.log("\n========================================");
  console.log(` TOTAAL OVERZICHT (${processedCount} bestanden verwerkt)`);
  console.log("========================================");
  console.log(`Totaal Oorspronkelijk Bedrag : € ${totalOriginalSum.toFixed(2)}`);
  console.log(`Totaal Gemiste Marge (Extra): € ${totalExtraSum.toFixed(2)}`);
  console.log(`Nieuwe Totale Omzet         : € ${totalNewSum.toFixed(2)}`);
  console.log("========================================");
}

runBatchProcessing();