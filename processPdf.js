// File: processPdf.js
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// Importeer de rekenlogica (zorg dat ruleEngine.js zijn processOrder functie exporteert)
const { processOrder } = require('./ruleEngine.js');

async function analyzePdfOrder(pdfPath) {
  try {
    // 1. Lees het PDF bestand in als buffer
    const absolutePath = path.resolve(pdfPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`Fout: Bestand niet gevonden op pad: ${absolutePath}`);
      return;
    }

    const dataBuffer = fs.readFileSync(absolutePath);
    
    // 2. Parse de PDF tekst
    const pdfData = await pdf(dataBuffer);
    const rawText = pdfData.text;

    // 3. Extraheer artikelcodes (zoals MO-2001, DO-1002, SB-3001) via Regex
    const codeMatches = rawText.match(/[A-Z]{2}-\d{4}/g) || [];
    
    // Unieke gevonden codes filteren
    const detectedCodes = [...new Set(codeMatches)];

    // Omzetten naar invoerobject voor de Rule Engine
    const orderData = {
      id: path.basename(pdfPath, '.pdf'),
      text: rawText,
      items: detectedCodes.map(code => ({
        code: code,
        quantity: 1, // Standaardwaarde indien niet expliciet gespecificeerd
        unitPrice: 0  // Wordt indien gewenst uit parameters.json gehaald
      }))
    };

    // 4. Verwerk door de Rule Engine
    console.log(`\n=== VERWERKING PDF: ${path.basename(pdfPath)} ===`);
    console.log(`Gedetecteerde codes in PDF: ${detectedCodes.join(', ') || 'Geen expliciete codes gevonden (match op tekst)'}\n`);

    const result = processOrder(orderData);

    // 5. Resultaat tonen
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

// Pak het PDF-bestand dat als argument wordt meegegeven via de terminal
const inputPdf = process.argv[2] || 'concept_opdracht.pdf';
analyzePdfOrder(inputPdf);
