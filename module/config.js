import template from 'systems/ahrpg/templates/template.json';

export const AHRPG = {}

AHRPG.skills = {
    'agi': "AHRPG.Skills.Agi",
    'ath': "AHRPG.Skills.Ath",
    'wit': "AHRPG.Skills.Wit",
    'pre': "AHRPG.Skills.Pre",
    'int': "AHRPG.Skills.Int",
    'kno': "AHRPG.Skills.Kno",
    'res': "AHRPG.Skills.Res",
    'mel': "AHRPG.Skills.Mel",
    'ran': "AHRPG.Skills.Ran",
    'lor': "AHRPG.Skills.Lor"    
}
console.log("Archetypes from template.json:", template.Item.archetype.types);
// Transform archetypes into an iterable array
AHRPG.archetypes = Object.entries(template.Item.archetype.types).map(([key, archetype]) => ({
  id: key,
  ...archetype,
}));
