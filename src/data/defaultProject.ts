import { defaultCoachSettings } from '../services/coach/settings';
import type { Project, CosmeticItem, UserStats } from '../types';

// the sample project a new install opens with: the first two chapters of Nereus, by its authors, with example notes around it
// each note below quotes the chapters, so a test checks the quotes still match when the text changes
export const DEFAULT_PROJECT: Project = {
  id: 'proj-nereus',
  title: 'Nereus',
  author: 'Kuiper Steinmeyer & AJ Sanfratello',
  genre: '',
  tags: ['Sample'],
  synopsis: 'A scalloping crew comes home early, silent and short of their catch, and one of them begs a friend on the dock to get inland. A second thread follows a trawler captain who wakes on the shore with no proof his shipwreck ever happened.',
  folder: 'Sample',
  chapters: [
    {
      id: 'chap-1',
      title: 'Chapter 1: Scallops',
      order: 1,
      wordCount: 1306,
      status: 'draft',
      folder: 'Part I',
      updatedAt: new Date().toISOString(),
      content: `<h2>Chapter 1: Scallops</h2>
<p>The other men returned to shore with dark eyes. Their boat ebbed with the rising waves, bumping lightly against the dock, and they hurried off of its slippery deck. They tossed their cargo, bulging white bags of scallop flesh, carelessly into the rusted industrial scale. A usually boisterous crew worked in near silence like an oiled machine.</p>
<p>It was all Leo could do to count the workers who returned. With a silence like the one before him, he had half a mind to call the funeral home to start arranging a service. He stood at the edge of the dock, squinting, counting, recounting again, just to be certain all seven who left had come back. He found them all to be there, working more quickly than they’d ever had. The boat- named the Haflinger, as was painted on its side- didn’t bear any marks to suggest an incident. Leo watched more curiously the closer he came.</p>
<p>“Hey,” he said, throwing up a hand in greeting. “I just got the call you came back to port. You’re, uh, back early.”</p>
<p>One of the sailors, Benjamin, an old friend, spared Leo a glance. “Yeah.” And he tossed another bag of scallops to the next sailor in the line.</p>
<p>Leo waited a few moments for an answer that didn’t come. He cleared his throat. “Okay! Okay. You guys are quiet today.”</p>
<p>As if in response, another few bags schlopped messily into the scale. The wind bellowed far beyond them, far out to sea. The water gnawed on the concrete of the dock harder.</p>
<p>Leo found there was little to do beyond idly watching the sailors finish their job. He puttered around, scraped half a barnacle off the Halflinger with the nail of his thumb, narrowly avoided a large swell that washed over the dock, circling the ankles of his boots before receding back.</p>
<p>“Shit. The sea’s really angry today,” Leo said. “I’m glad you lot got home when you did.”</p>
<p>“You wouldn’t believe it,” Ben murmured back, and there was a quiet, tense breath of laughter from someone else next to him.</p>
<p>The line of sailors dispersed away from the boat, dividing into smaller groups that seemed largely based in who was willing to share a cigarette with who. Leo cocked his head. “Wait,” he said. “Are you guys going to finish up the unloading?”</p>
<p>There was a pause before Captain Ripley spoke. “Shit, man. We are done.” The captain was tall, wiry, and young, maybe only a year or two Leo’s senior. He stood by the gauge on the scale, writing down the number it read in a notebook.</p>
<p>“What? You weren’t unloading Halfie for more than fifteen minutes. You guys were working fast today, not that fast.”</p>
<p>The silence that followed was uncomfortable. Ripley dug out a box of cigarettes from his coat pocket and yanked out the last one. He didn’t bother to light it, just stuck it in his mouth and started chewing. “Yeah,” he said. “It wasn’t a big haul.”</p>
<p>Leo’s eyes flickered to the gauge on the scale. 10,000. His eyebrows furrowed. He read the number again. “You- what? Ten thousand in six days? That’s-... what the fuck happened? You were talking big game. What happened to the thirty thousand?”</p>
<p>Ripley’s lips drew back, showing off yellow teeth. “Didn’t work out.” He turned his head so as not to look at Leo. “We had to come back to port early. You can see the seas out there- it gets worse the further you get out. We lost a bunch of cargo in the worst of it.” He looked back to him, and Leo was taken aback by the emptiness in usually fiery, ambitious eyes. “We were lucky to make it back at all.”</p>
<p>Leo’s mouth was open like he couldn’t find the words to respond. “You’re not gonna be able to pay the guys and keep Halfie with this. The hell are you gonna do?”</p>
<p>“The best I can.” Ripley shot him a glowering look that silenced Leo in an instant. “The guys don’t care.”</p>
<p>“Fuck. Okay.” Leo clapped Ripley on the back. “I’m glad you all made it back in one piece. That’s the most important thing. We’ll figure it out. Maybe I can radio in to one of the other boats out there to look for whatever you dropped. If they were bagged they ought to have been buoyant enough, right?”</p>
<p>Ripley spun around. “No,” he said sharply enough that Leo startled. “That’s the end of it. The sea’s too rough right now. We’re going to cut our fucking losses and that’s that. Call the shops and get these sold before the storm picks up.” The captain drew his coat stiffly around himself and marched off.</p>
<p>The rest of the crew began to disperse. Leo shook his head as Benjamin approached him. “What crawled up Rip’s ass today? Holy fuck. The guy must be taking all this really hard. Was the ocean that rough already?”</p>
<p>“Yeah. Uh, Lee, listen. I gotta talk to you for a moment in private.” Ben cast a nervous glance at the sea, which swelled up sharply again, devouring and spitting up big chunks of the docks. The boats tossed roughly around on their tethers. “Here works. Uh, listen. Real quick.” He shut his eyes tight. “You have to get inland. It’s dangerous on the coast right now.” He shook his head.</p>
<p>Leo cocked his head, concerned. “I- listen. Hey. Look at me- it’s alright. It’s gonna be okay. I know it’s rough out there. You’ll be safe.”</p>
<p>“No,” Benjamin said. “Listen to me, you’re not listening. There was something out there. The guys won’t admit it but we all saw it. They’ll deny it, say it was the storm. You’ve gotta listen to me. Get yourself the hell out of here.”</p>
<p>“Ben?” Leo reached out and touched his friend’s shoulder. He flinched away. “Ben, hey. It’s just a bad storm. It’ll be okay.”</p>
<p>Benjamin shook his head wildly. “No-. No. I- hey. Hey, I’ll catch you later. I gotta- I gotta go. I’m going inland. Don’t be stupid, okay?” And he broke away from Leo’s fingertips and practically ran off in the same direction Ripley had, and that the rest of the crew was slowly dispersing in. The sea washed towards him and he jumped out of the way before it could touch him, hurrying his pace.</p>
<p>Leo could only stare after the sailors and shake his head. They were all just shaken, he was certain. He knew firsthand how rough the scalloping grounds could be in bad weather to the extent his bad leg gave a pathetic pang at the memory of getting slammed into the deck. It was all he could do to wait out the storm.</p>
<p style="text-align: center;">* * *</p>
<p>It took a while for the market to come pick up the lackluster load of scallops and pass Leo a check to later be distributed among the fishermen. A few of the sailors hung around after they helped load the trucks. It took a little longer than that for the wind to push further towards the shore, bringing with it the first pellets of rainfall.</p>
<p>Leo stood under the main dock’s awning, watching the violent sea stir up before him. His sweatshirt’s hood was pulled over his damp brown hair, warming his freezing cheeks and tips of his ears. He tapped a message into his phone. It was maybe the sixth he’d sent to Benjamin.</p>
<p>u were acting weird as fuck earlier, it read. gimme a call when u can. storm is fucking w/ reception here but yknow. gimme a call u weird fuck, i wanna know who gave u the crack u were tripping on.</p>
<p>He shoved his phone back into his pocket in favor of gazing out to sea.</p>`
    },
    {
      id: 'chap-2',
      title: 'Chapter 2: Driftwood',
      order: 2,
      wordCount: 1297,
      status: 'draft',
      folder: 'Part I',
      updatedAt: new Date().toISOString(),
      content: `<h2>Chapter 2: Driftwood</h2>
<p>Memphis felt something rough and gritty against his cheek as he awoke. His head pounded, his body ached entirely, and every breath he attempted to heave hurt. He pulled himself up slightly, only to sputter and spit out about half his body weight worth of water. He took a handful of desperate breaths, trying to clear the burning sensation from his nose and lungs.</p>
<p>Once he felt like he could breathe again, he glanced up to realize he was at the shoreline of Eastport. Same dock he’d left out of. Nereus was a ways away but looked just fine, if not a bit wet. He looked around for any sign he’d been out at sea other than his waterlogged clothes. “What…” He looked to his boat, still tied to the dock, “What the fuck?” He felt around in his pocket to see if his phone was there.</p>
<p>He climbed up onto the dock and entered his ship. She was slick with rain, but nothing else. He checked the crank for her anchor. It hadn’t been moved at all. He checked for any signs that Kai and Trin had been on his ship, checked for Trin’s sweater, or Kai’s phone, either of their lunches in the fridge. Nothing.</p>
<p>Memphis pulled out his phone and dialed Kairos’s number. Straight to voicemail. Figures. “Hey, it’s Kai. Sorry I can’t get to the phone right now, But I’ll try to get back to you as soon as possible.” He never charged his damn phone. Or maybe it had been lost in the wreck? Or… did the wreck happen? He tried Trin’s number, too. He got the four rings, then voicemail.</p>
<p>“Hey, Trin. I had the weirdest dream. Call me back, alright? I hope you and K are doing okay.”</p>
<p>Memphis took another jacket from his wardrobe and slipped it on over his wet clothes. His dark, sopping wet curls stuck to his face as walked to the pier next to someone who seemed equally as distraught. He could still feel sand in his damn beard. He scratched what he could out before he shoved a (dry) cigarette into his mouth.</p>
<p>“You look like you’ve had a rough day.” Memphis voice was gruff and gravelly. Part of that was the residual saltwater in his throat, and part of it was the ten years of smoking. He’d quit eventually. He spared a glance over to the men who had scrambled off of the ship behind them. “Shit’s been weird, I’ll tell ya.”</p>
<p>“Listen, Memph. I don’t know about all this. Don’t you think we should turn around? We’re not even that far out yet--”</p>
<p>“Listen to yourself, K. A little storm never hurt anybody. Nereus here, she can take a beating.” Memphis confidently patted one of the walls of his ship. She was larger trawler, his absolute prized possession. Though he might not admit it to Kairos, he’d been back and forth with living on Nereus since his divorce.</p>
<p>Kairos gave Memphis an incredulous look. “Yeah, okay. A little storm never hurt anybody, except this storm isn’t little. Look--” Kairos pointed out to waves upon waves crashing atop one another angrily, aggressively. The waves rippled out three, four hundred feet, out to Nereus. She could easily be swallowed by the ocean’s swells.</p>
<p>Memphis gave the storm a look, then glanced over to Kairos and his wife. He pondered it for a moment, turning around and calling it a day. It’d been particularly slow, eerily silent up until that point. Everything had went still. Neither Kairos nor Memphis had gotten a bite--not even a nibble in hours. Of course it was unsettling, but Memphis had seen thousands of storms out at sea. That was one of the worse ones, of course, but he hadn’t considered it the worst. Does that mean he would’ve considered turning back in more dangerous circumstances? Not necessarily.</p>
<p>“Ah, to hell with you. Listen, if you want to go below deck and wait out the storm, be my guest. This isn’t the worst I’ve seen, and sure as hell won’t be the worst you’ve seen. You’re new to this, aintcha? Consider this a lesson.” Memphis raised a cocky brow and offered a shiny-toothed grin. Kairos gave a nervous laugh as he turned back towards the calmer waters, casting his line out again.</p>
<p>Memphis felt an itch in his hands as he was about to walk next to Kai and toss his line out. He gave the storm another glance. Yeah, it did look pretty bad. He was almost certain he’d be able to avoid it if he went farther east, but he’d have to get the anchor up. He glanced to Kai, then to Kai’s wife. A bad feeling settled into his gut, boiling up to his throat. “Can’t believe I’m saying this son, but you’re right. Think you and the lady can help me get the anchor back up? It’s ‘possed to go up automatically, but the thing gets stuck and I could use the extra strength to help me turn it.”</p>
<p>Kairos glanced over to Trin. They exchanged a nod before walking over and putting their hands on the crank with Memphis’s. With the three of them combined, the anchor came up from the ocean floor without too much problem. A couple of hard waves smacked the side of the boat with splashes that sprayed Memphis’s trench coat, prompting him to look up. The sky above them had gone completely gray, dark enough that any sunlight was blocked out entirely.</p>
<p>“Shit.” Memphis spat as he let go of the crank. “You two keep pulling that anchor, I’m gonna start trying to get us to move.” He called to Kai and Trin, who nodded up at him. Memphis made his way up to the wheel, making a vigorous attempt to start the damn boat again. “Come on, come on. Ner, I know you’ve got gas in you. Come on, we haven’t moved in four hours. Come on, start!” Memphis growled, actions becoming more panicked as he watched rain pelt down on the deck below. He kept glancing back to Trin and Kai, who were now struggling to turn the crank.</p>
<p>“It’s not turning! Memph, it’s stuck--It’s stuck!” Trin shouted up to Memphis. Memphis continued to struggle to start his boat until he finally heard Nereus roar to life. He hadn’t heard Trin over the sound of her engine or over the increasingly loud smacks of the waves against the hull. Even if the anchor wasn’t all the way up, he could still get far enough out of harm’s way that it wouldn’t matter. He started to move the boat out of the storm, but he felt her struggle against him.</p>
<p>“Fuck, shit. Motherfucker! Come on!” Memphis shouted. She was moving, but at a snail’s pace. “Come on, girl.” Her engine roared as she attempted to move.</p>
<p>“Memphis! Memphis!” Kairos and Trin shouted.</p>
<p>“She’s not fucking moving! She’s-- get below! Now! NOW!” Memphis finally shouted back after seeing the largest swell he’d ever seen. It was too damn close for comfort. Trin and Kairos dropped the crank, running across the deck to get under. The ship was plastic, metal, slippery. Trin and Kai scrambled to get to safety, slipping and grappling onto whatever they could hold.</p>
<p>The last thing Memphis heard from them was their shrill screams as he felt the bottom of his ship tip completely below the water. He grappled onto the captain’s chair as he felt her lurch, then bob back up.</p>
<p>“Trin? Kai?” Memphis shouted out of the cabin. “Fuck me. Fuck me.” He walked out of the cabin, only to be greeted by the largest billowing wave he’d ever seen. “Fuck me.” He sputtered out, before being swallowed by the unforgiving sea.</p>`
    }
  ],
  storyBible: {
    characters: [
      {
        id: 'char-leo',
        name: 'Leo',
        aliases: ['Lee'],
        role: 'protagonist',
        archetype: 'The Friend Left on the Dock',
        coreDesire: 'To keep his friends whole and to understand why the crew came back wrong.',
        fatalFlaw: 'Explains away what frightens him: “It’s just a bad storm.”',
        internalConflict: 'He wants to trust Ben’s warning, but he stays on the coast to wait out the storm.',
        physicalDescription: 'Damp brown hair under a sweatshirt hood. A bad leg that aches in rough weather.',
        speechPattern: 'Casual and teasing. Jokes to fill a silence, swears easily.',
        theSecret: 'He counted the crew twice because he feared someone had died.',
        avatarColor: '#c9933b',
        relationships: [
          { targetCharacterId: 'char-ben', targetName: 'Benjamin', relationshipType: 'Old friend', notes: 'Texts him six times and gets no answer.' },
          { targetCharacterId: 'char-ripley', targetName: 'Captain Ripley', relationshipType: 'Friend and dock contact', notes: 'Presses him about the lost cargo and is shut down.' }
        ]
      },
      {
        id: 'char-ben',
        name: 'Benjamin',
        aliases: ['Ben'],
        role: 'supporting',
        archetype: 'The Frightened Witness',
        coreDesire: 'To get himself, and Leo, away from the coast.',
        fatalFlaw: 'Cannot say plainly what he saw.',
        internalConflict: 'He is torn between the crew’s silence and warning his friend.',
        physicalDescription: 'Not described yet.',
        speechPattern: 'Clipped and breathless. Repeats himself when scared: “Listen. Real quick.”',
        theSecret: 'He saw something out at sea, and he says the whole crew did.',
        avatarColor: '#5c768d',
        relationships: []
      },
      {
        id: 'char-ripley',
        name: 'Captain Ripley',
        aliases: ['Rip'],
        role: 'supporting',
        archetype: 'The Proud Captain, Humbled',
        coreDesire: 'To end the matter fast: sell the catch, stay off the water, say nothing.',
        fatalFlaw: 'Pride. Answers questions with orders.',
        internalConflict: 'He talked big about thirty thousand and came back with ten.',
        physicalDescription: 'Tall, wiry and young, with yellow teeth. Chews cigarettes he does not light.',
        speechPattern: 'Short and blunt. Goes sharp when pressed.',
        theSecret: 'The “lost cargo” story may not be the whole truth.',
        avatarColor: '#8a2be2',
        relationships: []
      },
      {
        id: 'char-memphis',
        name: 'Memphis',
        aliases: ['Memph'],
        role: 'deuteragonist',
        archetype: 'The Stubborn Skipper',
        coreDesire: 'To keep Nereus and to prove he is still the best captain on the water.',
        fatalFlaw: 'Overconfidence. Waves off warnings: “A little storm never hurt anybody.”',
        internalConflict: 'He turned back a beat too late, and now he cannot prove the wreck happened.',
        physicalDescription: 'Dark curls, a beard, a trench coat and a gravelly smoker’s voice.',
        speechPattern: 'Gruff and cocky. Calls Kairos “son” and his boat “girl”.',
        theSecret: 'He has been going back and forth to living aboard Nereus since his divorce.',
        avatarColor: '#d4af37',
        relationships: [
          { targetCharacterId: 'char-kairos', targetName: 'Kairos', relationshipType: 'Fishing partner', notes: 'Kai is new to this, and Memphis makes it a lesson.' }
        ]
      },
      {
        id: 'char-kairos',
        name: 'Kairos',
        aliases: ['Kai', 'K'],
        role: 'supporting',
        archetype: 'The Cautious Newcomer',
        coreDesire: 'To get home safe, and to be taken seriously.',
        fatalFlaw: 'Goes along against his own instinct.',
        internalConflict: 'He knows the storm is bad but gives in to Memphis anyway.',
        speechPattern: 'Polite and worried: “Listen, Memph.”',
        physicalDescription: 'Not described yet.',
        theSecret: 'He wanted to turn back long before Memphis did.',
        avatarColor: '#4f80ff',
        relationships: [
          { targetCharacterId: 'char-trin', targetName: 'Trin', relationshipType: 'Wife', notes: 'She is on the boat with him.' }
        ]
      },
      {
        id: 'char-trin',
        name: 'Trin',
        role: 'minor',
        archetype: 'The Practical Hand',
        coreDesire: 'To get the anchor up and everyone off the water.',
        fatalFlaw: 'Shouts a warning no one can hear over the engine.',
        internalConflict: 'She helps Memphis even though she did not choose this trip.',
        physicalDescription: 'Not described yet.',
        theSecret: 'Not decided yet.',
        avatarColor: '#10b981',
        relationships: []
      }
    ],
    locations: [
      {
        id: 'loc-dock',
        name: 'The Dock',
        type: 'Harbor',
        atmosphere: 'Slick with rain, boats knocking on their tethers, the sea chewing at the concrete.',
        sensoryDetails: 'Rust and wet rope, cigarette smoke, bags of scallops thudding onto the scale.',
        significance: 'Where Chapter 1 happens. Chapter 2 names Eastport. Is it the same dock?'
      },
      {
        id: 'loc-nereus',
        name: 'Nereus',
        type: 'Trawler',
        atmosphere: 'Slippery plastic and metal decks, a cramped cabin below.',
        sensoryDetails: 'The engine roaring to life, rain on the deck, the crank for the anchor.',
        significance: 'Memphis’s prized possession, and where he lives on and off.'
      },
      {
        id: 'loc-haflinger',
        name: 'The Haflinger',
        type: 'Scallop boat',
        atmosphere: 'Looks untouched, which is the strange part.',
        sensoryDetails: 'A slippery deck, white bags of scallop flesh, a barnacle scraped off her side.',
        significance: 'Seven men left on her. Seven came back. The crew calls her Halfie.'
      }
    ],
    lore: [
      {
        id: 'lore-scalloping',
        title: 'How a scalloping run works',
        category: 'culture',
        content: 'A crew of seven goes out for about six days. The catch is weighed on the dock scale, sold to the market, and the check is shared among the fishermen.'
      },
      {
        id: 'lore-saw',
        title: 'What the crew saw',
        category: 'custom',
        content: 'Unknown so far. Ben says “something out there” and that the whole crew saw it. They will blame the storm.'
      }
    ]
  },
  plotThreads: [
    {
      id: 'thread-1',
      title: 'What the crew saw at sea',
      type: 'mystery',
      status: 'introduced',
      importance: 'central',
      introducedInChapterId: 'chap-1',
      notes: 'Ben says they all saw something and will deny it. No one will say what.',
      passageQuote: 'There was something out there. The guys won’t admit it but we all saw it.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'thread-2',
      title: 'The missing twenty thousand',
      type: 'mystery',
      status: 'introduced',
      importance: 'major',
      introducedInChapterId: 'chap-1',
      notes: 'Ripley says the cargo was lost in the storm and will not let anyone search for it.',
      passageQuote: 'What happened to the thirty thousand?',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'thread-3',
      title: 'Ben’s warning: get inland',
      type: 'foreshadowing',
      status: 'simmering',
      importance: 'major',
      introducedInChapterId: 'chap-1',
      notes: 'Leo stays on the coast. Whatever Ben is afraid of is still coming.',
      passageQuote: 'You have to get inland. It’s dangerous on the coast right now.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'thread-4',
      title: 'Did the wreck happen?',
      type: 'mystery',
      status: 'introduced',
      importance: 'central',
      introducedInChapterId: 'chap-2',
      notes: 'Nereus is untouched, the anchor was never moved, and there is no trace of Kai or Trin.',
      passageQuote: 'Or… did the wreck happen?',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  reflections: [
    {
      id: 'ref-1',
      cardId: 'char-1',
      cardTitle: 'The Sacred Lie',
      category: 'characters',
      linkedCharacterId: 'char-memphis',
      linkedChapterId: 'chap-2',
      reflectionText: 'Memphis believes that being the experienced one keeps everyone aboard safe. If he has seen a thousand storms, this one cannot be the one that takes them.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  goals: [
    {
      id: 'goal-1',
      title: 'Draft Chapter 3',
      type: 'words',
      target: 750,
      current: 0,
      unit: 'words',
      pointsReward: 40,
      completed: false
    },
    {
      id: 'goal-2',
      title: 'Daily Writing Ritual (20 Mins)',
      type: 'time',
      target: 20,
      current: 12,
      unit: 'minutes',
      pointsReward: 25,
      completed: false
    },
    {
      id: 'goal-3',
      title: 'Fill in Memphis’s profile',
      type: 'character',
      target: 1,
      current: 1,
      unit: 'profiles',
      pointsReward: 30,
      completed: true
    }
  ],
  comments: [
    {
      id: 'comm-1',
      chapterId: 'chap-1',
      passageText: 'A usually boisterous crew worked in near silence like an oiled machine.',
      commentText: 'Good opening beat. The wrongness is in the quiet before anyone speaks.',
      author: 'Sample note',
      createdAt: new Date().toISOString(),
      resolved: true
    },
    {
      id: 'comm-2',
      chapterId: 'chap-1',
      passageText: 'We lost a bunch of cargo in the worst of it.',
      commentText: 'Does this add up? Thirty thousand down to ten. Maybe Leo works out the math later.',
      author: 'Sample note',
      createdAt: new Date().toISOString(),
      resolved: false
    },
    {
      id: 'comm-3',
      chapterId: 'chap-2',
      passageText: 'Or… did the wreck happen?',
      commentText: 'The doubt carries this scene. Keep it, and do not answer it for a while.',
      author: 'Sample note',
      createdAt: new Date().toISOString(),
      resolved: false
    },
    {
      id: 'comm-4',
      chapterId: 'chap-2',
      passageText: 'Memphis felt an itch in his hands as he was about to walk next to Kai and toss his line out.',
      commentText: 'Is this the turning point? He gives in, but a beat too late.',
      author: 'Sample note',
      createdAt: new Date().toISOString(),
      resolved: false
    }
  ],
  mindMap: {
    id: 'mm-main',
    title: 'Who is connected to what',
    nodes: [
      { id: 'node-leo', label: 'Leo', type: 'character', x: 160, y: 180, color: '#c9933b', notes: 'Waits on the dock' },
      { id: 'node-ben', label: 'Benjamin', type: 'character', x: 160, y: 360, color: '#5c768d', notes: 'Warns Leo to get inland' },
      { id: 'node-ripley', label: 'Captain Ripley', type: 'character', x: 400, y: 280, color: '#8a2be2', notes: 'Shuts down every question' },
      { id: 'node-saw', label: 'What they saw', type: 'plot_event', x: 400, y: 460, color: '#d4638c', notes: 'No one will say' },
      { id: 'node-memphis', label: 'Memphis', type: 'character', x: 660, y: 180, color: '#d4af37', notes: 'Wakes on the shore' },
      { id: 'node-kai', label: 'Kairos', type: 'character', x: 880, y: 130, color: '#4f80ff', notes: 'Missing' },
      { id: 'node-trin', label: 'Trin', type: 'character', x: 880, y: 300, color: '#10b981', notes: 'Missing' },
      { id: 'node-nereus', label: 'Nereus', type: 'location', x: 660, y: 380, color: '#5c768d', notes: 'Untouched when he wakes' }
    ],
    edges: [
      { id: 'edge-1', fromNodeId: 'node-leo', toNodeId: 'node-ben', label: 'Old friends' },
      { id: 'edge-2', fromNodeId: 'node-ben', toNodeId: 'node-saw', label: 'Saw it' },
      { id: 'edge-3', fromNodeId: 'node-ripley', toNodeId: 'node-saw', label: 'Denies it' },
      { id: 'edge-4', fromNodeId: 'node-leo', toNodeId: 'node-ripley', label: 'Presses' },
      { id: 'edge-5', fromNodeId: 'node-memphis', toNodeId: 'node-nereus', label: 'Owns' },
      { id: 'edge-6', fromNodeId: 'node-memphis', toNodeId: 'node-kai', label: 'Fishing with' },
      { id: 'edge-7', fromNodeId: 'node-kai', toNodeId: 'node-trin', label: 'Married' },
      { id: 'edge-8', fromNodeId: 'node-saw', toNodeId: 'node-memphis', label: 'Same storm?' }
    ]
  },
  findings: [
    {
      id: 'find-1',
      category: 'dropped_thread',
      title: 'Setup: what the crew saw',
      summary: 'In Chapter 1, Ben says everyone on the boat saw “something out there” and will deny it. Chapter 2 does not pick this up yet. Is Memphis’s storm the same one?',
      evidencePassages: [
        { chapterId: 'chap-1', chapterTitle: 'Chapter 1', quote: 'There was something out there. The guys won’t admit it but we all saw it.' },
        { chapterId: 'chap-2', chapterTitle: 'Chapter 2', quote: 'Or… did the wreck happen?' }
      ],
      confidence: 'probable',
      linkedThreadId: 'thread-1',
      status: 'unreviewed'
    },
    {
      id: 'find-2',
      category: 'continuity',
      title: 'Is it the same dock?',
      summary: 'Chapter 1 never names its harbor. Chapter 2 puts Memphis on the shoreline of Eastport. If these are the same town, one line in Chapter 1 would tie the two stories together.',
      evidencePassages: [
        { chapterId: 'chap-1', chapterTitle: 'Chapter 1', quote: 'Leo stood under the main dock’s awning' },
        { chapterId: 'chap-2', chapterTitle: 'Chapter 2', quote: 'Eastport. Same dock he’d left out of.' }
      ],
      confidence: 'probable',
      status: 'unreviewed'
    },
    {
      id: 'find-3',
      category: 'continuity',
      title: 'The boat’s name is spelled two ways',
      summary: 'The boat is the Haflinger when it is introduced and the Halflinger a few paragraphs later. Pick one.',
      evidencePassages: [
        { chapterId: 'chap-1', chapterTitle: 'Chapter 1', quote: 'named the Haflinger, as was painted on its side' },
        { chapterId: 'chap-1', chapterTitle: 'Chapter 1', quote: 'scraped half a barnacle off the Halflinger' }
      ],
      confidence: 'definite',
      status: 'unreviewed'
    },
    {
      id: 'find-4',
      category: 'expansion',
      title: 'A shared tell: cigarettes under stress',
      summary: 'Ripley chews an unlit cigarette to dodge a question. Memphis shoves a dry one in his mouth after waking. Smoking looks like how your captains steady themselves. Want to explore what each of them is avoiding?',
      evidencePassages: [
        { chapterId: 'chap-1', chapterTitle: 'Chapter 1', quote: 'He didn’t bother to light it, just stuck it in his mouth and started chewing.' },
        { chapterId: 'chap-2', chapterTitle: 'Chapter 2', quote: 'he shoved a (dry) cigarette into his mouth' }
      ],
      confidence: 'possible_exploration',
      linkedFoundationCardId: 'autopsy-1',
      status: 'unreviewed'
    },
    {
      id: 'find-5',
      category: 'drafting_note',
      title: 'A memory starts without a marker',
      summary: 'In Chapter 2, the talk with Kairos begins right after Memphis speaks to the stranger on the pier. A line or a break might help readers know it is a memory.',
      evidencePassages: [
        { chapterId: 'chap-2', chapterTitle: 'Chapter 2', quote: 'Shit’s been weird, I’ll tell ya.' },
        { chapterId: 'chap-2', chapterTitle: 'Chapter 2', quote: 'Listen, Memph. I don’t know about all this.' }
      ],
      confidence: 'possible_exploration',
      status: 'unreviewed'
    }
  ],
  memoryVault: {
    establishedFacts: [
      {
        id: 'fact-1',
        subject: 'Leo',
        claim: 'Has a bad leg from being slammed into a deck on the scalloping grounds',
        sourceChapterId: 'chap-1',
        sourceQuote: 'his bad leg gave a pathetic pang at the memory of getting slammed into the deck'
      },
      {
        id: 'fact-2',
        subject: 'The Haflinger',
        claim: 'Seven men went out and all seven came back, with 10,000 where 30,000 was promised',
        sourceChapterId: 'chap-1',
        sourceQuote: 'all seven who left had come back'
      },
      {
        id: 'fact-3',
        subject: 'Memphis',
        claim: 'Has been going back and forth to living aboard Nereus since his divorce',
        sourceChapterId: 'chap-2',
        sourceQuote: 'he’d been back and forth with living on Nereus since his divorce'
      }
    ],
    authorStyleRules: [
      {
        id: 'rule-1',
        pattern: 'Quiet before the wrongness',
        meaning: 'Builds unease through silence and ordinary routine before anything strange is named.',
        examplesCount: 2,
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'rule-2',
        pattern: 'Shorter and cruder when scared',
        meaning: 'Characters clip their sentences and swear more as the fear grows.',
        examplesCount: 3,
        lastUpdated: new Date().toISOString()
      }
    ],
    analysisPreferences: {
      sensitivity: 'balanced',
      ignoreResolvedThreads: false
    }
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// a gift for opening the app, shown to the writer in a welcome note
export const WELCOME_QP = 200;

export const DEFAULT_USER_STATS: UserStats = {
  quillPoints: WELCOME_QP,
  totalWordsWritten: 0,
  totalMinutesFocussed: 0,
  sprintsCompleted: 0,
  unlockedCosmetics: [
    'theme-parchment', 
    'theme-black', 
    'theme-white', 
    'cursor-default', 
    'cursor-quill',
    'keystroke-typewriter'
  ],
  unlockedBadges: [],
  // dark unless the device asks for light
  activeTheme: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'parchment' : 'black',
  activeCursor: 'quill',
  activeFont: 'Lora',
  keystrokeSound: 'typewriter',
  keystrokeVolume: 0.45,
  calliopeMood: 'sparkly',
  fontSize: 18,
  lineHeight: 1.8,
  indentParagraphs: true,
  typewriterMode: true,
  ambientSound: 'off',
  ambientVolume: 0.35,
  cornerRoundness: 10,
  customThemes: [],
  customFonts: [],
  activeCustomThemeId: null,
  documentFolders: ['Sample', 'Standalone Drafts', 'Short Stories'],
  coach: defaultCoachSettings(),
  home: { showRecent: false, showTools: true }
};

export const COSMETIC_SHOP_ITEMS: CosmeticItem[] = [
  // --- accessible themes (always free / unlocked) ---
  {
    id: 'theme-parchment',
    name: 'Warm Parchment',
    category: 'theme',
    cost: 0,
    description: 'Cozy antique library atmosphere with warm sepia tones, aged linen textures, and dark amber ink.',
    unlocked: true,
    previewColor: '#f7f2e7',
    previewIcon: '📜'
  },
  {
    id: 'theme-black',
    name: 'Pure Obsidian OLED',
    category: 'theme',
    cost: 0,
    description: 'Pitch black background for zero glare, battery conservation, and stark focused contrast.',
    unlocked: true,
    previewColor: '#000000',
    previewIcon: '🌑'
  },
  {
    id: 'theme-white',
    name: 'Crisp Architectural White',
    category: 'theme',
    cost: 0,
    description: 'Clean gallery-white studio with high-readability graphite typography and airy borders.',
    unlocked: true,
    previewColor: '#ffffff',
    previewIcon: '🕊️'
  },

  // --- luxury ornate themes (point unlocked) ---
  {
    id: 'theme-celestial',
    name: 'Celestial Starlight & Gold',
    category: 'theme',
    cost: 50,
    description: 'Deep starlight navy with luminous celestial gold accents, azure aura, and cosmic calm.',
    unlocked: false,
    previewColor: '#0c1222',
    previewIcon: '✨'
  },
  {
    id: 'theme-velvet',
    name: 'Midnight Velvet & Rose',
    category: 'theme',
    cost: 50,
    description: 'A luxurious dark plum and charcoal study illuminated by dusty rose embers and silver filigree.',
    unlocked: false,
    previewColor: '#1a101f',
    previewIcon: '🍷'
  },
  {
    id: 'theme-solarium',
    name: 'Emerald Solarium & Brass',
    category: 'theme',
    cost: 65,
    description: 'Lush conservatory deep botanical green with polished aged brass accents and sunlit leaf borders.',
    unlocked: false,
    previewColor: '#081710',
    previewIcon: '🌿'
  },
  {
    id: 'theme-scriptorium',
    name: 'Amber Scriptorium & Candlelight',
    category: 'theme',
    cost: 65,
    description: 'Dark warm mahogany study lit by flickering candlelight and burnished copper glow.',
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
    description: 'Deep, resonant marble & polycarbonate bottom-out (lubed linear switch sound on foam plate).',
    unlocked: true,
    previewIcon: '🪵'
  },
  {
    id: 'keystroke-creamy',
    name: 'Creamy Smooth Linear Keys',
    category: 'keystroke',
    cost: 35,
    description: 'Buttery, smooth, popping mid-frequency lubed switches with velvety soft return.',
    unlocked: false,
    previewIcon: '🧈'
  },
  {
    id: 'keystroke-clacky',
    name: 'Clacky Crisp Keyboard',
    category: 'keystroke',
    cost: 35,
    description: 'Sharp, snappy aluminum-plate mechanical bottom-out with high-pitch energetic rebound.',
    unlocked: false,
    previewIcon: '⚡'
  },
  {
    id: 'keystroke-clicky',
    name: 'Tactile Clicky Keyboard',
    category: 'keystroke',
    cost: 35,
    description: 'Crisp mechanical switch click leaf with spring return (Kailh Box White tactile response).',
    unlocked: false,
    previewIcon: '🕹️'
  },
  {
    id: 'keystroke-typewriter',
    name: 'Vintage Typewriter Keys',
    category: 'keystroke',
    cost: 0,
    description: 'Authentic mechanical typewriter clack, spacebar thump, and carriage return bell ding on Enter.',
    unlocked: true,
    previewIcon: '⌨️'
  },
  {
    id: 'keystroke-bubbles',
    name: 'Bubble Pops',
    category: 'keystroke',
    cost: 30,
    description: 'Playful rising water drops and gentle Bubble Pops on every keypress.',
    unlocked: false,
    previewIcon: '🫧'
  },
  {
    id: 'keystroke-thud',
    name: 'Felt Tapping',
    category: 'keystroke',
    cost: 25,
    description: 'Soft dampened low-frequency felt key presses for whisper-quiet late-night drafting.',
    unlocked: false,
    previewIcon: '🛋️'
  },
  {
    id: 'keystroke-duck',
    name: 'Ducky',
    category: 'keystroke',
    cost: 25,
    description: 'Playful bath squeak toy on every keystroke with a deep friendly QUACK on Space and Enter.',
    unlocked: false,
    previewIcon: '🦆'
  },
  {
    id: 'keystroke-droplet',
    name: 'Water Drops',
    category: 'keystroke',
    cost: 25,
    description: 'Pure harmonic water droplet plinks and ripples with soft organic pitch sweeps.',
    unlocked: false,
    previewIcon: '💧'
  },
  {
    id: 'soundscape-ocean',
    name: 'Ocean Waves & Foam',
    category: 'soundscape',
    cost: 25,
    description: 'Rhythmic ocean surf rolling onto a quiet shore with gentle ebb, crest, and sea foam breeze.',
    unlocked: false,
    previewIcon: '🌊'
  },

  // --- cursors ---
  {
    id: 'cursor-default',
    name: 'Standard Caret',
    category: 'cursor',
    cost: 0,
    description: 'Traditional clean editing cursor.',
    unlocked: true,
    previewIcon: 'I'
  },
  {
    id: 'cursor-quill',
    name: 'Golden Quill',
    category: 'cursor',
    cost: 0,
    description: 'Handcrafted golden feathered quill for writing with vintage flair.',
    unlocked: true,
    previewIcon: '✒️'
  },
  {
    id: 'cursor-wand',
    name: 'Starlight Wand',
    category: 'cursor',
    cost: 40,
    description: 'Luminous cursor with soft starlight sparkle trail.',
    unlocked: false,
    previewIcon: '🪄'
  },
  {
    id: 'cursor-golden_nib',
    name: 'Calligrapher’s Nib',
    category: 'cursor',
    cost: 35,
    description: 'A sharp, elegant fountain pen nib for crisp line precision.',
    unlocked: false,
    previewIcon: '🖋️'
  },

  // --- manuscript dividers ---
  {
    id: 'divider-constellations',
    name: 'Astral Constellations Divider',
    category: 'separator',
    cost: 30,
    description: 'Gilded star charts and delicate celestial geometry to divide your manuscript scenes.',
    unlocked: false,
    previewIcon: '🌌'
  },
  {
    id: 'divider-feather',
    name: 'Art Deco Feather Flourish',
    category: 'separator',
    cost: 25,
    description: 'Hand-crafted geometric art deco feather with sweeping filigree lines.',
    unlocked: false,
    previewIcon: '🪶'
  },
  {
    id: 'divider-waxseal',
    name: 'Imperial Wax Seal Stamp',
    category: 'separator',
    cost: 35,
    description: 'Embossed vermilion wax seal with intricate monogram for section headings.',
    unlocked: false,
    previewIcon: '💌'
  }
];
