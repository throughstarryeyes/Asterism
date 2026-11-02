import type { CalliopeMood, WritingBadge, WritingPrompt, CosmeticItem } from '../types';

export interface CalliopeMoodInfo {
  id: CalliopeMood;
  label: string;
  emoji: string;
  statusLine: string;
  description: string;
  color: string;
  shakeQuotes: string[];
  sprintStartQuotes: string[];
  sprintFinishQuotes: string[];
}

export const CALLIOPE_MOODS: Record<CalliopeMood, CalliopeMoodInfo> = {
  sparkly: {
    id: 'sparkly',
    label: 'Sparkly',
    emoji: '✨',
    statusLine: 'brain static but in a good, glittery way.',
    description: 'High energy, unexpected connections, electric creative optimism.',
    color: '#f7c948',
    shakeQuotes: [
      'brain me a half-baked idea! We will make something chaotic and gorgeous.',
      'you are a creative disaster, but at least you are interesting. Now type!',
      'write the messy version first. Perfection is for published books, not today.',
      'every draft begins as a glittery accident. Lean into it.'
    ],
    sprintStartQuotes: [
      'Timer started! Throw caution into the void and write!',
      'Fast fingers, no editing allowed. Go go go!',
      'The muse is awake and drinking espresso. Let’s draft!'
    ],
    sprintFinishQuotes: [
      'Look at those words! You built something out of sheer thin air.',
      'Gorgeous momentum. Keep that spark burning!',
      'That was electric. Gold star in your constellation.'
    ]
  },
  dramatic: {
    id: 'dramatic',
    label: 'Dramatic',
    emoji: '🎭',
    statusLine: 'everything is a climax if you believe in yourself.',
    description: 'High stakes, opera-level tension, dramatic tension, fatal turns.',
    color: '#d4638c',
    shakeQuotes: [
      'you’re acting like a first draft can ruin your life. It cannot. Post it, coward.',
      'make them suffer a tiny bit more before they find solace.',
      'what is the secret that would burn down the entire room if spoken aloud?',
      'nothing is ordinary today. Every teacup carries an oath.'
    ],
    sprintStartQuotes: [
      'The stage lights are up. Deliver the line they cannot take back.',
      'Time to tear the veil. Sprint like the castle is burning!',
      'High stakes, ink on your hands. Begin!'
    ],
    sprintFinishQuotes: [
      'Curtain call! That had teeth. What a scene.',
      'The drama is intact. Outstanding execution.',
      'You did not flinch. Well done.'
    ]
  },
  soft: {
    id: 'soft',
    label: 'Soft',
    emoji: '🌸',
    statusLine: 'gentle character moments only. no plot, just feelings.',
    description: 'Quiet tenderness, emotional vulnerability, slow-breathing scenes.',
    color: '#85e2b6',
    shakeQuotes: [
      'hey. you’re allowed to make small, silly things that never become Anything. Existing is enough today.',
      'you roast yourself enough already. Go be kind to tiny-you for five minutes.',
      'write about the moment someone realized they were safe.',
      'the art can be tiny today. A cup of tea, a shared look.'
    ],
    sprintStartQuotes: [
      'Take a deep breath. No pressure, just one quiet sentence after another.',
      'Soft steps forward. Let the words unfold naturally.',
      'You are safe here. Tell the story at your own pace.'
    ],
    sprintFinishQuotes: [
      'Breathe out. That was tender and real.',
      'Every single word was worth creating today.',
      'You showed up for your story. That is everything.'
    ]
  },
  obsessed: {
    id: 'obsessed',
    label: 'Obsessed',
    emoji: '🔍',
    statusLine: 'i want to talk about *one* idea and beat it to death.',
    description: 'Hyper-focused, intricate world logic, forensic character dissection.',
    color: '#9370db',
    shakeQuotes: [
      'you’ve outlined this scene twelve times. It would like to exist now.',
      'let’s zoom into the microscopic detail: what is under their fingernails?',
      'dig deeper until you hit the nerve they swore was healed.',
      'stop researching 19th-century button clasps and write the argument.'
    ],
    sprintStartQuotes: [
      'Laser focus locked. Zero tabs open, pure manuscript immersion.',
      'Tackle that stubborn plot knot. Hack through the brambles!',
      'Full sprint tunnel vision engaged. Go!'
    ],
    sprintFinishQuotes: [
      'Unstoppable velocity. You conquered that mountain.',
      'That scene had nowhere left to hide from you.',
      'Incredible focus. That is how entire books are made.'
    ]
  },
  sleepy: {
    id: 'sleepy',
    label: 'Sleepy',
    emoji: '🌙',
    statusLine: 'i will give you soft, low-energy ideas only.',
    description: 'Late night quietude, minimalist sentences, dreamy reverie.',
    color: '#6b8afd',
    shakeQuotes: [
      'you do not, in fact, need another scroll break. You need water and a sentence.',
      'low energy? Good. Over-thinking is asleep, so the raw honesty can come out.',
      'just write one tiny paragraph and let yourself rest.',
      'half in your brain, fully in your manuscript. Let the tired words flow.'
    ],
    sprintStartQuotes: [
      'Just five or ten minutes of cozy words. We will keep each other company.',
      'Quiet midnight sprint. The world is asleep; the page is yours.',
      'Low hum, gentle rhythm. Tap the keys.'
    ],
    sprintFinishQuotes: [
      'Look at that—you wrote even when the world was silent and heavy.',
      'Proud of you for keeping the night watch.',
      'Cozy victory. Rest easy now, author.'
    ]
  },
  blocked: {
    id: 'blocked',
    label: 'Blocked',
    emoji: '🧱',
    statusLine: 'everything is mid-sentence. please insert inspiration.',
    description: 'Stuck in the mud, resistant, needs a crowbar to pry the scene loose.',
    color: '#e58e52',
    shakeQuotes: [
      'you’re not blocked, you’re just narrating your block instead of writing.',
      'it is allowed to be bad. Write the clumsy, awkward version so you have something to edit.',
      'change the weather. Bring in a knock at the door. Have someone drop a glass.',
      'if you can’t write the next scene, skip it and write the one you are actually daydreaming about.'
    ],
    sprintStartQuotes: [
      'We are smashing the wall down. Five minutes of bad writing. Dare to be messy!',
      'No backspacing allowed! Just forward momentum.',
      'Break the lock. Any word is better than a blank cursor.'
    ],
    sprintFinishQuotes: [
      'The block is broken! The ink is moving again!',
      'See? You were not broken, just stuck for a second.',
      'You won that round against the void.'
    ]
  }
};

