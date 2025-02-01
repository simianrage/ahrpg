async function renderDicePool(actor) {
  const dicePool = actor.system.dicepool || {};
  const maxDice = actor.system.dice_pool_maximum?.value || 0;
  const sortedKeys = Object.keys(dicePool).sort((a, b) => Number(a) - Number(b));
  const limitedDicePool = {};
  sortedKeys.slice(0, maxDice).forEach(key => {
    limitedDicePool[key] = dicePool[key];
  });  
  const template = `{{> dicePool dicepool=dicepool }}`;
  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate({ dicepool: limitedDicePool });
}

export class AHRPGCombatTracker extends CombatTracker {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 500,
      resizable: true
    });
  }
  // Override the getData method to customize the data sent to the template
  async getData(options={}) {
    const data = await super.getData(options);
    // Sort combatants: characters first, then NPCs
    if (!data.turns || !data.combat?.combatants) return data;
    data.turns.sort((a, b) => {
      let combatantA = data.combat.combatants.get(a.id);
      let combatantB = data.combat.combatants.get(b.id);

      if (!combatantA || !combatantB) return 0; // If combatants aren't found, don't change order

      let actorA = game.actors.get(combatantA.actorId);
      let actorB = game.actors.get(combatantB.actorId);

      if (!actorA || !actorB) return 0; // If actor not found, don't change order

      const aType = actorA.type === "character" ? 0 : 1;
      const bType = actorB.type === "character" ? 0 : 1;

      return aType - bType; // Sort so characters come first
    });
    // Add custom data here
    return data;
  }

  /** Override render to modify HTML structure */
  async _render(force, options) {
    await super._render(force, options);

    // Remove initiative elements
    this.element.find(".combatant .token-initiative").remove();

    // Convert combatant elements into an array to use with for...of
    let combatants = Array.from(this.element.find(".combatant"));
 
    let firstCharacter = null;
    let firstNPC = null;
 
    for (let element of combatants) {
      let li = $(element);
      let combatantId = li.data("combatant-id");
      let combatant = this.viewed.combatants.get(combatantId);
      let actor = combatant?.actor;
  
      if (actor) {
        let actorType = actor.type;
        if (actorType === "character" && !firstCharacter) {
          firstCharacter = li;
        } else if (actorType === "npc" && !firstNPC) {
          firstNPC = li;
        }
        
        let dicePoolHTML = await renderDicePool(actor); // Now `await` works correctly
  
        // Check if dice pool element already exists
        let existingDicePool = li.find(".dice-pool");
        
        if (existingDicePool.length) {
          existingDicePool.replaceWith(dicePoolHTML); // Replace if it exists
        } else {
          li.append(dicePoolHTML); // Otherwise, add new one
        }
      }
    }
    // Insert section headers if applicable
    //if (firstCharacter) {
    //  firstCharacter.prepend("<div class='tracker-group'>INVESTIGATORS</div>");
    //}
    //if (firstNPC) {
    //  firstNPC.prepend("<div class='tracker-group'>NPCS</div>");
    //}
  }
}