// File: processPdf.js
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { processOrder } = require('./ruleEngine.js');

async function analyzePdfOrder(pdfPath) {
  try {
    const absolutePath = path.resolve(pdfPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`\nFout: PDF-bestand niet gevonden op: ${absolutePath}`);
      console.log('Zorg dat er een test-PDF in de map staat of geef de juiste bestandsnaam mee.\n');
      return;
    }

    const dataBuffer = fs.readFileSync(absolutePath);
    const pdfData = await pdf(dataBuffer);
    const rawText = pdfData.text;

    // Detecteer artikelcodes (zoals MO-2001, DO-1002, SB-3001) via Regex
    const codeMatches = rawText.match(/[A-Z]{2}-\d{4}/g) || [];
    const detectedCodes = [...new Set(codeMatches)];

    const orderData = {
      id: path.basename(pdfPath, '.pdf'),
      text: rawText,
      items: detectedCodes.map(code => ({
        code: code,
        quantity: 1,
        unitPrice: 0
      }))
    };

    console.log(`\n=== VERWERKING PDF: ${path.basename(pdfPath)} ===`);
    console.log(`Gedetecteerde codes in PDF: ${detectedCodes.join(', ') || 'Geen expliciete codes gevonden (match op tekst)'}\n`);

    const result = processOrder(orderData);

    console.log(`Opdracht ID         : ${result.orderId}`);
    console.log(`Oorspronkelijk Bedrag: € ${result.originalAmount.toFixed(2)}`);
    console.log(`Gegenereerd Extra   : € ${result.extraAmount.toFixed(2)}`);
    console.log(`Nieuwe Opdrachtsom  : € ${result.newTotalAmount.toFixed(2)}\n`);

    console.log('=== GEGENEREERDE NEVENPOSTEN ===');
    if (result.generatedItems.length === 0) {
      console.log('Geen ontbrekende nevenposten gedetecteerd.');
    } else {
      result.generatedItems.forEach((item, index) => {
        console.log(`${index + 1}. [${item.code}] ${item.description}`);
        console.log(`   Aantal: ${item.quantity} | Prijs p/st: € ${item.unitPrice.toFixed(2)} | Totaal: € ${item.totalPrice.toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('Fout bij het verwerken van de PDF:', error.message);
  }
}

const inputPdf = process.argv[2] || 'sample.pdf';
analyzePdfOrder(inputPdf);
