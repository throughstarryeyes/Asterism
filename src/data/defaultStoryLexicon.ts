import type { StoryLexiconConfig, StoryMemoryVault } from '../types';

export const DEFAULT_STORY_LEXICON: StoryLexiconConfig = {
  // deflecting and emotional avoidance phrases across dialogues
  deflectionPhrases: [
    "I'm fine",
    "I am fine",
    "It's nothing",
    "It is nothing",
    "Just tired",
    "Don't worry about it",
    "Don't worry",
    "I don't care",
    "I'm good",
    "Never mind",
    "Forget I said anything",
    "It doesn't matter",
    "Leave it alone",
    "I'm okay",
    "Drop it",
    "I'm handling it",
    "It's not a big deal",
    "I have it under control"
  ],

  // trauma responses, hypervigilance, and emotional shielding behavioral tells
  traumaCues: [
    "checked the locks",
    "checking the locks",
    "back to the wall",
    "flinched at the sound",
    "flinched when touched",
    "couldn't breathe",
    "heart pounded",
    "pulse racing",
    "dissociated",
    "numbness crept",
    "hyperventilating",
    "trembling hands",
    "stared at the door",
    "scanning the exits",
    "scanning the room",
    "startled awake",
    "couldn't shake the memory",
    "avoided eye contact",
    "jaw clenched tight"
  ],

  // tactical / Chekhov items that carry narrative weight and can become dropped threads
  tactileObjects: [
    "key",
    "keys",
    "gun",
    "pistol",
    "revolver",
    "rifle",
    "shotgun",
    "knife",
    "blade",
    "dagger",
    "letter",
    "envelope",
    "note",
    "telegram",
    "ring",
    "necklace",
    "locket",
    "pendant",
    "photograph",
    "photo",
    "picture",
    "pills",
    "pill",
    "bottle",
    "prescription",
    "medicine",
    "vial",
    "cassette",
    "tape",
    "flash drive",
    "usb",
    "drive",
    "journal",
    "diary",
    "notebook",
    "ledger",
    "contract",
    "deed",
    "will",
    "badge",
    "lockbox",
    "safe",
    "passport",
    "syringe",
    "lighter",
    "matches",
    "phone",
    "burner",
    "wallet",
    "ticket",
    "briefcase",
    "folder",
    "dossier",
    "document",
    "watch",
    "pocketwatch",
    "compass",
    "medallion"
  ],

  // mystery questions, investigative inquiries, and dramatic suspicions
  mysteryInquiries: [
    "Who told you",
    "Where were you",
    "Why did you leave",
    "What are you hiding",
    "What happened to",
    "Who was that at the door",
    "Where did you get this",
    "Why didn't you answer",
    "Who sent this",
    "What did they want",
    "How did you know",
    "wondered if anyone had seen",
    "couldn't shake the suspicion",
    "had to find out what",
    "needed to know who",
    "what were they looking for"
  ],

  // commitments, appointments, vows, and promises made between characters
  commitmentPhrases: [
    "Meet me at",
    "I'll meet you at",
    "I will meet you at",
    "Let's meet at",
    "I'll call you",
    "We'll talk tomorrow",
    "We'll talk later",
    "Promise me you won't",
    "Promise me you will",
    "I swear I'll",
    "I promise I will",
    "I'll be there at",
    "See you on Friday",
    "We need to talk tonight"
  ],

  // physical continuity: eye colors
  eyeColors: [
    "blue",
    "green",
    "brown",
    "hazel",
    "grey",
    "gray",
    "amber",
    "violet",
    "dark",
    "black",
    "golden"
  ],

  // physical continuity: hair colors
  hairColors: [
    "blonde",
    "blond",
    "black",
    "brown",
    "red",
    "auburn",
    "silver",
    "grey",
    "gray",
    "white",
    "golden",
    "raven",
    "chestnut",
    "dark"
  ],

  // custom user-defined categories
  customCategories: {}
};

/**
 * returns the effective lexicon by taking user-configured lists and falling back
 * to or merging with the default lists.
 */
export function getEffectiveLexicon(vault?: StoryMemoryVault): StoryLexiconConfig {
  if (!vault || !vault.lexiconConfig) {
    return { ...DEFAULT_STORY_LEXICON };
  }

  const custom = vault.lexiconConfig;

  return {
    deflectionPhrases: custom.deflectionPhrases && custom.deflectionPhrases.length > 0 
      ? custom.deflectionPhrases 
      : [...DEFAULT_STORY_LEXICON.deflectionPhrases],
    traumaCues: custom.traumaCues && custom.traumaCues.length > 0
      ? custom.traumaCues
      : [...DEFAULT_STORY_LEXICON.traumaCues],
    tactileObjects: custom.tactileObjects && custom.tactileObjects.length > 0
      ? custom.tactileObjects
      : [...DEFAULT_STORY_LEXICON.tactileObjects],
    mysteryInquiries: custom.mysteryInquiries && custom.mysteryInquiries.length > 0
      ? custom.mysteryInquiries
      : [...DEFAULT_STORY_LEXICON.mysteryInquiries],
    commitmentPhrases: custom.commitmentPhrases && custom.commitmentPhrases.length > 0
      ? custom.commitmentPhrases
      : [...DEFAULT_STORY_LEXICON.commitmentPhrases],
    eyeColors: custom.eyeColors && custom.eyeColors.length > 0
      ? custom.eyeColors
      : [...DEFAULT_STORY_LEXICON.eyeColors],
    hairColors: custom.hairColors && custom.hairColors.length > 0
      ? custom.hairColors
      : [...DEFAULT_STORY_LEXICON.hairColors],
    customCategories: custom.customCategories || {}
  };
}
