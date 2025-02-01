import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import {
  createDiceRollerSnippet,
  rollDice,
  resetDicePool,
  showRefillModal,
  strainDicePool,
  showHorrorDamageModal,
  showDamageModal,
  healDice
} from '../helpers/dice-roller.mjs';
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class AHRPGActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['ahrpg', 'sheet', 'actor'],
      width: 900,
      height: 700,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'features',
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/ahrpg/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Adding a pointer to CONFIG.AHRPG
    context.config = CONFIG.AHRPG;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor,
      }
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    // This is where you can enrich character-specific editor fields
    // or setup anything else that's specific to this type
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const personalities = [];
    const archetypes = [];
    const knacks = {
      1: [],
      2: [],
      3: [],
      4: []
    };

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to backgrounds.
      else if (i.type === 'personality') {
        personalities.push(i);
      }
      // Append to archetypes.
      else if (i.type === 'archetype') {
        archetypes.push(i);
      }
      // Append to knacks.
      else if (i.type === 'knack') {
        if (i.system.tier != undefined) {
          knacks[i.system.tier].push(i);
        }
      }
    }

    // Assign and return
    context.gear = gear;
    context.personalities = personalities;
    context.archetypes = archetypes;
    context.knacks = knacks;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    html.on('click', '#dice-refill-button', (ev) => {
      console.log('dice-refill-button click');
    });
    html.on('click', '.dice-pool-rollable', (ev) => {
      const actor = this.actor;
      const skillName = $(ev.currentTarget).data('label');
      const skillValue = $(ev.currentTarget).data('skill-score');
      
      const dicePool = actor.system.dicepool;
      const diceMax = actor.system.dice_pool_maximum.value;
      const slicedDiceKeys = Object.keys(dicePool).slice(0, diceMax);
      let normalDice = 0;
      let horrorDice = 0;
      for (const key of slicedDiceKeys) {
        const die = dicePool[key];
         if (die.status === 'available') {
          if (die.dietype === 'normal') normalDice++;
          if (die.dietype === 'horror') horrorDice++;
        }
      }
      
      // If no dice are available, abort
      if (normalDice === 0 && horrorDice === 0) return;
      
      console.log(`Roll skill ${skillName} with score ${skillValue}, normal dice: ${normalDice}, horror dice: ${horrorDice}`);
      // Create roll dialog
      const data = {
        normalDice: normalDice,
        horrorDice: horrorDice,
        skillName: skillName,
        skillValue: skillValue
      };
      const contentHtml = createDiceRollerSnippet(data);

      new Dialog({
        title: skillName,
        content: contentHtml,
        buttons: {
          roll: { label: "Roll", callback: (html) => rollDice(html, actor) }, // Pass actor to rollDice
          cancel: { label: "Cancel" }
        }
      }).render(true);
    });
    
    html.on("click", "#dice-reset-button", (ev) => {
      resetDicePool(this.actor); // Call the reset function
    });
    html.on("click", "#dice-refill-button", (ev) => {
      showRefillModal(this.actor); // Call the refill function
    });
    html.on("click", "#dice-strain-button", (ev) => {
      strainDicePool(this.actor); // Call the strain function
    });
    html.on("click", "#dice-horror-button", (ev) => {
      showHorrorDamageModal(this.actor); // Open the modal
    });
    html.on("click", "#dice-damage-button", (ev) => {
      showDamageModal(this.actor); // Open the modal
    });
    html.on('click', '#dice-heal-button', (event) => {
      healDice(this.actor); // Delegate logic to the function in dice-roller.mjs
    });
    html.on('change', '#character-archetype', (event) => {
      const selectedArchetype = event.target.value;
    
      // Get the archetype data from CONFIG.AHRPG.archetypes
      const archetypeData = CONFIG.AHRPG.archetypes[selectedArchetype];
      if (!archetypeData) {
        console.warn(`Archetype ${selectedArchetype} not found in CONFIG.AHRPG.archetypes`);
        return;
      }
    
      // Update the actor's skills with the new max values
      const updatedSkills = {};
      for (const [skill, maxValue] of Object.entries(archetypeData.skillmax)) {
        updatedSkills[`system.skills.${skill}.max`] = maxValue; // Assuming a `max` property exists
      }
    
      // Update the actor's archetype and skill max values
      this.actor.update({
        'system.characterInfo.archetype': selectedArchetype,
        ...updatedSkills,
      }).then(() => {
        ui.notifications.info(`Archetype set to ${archetypeData.name}, skills updated.`);
      });
    });
    
    // Listen for clicks on any ammo circle
    html.find('.ammo-circles .circle').click(async (event) => {
      // Get the clicked circle element
      const circle = event.currentTarget;
      
      // Find the parent weapon container using the correct class
      const weaponEntry = circle.closest('.weapon-item');
      
      // Make sure you have set a data attribute for the weapon index on your .weapon-item element
      const weaponIndex = Number(weaponEntry.dataset.weaponIndex);
      
      // Get the ammo index from the clicked circle
      const ammoIndex = Number(circle.dataset.ammoIndex);
      
      // Get the current weapons array from actor system data
      const weapons = duplicate(this.actor.system.weapons);
      
      // Toggle the ammo state at this index:
      // If available, set to spent; if spent, set back to available.
      const currentState = weapons[weaponIndex].ammo[ammoIndex];
      const newState = currentState === "available" ? "spent" : "available";
      weapons[weaponIndex].ammo[ammoIndex] = newState;
      
      // Update the actor with the new weapons data
      await this.actor.update({"system.weapons": weapons});
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
}
