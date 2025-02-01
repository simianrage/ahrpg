$(document).on('click', '.rollable-dice-icon', function () {
  const isSelected = $(this).data('selected');
  
  // Toggle the `data-selected` attribute
  $(this).data('selected', !isSelected);
  
  // Toggle the `highlight` class
  $(this).toggleClass('highlight', !isSelected);
});

export function createDiceRollerSnippet(config) {
  // Destructure the config object
  const { normalDice, horrorDice, skillName, skillValue } = config;

  // Start building the HTML snippet using template literals
  let html = `
    <form>
    <div class="rollable-dice-snippet-wrapper">
      <h3><span class="skill-name">${skillName}</span>: <span class="skill-value">${skillValue}</span></h3>
      <div class="rollable-dice-container">
  `;

  // Add normal dice icons
  for (let i = 0; i < normalDice; i++) {
    html += `
      <img src="systems/ahrpg/assets/normal_die.svg" 
           class="rollable-dice-icon rollable-normal-die" 
           data-selected="false" 
           data-type="normal" />
    `;
  }

  // Add horror dice icons
  for (let i = 0; i < horrorDice; i++) {
    html += `
      <img src="systems/ahrpg/assets/horror_die.svg" 
           class="rollable-dice-icon rollable-horror-die" 
           data-selected="false" 
           data-type="horror" />
    `;
  }

  // Close the dice container
  html += `
      </div>
      <!-- Checkboxes for Advantage and Disadvantage -->
      <div class="rollable-checkbox-container">
        <label>
          <input type="checkbox" class="rollable-advantage-checkbox" />
          Advantage
        </label>
        <label>
          <input type="checkbox" class="rollable-disadvantage-checkbox" />
          Disadvantage
        </label>
      </div>
    </div>
    </form>
  `;

  // Return the complete HTML string
  return html;
}

export async function rollDice(html, actor) {
  const container = html[0].querySelector('form');
  const normalDice = $(container).find('.rollable-normal-die.highlight').length;
  const horrorDice = $(container).find('.rollable-horror-die.highlight').length;
  const isAdvantage = $(container).find('.rollable-advantage-checkbox').is(':checked');
  const isDisadvantage = $(container).find('.rollable-disadvantage-checkbox').is(':checked');
  const skillName = $(container).find('.skill-name').text();
  const skillValue = parseInt($(container).find('.skill-value').text());
  
  // This updates the sheet to reflect new dice state
  updateDiceRolled(actor, normalDice, horrorDice);
  
  // Implement the roll into the Chat window
  // Calculate total dice to roll
  let additionalDice = 0;
  if (isAdvantage) additionalDice += 1; // Add one normal die for Advantage
  if (isDisadvantage) additionalDice += 1; // Add one normal die for Disadvantage

  const totalNormalDice = normalDice + additionalDice; // Total normal dice to roll
  const totalDice = totalNormalDice + horrorDice; // Total dice including horror

  // Roll all dice
  const roll = await new Roll(`${totalDice}d6`).evaluate();
  const results = roll.terms[0].results.map((r, index) => ({
    result: r.result,
    type: index < totalNormalDice ? "normal" : "horror", // Identify normal vs horror dice
  }));

  // Store the original roll for display
  const originalDice = [...results];

  // Handle Advantage/Disadvantage
  if (isAdvantage || isDisadvantage) {
    // Sort dice by result for easier removal
    results.sort((a, b) => a.result - b.result);

    if (isAdvantage && isDisadvantage) {
      // Remove both the lowest and highest dice
      results.shift(); // Remove the lowest
      results.pop();   // Remove the highest
    } else if (isAdvantage) {
      // Remove the lowest die
      results.shift();
    } else if (isDisadvantage) {
      // Remove the highest die
      results.pop();
    }
  }

  // Calculate successes
  let successes = 0;
  results.forEach((die) => {
    if (die.result === 6 || (die.result >= skillValue && die.result !== 1)) {
      successes++;
    }
  });

  // Separate final results into normal and horror dice
  const finalNormalDice = results.filter((die) => die.type === "normal");
  const finalHorrorDice = results.filter((die) => die.type === "horror");

  // Construct chat message content
  const messageContent = constructDiceRollMessage(
    originalDice,
    finalNormalDice,
    finalHorrorDice,
    isAdvantage,
    isDisadvantage,
    successes,
    skillName,
    skillValue
  );

  // Create the chat message
  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: messageContent,
  });
}