// calliope autopsy and faultline data
export interface CalliopeAutopsyPacket {
  title: string;
  category: 'wants' | 'wounds' | 'fears' | 'masks';
  prompt: string;
  deepeningQuestions: string[];
}

export const CALLIOPE_AUTOPSY_PACKETS: CalliopeAutopsyPacket[] = [
  {
    title: 'Core Wants',
    category: 'wants',
    prompt: 'What do they want so badly it terrifies them—and what do they think they actually deserve?',
    deepeningQuestions: [
      'What desire do they keep just out of reach on purpose so they never have to face failing to get it?',
      'What do they chase when they feel hollow inside?',
      'What would they sacrifice first if forced into an ultimatum?',
      'What do they believe will finally make them feel safe?'
    ]
  },
  {
    title: 'Wounds & Lies',
    category: 'wounds',
    prompt: 'What foundational lie did they learn to survive, and what wound do they keep reopening to prove it still hurts?',
    deepeningQuestions: [
      'What do they mistake for love or approval?',
      'What truth would unravel them if spoken out loud in front of everyone?',
      'What pain do they normalize because it is the only pain that feels familiar?',
      'What part of them learned to disappear whenever footsteps approached?'
    ]
  },
  {
    title: 'Fears & Avoidance',
    category: 'fears',
    prompt: 'What are they most afraid will happen if they stop running, and what fear disguises itself as logic?',
    deepeningQuestions: [
      'What silence terrifies them more than screams?',
      'What do they leave before it has the chance to leave them?',
      'What outcome do they obsessively plan for at 3 AM but never mention aloud?',
      'What fear do they proudly dress up as "independence"?'
    ]
  },
  {
    title: 'Masks & Performances',
    category: 'masks',
    prompt: 'Who are they pretending to be to stay safe, and what emotion do they perform instead of the real one?',
    deepeningQuestions: [
      'What do they hide behind their competence, humor, or cool silence?',
      'Who benefits most from the curated version of them that exists right now?',
      'What would happen if someone saw their hands shaking under the table?',
      'What do they never let themselves need from anyone else?'
    ]
  }
];

export interface CalliopeFaultline {
  id: string;
  characterA_wants: string;
  characterB_wants: string;
  crux: string;
  sparkQuestion: string;
}

