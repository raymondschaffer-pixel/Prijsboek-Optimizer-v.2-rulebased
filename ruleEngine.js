// File: ruleEngine.js
const fs = require('fs');
const path = require('path');

// Laad parameters.json (regels en afhankelijkheden)
const parametersPath = path.join(__dirname, 'parameters.json');
let parametersData = { rule_sets: [] };
if (fs.existsSync(parametersPath)) {
  parametersData = JSON.parse(fs.readFileSync(parametersPath, 'utf-8'));
}

// Simpele helper om een fictief prijzenboek te simuleren of in te lezen
function getStandardPrice(code) {
  // Standaard basisprijzen voor hoofdregels ter demonstratie
  const priceBook = {
    "MO-2001": 180.00,
    "MO-3002": 150.00,
    "MO-3003": 95.00,
    "MO-3004": 40.00,
    "MO-4001": 450.00,
    "MO-4005": 650.00
  };
  return priceBook[code] || 50.00; // Fallback prijs als code niet direct gevonden wordt
}

function processOrder(orderData) {
  let originalAmount = 0;
  const triggeredItemsMap = new Map();
  const processedMainCodes = new Set();

  // Stap 1: Bepaal de eenheidsprijs en het oorspronkelijke bedrag van de hoofdregels
  orderData.items.forEach(item => {
    const unitPrice = getStandardPrice(item.code);
    item.unitPrice = unitPrice;
    item.totalPrice = unitPrice * (item.quantity || 1);
    originalAmount += item.totalPrice;
    processedMainCodes.add(item.code);
  });

  // Stap 2: Controleer welke regels triggeren op ontbrekende nevenposten
  parametersData.rule_sets.forEach(ruleSet => {
    // Check of een van de trigger codes aanwezig is in de opdracht
    const hasTriggerCode = ruleSet.trigger_codes.some(code => processedMainCodes.has(code));
    
    // Check optioneel op trefwoorden in de ruwe tekst
    const hasKeyword = ruleSet.trigger_keywords && ruleSet.trigger_keywords.some(keyword => 
      orderData.text && orderData.text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasTriggerCode || hasKeyword) {
      ruleSet.dependent_items.forEach(dep => {
        // Voorkom dubbele toevoeging als de nevenpost al op de opdracht staat
        if (!processedMainCodes.has(dep.code)) {
          let calculatedQty = dep.default_qty || 1;

          if (dep.quantity_rule === 'MATCH_MAIN_QTY') {
            calculatedQty = orderData.items[0] ? orderData.items[0].quantity : 1;
          }

          const totalPrice = calculatedQty * dep.unit_price;

          // Voeg toe aan de lijst van gegenereerde nevenposten (uniek op code)
          if (!triggeredItemsMap.has(dep.code)) {
            triggeredItemsMap.set(dep.code, {
              code: dep.code,
              description: dep.description,
              quantity: calculatedQty,
              unitPrice: dep.unit_price,
              totalPrice: totalPrice,
              ruleId: ruleSet.rule_id
            });
          }
        }
      });
    }
  });

  const generatedItems = Array.from(triggeredItemsMap.values());
  const extraAmount = generatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const newTotalAmount = originalAmount + extraAmount;

  return {
    orderId: orderData.id,
    originalAmount,
    extraAmount,
    newTotalAmount,
    mainItems: orderData.items,
    generatedItems
  };
}

module.exports = { processOrder };