function updateDiceRolled(actor, normal_die, horror_die) {
  // Track remaining counts for normal and horror dice
  // Copy the dicepool to avoid directly mutating actor data
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);
  const diceMax = parseInt(actor.system.dice_pool_maximum.value);
  let normalCount = normal_die;
  let horrorCount = horror_die;
  
  // Iterate through the dicepool keys in ascending order
  Object.keys(dicepool)
    .sort((a, b) => b - a) // Ensure numerical order
    .forEach((key) => {
      // Skip this dice if it's key (slot number) is bigger than the dice pool
      if (parseInt(key) <= diceMax) {
        const die = dicepool[key];
        if (normalCount > 0 && die.dietype === "normal" && die.status === "available") {
          // Update normal dice
          die.status = "spent";
          normalCount--;
        } else if (horrorCount > 0 && die.dietype === "horror" && die.status === "available") {
          // Update horror dice
          die.status = "spent";
          horrorCount--;
        }
      }
    });

  // Use actor.update() to persist changes
  actor.update({
    "system.dicepool": dicepool
  }).then(() => {
    console.log("Updated dicepool:", dicepool);
  }).catch((error) => {
    console.error("Failed to update dicepool:", error);
  });
}

function constructDiceRollMessage(
  originalDice,
  finalNormal,
  finalHorror,
  isAdvantage,
  isDisadvantage,
  successes,
  skillName,
  skillValue
) {
  const renderDiceIcons = (dice) => {
    return dice
      .map(
        (die) =>
          `<img src="systems/ahrpg/assets/${die.type}_die_${die.result}.svg" class="dice-result-icon" />`
      )
      .join("");
  };

  const finalIcons = renderDiceIcons([...finalNormal, ...finalHorror]);

  // Determine the final roll label based on Advantage/Disadvantage
  let rollLabel = "";
  if (isAdvantage && isDisadvantage) {
    rollLabel = "Advantage and Disadvantage";
  } else if (isAdvantage) {
    rollLabel = "Advantage";
  } else if (isDisadvantage) {
    rollLabel = "Disadvantage";
  }

  // Construct the message content
  let rollContent = `
    <div class="dice-roll-message">
      <h3>Dice Roll Results</h3>
      <div class="dice-results-section">
        <strong>Skill:</strong> ${skillName} (Value: ${skillValue})
      </div>
  `;

  if (rollLabel) {
    // Show Original Roll and Final Roll when Advantage or Disadvantage is applied
    const originalIcons = renderDiceIcons(originalDice);
    rollContent += `
      <div class="dice-results-section">
        <strong>Original Roll:</strong>
        <div class="dice-icons">
          ${originalIcons}
        </div>
      </div>
      <div class="dice-results-section">
        <strong>Final Roll (${rollLabel}):</strong>
        <div class="dice-icons">
          ${finalIcons}
        </div>
      </div>
    `;
  } else {
    // Show only Final Roll when no Advantage or Disadvantage is applied
    rollContent += `
      <div class="dice-results-section">
        <strong>Roll:</strong>
        <div class="dice-icons">
          ${finalIcons}
        </div>
      </div>
    `;
  }

  rollContent += `
    <div class="dice-results-section">
      <strong>Successes:</strong> ${successes}
    </div>
  </div>
  `;

  return rollContent;
}


