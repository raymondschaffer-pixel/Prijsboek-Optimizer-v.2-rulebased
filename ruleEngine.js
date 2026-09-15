/**
 * Rule Engine voor Prijsboek & Workflow Optimizer
 * Ondersteunt rule-sets met strikte ruimte-context en trigger-matching.
 */

function evaluateOrder(mainOrder, parameters) {
  const matchedTasks = [];
  const mainCode = (mainOrder.code || "").trim();
  const mainDesc = (mainOrder.omschrijving || mainOrder.description || "").toLowerCase();
  const mainQty = mainOrder.aantal || mainOrder.quantity || 1;

  // Bepaal de context van de hoofdregel (ruimte/type)
  let orderContext = 'algemeen';
  if (mainDesc.includes('badkamer') || mainDesc.includes('tegelwerk') || mainCode.startsWith('MO-4001')) {
    orderContext = 'badkamer';
  } else if (mainDesc.includes('keuken') || mainDesc.includes('aanrecht') || mainCode.startsWith('MO-4005')) {
    orderContext = 'keuken';
  } else if (mainDesc.includes('deur') || mainDesc.includes('kozijn') || mainCode.startsWith('MO-3002') || mainCode.startsWith('MO-3003')) {
    orderContext = 'timmerwerk';
  } else if (mainDesc.includes('stuc') || mainDesc.includes('sausklaar') || mainCode.startsWith('MO-2001')) {
    orderContext, 'stucwerk';
  }

  // Doorloop alle rule_sets in parameters.json
  if (parameters && parameters.rule_sets) {
    parameters.rule_sets.forEach(ruleSet => {
      let isTriggered = false;

      // 1. Check op basis van trigger codes
      if (ruleSet.trigger_codes && ruleSet.trigger_codes.includes(mainCode)) {
        isTriggered = true;
      }

      // 2. Check op basis van trefwoorden in de omschrijving
      if (!isTriggered && ruleSet.trigger_keywords) {
        isTriggered = ruleSet.trigger_keywords.some(keyword => mainDesc.includes(keyword.toLowerCase()));
      }

      if (isTriggered) {
        // Extra veiligheidscheck: Voorkom dat keuken-rules op badkamer-orders afgaan (en vice versa)
        let isContextValid = true;
        const setId = ruleSet.rule_id || "";

        if (setId.includes('KEUKEN') && !mainDesc.includes('keuken') && !mainCode.startsWith('MO-4005')) {
          isContextValid = false;
        }
        if (setId.includes('BADKAMER') && !mainDesc.includes('badkamer') && !mainDesc.includes('tegelwerk') && !mainCode.startsWith('MO-4001')) {
          isContextValid = false;
        }

        if (isContextValid && ruleSet.dependent_items) {
          ruleSet.dependent_items.forEach(item => {
            // Bereken hoeveelheid op basis van de regelregels
            let calculatedQty = mainQty;
            
            if (item.quantity_rule === 'FIXED_DEFAULT') {
              calculatedQty = item.default_qty || 1;
            } else if (item.quantity_rule === 'MATCH_MAIN_QTY') {
              calculatedQty = mainQty;
            } else if (item.quantity_rule === 'CUSTOM_PARAM_OR_ESTIMATE' && item.default_ratio) {
              calculatedQty = Math.ceil(mainQty * item.default_ratio);
            }

            matchedTasks.push({
              code: item.code,
              omschrijving: item.description,
              aantal: calculatedQty,
              prijs: item.unit_price,
              totaal: calculatedQty * item.unit_price
            });
          });
        }
      }
    });
  }

  return matchedTasks;
}

module.exports = {
  evaluateOrder
};
