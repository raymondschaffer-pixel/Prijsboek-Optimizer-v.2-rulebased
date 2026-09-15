// File: runBatch.js
const fs = require('fs');
const path = require('path');
const { processOrder } = require('./ruleEngine');

const targetDir = __dirname;

function runBatchProcessing() {
  console.log("=== STARTING BATCH PROCESSING ===");
  
  const files = fs.readdirSync(targetDir).filter(file => file.endsWith('.txt'));

  let totalOriginalSum = 0;
  let totalExtraSum = 0;
  let totalNewSum = 0;
  let processedCount = 0;
  
  const alleResultaten = [];

  files.forEach(file => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const foundCodes = [];
    const matches = content.match(/MO-\d{4}|DO-\d{4}/g);
    if (matches) {
      matches.forEach(code => {
        if (!foundCodes.includes(code)) {
          foundCodes.push(code);
        }
      });
    }

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
    
    alleResultaten.push({
        bestandsnaam: file,
        gedetecteerdeCodes: foundCodes,
        origineelBedrag: result.originalAmount.toFixed(2),
        gegenereerdExtra: result.extraAmount.toFixed(2),
        nieuweOpdrachtsom: result.newTotalAmount.toFixed(2),
        // Geef nu ook de volledige hoofdregels mee (inclusief omschrijving en prijs)
        hoofdregels: result.mainItems || [],
        nevenposten: result.generatedItems || [] 
    });

    console.log(`\n[Bestand: ${file}]`);
    console.log(`- Gedetecteerde codes: ${foundCodes.join(', ') || 'Geen'}`);
    console.log(`- Origineel: € ${result.originalAmount.toFixed(2)} | Extra Marge: € ${result.extraAmount.toFixed(2)} | Totaal: € ${result.newTotalAmount.toFixed(2)}`);
  });

  const dashboardData = {
      samenvatting: {
          aantalBestanden: processedCount,
          totaleKosten: totalOriginalSum.toFixed(2),
          totaleMarge: totalExtraSum.toFixed(2),
          totaleOmzet: totalNewSum.toFixed(2)
      },
      opdrachten: alleResultaten
  };
  
  fs.writeFileSync(path.join(targetDir, 'results.json'), JSON.stringify(dashboardData, null, 2));
  console.log("✅ Data succesvol opgeslagen in 'results.json' met uitgebreide hoofdregels!");
}

runBatchProcessing();