export async function resetDicePool(actor) {
  // Deep clone the current dicepool to avoid direct mutation
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);

  // Reset all dice slots
  Object.keys(dicepool).forEach((key) => {
    dicepool[key].status = "available";
    dicepool[key].dietype = "normal";
  });

  // Update the actor's data
  actor
    .update({ "system.dicepool": dicepool })
    .then(() => {
      ui.notifications.info(`${actor.name}'s dice pool has been reset.`);

      // Send a chat message to notify everyone
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> has reset their dice pool.</p>`,
      });
    })
    .catch((error) => {
      console.error("Failed to reset dice pool:", error);
      ui.notifications.error("Failed to reset dice pool. Check the console for details.");
    });
}

export async function showRefillModal(actor) {
  // Get the number of spent slots
  const dicepool = actor.system.dicepool;
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);
  // Count the number of spent dice within the slice
  const spentCount = slicedDiceKeys.filter((key) => dicepool[key].status === "spent").length;

  // Build buttons for the modal
  const content = `
    <div class="ahrpg-dialog-button-container">
      <p>Select how many dice to refill:</p>
      <div class="buttons">
        <button class="refill-button button" data-value="all">
          All
        </button>
        ${Array.from({ length: spentCount }, (_, i) => i + 1)
          .map(
            (number) => `
            <button class="refill-button button" data-value="${number}">
              ${number}
            </button>
          `
          )
          .join("")}
      </div>
    </div>
  `;

  const dialog = new Dialog({
    title: "Refill Dice",
    content,
    buttons: {},
    render: (html) => {
      html.find(".refill-button").on("click", (ev) => {
        const value = ev.currentTarget.dataset.value;
        const refillCount = value === "all" ? null : parseInt(value);
        dialog.close();
        refillDicePool(actor, refillCount);
      });
    },
  });

  dialog.render(true);
}

function refillDicePool(actor, refillCount = null) {
  // Deep clone the dicepool to avoid direct mutation
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);

  // Filter slots with status="spent"
  const spentSlots = slicedDiceKeys.filter((key) => dicepool[key].status === "spent");

  // If "All" is selected or no specific count is given, refill all spent slots
  if (refillCount === null || refillCount >= spentSlots.length) {
    spentSlots.forEach((key) => {
      dicepool[key].status = "available";
    });
    refillCount = spentSlots.length; // Update refillCount to all for the chat message
  } else {
    // Refill specific number of slots, prioritizing horror dice
    spentSlots
      .sort((a, b) => {
        const dieA = dicepool[a];
        const dieB = dicepool[b];

        // Prioritize horror over normal
        if (dieA.dietype === "horror" && dieB.dietype === "normal") return -1;
        if (dieA.dietype === "normal" && dieB.dietype === "horror") return 1;

        // Maintain default order otherwise
        return 0;
      })
      .slice(0, refillCount)
      .forEach((key) => {
        dicepool[key].status = "available";
      });
  }

  // Update the actor's dicepool
  actor
    .update({ "system.dicepool": dicepool })
    .then(() => {
      ui.notifications.info(`${actor.name} refilled ${refillCount} dice.`);
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> has refilled <strong>${refillCount}</strong> dice.</p>`,
      });
    })
    .catch((error) => {
      console.error("Failed to refill dicepool:", error);
      ui.notifications.error("Failed to refill dicepool. Check the console for details.");
    });
}

