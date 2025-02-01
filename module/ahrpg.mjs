// Import document classes.
import { AHRPGActor } from './documents/actor.mjs';
import { AHRPGItem } from './documents/item.mjs';
// Import sheet classes.
import { AHRPGActorSheet } from './sheets/actor-sheet.mjs';
import { AHRPGItemSheet } from './sheets/item-sheet.mjs';
// Custom combat tracker
import { AHRPGCombatTracker } from "./helpers/combat-tracker.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { AHRPG } from './helpers/config.mjs';

/* -------------------------------------------- */
/*  Setup Hook                                  */
/* -------------------------------------------- */
Hooks.once("setup", () => {
  //CONFIG.Combat.documentClass = AHRPGCombatTracker;
  CONFIG.ui.combat = AHRPGCombatTracker;
});

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.ahrpg = {
    AHRPGActor,
    AHRPGItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.AHRPG = AHRPG;

  // Define custom Document classes
  CONFIG.Actor.documentClass = AHRPGActor;
  CONFIG.Item.documentClass = AHRPGItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  Handlebars.registerHelper('mod', function (value, mod, options) {
    return value % mod === 0;
  });
  
  Handlebars.registerHelper("add", function (value, addend) {
    return value + addend;
  });

  Handlebars.registerHelper("sub", function (value, subtrahend) {
    return value - subtrahend;
  });

  Handlebars.registerHelper("length", function (array) {
    return array.length;
  });
  
  Handlebars.registerHelper('slice', function (context, start, end) {
    if (!Array.isArray(context)) return [];
    return context.slice(start, end);
  });
  
  Handlebars.registerHelper("chunkArray", function (arrayOrObject, chunkSize) {
    // Convert object to array if necessary
    const array = Array.isArray(arrayOrObject)
      ? arrayOrObject
      : Object.values(arrayOrObject);
  
    // Proceed with chunking
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  });
  
  Handlebars.registerHelper("limitArray", function (arrayOrObject, limit) {
    // Convert object to array if necessary
    const array = Array.isArray(arrayOrObject)
      ? arrayOrObject
      : Object.values(arrayOrObject);
  
    // Limit the array to the specified number
    return array.slice(0, limit);
  });

  Handlebars.registerHelper("calcRowSize", function (max) {
    console.log(`calcRowSize: ${max}`);
    return max > 6 ? 6 : max; // Maximum of 6 slots per row.
  });

  Handlebars.registerPartial("dicePool", `
    <div class="dice-pool">
      {{#each dicepool}}
      <div class="dice-slot" data-status="{{status}}" data-type="{{dietype}}">
        {{#if (eq status "available")}}
        <img src="systems/ahrpg/assets/{{dietype}}_die.svg" />
        {{else if (eq status "wound")}}
        <img src="systems/ahrpg/assets/wound_token.svg" />
        {{else}}
        <img src="systems/ahrpg/assets/spent_die.svg" />
        {{/if}}
      </div>
      {{/each}}
    </div>
  `);

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('ahrpg', AHRPGActorSheet, {
    makeDefault: true,
    label: 'AHRPG.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('ahrpg', AHRPGItemSheet, {
    makeDefault: true,
    label: 'AHRPG.SheetLabels.Item',
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.ahrpg.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'ahrpg.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