export const CALLIOPE_FAULTLINES: CalliopeFaultline[] = [
  {
    id: 'fl-1',
    characterA_wants: 'Truth at all costs',
    characterB_wants: 'Safety & Sanctuary',
    crux: 'The truth would permanently destroy the only safe thing they have left.',
    sparkQuestion: 'When the secret cracks, does Character A see Character B as a coward, or as someone they failed to protect?'
  },
  {
    id: 'fl-2',
    characterA_wants: 'Control & Predictability',
    characterB_wants: 'Freedom & Autonomy',
    crux: 'Every compromise feels like betrayal to one, and asphyxiation to the other.',
    sparkQuestion: 'What physical boundary or small gesture triggers their deepest mutual resentment?'
  },
  {
    id: 'fl-3',
    characterA_wants: 'To be chosen for once',
    characterB_wants: 'To never owe anyone anything',
    crux: 'Need starts to look like an inescapable trap to one, and a closed door to the other.',
    sparkQuestion: 'Who flinches first when physical closeness demands emotional surrender?'
  },
  {
    id: 'fl-4',
    characterA_wants: 'Peace & Quiet Healing',
    characterB_wants: 'Retribution & Justice',
    crux: 'Peace requires letting a monster walk away; justice requires setting the house on fire.',
    sparkQuestion: 'Can they love each other across the divide of what cannot be forgiven?'
  },
  {
    id: 'fl-5',
    characterA_wants: 'To protect the other person',
    characterB_wants: 'To be told the raw honest truth',
    crux: 'Protection requires a protective lie that grows heavier and more corrosive each day.',
    sparkQuestion: 'When the lie is uncovered, does the betrayal hurt worse than the danger itself?'
  },
  {
    id: 'fl-6',
    characterA_wants: 'To survive by any means necessary',
    characterB_wants: 'To remain a good person',
    crux: 'Goodness keeps getting in the way of survival, while survival keeps staining goodness.',
    sparkQuestion: 'Who pays the moral bill when the night is over?'
  }
];

// calliope prompts archive
export const CALLIOPE_PROMPTS: WritingPrompt[] = [
  {
    id: 'pr-1',
    text: 'Write the scene that happens five minutes after something life-changing—not the explosion itself, but the surreal quiet afterward.',
    category: 'turning_point',
    calliopeMood: 'dramatic',
    flavorNotes: 'Focus on sensory aftershocks: ringing ears, dust settling, the coldness of a door handle.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-2',
    text: 'A character realizes they feel safe for the first time in years, for a stupid, tiny, ordinary reason.',
    category: 'wound_confession',
    calliopeMood: 'soft',
    flavorNotes: 'Warmth, tea, a lock clicking into place, an unlocked window that no longer matters.',
    defaultTargetWords: 300
  },
  {
    id: 'pr-3',
    text: 'Write a conversation where no one says what they actually mean, but both walk away knowing everything has changed.',
    category: 'turning_point',
    calliopeMood: 'obsessed',
    flavorNotes: 'Subtext is king: what do the hands do? Where do the eyes dart?',
    defaultTargetWords: 400
  },
  {
    id: 'pr-4',
    text: 'Two people sit in a parked car with the engine off, the headlights dimming, and the world held at bay.',
    category: 'scene_starter',
    calliopeMood: 'sleepy',
    flavorNotes: 'A late night confession or a silent realization before opening the car door.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-5',
    text: 'Someone kept an unsent message or drafted letter for three years. Tonight, they finally hit delete—or send.',
    category: 'wound_confession',
    calliopeMood: 'dramatic',
    flavorNotes: 'What was the unspeakable sentence inside it? Why tonight?',
    defaultTargetWords: 300
  },
  {
    id: 'pr-6',
    text: 'Write the last normal day before everything changes, without ever mentioning what is coming.',
    category: 'turning_point',
    calliopeMood: 'soft',
    flavorNotes: 'Every mundane habit feels heartbreaking when the reader knows the storm ahead.',
    defaultTargetWords: 450
  },
  {
    id: 'pr-7',
    text: 'A character notices a small physical habit they picked up from someone who is gone, and catches themselves doing it.',
    category: 'wound_confession',
    calliopeMood: 'soft',
    flavorNotes: 'Tapping a ring, double-checking the kettle, folding paper into thirds.',
    defaultTargetWords: 250
  },
  {
    id: 'pr-8',
    text: '“I didn’t think it would hurt like this.” Start right here and keep going.',
    category: 'one_liner',
    calliopeMood: 'sparkly',
    flavorNotes: 'Raw momentum. Do not pause to edit.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-9',
    text: 'A late night errand that becomes unexpectedly intimate because neither wants to go back to an empty apartment.',
    category: 'scene_starter',
    calliopeMood: 'sleepy',
    flavorNotes: 'Fluorescent lights in an all-night diner or convenience store.',
    defaultTargetWords: 400
  },
  {
    id: 'pr-10',
    text: 'A character chooses to stay and be blamed for something, because the alternative would destroy someone fragile.',
    category: 'turning_point',
    calliopeMood: 'dramatic',
    flavorNotes: 'Quiet sacrifice. The heavy dignity of silence.',
    defaultTargetWords: 400
  },
  {
    id: 'pr-11',
    text: 'Write a scene where someone is kind in a way that feels unbearable to the recipient.',
    category: 'wound_confession',
    calliopeMood: 'obsessed',
    flavorNotes: 'When you are braced for a blow, a gentle hand feels like fire.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-12',
    text: '“You don’t get to apologize like that.” Start with this sentence.',
    category: 'one_liner',
    calliopeMood: 'dramatic',
    flavorNotes: 'An apology that was really an evasion. Tear it open.',
    defaultTargetWords: 300
  },
  {
    id: 'pr-13',
    text: 'A place that remembers everyone who has loved there, holding residual echoes in the woodwork.',
    category: 'sensory_atmosphere',
    calliopeMood: 'sparkly',
    flavorNotes: 'Atmospheric magic, worn floorboards, afternoon dust motes.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-14',
    text: 'Two people who swore they would never speak again find themselves forced to assemble something mundane together.',
    category: 'scene_starter',
    calliopeMood: 'blocked',
    flavorNotes: 'Changing a flat tire, fixing a collapsed bookshelf, cooking in a tiny galley.',
    defaultTargetWords: 350
  },
  {
    id: 'pr-15',
    text: 'A character can revisit any memory, but only the painful ones that taught them something.',
    category: 'turning_point',
    calliopeMood: 'obsessed',
    flavorNotes: 'What memory do they keep revisiting, and what detail did they misremember?',
    defaultTargetWords: 400
  }
];