export async function strainDicePool(actor) {
  // Deep clone the dicepool to avoid direct mutation
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);

  // Update all "spent" or "wound" dice to "available"
  Object.keys(dicepool).forEach((key) => {
    if (dicepool[key].status === "spent" || dicepool[key].status === "wound") {
      dicepool[key].status = "available";
    }
  });

  // Update the actor's dicepool
  actor
    .update({ "system.dicepool": dicepool })
    .then(() => {
      ui.notifications.info(`${actor.name} has strained themselves to refresh their dice.`);
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> has strained themselves to refresh their dice.</p>`,
      });
    })
    .catch((error) => {
      console.error("Failed to strain dicepool:", error);
      ui.notifications.error("Failed to strain dicepool. Check the console for details.");
    });
}

export async function showHorrorDamageModal(actor) {
  const dicepool = actor.system.dicepool;
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);


  // Count normal dice available for conversion
  const normalDiceCount = slicedDiceKeys.filter(
    (key) => dicepool[key].dietype === "normal"
  ).length;

  const content = `
    <div class="ahrpg-dialog-button-container">
      <p>Select how much horror damage to apply:</p>
      <div class="buttons">
        ${Array.from({ length: normalDiceCount }, (_, i) => i + 1)
          .map(
            (number) => `
            <button class="horror-damage-button button" data-value="${number}">
              ${number}
            </button>
          `
          )
          .join("")}
      </div>
    </div>
  `;

  const dialog = new Dialog({
    title: "Horror Damage",
    content,
    buttons: {},
    render: (html) => {
      html.find(".horror-damage-button").on("click", (ev) => {
        const horrorDamage = parseInt(ev.currentTarget.dataset.value);
        dialog.close();
        applyHorrorDamage(actor, horrorDamage);
      });
    },
  });

  dialog.render(true);
}

function applyHorrorDamage(actor, horrorDamage) {
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);
  
  let remainingHorrorDamage = horrorDamage;

  // Change `dietype` from "normal" to "horror", prioritizing status order
  const statusPriority = ["available", "spent", "wound"];
  for (const status of statusPriority) {
    for (const key of slicedDiceKeys) {
      if (remainingHorrorDamage === 0) break;
  
      const die = dicepool[key];
      if (die.dietype === "normal" && die.status === status) {
        die.dietype = "horror";
        remainingHorrorDamage--;
      }
    }
  }

  // Update the actor's dicepool
  actor
    .update({ "system.dicepool": dicepool })
    .then(() => {
      ui.notifications.info(`${actor.name} has taken ${horrorDamage} horror damage.`);
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> has taken <strong>${horrorDamage}</strong> horror damage.</p>`,
      });
    })
    .catch((error) => {
      console.error("Failed to apply horror damage:", error);
      ui.notifications.error("Failed to apply horror damage. Check the console for details.");
    });
}

export async function showDamageModal(actor) {
  const dicepool = actor.system.dicepool;
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);

  // Count non-wounded dice
  const damageableDiceCount = slicedDiceKeys.filter(
    (key) => dicepool[key].status !== "wound"
  ).length;

  const content = `
    <div class="ahrpg-dialog-button-container">
      <p>Select how much damage to apply:</p>
      <div class="buttons">
        ${Array.from({ length: damageableDiceCount }, (_, i) => i + 1)
          .map(
            (number) => `
            <button class="damage-button button" data-value="${number}">
              ${number}
            </button>
          `
          )
          .join("")}
      </div>
    </div>
  `;

  const dialog = new Dialog({
    title: "Apply Damage",
    content,
    buttons: {},
    render: (html) => {
      html.find(".damage-button").on("click", (ev) => {
        const damage = parseInt(ev.currentTarget.dataset.value);
        dialog.close();
        applyDamage(actor, damage);
      });
    },
  });

  dialog.render(true);
}

