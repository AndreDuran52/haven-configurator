// The person's height limits, apart from the figure's geometry (person.ts), so
// the entry chunk (prefs, the store) carries only these few numbers.
export type PersonPose = 'lounge' | 'upright';

/** The average US man (CDC): 5'9″. */
export const PERSON_HEIGHT = 69;
export const PERSON_MIN = 54; // 4'6″
export const PERSON_MAX = 80; // 6'8″
