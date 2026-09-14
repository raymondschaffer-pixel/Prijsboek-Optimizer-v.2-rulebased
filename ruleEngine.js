// File: ruleEngine.js
const fs = require('fs');
const path = require('path');

// 1. Laad het parameters.json bestand
function loadParameters() {
  const filePath = path.join(__dirname, 'parameters.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData);
}

// 2. Core Rule Engine Logica
function processOrder(order) {
  const config = loadParameters();
  const inputText = (order.text || '').toLowerCase();
  const inputItems = order.items || [];
  
  let originalAmount = 0;
  let extraAmount = 0;
  const generatedItems = [];
  const triggeredRules = new Set();

  // Bereken oorspronkelijke opdrachtsom
  inputItems.forEach(item => {
    originalAmount += item.quantity * item.unitPrice;
  });

  // Scan alle regels uit parameters.json
  config.rule_sets.forEach(rule => {
    let isTriggered = false;

    // Check op aanwezige artikelcodes
    if (rule.trigger_codes) {
      const codeMatch = inputItems.some(item => rule.trigger_codes.includes(item.code));
      if (codeMatch) isTriggered = true;
    }

    // Check op trefwoorden in de tekst
    if (!isTriggered && rule.trigger_keywords) {
      const keywordMatch = rule.trigger_keywords.some(kw => inputText.includes(kw.toLowerCase()));
      if (keywordMatch) isTriggered = true;
    }

    // Als de regel triggert, genereer de afhankelijke nevenposten
    if (isTriggered && !triggeredRules.has(rule.rule_id)) {
      triggeredRules.add(rule.rule_id);

      rule.dependent_items.forEach(dep => {
        // Controleer of de nevenpost niet al handmatig op de bon staat
        const alreadyPresent = inputItems.some(item => item.code === dep.code);
        if (alreadyPresent) return;

        let calculatedQty = 0;

        // Bepaal aantal op basis van de rekenregel
        if (dep.quantity_rule === 'MATCH_MAIN_QTY') {
          const mainItem = inputItems.find(item => rule.trigger_codes.includes(item.code)) || inputItems[0];
          calculatedQty = mainItem ? mainItem.quantity : 1;
        } else if (dep.quantity_rule === 'CUSTOM_PARAM_OR_ESTIMATE') {
          const mainItem = inputItems.find(item => rule.trigger_codes.includes(item.code)) || inputItems[0];
          calculatedQty = mainItem ? Math.round(mainItem.quantity * (dep.default_ratio || 1)) : 1;
        } else if (dep.quantity_rule === 'FIXED_DEFAULT') {
          calculatedQty = dep.default_qty || 1;
        } else if (dep.quantity_rule === 'MATCH_ITEM_QTY') {
          const target = generatedItems.find(gi => gi.code === dep.match_target_code);
          calculatedQty = target ? target.quantity : (dep.default_qty || 1);
        }

        const totalItemPrice = calculatedQty * dep.unit_price;
        extraAmount += totalItemPrice;

        generatedItems.push({
          code: dep.code,
          description: dep.description,
          quantity: calculatedQty,
          unitPrice: dep.unit_price,
          totalPrice: totalItemPrice,
          sourceRule: rule.name
        });
      });
    }
  });

  return {
    orderId: order.id || 'DEMO-001',
    originalAmount: originalAmount,
    extraAmount: extraAmount,
    newTotalAmount: originalAmount + extraAmount,
    generatedItems: generatedItems
  };
}

// ---------------------------------------------------------
// DEMO TESTRUN (Wordt uitgevoerd bij: node ruleEngine.js)
// ---------------------------------------------------------
const testOrder = {
  id: 'MUT-2026-8812',
  text: 'Herstel en stucwerk wanden sausklaar in woonkamer 50m2',
  items: [
    { code: 'MO-2001', description: 'Stucwerk wanden sausklaar', quantity: 50, unitPrice: 22.50 }
  ]
};

console.log('=== TESTRUN RULE ENGINE ===\n');
const result = processOrder(testOrder);

console.log(`Opdracht ID         : ${result.orderId}`);
console.log(`Oorspronkelijk Bedrag: € ${result.originalAmount.toFixed(2)}`);
console.log(`Gegenereerd Extra   : € ${result.extraAmount.toFixed(2)}`);
console.log(`Nieuwe Opdrachtsom  : € ${result.newTotalAmount.toFixed(2)}\n`);

console.log('=== GEGENEREERDE NEVENPOSTEN ===');
result.generatedItems.forEach((item, index) => {
  console.log(`${index + 1}. [${item.code}] ${item.description}`);
  console.log(`   Aantal: ${item.quantity} | Prijs p/st: € ${item.unitPrice.toFixed(2)} | Totaal: € ${item.totalPrice.toFixed(2)}`);
});
