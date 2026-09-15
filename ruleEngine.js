/**
 * Rule Engine voor Prijsboek & Workflow Optimizer
 * Bevat de juiste processOrder functie en strikte ruimte-context validatie.
 */

const fs = require('fs');
const path = require('path');

// Laad parameters.json automatisch in
let parameters = {};
try {
  parameters = JSON.parse(fs.readFileSync(path.join(__dirname, 'parameters.json'), 'utf-8'));
} catch (e) {
  parameters = { rule_sets: [] };
}

function processOrder(orderData) {
  let originalAmount = 0;
  let extraAmount = 0;
  const mainItems = [];
  const generatedItems = [];

  const text = (orderData.text || "").toLowerCase();
  const items = orderData.items || [];

  // Bepaal de context van de order op basis van de tekst
  let orderContext = 'algemeen';
  if (text.includes('badkamer') || text.includes('tegelwerk') || items.some(i => i.code.startsWith('MO-4001') || i.code.startsWith('MO-4005'))) {
    if (text.includes('keuken') || items.some(i => i.code.startsWith('MO-4005'))) {
      orderContext = 'keuken';
    } else {
      orderContext = 'badkamer';
    }
  } else if (text.includes('deur') || text.includes('kozijn') || items.some(i => i.code.startsWith('MO-3'))) {
    orderContext = 'timmerwerk';
  } else if (text.includes('stuc') || text.includes('sausklaar') || items.some(i => i.code.startsWith('MO-2001'))) {
    orderContext = 'stucwerk';
  }

  // Standaard fictieve / realistische basisprijzen per hoofdcode als deze niet in de tekst staan
  const basePrices = {
    'MO-2001': 180.00,
    'MO-3002': 150.00,
    'MO-3003': 95.00,
    'MO-4001': 500.00,
    'MO-4005': 650.00
  };

  // 1. Verwerk de gevonden hoofdregels
  items.forEach(item => {
    const code = item.code;
    const qty = item.quantity || 1;
    const prijs = basePrices[code] || 100.00;
    const totaal = prijs * qty;

    originalAmount += totaal;

    // Bepaal een nette omschrijving op basis van de code
    let omschrijving = "Werkorder mutatie " + code;
    if (code === 'MO-4005') omschrijving = "Vervangen keuken / aanrecht";
    if (code === 'MO-4001') omschrijving = "Vervangen tegelwerk badkamer";
    if (code === 'MO-3002') omschrijving = "Vervangen binnendeur inclusief beslag";
    if (code === 'MO-3003') omschrijving = "Binnenschilderwerk kozijnen / deuren";
    if (code === 'MO-2001') omschrijving = "Stucwerk wanden sausklaar";

    mainItems.push({
      code: code,
      omschrijving: omschrijving,
      aantal: qty,
      prijs: prijs,
      totaal: totaal
    });
  });

  // Als er geen items zijn gedetecteerd, geef een fallback bedrag
  if (originalAmount === 0) {
    originalAmount = 250.00;
    mainItems.push({
      code: "MO-ALG",
      omschrijving: "Algemene onderhoudswerkzaamheden",
      aantal: 1,
      prijs: 250.00,
      totaal: 250.00
    });
  }

  // 2. Doorloop alle rule_sets in parameters.json om nevenposten te genereren met context-filtering
  if (parameters && parameters.rule_sets) {
    parameters.rule_sets.forEach(ruleSet => {
      let isTriggered = false;

      // Check op basis van codes
      if (ruleSet.trigger_codes && ruleSet.trigger_codes.some(c => items.some(i => i.code === c))) {
        isTriggered = true;
      }

      // Check op basis van trefwoorden
      if (!isTriggered && ruleSet.trigger_keywords) {
        isTriggered = ruleSet.trigger_keywords.some(keyword => text.includes(keyword.toLowerCase()));
      }

      if (isTriggered) {
        // Strikte context guard: voorkom dat keukenregels bij badkamers komen en vice versa
        let isContextValid = true;
        const setId = ruleSet.rule_id || "";

        if (setId.includes('KEUKEN') && orderContext !== 'keuken' && !text.includes('keuken')) {
          isContextValid = false;
        }
        if (setId.includes('BADKAMER') && orderContext !== 'badkamer' && !text.includes('badkamer') && !text.includes('tegelwerk')) {
          isContextValid = false;
        }

        if (isContextValid && ruleSet.dependent_items) {
          ruleSet.dependent_items.forEach(depItem => {
            let calculatedQty = 1;
            const mainQty = items[0] ? (items[0].quantity || 1) : 1;

            if (depItem.quantity_rule === 'FIXED_DEFAULT') {
              calculatedQty = depItem.default_qty || 1;
            } else if (depItem.quantity_rule === 'MATCH_MAIN_QTY') {
              calculatedQty = mainQty;
            } else if (depItem.quantity_rule === 'CUSTOM_PARAM_OR_ESTIMATE' && depItem.default_ratio) {
              calculatedQty = Math.ceil(mainQty * depItem.default_ratio);
            }

            const depTotaal = calculatedQty * depItem.unit_price;
            extraAmount += depTotaal;

            generatedItems.push({
              code: depItem.code,
              omschrijving: depItem.description,
              aantal: calculatedQty,
              prijs: depItem.unit_price,
              totaal: depTotaal
            });
          });
        }
      }
    });
  }

  const newTotalAmount = originalAmount + extraAmount;

  return {
    originalAmount,
    extraAmount,
    newTotalAmount,
    mainItems,
    generatedItems
  };
}

module.exports = {
  processOrder
};