// milestone badges: earned by writing, never bought
export const DEFAULT_WRITING_BADGES: WritingBadge[] = [
  { id: 'badge-season-winter', name: 'Winterkeeper', description: 'Wrote 10,000 words in a winter. Earns the Snowbound cover.', icon: 'Moon', category: 'words', unlocked: false, progress: 0, maxProgress: 10000 },
  { id: 'badge-season-spring', name: 'Springwalker', description: 'Wrote 10,000 words in a spring. Earns the First Bloom cover.', icon: 'Feather', category: 'words', unlocked: false, progress: 0, maxProgress: 10000 },
  { id: 'badge-season-summer', name: 'Sunchaser', description: 'Wrote 10,000 words in a summer. Earns the Long Days cover.', icon: 'Flame', category: 'words', unlocked: false, progress: 0, maxProgress: 10000 },
  { id: 'badge-season-autumn', name: 'Leafgatherer', description: 'Wrote 10,000 words in an autumn. Earns the Harvest cover.', icon: 'BookOpen', category: 'words', unlocked: false, progress: 0, maxProgress: 10000 },
  {
    id: 'badge-streak-7',
    name: 'Seven Days Strong',
    description: 'Wrote or finished a challenge 7 days in a row. Earns the Ember cloth cover.',
    icon: 'Flame',
    category: 'streak',
    unlocked: false,
    progress: 0,
    maxProgress: 7
  },
  {
    id: 'badge-streak-30',
    name: 'A Month of Mornings',
    description: 'Kept a 30-day streak. Earns the Comet tail pointer trail.',
    icon: 'Star',
    category: 'streak',
    unlocked: false,
    progress: 0,
    maxProgress: 30
  },
  {
    id: 'badge-streak-100',
    name: 'Hundred Day Legend',
    description: 'Kept a 100-day streak. Earns the Hall of legends shelf and the Triumph chime.',
    icon: 'Crown',
    category: 'streak',
    unlocked: false,
    progress: 0,
    maxProgress: 100
  },
  {
    id: 'badge-first-sprint',
    name: 'First Time with your New Legs?',
    description: 'Completed your very first writing sprint against the clock.',
    icon: 'Flame',
    category: 'sprint',
    unlocked: false,
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'badge-hourglass',
    name: 'Stay Focused!',
    description: 'Conquered a full 20+ minute uninterrupted writing sprint.',
    icon: 'Hourglass',
    category: 'sprint',
    unlocked: false,
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'badge-sprint-veteran',
    name: 'Deep In The Groove',
    description: 'Completed 5 writing sprints in your journey.',
    icon: 'Zap',
    category: 'sprint',
    unlocked: false,
    progress: 0,
    maxProgress: 5
  },
  {
    id: 'badge-midnight-weaver',
    name: 'Night Owl!',
    description: 'Wrote words during the nocturnal hours between 11 PM and 4 AM.',
    icon: 'Moon',
    category: 'night',
    unlocked: false,
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'badge-deep-autopsy',
    name: 'Surgeon',
    description: 'Saved 3 reflections from Calliope’s Autopsy and Faultline decks.',
    icon: 'Compass',
    category: 'cards',
    unlocked: false,
    progress: 0,
    maxProgress: 3
  },
  {
    id: 'badge-words-5k',
    name: 'Asterism Scholar',
    description: 'Pen 5,000 words across your manuscripts.',
    icon: 'Feather',
    category: 'words',
    unlocked: false,
    progress: 0,
    maxProgress: 5000
  },
  {
    id: 'badge-words-25k',
    name: 'Novella!',
    description: 'Pen 25,000 words into your grand archive.',
    icon: 'BookOpen',
    category: 'words',
    unlocked: false,
    progress: 0,
    maxProgress: 25000
  },
  {
    id: 'badge-words-50k',
    name: 'I WROTE A BOOK!!',
    description: 'Pen 50,000 words into your grand archive.',
    icon: 'BookOpen',
    category: 'words',
    unlocked: false,
    progress: 0,
    maxProgress: 50000
  },
  {
    id: 'badge-words-100k',
    name: 'Superstar!',
    description: 'Pen 100,000 words into your grand archive.',
    icon: 'BookOpen',
    category: 'words',
    unlocked: false,
    progress: 0,
    maxProgress: 100000
  },
  {
    id: 'badge-calliope-chosen',
    name: 'Calliope’s Chosen',
    description: 'Drafted 3 prompt sprint pieces inspired by the muse.',
    icon: 'Sparkles',
    category: 'streak',
    unlocked: false,
    progress: 0,
    maxProgress: 3
  }
];

