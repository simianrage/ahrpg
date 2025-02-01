# AHRPG System

This is a rudimentary system for the Arkham Horror RPG.

## Project Scope

The focus of this initial version is on dice pool management. The character sheet was modeled directly on the template
from the core rules book.

### Features

DICE POOL MANAGEMENT
  The dice pool shows the status of each die slot and includes buttons for managing the dice:
  
  Refill - restores all dice slots that are currently empty and not in a wound state.
  Horror - applies horror by converting normal dice to horror dice.
  Damage - applies damage by converting dice slots to wounds.
  Strain - removes wounds and refills the dice pool.
  Heal - allows changing horror dice to normal dice and/or removing wound slots.
  Reset - convience button to reset all slots to normal and refilling the dice pool.
  
DICE ROLLS
  Each skill can be clicked to open a roll dialog where you are presented with your available dice and you pick
  which ones to roll. Normal and Horror dice are visibly differentiated. You also can select Advantage and Disadvantage.
  When submitted, the dice selected are rolled, removed from your current pool, and the results are shown in the chat log.
  The results determine the number of successes, accounting for advantage and disadvantage, and visibly indicate the value
  of each die. This allows you to see if any 1s were rolled on horror dice.
  
COMBAT TRACKER
  The combat tracker is a basic override of the built-in combat tracker. The purpose is primarily for all players to see
  all dice pools of investigators and NPCs participating in a scene. The initiative column has been replaced with a realtime
  snapshot of the dice pools. Rolls from the sheets update this display. For convenience all characters are listed first, followed
  by NPCs.
  
CHARACTER (Investigator) SHEET
  For convenience, an Archetype dropdown is provided to choose your class and this automatically updates the Max values in the Skills
  section.
  
  Knacks, Weapons, Insight, Personality, and Inuries are all just editable text fields for now. As a convenience, each weapon slot 
  provides ammo circles that can be toggled to help track spent ammo.
  
NPC SHEET
  The system allows for up to 12 dice pool slots (it would not be hard to make this bigger). A Dice Pool Maximum text box
  is provided where you can set a number from 1 to 12 to get that many dice slots in the pool.
  
  Knacks, Equipment, and Injuries are provided as editable text boxes.

### Miscellaneous

I started this project using the boilerplate system here:
https://github.com/asacolips-projects/boilerplate

Thanks to asacolips for putting that together.