function applyDamage(actor, damage) {
  // Deep clone the dicepool to avoid direct mutation
  const dicepool = foundry.utils.deepClone(actor.system.dicepool);
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);
  
  let remainingDamage = damage;

  // Update dicepool to apply damage
  const priority = [
    { status: "available", dietype: "normal" },
    { status: "available", dietype: "horror" },
    { status: "spent", dietype: "normal" },
    { status: "spent", dietype: "horror" },
  ];

  for (const { status, dietype } of priority) {
    for (const key of slicedDiceKeys) {
      if (remainingDamage === 0) break;
  
      const die = dicepool[key];
      if (die.status == status && die.dietype == dietype) {
        die.status = "wound";
        remainingDamage--;
      }
    }
  }

  // Update the actor's dicepool
  actor
    .update({ "system.dicepool": dicepool })
    .then(() => {
      ui.notifications.info(`${actor.name} has taken ${damage} damage.`);
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> has taken <strong>${damage}</strong> damage.</p>`,
      });
    })
    .catch((error) => {
      console.error("Failed to apply damage:", error);
      ui.notifications.error("Failed to apply damage. Check the console for details.");
    });
}

export async function healDice(actor) {
  const dicepool = actor.system.dicepool;
  const diceMax = actor.system.dice_pool_maximum.value;
  const slicedDiceKeys = Object.keys(dicepool).slice(0, diceMax);

  // Count available slots for damage and horror healing within the slice
  const woundCount = slicedDiceKeys.filter((key) => dicepool[key].status === "wound").length;
  const horrorCount = slicedDiceKeys.filter((key) => dicepool[key].dietype === "horror").length;

  // Build the modal content
  let modalContent = `
    <div class="ahrpg-dialog-button-container">
      <h3>Heal Damage</h3>
      <div class="heal-section buttons">
        ${woundCount > 0
          ? Array.from({ length: woundCount }, (_, i) => `<button class="heal-button heal-damage-button button" data-value="${i + 1}">${i + 1}</button>`).join(' ')
          : `<p>No current wounds</p>`}
      </div>
    </div>
    <div class="ahrpg-dialog-button-container">
      <h3>Heal Horror</h3>
      <div class="heal-section buttons">
        ${horrorCount > 0
          ? Array.from({ length: horrorCount }, (_, i) => `<button class="heal-button heal-horror-button button" data-value="${i + 1}">${i + 1}</button>`).join(' ')
          : `<p>No current horror dice</p>`}
      </div>
    </div>
    <div class="modal-buttons">
      <button id="apply-heal-button">Apply</button>
      <button id="cancel-heal-button">Cancel</button>
    </div>
  `;

  // Create the dialog instance
  const dialog = new Dialog({
    title: 'Heal Dice',
    content: modalContent,
    buttons: {}, // Buttons are inline in the modal content
    render: html => {
      // Highlighting logic for mutually exclusive button selections
      html.on('click', '.heal-damage-button', function () {
        html.find('.heal-damage-button').removeClass('selected');
        $(this).addClass('selected');
      });

      html.on('click', '.heal-horror-button', function () {
        html.find('.heal-horror-button').removeClass('selected');
        $(this).addClass('selected');
      });

      // Apply healing logic
      html.on('click', '#apply-heal-button', async function () {
        const damageHeal = parseInt(html.find('.heal-damage-button.selected').data('value')) || 0;
        const horrorHeal = parseInt(html.find('.heal-horror-button.selected').data('value')) || 0;

        const updatedDicepool = foundry.utils.deepClone(dicepool);

        // Apply horror healing first
        if (horrorHeal > 0) {
          let remainingHorrorHeal = horrorHeal;
          Object.keys(updatedDicepool)
            .sort((a, b) => b - a) // Prioritize slots with status="spent" before "wound"
            .forEach(key => {
              const slot = updatedDicepool[key];
              if (remainingHorrorHeal > 0 && slot.dietype === 'horror') {
                slot.dietype = 'normal'; // Change to normal
                remainingHorrorHeal--;
              }
            });
        }

        // Apply damage healing next
        if (damageHeal > 0) {
          let remainingDamageHeal = damageHeal;
          Object.keys(updatedDicepool)
            .sort((a, b) => a - b) // Prioritize slots with dietype="normal" before "horror"
            .forEach(key => {
              const slot = updatedDicepool[key];
              if (remainingDamageHeal > 0 && slot.status === 'wound') {
                slot.status = 'spent'; // Change to spent
                remainingDamageHeal--;
              }
            });
        }

        // Update the actor data
        await actor.update({ 'system.dicepool': updatedDicepool });

        // Notify players and close the dialog
        ui.notifications.info('Dice pool has been healed.');
        dialog.close(); // Close the dialog instance
      });

      // Cancel button logic
      html.on('click', '#cancel-heal-button', function () {
        dialog.close(); // Close the dialog instance
      });
    }
  });

  // Render the dialog
  dialog.render(true);
}
