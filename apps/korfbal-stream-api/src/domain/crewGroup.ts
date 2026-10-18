/** The two groups of Beheer → Producties → Beschikbaarheid. */
export type CrewGroup = 'crew' | 'entertainment';

/**
 * A person is Entertainment when every skill they have belongs only to positions with category
 * ENTERTAINMENT (the organization's own positions, via Position.skillId: renamed skills and positions
 * keep working). Anyone with a TECHNICAL or GENERAL skill, with a skill no position uses, or without
 * skills at all is Crew: someone who isn't known to be on screen is counted with the crew.
 *
 * @param skillIds the person's skills
 * @param categoriesBySkill the categories of the positions per skill id
 */
export function crewGroupOf(skillIds: number[], categoriesBySkill: Map<number, Set<string>>): CrewGroup {
  if (skillIds.length === 0) return 'crew';
  const entertainmentOnly = skillIds.every((skillId) => {
    const categories = categoriesBySkill.get(skillId);
    return !!categories && categories.size > 0 && [...categories].every((category) => category === 'ENTERTAINMENT');
  });
  return entertainmentOnly ? 'entertainment' : 'crew';
}

/** Categories of the positions per skill id, from the organization's positions. */
export function positionCategoriesBySkill(positions: Array<{skillId: number | null; category: string}>): Map<number, Set<string>> {
  const bySkill = new Map<number, Set<string>>();
  for (const position of positions) {
    if (position.skillId == null) continue;
    const categories = bySkill.get(position.skillId) ?? new Set<string>();
    categories.add(position.category);
    bySkill.set(position.skillId, categories);
  }
  return bySkill;
}