// themes
export const EXPANDED_COSMETIC_SHOP_ITEMS: CosmeticItem[] = [
  {
    id: 'theme-parchment',
    name: 'Warm Parchment',
    category: 'theme',
    cost: 0,
    description: 'Soft sepia library tone.',
    unlocked: true,
    previewColor: '#f5f0e6',
    previewIcon: '📜'
  },
  {
    id: 'theme-black',
    name: 'Black Contrast',
    category: 'theme',
    cost: 0,
    description: 'Zero glare, black contrast.',
    unlocked: true,
    previewColor: '#000000',
    previewIcon: '🌑'
  },
  {
    id: 'theme-white',
    name: 'White Contrast',
    category: 'theme',
    cost: 0,
    description: 'Clean white.',
    unlocked: true,
    previewColor: '#ffffff',
    previewIcon: '🕊️'
  },

  // --- luxury ornate themes (point unlocked) ---
  {
    id: 'theme-celestial',
    name: 'Celestial Starlight',
    category: 'theme',
    cost: 50,
    description: 'Deep navy with gold stars.',
    unlocked: false,
    previewColor: '#080c18',
    previewIcon: '✨'
  },
  {
    id: 'theme-velvet',
    name: 'Midnight Velvet',
    category: 'theme',
    cost: 50,
    description: 'Deep moody burgundy.',
    unlocked: false,
    previewColor: '#120e17',
    previewIcon: '🍷'
  },
  {
    id: 'theme-solarium',
    name: 'Emerald Solarium',
    category: 'theme',
    cost: 65,
    description: 'Dark forest green with brass accents.',
    unlocked: false,
    previewColor: '#081710',
    previewIcon: '🌿'
  },
  {
    id: 'theme-scriptorium',
    name: 'Amber Scriptorium',
    category: 'theme',
    cost: 65,
    description: '.',
    unlocked: false,
    previewColor: '#1a110a',
    previewIcon: '🕯️'
  },

  {
    id: 'theme-composition',
    name: 'Composition Notebook',
    category: 'theme',
    cost: 45,
    description: 'Authentic blue ruled lines with red vertical margin, ballpoint ink, and pastel sticky-note critique comments.',
    unlocked: false,
    previewColor: '#fbfbf6',
    previewIcon: '📓'
  },
  {
    id: 'theme-pasteldream',
    name: 'Pastel Dream Journal',
    category: 'theme',
    cost: 45,
    description: 'Soft lavender-blue grid paper, sweet candy borders, and heart-accented comment notes.',
    unlocked: false,
    previewColor: '#f5f3ff',
    previewIcon: '🎀'
  },
  {
    id: 'theme-duck',
    name: 'Rubber Duck Bath Theme',
    category: 'theme',
    cost: 30,
    description: 'Silly sunny yellow bath paper with gentle soap bubble borders, blue water margin lines, and bath sponge comment bubbles.',
    unlocked: false,
    previewColor: '#fef9c3',
    previewIcon: '🦆'
  },

  // --- mechanical keyboard & keystroke sound packs ---
  {
    id: 'keystroke-thocky',
    name: 'Thocky Mechanical Keyboard',
    category: 'keystroke',
    cost: 0,
    description: 'Deep and clicky.',
    unlocked: true,
    previewIcon: '🪵'
  },
  {
    id: 'keystroke-creamy',
    name: 'Creamy Smooth Linear Keys',
    category: 'keystroke',
    cost: 35,
    description: 'Buttery and smooth',
    unlocked: false,
    previewIcon: '🧈'
  },
  {
    id: 'keystroke-clacky',
    name: 'Clacky Crisp Keyboard',
    category: 'keystroke',
    cost: 35,
    description: 'Sharp and snappy',
    unlocked: false,
    previewIcon: '⚡'
  },
  {
    id: 'keystroke-clicky',
    name: 'Tactile Clicky Keyboard',
    category: 'keystroke',
    cost: 35,
    description: 'Crisp clicky.',
    unlocked: false,
    previewIcon: '🕹️'
  },
  {
    id: 'keystroke-typewriter',
    name: 'Vintage Typewriter Keys',
    category: 'keystroke',
    cost: 0,
    description: 'Old fashioned typing.',
    unlocked: true,
    previewIcon: '⌨️'
  },
  {
    id: 'keystroke-bubbles',
    name: 'Bubble Pops',
    category: 'keystroke',
    cost: 30,
    description: 'Bubble pops.',
    unlocked: false,
    previewIcon: '🫧'
  },
  {
    id: 'keystroke-real-typewriter',
    name: 'Real Typewriter',
    category: 'keystroke',
    cost: 60,
    description: 'Recorded from a real typewriter, with its own return.',
    unlocked: false,
    previewIcon: '📠'
  },
  {
    id: 'keystroke-thud',
    name: 'Felt Tapping',
    category: 'keystroke',
    cost: 25,
    description: 'Soft and muted.',
    unlocked: false,
    previewIcon: '🛋️'
  },
  {
    id: 'keystroke-duck',
    name: 'Ducky',
    category: 'keystroke',
    cost: 25,
    description: 'Silly and squeaky.',
    unlocked: false,
    previewIcon: '🦆'
  },
  {
    id: 'keystroke-droplet',
    name: 'Water Drops',
    category: 'keystroke',
    cost: 25,
    description: 'Water drops!',
    unlocked: false,
    previewIcon: '💧'
  },

  // --- ambient soundscapes ---
  {
    id: 'soundscape-rain',
    name: 'Rain on Library Skylight',
    category: 'soundscape',
    cost: 25,
    description: 'Pink noise rain.',
    unlocked: false,
    previewIcon: '🌧️'
  },
  {
    id: 'soundscape-fire',
    name: 'Actual Crackling Fire',
    category: 'soundscape',
    cost: 25,
    description: 'Low roar, pops and crackles.',
    unlocked: false,
    previewIcon: '🔥'
  },
  {
    id: 'soundscape-library',
    name: 'Silent Archive Acoustics',
    category: 'soundscape',
    cost: 20,
    description: 'Quiet resonant room.',
    unlocked: false,
    previewIcon: '📚'
  },
  {
    id: 'soundscape-wind',
    name: 'Wind Through Trees',
    category: 'soundscape',
    cost: 25,
    description: 'Gusts that rise and fall through leaves.',
    unlocked: false,
    previewIcon: '🍃'
  },
  {
    id: 'soundscape-ocean',
    name: 'Ocean Waves & Foam',
    category: 'soundscape',
    cost: 25,
    description: 'Ocean swirling, waves crashing.',
    unlocked: false,
    previewIcon: '🌊'
  },
];

// scene breaks, title page flourishes and loaders are in services/ornaments and services/loaders; services/shop puts it all together
