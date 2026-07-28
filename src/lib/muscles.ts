/**
 * Keyword-based mapping from exercise names to targeted muscle groups, used
 * for the chips on the workout-session screens. First matching rule wins, so
 * specific patterns (leg curl, leg extension) come before generic ones
 * (curl, extension). Purely cosmetic — unknown names return no groups.
 */

const RULES: { pattern: RegExp; groups: string[] }[] = [
  { pattern: /leg curl|hamstring|nordic/i, groups: ['Hamstrings'] },
  { pattern: /leg extension/i, groups: ['Quads'] },
  { pattern: /calf|calves/i, groups: ['Calves'] },
  { pattern: /squat|leg press|lunge|step[- ]?up|pistol/i, groups: ['Quads', 'Glutes'] },
  { pattern: /deadlift|rdl|good morning/i, groups: ['Hamstrings', 'Glutes', 'Back'] },
  { pattern: /hip thrust|glute/i, groups: ['Glutes'] },
  { pattern: /bench|chest|fly|flye|push[- ]?up/i, groups: ['Chest', 'Triceps'] },
  { pattern: /\bdip\b/i, groups: ['Triceps', 'Chest'] },
  {
    pattern: /overhead press|shoulder press|\bohp\b|military|lateral raise|front raise|delt|shrug|face pull|upright row/i,
    groups: ['Shoulders'],
  },
  { pattern: /\brow\b|pull[- ]?up|chin[- ]?up|pulldown|pullover|\blat\b/i, groups: ['Back', 'Biceps'] },
  { pattern: /curl/i, groups: ['Biceps'] },
  { pattern: /pushdown|skull|tricep|close[- ]?grip|extension/i, groups: ['Triceps'] },
  { pattern: /plank|crunch|sit[- ]?up|\bab\b|abs|core|russian|leg raise|hollow/i, groups: ['Core'] },
  { pattern: /clean|snatch|thruster|burpee|swing|carry|sled/i, groups: ['Full body'] },
  { pattern: /run|sprint|bike|cycle|jump rope|rower|erg/i, groups: ['Cardio'] },
];

export function muscleGroupsFor(exerciseName: string): string[] {
  for (const rule of RULES) {
    if (rule.pattern.test(exerciseName)) return rule.groups;
  }
  return [];
}
