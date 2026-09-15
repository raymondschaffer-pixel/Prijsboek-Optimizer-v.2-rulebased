// File: processPdf.js
const fs = require('fs');
const path = require('path');
const { processOrder } = require('./ruleEngine.js');

function analyzeOrder(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`\nFout: Bestand niet gevonden: ${absolutePath}\n`);
      return;
    }

    // Lees het bestand direct in als tekst (omdat ze in GitHub zijn getypt)
    const rawText = fs.readFileSync(absolutePath, 'utf-8');

    // Detecteer artikelcodes in de tekst via Regex (bijv. MO-3002)
    const codeMatches = rawText.match(/[A-Z]{2}-\d{4}/g) || [];
    const detectedCodes = [...new Set(codeMatches)];

    const orderData = {
      id: path.basename(filePath, '.pdf'),
      text: rawText,
      items: detectedCodes.map(code => ({
        code: code,
        quantity: 1, 
        unitPrice: 0 
      }))
    };

    console.log(`\n=== VERWERKING OPDRACHT: ${path.basename(filePath)} ===`);
    console.log(`Gedetecteerde codes in tekst: ${detectedCodes.join(', ') || 'Geen expliciete codes gevonden.'}\n`);

    const result = processOrder(orderData);

    console.log(`Opdracht ID         : ${result.orderId}`);
    console.log(`Oorspronkelijk Bedrag: € ${result.originalAmount.toFixed(2)}`);
    console.log(`Gegenereerd Extra   : € ${result.extraAmount.toFixed(2)}`);
    console.log(`Nieuwe Opdrachtsom  : € ${result.newTotalAmount.toFixed(2)}\n`);

    console.log('=== GEGENEREERDE NEVENPOSTEN ===');
    if (result.generatedItems.length === 0) {
      console.log('Geen ontbrekende nevenposten gedetecteerd door de Rule Engine.');
    } else {
      result.generatedItems.forEach((item, index) => {
        console.log(`${index + 1}. [${item.code}] ${item.description}`);
        console.log(`   Aantal: ${item.quantity} | Prijs p/st: € ${item.unitPrice.toFixed(2)} | Totaal: € ${item.totalPrice.toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('\nFout bij het verwerken:', error.message);
  }
}

const inputFile = process.argv[2] || 'werkopdracht 1.pdf';
analyzeOrder(inputFile);