/**
 * Maps a free-text GitFit exercise name to one of Strava's `exercise_type`
 * identifiers for the WeightTraining JSON upload. Strava names each exercise in
 * its workout log and draws the muscle map from this id -- not from our name --
 * so a wrong or generic match shows up directly on the activity.
 *
 * Every id here is copied from https://developers.strava.com/docs/uploads/;
 * don't invent new ones, since an unknown id fails upload processing.
 *
 * First matching rule wins, so specific patterns come before generic ones
 * (leg curl before curl, incline dumbbell press before bench press, leg
 * extension before triceps extension). Equipment is read from the name when
 * Strava distinguishes it; anything unmatched is TOTAL_BODY_GENERIC.
 */

export const FALLBACK_EXERCISE_TYPE = 'TOTAL_BODY_GENERIC';

type Rule = { pattern: RegExp; type: string | ((name: string) => string) };

// Tolerates the common "dumbell" misspelling.
const DUMBBELL = /dumb+ell|\bdbs?\b/i;
const CABLE = /cable|rope/i;
const MACHINE = /machine/i;
const SMITH = /smith/i;

const RULES: Rule[] = [
  // Push-ups (before "incline"/"decline" presses so "Incline Push Up" stays a push-up).
  { pattern: /diamond push[- ]?up/i, type: 'DIAMOND_PUSH_UP' },
  { pattern: /incline push[- ]?up/i, type: 'INCLINE_PUSH_UP' },
  { pattern: /decline push[- ]?up/i, type: 'DECLINE_PUSH_UP' },
  { pattern: /pike push[- ]?up/i, type: 'PIKE_PUSH_UP' },
  { pattern: /push[- ]?up/i, type: 'PUSH_UP_GENERIC' },

  // Movements that merely mention a bench/incline/chest but aren't presses.
  { pattern: /bench dip/i, type: 'BENCH_DIP' },
  { pattern: /incline.*curl/i, type: 'INCLINE_DUMBBELL_BICEPS_CURL' },
  { pattern: /chest[- ]?supported/i, type: 'CHEST_SUPPORTED_ROW' },

  // Flyes: rear-delt work first, it's a shoulder movement.
  {
    pattern: /rear[- ]?delt|reverse fl(y|ye|ies)/i,
    type: (name) =>
      CABLE.test(name) ? 'CABLE_REAR_DELT_FLY' : MACHINE.test(name) ? 'MACHINE_REAR_DELT_REVERSE_FLY' : 'DUMBBELL_REAR_DELT_FLY',
  },
  { pattern: /pec[- ]?deck|butterfly/i, type: 'PEC_DECK_BUTTERFLY' },
  { pattern: /crossover/i, type: 'CABLE_CROSSOVER' },
  {
    pattern: /\bfl(y|ye|yes|ys|ies)\b/i,
    type: (name) =>
      /incline/i.test(name)
        ? CABLE.test(name)
          ? 'INCLINE_CABLE_FLY'
          : 'INCLINE_DUMBBELL_FLYE'
        : CABLE.test(name)
          ? 'CABLE_CROSSOVER'
          : MACHINE.test(name)
            ? 'MACHINE_CHEST_FLY'
            : 'DUMBBELL_FLYE',
  },

  // Chest presses.
  {
    pattern: /incline.*(press|bench)|(press|bench).*incline/i,
    type: (name) =>
      SMITH.test(name)
        ? 'SMITH_MACHINE_INCLINE_BENCH_PRESS'
        : MACHINE.test(name)
          ? 'MACHINE_INCLINE_CHEST_PRESS'
          : DUMBBELL.test(name)
            ? 'INCLINE_DUMBBELL_BENCH_PRESS'
            : 'INCLINE_BARBELL_BENCH_PRESS',
  },
  { pattern: /decline.*(press|bench)/i, type: (name) => (MACHINE.test(name) ? 'MACHINE_DECLINE_BENCH_PRESS' : 'DECLINE_DUMBBELL_BENCH_PRESS') },
  { pattern: /close[- ]?grip.*bench/i, type: 'CLOSE_GRIP_BARBELL_BENCH_PRESS' },
  { pattern: /floor press/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_FLOOR_PRESS' : 'BARBELL_FLOOR_PRESS') },
  { pattern: /chest press/i, type: (name) => (MACHINE.test(name) ? 'MACHINE_CHEST_PRESS' : DUMBBELL.test(name) ? 'DUMBBELL_BENCH_PRESS' : 'CHEST_PRESS') },
  { pattern: /bench/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_BENCH_PRESS' : 'BARBELL_BENCH_PRESS') },

  // Shoulders.
  { pattern: /arnold/i, type: 'ARNOLD_PRESS' },
  { pattern: /push press/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_PUSH_PRESS' : 'PUSH_PRESS') },
  { pattern: /face[- ]?pull/i, type: 'FACE_PULL' },
  { pattern: /upright row/i, type: (name) => (CABLE.test(name) ? 'CABLE_UPRIGHT_ROW' : 'BARBELL_UPRIGHT_ROW') },
  { pattern: /shrug/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_SHRUG' : 'BARBELL_SHRUG') },
  { pattern: /lateral raise|side raise|lat raise/i, type: (name) => (CABLE.test(name) ? 'CABLE_LATERAL_RAISE' : 'LATERAL_RAISE_GENERIC') },
  { pattern: /front raise/i, type: 'FRONT_RAISE' },
  {
    pattern: /shoulder press|overhead press|\bohp\b|military press|\bmilitary\b/i,
    type: (name) =>
      SMITH.test(name)
        ? 'SMITH_MACHINE_OVERHEAD_PRESS'
        : MACHINE.test(name)
          ? 'MACHINE_SEATED_SHOULDER_PRESS'
          : DUMBBELL.test(name)
            ? 'SEATED_DUMBBELL_SHOULDER_PRESS'
            : /shoulder press/i.test(name)
              ? 'SHOULDER_PRESS_GENERIC'
              : 'OVERHEAD_BARBELL_PRESS',
  },

  // A bare "Dumbbell Press" is almost always the flat chest press.
  { pattern: /(dumb+ell|\bdbs?\b) press$/i, type: 'DUMBBELL_BENCH_PRESS' },

  // Legs -- leg extension/curl before triceps extension and biceps curls.
  { pattern: /leg extension|quad extension/i, type: 'MACHINE_LEG_EXTENSION' },
  { pattern: /nordic/i, type: 'NORDIC_CURL' },
  { pattern: /good morning/i, type: 'GOOD_MORNING' },
  { pattern: /leg curl|hamstring curl/i, type: (name) => (/seated/i.test(name) ? 'MACHINE_LEG_CURL_SEATED' : /standing/i.test(name) ? 'STANDING_LEG_CURL' : 'LEG_CURL_GENERIC') },
  { pattern: /bulgarian/i, type: (name) => (/barbell/i.test(name) ? 'BARBELL_BULGARIAN_SPLIT_SQUAT' : 'DUMBBELL_BULGARIAN_SPLIT_SQUATS') },
  { pattern: /split squat/i, type: (name) => (/barbell/i.test(name) ? 'BARBELL_SPLIT_SQUAT' : 'DUMBBELL_SPLIT_SQUAT') },
  { pattern: /hack squat/i, type: 'MACHINE_HACK_SQUAT' },
  { pattern: /leg press/i, type: (name) => (/single/i.test(name) ? 'MACHINE_SINGLE_LEG_PRESS' : 'MACHINE_LEG_PRESS') },
  { pattern: /goblet/i, type: 'GOBLET_SQUAT' },
  { pattern: /front squat/i, type: 'BARBELL_FRONT_SQUAT' },
  { pattern: /pistol/i, type: 'PISTOL_SQUAT' },
  { pattern: /step[- ]?up/i, type: 'STEP_UP' },
  { pattern: /thruster/i, type: 'THRUSTERS' },
  {
    pattern: /squat/i,
    type: (name) =>
      SMITH.test(name)
        ? 'SMITH_MACHINE_SQUAT'
        : DUMBBELL.test(name)
          ? 'DUMBBELL_SQUAT'
          : /air|bodyweight/i.test(name)
            ? 'AIR_SQUAT'
            : 'BARBELL_BACK_SQUAT',
  },
  { pattern: /walking lunge/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_WALKING_LUNGES' : 'WALKING_LUNGE') },
  { pattern: /reverse lunge/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_REVERSE_LUNGE' : 'REVERSE_LUNGE') },
  { pattern: /lateral lunge|side lunge/i, type: 'LATERAL_LUNGE' },
  { pattern: /lunge/i, type: (name) => (/barbell/i.test(name) ? 'BARBELL_LUNGE' : 'LUNGE_GENERIC') },
  { pattern: /romanian|\brdls?\b|stiff[- ]?leg/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_ROMANIAN_DEADLIFTS' : 'BARBELL_ROMANIAN_DEADLIFT') },
  { pattern: /sumo deadlift/i, type: 'SUMO_DEADLIFT' },
  { pattern: /trap[- ]?bar|hex[- ]?bar/i, type: 'TRAP_BAR_DEADLIFT' },
  { pattern: /rack pull/i, type: 'RACK_PULL' },
  { pattern: /deadlift/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_DEADLIFT' : 'BARBELL_DEADLIFT') },
  { pattern: /hip thrust/i, type: (name) => (MACHINE.test(name) ? 'MACHINE_HIP_THRUST' : DUMBBELL.test(name) ? 'DUMBBELL_HIP_THRUST' : 'BARBELL_HIP_THRUST') },
  { pattern: /glute bridge/i, type: 'GLUTE_BRIDGE' },
  { pattern: /glute kickback|kickback.*glute/i, type: 'MACHINE_GLUTE_KICKBACK' },
  { pattern: /abduct|adduct/i, type: 'HIP_STABILITY_GENERIC' },
  { pattern: /seated calf/i, type: 'SEATED_CALF_RAISE' },
  { pattern: /calf press/i, type: 'MACHINE_CALF_PRESS' },
  { pattern: /calf|calves/i, type: 'STANDING_CALF_RAISE' },

  // Triceps.
  { pattern: /skull/i, type: (name) => (DUMBBELL.test(name) ? 'DUMBBELL_SKULLCRUSHER' : 'SKULL_CRUSHER') },
  { pattern: /push[- ]?down|press[- ]?down/i, type: (name) => (/single|one[- ]arm/i.test(name) ? 'CABLE_SINGLE_ARM_TRICEPS_PUSHDOWN' : 'CABLE_TRICEPS_PUSHDOWN') },
  { pattern: /kickback/i, type: 'DUMBBELL_KICKBACK' },
  { pattern: /chest dip/i, type: 'CHEST_DIP' },
  { pattern: /\bdips?\b/i, type: 'TRICEP_DIP' },
  {
    pattern: /tricep/i,
    type: (name) =>
      /overhead/i.test(name)
        ? CABLE.test(name)
          ? 'CABLE_OVERHEAD_TRICEPS_EXTENSION'
          : 'OVERHEAD_DUMBBELL_TRICEPS_EXTENSION'
        : MACHINE.test(name)
          ? 'MACHINE_TRICEP_EXTENSION'
          : 'TRICEPS_EXTENSION_GENERIC',
  },

  // Biceps / forearms.
  { pattern: /wrist curl/i, type: 'DUMBBELL_WRIST_CURL' },
  { pattern: /hammer/i, type: (name) => (CABLE.test(name) ? 'CABLE_HAMMER_CURL' : 'DUMBBELL_HAMMER_CURL') },
  { pattern: /preacher/i, type: (name) => (MACHINE.test(name) ? 'PREACHER_CURL_MACHINE' : 'EZ_BAR_PREACHER_CURL') },
  { pattern: /concentration/i, type: 'CONCENTRATION_CURL' },
  { pattern: /spider curl/i, type: 'SPIDER_CURL' },
  { pattern: /bayesian/i, type: 'BAYESIAN_CURL' },
  { pattern: /reverse curl/i, type: 'BARBELL_REVERSE_CURL' },
  {
    pattern: /curl/i,
    type: (name) =>
      CABLE.test(name)
        ? 'CABLE_BICEPS_CURL'
        : MACHINE.test(name)
          ? 'MACHINE_BICEP_CURL'
          : /ez[- ]?bar/i.test(name)
            ? 'STANDING_EZ_BAR_BICEPS_CURL'
            : /barbell/i.test(name)
              ? 'BARBELL_BICEPS_CURL'
              : DUMBBELL.test(name) || /bicep/i.test(name)
                ? 'STANDING_DUMBBELL_BICEPS_CURL'
                : 'CURL_GENERIC',
  },

  // Back.
  { pattern: /straight[- ]?arm pull[- ]?down/i, type: 'STRAIGHT_ARM_PULLDOWN' },
  { pattern: /pull[- ]?down/i, type: (name) => (/close/i.test(name) ? 'CABLE_LAT_PULLDOWN_CLOSE_GRIP' : /single|one[- ]arm/i.test(name) ? 'SINGLE_ARM_LAT_PULLDOWN' : 'LAT_PULLDOWN') },
  { pattern: /assisted (pull|chin)/i, type: 'MACHINE_ASSISTED_PULL_UP' },
  { pattern: /chin[- ]?up/i, type: 'CLOSE_GRIP_CHIN_UP' },
  { pattern: /pull[- ]?up/i, type: 'PULL_UP_GENERIC' },
  { pattern: /pullover/i, type: (name) => (MACHINE.test(name) ? 'MACHINE_PULLOVER' : 'DUMBBELL_PULLOVER') },
  { pattern: /t[- ]?bar/i, type: 'T_BAR_ROW' },
  { pattern: /inverted row/i, type: 'INVERTED_ROW' },
  {
    pattern: /\brows?\b/i,
    type: (name) =>
      CABLE.test(name) || /seated/i.test(name)
        ? MACHINE.test(name)
          ? 'MACHINE_SEATED_ROW'
          : 'SEATED_CABLE_ROW'
        : MACHINE.test(name)
          ? 'MACHINE_SEATED_ROW'
          : SMITH.test(name)
            ? 'SMITH_MACHINE_ROW'
            : DUMBBELL.test(name) || /one[- ]arm|single[- ]arm/i.test(name)
              ? 'DUMBBELL_ROW'
              : /barbell|bent/i.test(name)
                ? 'BENT_OVER_BARBELL_ROW'
                : 'ROW_GENERIC',
  },
  { pattern: /back extension|hyperextension/i, type: 'HYPEREXTENSION_GENERIC' },

  // Core.
  { pattern: /plank/i, type: 'PLANK_GENERIC' },
  { pattern: /cable crunch/i, type: 'CABLE_CRUNCH' },
  { pattern: /crunch/i, type: 'CRUNCH' },
  { pattern: /sit[- ]?up/i, type: 'SIT_UP_GENERIC' },
  { pattern: /leg raise|knee raise/i, type: 'LEG_RAISE_GENERIC' },
  { pattern: /woodchop|wood chop|\bchop\b/i, type: 'CHOP_GENERIC' },
  { pattern: /\babs?\b|core|russian twist|hollow/i, type: 'CORE_GENERIC' },

  // Full-body / conditioning.
  { pattern: /clean|snatch|jerk/i, type: 'OLYMPIC_LIFT_GENERIC' },
  { pattern: /swing/i, type: 'HIP_SWING_GENERIC' },
  { pattern: /carry|farmer/i, type: 'CARRY_GENERIC' },
  { pattern: /box jump|jump squat|plyo/i, type: 'PLYO_GENERIC' },
];

export function stravaExerciseTypeFor(exerciseName: string): string {
  for (const rule of RULES) {
    if (rule.pattern.test(exerciseName)) {
      return typeof rule.type === 'function' ? rule.type(exerciseName) : rule.type;
    }
  }
  return FALLBACK_EXERCISE_TYPE;
}
