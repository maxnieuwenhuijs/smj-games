// Elke gast is een poppetje met een naam en een paar weetjes. Die staan hier, in het Nederlands en het Engels
// (niet in nl.json/en.json: dat zijn de zinnen van de knoppen). `guestCard` kiest er bij een vast getal steeds
// dezelfde uit, zodat een gast zijn hele bezoek dezelfde naam en dezelfde weetjes houdt.

type Lang = 'nl' | 'en';
/** Voor wie een weetje is: iedereen, alleen kinderen of alleen grote mensen. */
export type FactWho = 'all' | 'kid' | 'adult';
export type GuestSex = 'm' | 'f';

const w = (s: string): string[] => s.split('|');
/** Elk stukje krijgt hetzelfde begin (en soms hetzelfde eind): 'Houdt van' + 'pannenkoeken'. */
const pre = (lead: string, s: string, tail = ''): string[] => s.split('|').map(x => `${lead} ${x}${tail}`);

// ------------------------------------------------------------ namen
// Niet de namen van de dieren (names.boys en names.girls in nl.json): anders heet een gast net als de giraf.
const NAMES: Record<Lang, Record<'kid' | 'adult', Record<GuestSex, string[]>>> = {
  nl: {
    kid: {
      m: w('Daan|Sem|Luuk|Finn|Levi|Noah|Jesse|Thijs|Lars|Stijn|Ruben|Mees|Jens|Cas|Olivier|Milan|Hidde|Joep|Gijs|Sven|Tom|Niek|Bas|Floris|Abel|Jurre|Koen|Rik|Adam|Amir'),
      f: w('Emma|Sophie|Julia|Anna|Lieke|Eva|Sara|Lotte|Fenna|Nina|Isa|Zoë|Yara|Maud|Sanne|Femke|Liv|Lynn|Jasmijn|Floor|Merel|Elin|Vera|Hanna|Nora|Iris|Fleur|Elif|Jet|Madelief'),
    },
    adult: {
      m: w('Henk|Jeroen|Pieter|Wim|Kees|Jan|Erik|Marco|Bart|Dennis|Rob|Hans|Frank|Peter|Johan|Martijn|Sander|Wouter|Karel|Gerard|Ruud|Arjen|Maarten|Joost|Paul|Mo|Ahmed|Willem'),
      f: w('Anja|Marieke|Ingrid|Els|Petra|Karin|Linda|Monique|Annemiek|Esther|Wilma|Joke|Ria|Sandra|Inge|Marloes|Hanneke|Bianca|Yvonne|Carla|Trudy|Nicole|Astrid|Miriam|Fatima|Greet|Tineke|Marjan'),
    },
  },
  en: {
    kid: {
      m: w('Oliver|Noah|Harry|George|Charlie|Alfie|Oscar|Archie|Henry|Theo|Freddie|Arthur|Logan|Ethan|Lucas|Mason|Jacob|Dylan|Toby|Luke|Adam|Riley|Owen|Eli|Zack|Jamie|Amir|Callum'),
      f: w('Olivia|Emma|Amelia|Isla|Ava|Mia|Ella|Grace|Lily|Sophie|Chloe|Ruby|Emily|Freya|Hannah|Zoe|Lucy|Molly|Maya|Erin|Ivy|Alice|Holly|Anna|Zara|Sara|Elif|Martha'),
    },
    adult: {
      m: w('David|John|Peter|Mark|Paul|Andrew|Steve|Simon|Richard|Tom|Chris|Martin|Kevin|Brian|Gary|Neil|Colin|Graham|Frank|Alan|Robert|Daniel|James|Michael|Omar|Raj|Mo|William'),
      f: w('Susan|Karen|Helen|Sarah|Claire|Julie|Linda|Rachel|Laura|Kate|Jane|Anne|Carol|Diane|Fiona|Gemma|Hazel|Irene|Joanne|Louise|Mary|Nina|Paula|Sally|Wendy|Priya|Amina|Fatima'),
    },
  },
};

// ------------------------------------------------------------ weetjes
/**
 * Een rijtje weetjes. `group`: waar het over gaat; een gast krijgt nooit twee weetjes uit dezelfde groep, dus
 * wat elkaar tegenspreekt ('Komt hier elke week' en 'Is hier voor het eerst') staat in dezelfde groep.
 */
interface Pool {
  group: string;
  who: FactWho;
  nl: string[];
  en: string[];
}

const POOLS: Pool[] = [
  // --- eten
  {
    group: 'food', who: 'all',
    nl: [
      ...pre('Houdt van', "pannenkoeken|poffertjes|patat met mayo|appelmoes|pindakaas|hagelslag|stroopwafels|drop|aardbeien|kersen|watermeloen|tomatensoep|spaghetti|pizza|kaas|tosti's|worteltjes|komkommer|bananen|druiven|oliebollen|pepernoten|vla|ijs met slagroom|popcorn|rijst|broccoli|mandarijnen|appeltaart|krentenbollen|soepstengels|doperwtjes|rozijnen|gekookte eieren|ontbijtkoek|yoghurt met honing|maïskolven|peren|frambozen|blauwe bessen|suikerspin|zoute stokjes|augurken|beschuit met muisjes|stamppot|kroketten|macaroni|nasi|erwtensoep|wentelteefjes|kaneelbroodjes"),
      ...pre('Lust geen', 'spruitjes|witlof|champignons|olijven|spinazie|bietjes|uien|paprika|andijvie|zuurkool'),
      ...w('Eet elke dag een appel|Eet het liefst met de handen|Likt altijd de lepel af|Eet eerst de korstjes op|Bewaart het lekkerste voor het laatst|Doopt koekjes in de thee|Eet patat met appelmoes|Heeft altijd trek in iets lekkers|Proeft graag nieuwe dingen|Eet boterhammen in kleine stukjes'),
    ],
    en: [
      ...pre('Loves', 'pancakes|waffles|chips with ketchup|apple sauce|peanut butter|toast with jam|biscuits|strawberries|cherries|watermelon|tomato soup|spaghetti|pizza|cheese|toasties|carrots|cucumber|bananas|grapes|doughnuts|gingerbread|custard|ice cream with sprinkles|popcorn|rice|broccoli|tangerines|apple pie|currant buns|breadsticks|peas|raisins|boiled eggs|porridge|yoghurt with honey|corn on the cob|pears|raspberries|blueberries|candyfloss|pretzels|pickles|crumpets|mashed potato|fish fingers|macaroni|fried rice|pea soup|jelly|scones|cinnamon buns'),
      ...pre('Does not like', 'sprouts|mushrooms|olives|spinach|beetroot|onions|peppers|cabbage|celery|turnips'),
      ...w('Eats an apple every day|Likes to eat with fingers|Always licks the spoon|Eats the crusts first|Saves the best bite for last|Dips biscuits in tea|Eats chips with apple sauce|Is always ready for a snack|Likes to try new food|Cuts sandwiches into tiny squares'),
    ],
  },
  // --- drinken
  {
    group: 'drink', who: 'all',
    nl: [...pre('Drinkt het liefst', 'appelsap|chocomel|limonade|sinaasappelsap|karnemelk|warme chocolademelk|ranja|melk|perensap|water met een rietje'), ...w('Blaast bellen met een rietje|Heeft altijd een flesje water mee|Drinkt alles met een rietje')],
    en: [...pre('Likes to drink', 'apple juice|chocolate milk|lemonade|orange juice|buttermilk|hot chocolate|squash|milk|pear juice|water through a straw'), ...w('Blows bubbles with a straw|Always carries a water bottle|Drinks everything through a straw')],
  },
  {
    group: 'drink', who: 'adult',
    nl: w('Drinkt graag koffie|Drinkt thee met honing|Drinkt koffie met veel melk|Neemt altijd een thermoskan mee|Drinkt elke ochtend muntthee|Zet de lekkerste thee'),
    en: w('Loves a cup of coffee|Drinks tea with honey|Drinks coffee with lots of milk|Always brings a flask|Drinks mint tea every morning|Makes the best cup of tea'),
  },
  // --- wat de gast graag doet
  {
    group: 'hobby', who: 'all',
    nl: w("Vliegert graag|Bouwt hutten|Tekent elke dag|Knutselt met karton|Bakt graag koekjes|Zwemt graag|Fietst graag door het bos|Danst graag in de kamer|Zingt onder de douche|Leest graag stripboeken|Puzzelt graag|Kleit graag|Timmert graag|Gaat graag vissen|Tuiniert graag|Kijkt graag naar vogels|Schaatst graag|Klimt graag in bomen|Maakt graag foto's|Speelt graag toneel|Goochelt graag|Kampeert graag|Wandelt graag in de duinen|Rolschaatst graag|Bakt elke zondag taart|Kookt graag soep|Zoekt graag kastanjes|Bouwt graag zandkastelen|Plukt graag bloemen|Vouwt papieren bootjes|Schrijft graag verhaaltjes|Bouwt torens van blokken|Rijgt graag kralen|Skatet graag|Doet aan judo|Zit op gymnastiek|Zit op voetbal|Zit op paardrijden|Zit op dansles|Zit op hockey|Zit bij de scouting|Kijkt graag naar de sterren|Roeit graag|Zeilt graag|Tennist graag|Maakt graag kaarten|Zoekt schelpen op het strand|Vouwt papieren vliegtuigjes|Maakt graag slingers|Zaait graag zonnebloemen"),
    en: w('Loves flying kites|Builds dens|Draws every day|Makes things from cardboard|Likes baking biscuits|Loves swimming|Likes cycling in the woods|Dances in the living room|Sings in the shower|Likes reading comics|Loves jigsaw puzzles|Likes modelling clay|Likes hammering and building|Likes going fishing|Loves gardening|Likes watching birds|Loves ice skating|Likes climbing trees|Likes taking photos|Likes putting on plays|Does magic tricks|Loves camping|Likes walks in the dunes|Loves roller skating|Bakes a cake every Sunday|Likes making soup|Likes looking for conkers|Builds sandcastles|Likes picking flowers|Folds paper boats|Likes writing little stories|Builds towers of blocks|Likes threading beads|Loves skateboarding|Does judo|Goes to gymnastics|Plays in a football team|Goes horse riding|Goes to dance class|Plays hockey|Is in the Scouts|Likes looking at the stars|Likes rowing|Likes sailing|Likes playing tennis|Likes making cards|Looks for shells on the beach|Folds paper planes|Likes making paper chains|Likes growing sunflowers'),
  },
  {
    group: 'hobby', who: 'kid',
    nl: w('Verft graag met vingerverf|Zit op zwemles|Speelt graag in de zandbak|Stept graag|Springt graag touwtje|Bouwt tenten van dekens|Kleurt graag kleurplaten|Plakt graag stickers|Zit op kleutergym|Graaft graag kuilen'),
    en: w('Loves finger painting|Goes to swimming lessons|Likes playing in the sandpit|Loves riding a scooter|Loves skipping|Builds tents from blankets|Likes colouring in|Likes sticking stickers|Goes to toddler gym|Likes digging holes'),
  },
  {
    group: 'hobby', who: 'adult',
    nl: w('Breit sjaals|Gaat graag naar de markt|Maakt graag lange wandelingen|Schildert landschappen|Haakt knuffels|Bakt zelf brood|Zingt in de auto|Knapt oude meubels op|Maakt zelf jam|Fotografeert vogels'),
    en: w('Knits scarves|Likes going to the market|Likes long walks|Paints landscapes|Crochets soft toys|Bakes bread at home|Sings in the car|Fixes up old furniture|Makes jam at home|Takes photos of birds'),
  },
  // --- verzamelen
  {
    group: 'collect', who: 'all',
    nl: pre('Verzamelt', 'schelpen|stenen|stickers|knikkers|veren|kastanjes|postzegels|sleutelhangers|dennenappels|ansichtkaarten|flessendoppen|boekenleggers|glimmende knopen|mooie takken|eikels|treinkaartjes|voetbalplaatjes|magneten|gedroogde bloemen|speldjes|dierenplaatjes|mooie blaadjes|gladde kiezels'),
    en: pre('Collects', 'shells|stones|stickers|marbles|feathers|conkers|stamps|key rings|pine cones|postcards|bottle tops|bookmarks|shiny buttons|pretty sticks|acorns|train tickets|football cards|magnets|dried flowers|badges|animal cards|pretty leaves|smooth pebbles'),
  },
  { group: 'collect', who: 'kid', nl: pre('Verzamelt', "gummetjes|autootjes|plastic dino's|knuffels|strikjes"), en: pre('Collects', 'rubbers|toy cars|plastic dinosaurs|soft toys|ribbons') },
  { group: 'collect', who: 'adult', nl: pre('Verzamelt', 'mokken|theelepeltjes|oude boeken|plantjes|klokken'), en: pre('Collects', 'mugs|teaspoons|old books|house plants|clocks') },
  // --- wat een kind later wil worden
  {
    group: 'dream', who: 'kid',
    nl: [
      ...pre('Wil later', 'piloot|dierenverzorger|dierenarts|astronaut|bakker|kapitein|treinmachinist|boer|kok|uitvinder|schilder|ontdekkingsreiziger|duiker|goochelaar|boswachter|buschauffeur|postbode|circusclown|schrijver|fotograaf|voetballer|badmeester|imker|coureur|kraanmachinist|dierentuindirecteur', ' worden'),
      ...w("Wil later bij de brandweer|Wil later dino's opgraven|Wil later op de maan lopen|Wil later een eigen boerderij|Wil later in een boomhut wonen|Wil later de hele wereld zien|Wil later een paard hebben|Wil later ijsjes verkopen|Wil later huizen bouwen|Wil later op een podium zingen|Wil later op de vuilniswagen|Wil later een raket bouwen|Wil later boeken maken|Wil later met dolfijnen zwemmen|Wil later een eigen bakkerij|Wil later bij de politie|Wil later op een schip varen|Wil later een taartenwinkel"),
    ],
    en: [
      ...pre('Wants to be', "a pilot|a zookeeper|a vet|an astronaut|a baker|a ship's captain|a train driver|a farmer|a chef|an inventor|a painter|an explorer|a diver|a magician|a forest ranger|a bus driver|a postie|a circus clown|a writer|a photographer|a footballer|a lifeguard|a beekeeper|a racing driver|a crane driver|a zoo director"),
      ...w('Wants to be a firefighter|Wants to dig up dinosaurs|Wants to walk on the moon|Wants a farm one day|Wants to live in a treehouse|Wants to see the whole world|Wants a horse one day|Wants to sell ice cream|Wants to build houses|Wants to sing on a stage|Wants to ride the bin lorry|Wants to build a rocket|Wants to make books|Wants to swim with dolphins|Wants a bakery one day|Wants to be a police officer|Wants to sail on a ship|Wants a cake shop one day'),
    ],
  },
  // --- het werk van een groot mens
  {
    group: 'job', who: 'adult',
    nl: w('Werkt op een school|Werkt in een bakkerij|Is buschauffeur|Werkt bij de brandweer|Werkt in een bibliotheek|Is postbode|Werkt in een bloemenwinkel|Werkt op een boerderij|Werkt op een kinderboerderij|Is kok in een restaurant|Bestuurt een grote kraan|Rijdt op een vrachtwagen|Werkt bij de politie|Repareert fietsen|Bouwt huizen|Is schilder|Is treinmachinist|Is dierenarts|Is tuinier|Werkt in een speelgoedwinkel|Bakt taarten|Is piloot|Werkt op een boot|Is kapper|Schrijft kinderboeken|Is fotograaf|Werkt in het zwembad|Is boswachter|Is imker|Maakt meubels|Werkt in een museum|Werkt in een bioscoop|Is muzikant|Werkt in een ijssalon|Past vaak op de buurkinderen|Verkoopt kaas op de markt|Werkt in een boekwinkel|Vaart op de veerboot|Maakt speelgoed|Tekent prentenboeken'),
    en: w("Works at a school|Works in a bakery|Drives a bus|Is a firefighter|Works in a library|Delivers the post|Works in a flower shop|Works on a farm|Works at a petting farm|Is a chef in a restaurant|Drives a big crane|Drives a lorry|Is a police officer|Fixes bicycles|Builds houses|Is a painter|Drives a train|Is a vet|Is a gardener|Works in a toy shop|Bakes cakes|Is a pilot|Works on a boat|Is a hairdresser|Writes children's books|Is a photographer|Works at the swimming pool|Is a forest ranger|Is a beekeeper|Makes furniture|Works in a museum|Works at the cinema|Is a musician|Works in an ice cream shop|Often babysits for the neighbours|Sells cheese at the market|Works in a bookshop|Works on a ferry|Makes toys|Draws picture books"),
  },
  // --- wat de gast kan
  {
    group: 'can', who: 'all',
    nl: w('Kan heel hard fluiten|Kan op één been staan|Kan met de oren wiebelen|Kan de tong oprollen|Kan jongleren met drie ballen|Kan een radslag maken|Kan op de handen staan|Kan heel goed hinkelen|Kan een koprol maken|Kan alle vogels nadoen|Kan brullen als een leeuw|Kan kwaken als een kikker|Kan heel lang de adem inhouden|Kan op de vingers fluiten|Kan tot tien tellen in het Engels|Kan heel goed verstoppen|Kan heel snel rennen|Kan de spagaat|Kan heel goed onthouden|Kan een mooie strik maken|Kan een tent opzetten|Kan steentjes laten ketsen|Kan een liedje achterstevoren zingen|Kan heel goed kietelen|Kan de hik wegtoveren|Kan heel hard klappen|Kan met elk oog knipogen|Kan een ei bakken|Kan heel zacht sluipen|Kan lopen als een pinguïn|Kan springen als een kangoeroe|Kan trompetteren als een olifant|Kan apengeluiden maken|Kan heel ver gooien|Kan een bal hooghouden|Kan heel hoog springen|Kan dieren tekenen uit het hoofd|Kan in drie talen gedag zeggen|Kan heel goed kaartlezen|Kan een hoepel laten draaien'),
    en: w('Can whistle very loudly|Can stand on one leg|Can wiggle both ears|Can roll the tongue|Can juggle three balls|Can do a cartwheel|Can do a handstand|Is very good at hopping|Can do a forward roll|Can copy every bird|Can roar like a lion|Can croak like a frog|Can hold a breath for ages|Can whistle through two fingers|Can count to ten in Dutch|Is very good at hiding|Can run very fast|Can do the splits|Has a very good memory|Can tie a perfect bow|Can put up a tent|Can skim stones|Can sing a song backwards|Is very good at tickling|Can magic hiccups away|Can clap very loudly|Can wink with either eye|Can fry an egg|Can tiptoe without a sound|Can waddle like a penguin|Can jump like a kangaroo|Can trumpet like an elephant|Can make monkey noises|Can throw very far|Can keep a ball in the air|Can jump very high|Can draw animals from memory|Can say hello in three languages|Is very good at reading maps|Can spin a hula hoop'),
  },
  {
    group: 'can', who: 'kid',
    nl: w('Kan zelf de veters strikken|Kan al fietsen zonder zijwieltjes|Kan al de eigen naam schrijven|Kan al tot honderd tellen|Kan al klokkijken|Kan al zwemmen|Kan al zelf de jas dichtdoen|Kan het alfabet zingen|Kan al tot twintig tellen|Kan heel hoog schommelen'),
    en: w('Can tie shoelaces alone|Can ride a bike without stabilisers|Can already write a whole name|Can already count to a hundred|Can already tell the time|Can already swim|Can already zip up a coat|Can sing the alphabet|Can already count to twenty|Can swing very high'),
  },
  {
    group: 'can', who: 'adult',
    nl: w('Kan heel goed pannenkoeken bakken|Kan elke band plakken|Kan heel mooi voorlezen|Kan alles repareren|Kan de lekkerste soep maken|Kan heel goed verhalen vertellen|Kan een vlieger bouwen|Kan elke knoop leggen'),
    en: w('Makes very good pancakes|Can mend any puncture|Reads stories aloud beautifully|Can fix anything|Makes the tastiest soup|Is very good at telling stories|Can build a kite|Can tie every knot'),
  },
  // --- waar de gast dol op is
  {
    group: 'like', who: 'all',
    nl: [
      ...pre('Is dol op', "treinen|bellenblaas|ballonnen|luchtballonnen|vuurtorens|glitters|tractors|brandweerauto's|hijskranen|bootjes|bruggen|molens|kastelen|eenhoorns|dino's|sprookjes|vlinders|lieveheersbeestjes|paddenstoelen|kaarsjes|feestjes|slingers|verjaardagen|kampvuur|de zee|het bos|de kermis|draaimolens|poppenkast|vuurvliegjes|raketten|vliegtuigen|robots|stoomtreinen|watervallen|zonnebloemen"),
      ...w('Vindt tunnels spannend|Vindt hoge torens prachtig|Zwaait naar elke trein|Pakt graag cadeautjes in|Kijkt graag naar de maan'),
    ],
    en: [
      ...pre('Is mad about', 'trains|bubbles|balloons|hot-air balloons|lighthouses|glitter|tractors|fire engines|cranes|little boats|bridges|windmills|castles|unicorns|dinosaurs|fairy tales|butterflies|ladybirds|toadstools|candles|parties|bunting|birthdays|campfires|the sea|the woods|the funfair|merry-go-rounds|puppet shows|fireflies|rockets|aeroplanes|robots|steam trains|waterfalls|sunflowers'),
      ...w('Thinks tunnels are exciting|Thinks tall towers are wonderful|Waves at every train|Likes wrapping presents|Likes looking at the moon'),
    ],
  },
  { group: 'like', who: 'kid', nl: pre('Is dol op', 'glijbanen|schommels|ridders|piraten|draken|klimrekken|trampolines|springkussens|tekenfilms'), en: pre('Is mad about', 'slides|swings|knights|pirates|dragons|climbing frames|trampolines|bouncy castles|cartoons') },
  { group: 'like', who: 'adult', nl: pre('Is dol op', "oude auto's|rommelmarkten|bloemen in huis|zondagochtenden|lange treinreizen|oude liedjes|tuincentra"), en: pre('Is mad about', 'old cars|jumble sales|flowers in the house|Sunday mornings|long train rides|old songs|garden centres') },
  // --- grappige kleine dingen
  {
    group: 'funny', who: 'all',
    nl: w("Heeft twee verschillende sokken aan|Telt alle eenden|Praat tegen de vogels|Zwaait naar alle dieren|Geeft elk dier een naam|Huppelt als niemand kijkt|Zingt de hele dag liedjes|Neuriet tijdens het lopen|Moet altijd lachen om apen|Stapt nooit op de lijntjes|Springt van elke stoeprand|Heeft zand in de schoenen|Heeft een mooie steen in de zak|Draagt een geluksknoop|Zegt gedag tegen elke boom|Loopt graag achteruit|Telt alle treden|Kijkt onder elke steen|Ruikt aan alle bloemen|Verzint grapjes over giraffen|Doet alle dieren na|Heeft een tekening in de tas|Heeft kruimels in de jaszak|Raakt altijd één want kwijt|Praat soms met een grappige stem|Maakt van alles een liedje|Fluit als niemand luistert|Lacht met een knorretje|Niest altijd drie keer|Krijgt de slappe lach van pinguïns|Kent een mop over een olifant|Loopt het liefst op blote voeten|Heeft een geheim hutje|Draagt altijd sokken met dieren|Telt alle rode auto's|Zoekt overal klavertjes vier|Redt slakken van het pad|Wenst iets bij elke paardenbloem|Spaart de mooiste herfstbladeren|Kijkt altijd omhoog naar vliegtuigen"),
    en: w('Is wearing two different socks|Counts all the ducks|Talks to the birds|Waves at every animal|Gives every animal a name|Skips when nobody is looking|Sings little songs all day|Hums while walking|Always giggles at monkeys|Never steps on the lines|Jumps off every kerb|Has sand in both shoes|Has a pretty stone in a pocket|Carries a lucky button|Says hello to every tree|Likes walking backwards|Counts every step on the stairs|Looks under every stone|Sniffs all the flowers|Makes up jokes about giraffes|Copies all the animals|Has a drawing in the bag|Has crumbs in a coat pocket|Always loses one mitten|Sometimes talks in a funny voice|Turns everything into a song|Whistles when nobody is listening|Laughs with a little snort|Always sneezes three times|Gets the giggles from penguins|Knows a joke about an elephant|Likes going barefoot best|Has a secret den|Always wears socks with animals|Counts all the red cars|Looks for four-leaf clovers|Rescues snails from the path|Makes a wish on every dandelion|Saves the prettiest autumn leaves|Always looks up at aeroplanes'),
  },
  {
    group: 'funny', who: 'kid',
    nl: w('Heeft een knuffel mee|Heeft een schatkaart getekend|Zoekt overal naar schatten|Denkt dat de maan meeloopt|Gelooft in kabouters|Heeft een onzichtbaar vriendje|Verstopt zich achter elke boom|Vraagt bij alles waarom|Wil overal bovenop klimmen|Noemt elke hond woef'),
    en: w('Has brought a cuddly toy|Has drawn a treasure map|Looks for treasure everywhere|Thinks the moon follows along|Believes in gnomes|Has an invisible friend|Hides behind every tree|Asks why about everything|Wants to climb on everything|Calls every dog woof-woof'),
  },
  {
    group: 'funny', who: 'adult',
    nl: w('Raakt altijd de zonnebril kwijt|Zoekt elke dag de sleutels|Maakt flauwe grapjes|Vertelt graag sterke verhalen|Praat tegen de planten|Zingt altijd een beetje vals|Vergeet waar de fiets staat|Neemt altijd te veel boterhammen mee'),
    en: w('Always loses the sunglasses|Looks for the keys every day|Tells very silly jokes|Loves telling tall tales|Talks to the house plants|Always sings a bit out of tune|Forgets where the bike is parked|Always packs too many sandwiches'),
  },
  // --- vandaag
  {
    group: 'today', who: 'all',
    nl: w('Is vandaag jarig|Is hier voor het eerst|Komt hier elke week|Komt hier elk jaar|Kent dit park uit het hoofd|Heeft vandaag vrij|Is op vakantie|Heeft een picknick mee|Heeft een verrekijker mee|Heeft een fototoestel mee|Heeft een tekenblok mee|Heeft een kaartje gewonnen|Kreeg dit uitje cadeau|Is vroeg opgestaan voor vandaag|Keek hier al weken naar uit|Is hier met de buren|Is hier met het hele gezin|Wil het liefst heel lang blijven|Wil vandaag alles zien|Heeft zonnebrand op|Heeft een appel in de tas|Is net hier komen wonen|Heeft nieuwe schoenen aan|Heeft een plattegrond getekend|Heeft een lijstje met dieren mee|Viert vandaag iets leuks'),
    en: w('Has a birthday today|Is here for the first time|Comes here every week|Comes here every year|Knows this park by heart|Has a day off today|Is on holiday|Has brought a picnic|Has brought binoculars|Has brought a camera|Has brought a sketch pad|Won a ticket for today|Got this day out as a present|Got up early for today|Has looked forward to this for weeks|Is here with the neighbours|Is here with the whole family|Would love to stay very long|Wants to see everything today|Is wearing sun cream|Has an apple in the bag|Has just moved to this town|Is wearing new shoes|Has drawn a map of the park|Has brought a list of animals|Is celebrating something nice today'),
  },
  {
    group: 'today', who: 'kid',
    nl: w('Komt met opa en oma|Mocht vandaag zelf kiezen|Viert vandaag het zwemdiploma|Viert een mooi rapport|Is hier met een vriendje|Heeft een logeetje mee|Heeft een wiebeltand|Kon bijna niet slapen van de zin|Mag vandaag laat naar bed'),
    en: w("Came with grandma and grandad|Got to choose today's trip|Is celebrating a swimming badge|Is celebrating a good school report|Is here with a friend|Has a friend sleeping over|Has a wobbly tooth|Was too excited to sleep|May stay up late tonight"),
  },
  {
    group: 'today', who: 'adult',
    nl: w('Is hier met de kleinkinderen|Kwam hier als kind al|Trakteert vandaag op ijs|Heeft een dagje vrij genomen|Past vandaag op de kinderen'),
    en: w('Is here with the grandchildren|Came here as a child too|Is treating everyone to ice cream|Took a day off for this|Is looking after the children today'),
  },
  // --- lievelingskleur
  {
    group: 'colour', who: 'all',
    nl: pre('Lievelingskleur:', 'rood|blauw|geel|groen|oranje|paars|roze|turquoise|goud|zilver|lichtblauw|donkergroen|alle kleuren tegelijk'),
    en: pre('Favourite colour:', 'red|blue|yellow|green|orange|purple|pink|turquoise|gold|silver|sky blue|dark green|all of them at once'),
  },
  // --- seizoen en weer
  {
    group: 'weather', who: 'all',
    nl: [...pre('Lievelingsseizoen:', 'de lente|de zomer|de herfst|de winter'), ...w('Vindt regen leuk|Is dol op sneeuw|Houdt van zonnige dagen|Vindt mist geheimzinnig|Houdt van harde wind|Stampt graag in plassen|Zoekt altijd naar regenbogen|Kijkt graag naar de wolken|Ziet dieren in de wolken|Vangt sneeuwvlokken met de tong|Bouwt elke winter een sneeuwpop|Vindt herfstbladeren prachtig|Loopt graag door de regen|Ruikt graag het gras na regen|Wacht elk jaar op sneeuw|Houdt van lange zomeravonden|Vindt ijsbloemen op het raam mooi|Houdt van de eerste lentedag|Luistert graag naar de regen|Vindt de zon het allerfijnst')],
    en: [...pre('Favourite season:', 'spring|summer|autumn|winter'), ...w('Thinks rain is fun|Is mad about snow|Loves sunny days|Thinks fog is mysterious|Loves a strong wind|Loves stamping in puddles|Always looks for rainbows|Likes watching the clouds|Sees animals in the clouds|Catches snowflakes on the tongue|Builds a snowman every winter|Thinks autumn leaves are beautiful|Likes walking in the rain|Loves the smell of rain on grass|Waits for snow every year|Loves long summer evenings|Loves frost patterns on the window|Loves the first day of spring|Likes listening to the rain|Likes the sun best of all')],
  },
  // --- spelletjes
  {
    group: 'game', who: 'all',
    nl: [...pre('Speelt graag', 'verstoppertje|tikkertje|memory|ganzenbord|domino|kwartet|mens-erger-je-niet|ik zie, ik zie|boter-kaas-en-eieren|badminton|tafeltennis|trefbal|bordspellen|met de bal|in het water'), ...w('Knikkert graag|Damt graag|Schaakt graag|Tekent graag met stoepkrijt|Is heel goed in memory|Bouwt graag knikkerbanen|Doet graag raadsels|Verzint graag eigen spelletjes|Speelt graag woordspelletjes')],
    en: [...pre('Likes playing', 'hide and seek|tag|pairs|snakes and ladders|dominoes|happy families|ludo|I spy|noughts and crosses|badminton|table tennis|dodgeball|board games|ball games|in the water|marbles|draughts|chess'), ...w('Likes drawing with pavement chalk|Is very good at pairs|Builds marble runs|Likes solving riddles|Makes up new games|Likes word games')],
  },
  {
    group: 'game', who: 'kid',
    nl: pre('Speelt graag', "winkeltje|schooltje|restaurantje|dierentuintje|piraatje|stoelendans|blindemannetje|zakdoekje leggen|met de poppen|met auto's|de vloer is lava|vadertje en moedertje|ridder en draak|treintje"),
    en: pre('Likes playing', "shops|schools|restaurants|zoos|pirates|musical chairs|blind man's buff|duck, duck, goose|with dolls|with toy cars|the floor is lava|mums and dads|knights and dragons|trains"),
  },
  {
    group: 'game', who: 'adult',
    nl: w('Speelt graag jeu de boules|Kaart graag|Legt graag grote puzzels|Maakt graag kruiswoordpuzzels|Sjoelt graag'),
    en: w('Likes playing boules|Likes playing cards|Likes doing big jigsaws|Likes doing crosswords|Likes a game of skittles'),
  },
  // --- muziek
  {
    group: 'music', who: 'all',
    nl: [...pre('Speelt', 'blokfluit|gitaar|piano|trommel|viool|mondharmonica|trompet|ukelele|accordeon|xylofoon|triangel'), ...w('Wil leren drummen|Zingt in een koor|Lievelingsinstrument: de tuba|Lievelingsinstrument: de harp|Lievelingsinstrument: de saxofoon|Fluit elk liedje mee|Kent heel veel liedjes|Danst op elk muziekje|Zingt het hardst van iedereen|Maakt muziek met lepels|Klapt altijd mee in de maat|Wil leren pianospelen')],
    en: [...pre('Plays the', 'recorder|guitar|piano|drum|violin|mouth organ|trumpet|ukulele|accordion|xylophone|triangle'), ...w('Wants to learn the drums|Sings in a choir|Favourite instrument: the tuba|Favourite instrument: the harp|Favourite instrument: the saxophone|Whistles along to every song|Knows lots and lots of songs|Dances to every tune|Sings louder than anyone|Makes music with spoons|Always claps along in time|Wants to learn the piano')],
  },
  { group: 'music', who: 'kid', nl: w('Trommelt op alle pannen|Zingt elke dag het dierenlied|Heeft een eigen trommeltje'), en: w('Drums on all the pans|Sings the animal song every day|Has a little drum at home') },
  { group: 'music', who: 'adult', nl: w('Speelt in een fanfare|Speelt in een bandje|Draait graag oude platen'), en: w('Plays in a brass band|Plays in a band|Likes playing old records') },
  // --- huisdieren
  {
    group: 'pet', who: 'all',
    nl: [...pre('Heeft thuis', 'een cavia|een konijn|een hamster|een goudvis|een kat|een hond|een parkiet|een schildpad|twee kippen|een wandelende tak|een kanarie|drie katten|een aquarium|twee konijnen|een oude lieve hond'), ...w('Heeft een hond die Bobbie heet|Heeft een kat die Snorrie heet|Heeft een konijn dat Flappie heet|Heeft een poes met witte sokjes|Laat elke dag de hond uit|Wil heel graag een puppy|Wil heel graag een poes|Past soms op de buurkat|Voert thuis elke dag de vissen|Heeft een pony in de wei|Heeft een hond die kan zwaaien|Heeft een kat die altijd slaapt|Heeft een cavia die Wiebel heet|Heeft een hamster die Nootje heet|Wil heel graag een konijn|Heeft een vis die Blub heet|Heeft een hond met flaporen|Borstelt elke dag de kat')],
    en: [...pre('Has', 'a guinea pig at home|a rabbit at home|a hamster at home|a goldfish at home|a cat at home|a dog at home|a budgie at home|a tortoise at home|two hens at home|a stick insect at home|a canary at home|three cats at home|a fish tank at home|two rabbits at home|a sweet old dog at home'), ...w("Has a dog called Biscuit|Has a cat called Whiskers|Has a rabbit called Hoppy|Has a cat with white socks|Walks the dog every day|Would love a puppy|Would love a kitten|Sometimes minds next door's cat|Feeds the fish every day|Has a pony in a field|Has a dog that can wave|Has a cat that always sleeps|Has a guinea pig called Wobble|Has a hamster called Peanut|Would love a rabbit|Has a fish called Bubbles|Has a dog with floppy ears|Brushes the cat every day")],
  },
  // --- over de dierentuin
  {
    group: 'zoo', who: 'all',
    nl: w('Wil alle dieren zien|Maakt van elk dier een foto|Wil het liefst de dieren voeren|Wil weten wat elk dier eet|Leest alle bordjes|Zoekt het kleinste dier|Zoekt het grootste dier|Wil graag een dier aaien|Tekent thuis alle dieren na|Vindt brullen een beetje spannend|Wil zien hoe dieren slapen|Vraagt alles aan de verzorgers|Zou hier best willen werken|Vindt babydieren het allerliefst|Kijkt overal heel lang|Wil niets missen|Houdt van dieren met strepen|Houdt van dieren met stippen|Houdt van dieren met veren|Houdt van dieren met een lange nek|Houdt van dieren die zwemmen|Houdt van hele grote dieren|Houdt van hele kleine dieren|Houdt van zachte dieren|Houdt van dieren die klimmen|Wil weten hoe elk dier heet|Wil een dier horen brullen|Wil een dier zien eten|Hoopt op een dier met jongen|Kijkt het liefst bij het water|Fluistert bij slapende dieren|Schrijft dierennamen in een boekje|Heeft een dierenboek mee|Heeft thuis een dierenposter|Kijkt thuis alle dierenfilms|Vindt de dierentuin de mooiste plek|Wil hier wel elke dag komen|Wijst elk dier aan|Roept bij elk dier: kijk!|Bedankt de verzorgers altijd|Gooit afval altijd in de bak|Is heel stil bij de dieren|Zoekt het snelste dier|Zoekt de langste staart|Wil weten waar elk dier woont|Houdt van dieren met grote oren|Houdt van dieren met een snavel|Onthoudt de naam van elk dier|Zoekt een dier dat lacht'),
    en: w("Wants to see every animal|Takes a photo of every animal|Would love to feed the animals|Wants to know what each animal eats|Reads all the signs|Is looking for the smallest animal|Is looking for the biggest animal|Would love to stroke an animal|Draws all the animals at home|Thinks roaring is a bit exciting|Wants to see how animals sleep|Asks the keepers everything|Would quite like to work here|Loves baby animals most of all|Looks at everything for ages|Does not want to miss a thing|Loves animals with stripes|Loves animals with spots|Loves animals with feathers|Loves animals with long necks|Loves animals that swim|Loves very big animals|Loves very small animals|Loves soft animals|Loves animals that climb|Wants to know every animal's name|Wants to hear an animal roar|Wants to watch an animal eat|Hopes to see an animal with babies|Likes watching by the water best|Whispers near sleeping animals|Writes animal names in a notebook|Has brought an animal book|Has an animal poster at home|Watches every animal film at home|Thinks the zoo is the best place|Would like to come here every day|Points at every animal|Shouts look! at every animal|Always thanks the keepers|Always puts litter in the bin|Is very quiet near the animals|Is looking for the fastest animal|Is looking for the longest tail|Wants to know where each animal lives|Loves animals with big ears|Loves animals with beaks|Remembers every animal's name|Is looking for an animal that smiles"),
  },
  {
    group: 'zoo', who: 'kid',
    nl: w('Wil de dieren welterusten zeggen|Wil een knuffel van elk dier|Zwaait naar de verzorgers|Wil alle dierengeluiden leren|Speelt thuis dierentuin met knuffels'),
    en: w('Wants to say goodnight to the animals|Wants a cuddly toy of every animal|Waves at the keepers|Wants to learn every animal sound|Plays zoo at home with cuddly toys'),
  },
  {
    group: 'zoo', who: 'adult',
    nl: w('Vertelt bij elk dier een weetje|Kijkt het liefst vanaf een bankje|Leest alle bordjes hardop voor'),
    en: w('Tells a fun fact at every animal|Likes watching from a bench|Reads all the signs out loud'),
  },
  // --- hoe de gast hier kwam
  {
    group: 'travel', who: 'all',
    nl: w('Kwam met de trein|Kwam met de fiets|Kwam met de bus|Kwam lopend|Kwam met de auto|Kwam met de tram|Kwam met de boot|Kwam helemaal van ver|Woont hier vlakbij|Zat een uur in de trein|Zong de hele weg liedjes|Telde onderweg alle koeien|Zag onderweg een regenboog|Zag onderweg een ooievaar|Reed vandaag door een tunnel|Kwam over een hele hoge brug|Moest onderweg twee keer overstappen|Had onderweg de wind mee|Zag onderweg drie molens|Zwaaide onderweg naar een boot'),
    en: w('Came by train|Came by bike|Came by bus|Came on foot|Came by car|Came by tram|Came by boat|Came from very far away|Lives just around the corner|Sat on the train for an hour|Sang songs all the way here|Counted all the cows on the way|Saw a rainbow on the way|Saw a stork on the way|Went through a tunnel today|Crossed a very high bridge|Had to change trains twice|Had the wind behind all the way|Saw three windmills on the way|Waved at a boat on the way'),
  },
  {
    group: 'travel', who: 'kid',
    nl: w('Kwam achterop de fiets|Kwam in de bakfiets|Sliep de hele weg hierheen|Kwam op de step|Vroeg steeds: zijn we er al?'),
    en: w('Came on the back of a bike|Came in a cargo bike|Slept all the way here|Came on a scooter|Kept asking: are we there yet?'),
  },
  {
    group: 'travel', who: 'adult',
    nl: w('Rijdt op een bakfiets|Fietst overal naartoe|Kwam met de elektrische fiets|Wist de weg uit het hoofd'),
    en: w('Rides a cargo bike|Cycles everywhere|Came on an electric bike|Knew the way by heart'),
  },
  // --- thuis
  {
    group: 'home', who: 'all',
    nl: w('Heeft een grote broer|Heeft een kleine zus|Heeft een tweelingbroer|Is de oudste thuis|Is de jongste thuis|Heeft drie zussen|Woont op een boerderij|Woont naast een molen|Woont aan het water|Woont in een dorp|Woont in de stad|Woont bij het bos|Heeft een boomhut in de tuin|Heeft een moestuin|Heeft een schommel in de tuin|Heeft een rode voordeur|Heeft een appelboom in de tuin|Heeft een heel lieve oma|Heeft een tuin vol bloemen|Heeft zonnebloemen voor het raam|Woont in een straat vol kinderen|Heeft een trampoline in de tuin|Woont in een huis met een torentje|Heeft familie ver weg|Heeft een vijver met kikkers|Heeft een vogelhuisje in de tuin|Heeft een egel in de tuin|Woont boven een bakkerij|Heeft de liefste buren|Woont vlak bij zee'),
    en: w('Has a big brother|Has a little sister|Has a twin brother|Is the oldest at home|Is the youngest at home|Has three sisters|Lives on a farm|Lives next to a windmill|Lives by the water|Lives in a village|Lives in the city|Lives near the woods|Has a treehouse in the garden|Has a vegetable patch|Has a swing in the garden|Has a red front door|Has an apple tree in the garden|Has a very sweet grandma|Has a garden full of flowers|Has sunflowers by the window|Lives in a street full of children|Has a trampoline in the garden|Lives in a house with a turret|Has family far away|Has a pond with frogs|Has a bird house in the garden|Has a hedgehog in the garden|Lives above a bakery|Has the nicest neighbours|Lives close to the sea'),
  },
  { group: 'home', who: 'kid', nl: w('Heeft een stapelbed|Slaapt op zolder|Logeert vaak bij opa en oma|Heeft een babyzusje|Heeft een eigen tuintje'), en: w('Has a bunk bed|Sleeps in the attic|Often stays with grandma and grandad|Has a baby sister|Has a little garden patch') },
  { group: 'home', who: 'adult', nl: w('Heeft vier kleinkinderen|Heeft een tuinhuisje|Heeft een huis vol boeken|Heeft een bankje voor het huis'), en: w('Has four grandchildren|Has a garden shed|Has a house full of books|Has a bench by the front door') },
  // --- slapen en opstaan
  {
    group: 'sleep', who: 'all',
    nl: w("Staat altijd vroeg op|Slaapt graag uit|Leest voor het slapen|Droomt vaak over vliegen|Droomt over dieren|Droomde vannacht over een giraf|Is een echte ochtendmens|Is 's avonds het vrolijkst|Geeuwt heel hard|Doet graag een middagdutje|Slaapt met de sokken aan|Wordt wakker van de vogels|Springt 's ochtends uit bed|Heeft een dekbed met dieren|Slaapt het liefst in een tent|Wordt altijd vrolijk wakker|Slaapt als een roosje|Droomt over verre reizen|Is altijd als eerste wakker"),
    en: w('Always gets up early|Loves a lie-in|Reads before going to sleep|Often dreams about flying|Dreams about animals|Dreamt about a giraffe last night|Is a real morning person|Is happiest in the evening|Yawns very loudly|Likes an afternoon nap|Sleeps with socks on|Wakes up when the birds sing|Jumps out of bed in the morning|Has a duvet with animals on|Likes sleeping in a tent best|Always wakes up cheerful|Sleeps like a log|Dreams about faraway trips|Is always the first one awake'),
  },
  {
    group: 'sleep', who: 'kid',
    nl: w('Slaapt met een nachtlampje|Slaapt met drie knuffels|Wil elke avond een verhaaltje|Heeft sterren op het plafond|Leest stiekem onder de dekens|Mag in het weekend opblijven'),
    en: w('Sleeps with a night light|Sleeps with three cuddly toys|Wants a story every night|Has stars on the ceiling|Secretly reads under the covers|May stay up at weekends'),
  },
  { group: 'sleep', who: 'adult', nl: w('Leest elke avond een verhaaltje voor|Zet elke avond de wekker|Doet op zondag een dutje'), en: w('Reads a bedtime story every night|Sets the alarm every evening|Has a nap on Sundays') },
  // --- school
  {
    group: 'school', who: 'kid',
    nl: [...w('Zit in groep 2|Zit in groep 4|Zit in groep 6|Gaat bijna naar groep 3|Leert net lezen|Leert net schrijven|Kent alle letters al|Houdt een spreekbeurt over dieren|Is deze week klassenhulpje|Heeft de liefste juf|Fietst zelf naar school|Loopt elke dag naar school|Heeft een beste vriend op school|Mag na school buiten spelen|Schrijft al aan elkaar|Kreeg een sticker van de juf|Leest al dikke boeken|Maakt graag sommen|Heeft morgen gymles|Zit bij de kleuters|Geeft in de klas de planten water|Neemt fruit mee naar school'), ...pre('Lievelingsvak:', 'gym|tekenen|rekenen|muziek|buitenspelen|voorlezen|knutselen|natuur')],
    en: [...w('Is in Reception|Is in Year 2|Is in Year 4|Starts big school soon|Is just learning to read|Is just learning to write|Already knows all the letters|Is giving a talk about animals|Is class helper this week|Has the nicest teacher|Cycles to school alone|Walks to school every day|Has a best friend at school|May play outside after school|Can already do joined-up writing|Got a sticker from the teacher|Already reads thick books|Likes doing sums|Has PE tomorrow|Is in nursery class|Waters the plants in class|Takes fruit to school'), ...pre('Favourite lesson:', 'PE|drawing|maths|music|playtime|story time|crafts|nature')],
  },
  // --- hoe de gast is
  {
    group: 'heart', who: 'all',
    nl: w('Lacht om alles|Is bijna altijd vrolijk|Stelt heel veel vragen|Deelt graag|Helpt graag|Is heel nieuwsgierig|Is een beetje verlegen|Geeft graag knuffels|Zegt altijd dankjewel|Kan heel goed luisteren|Maakt snel vriendjes|Troost graag|Is dol op verrassingen|Kan goed wachten|Houdt van opruimen|Vergeet nooit een verjaardag|Vertelt graag verhalen|Fluistert graag geheimpjes|Heeft altijd een plan|Geeft graag complimentjes|Lacht het hardst van iedereen|Is gek op grapjes|Vindt alles interessant|Wil altijd helpen dragen|Houdt van gezelligheid|Praat graag met iedereen|Denkt graag lang na|Bedenkt de gekste dingen|Zwaait naar iedereen|Is een echte dierenvriend|Zegt iedereen gedag|Houdt de deur open voor iedereen|Moedigt iedereen aan|Is altijd in voor een feestje|Geeft nooit op|Maakt iedereen aan het lachen|Is het liefst buiten|Is heel zorgzaam|Durft heel veel|Is een echte dromer'),
    en: w('Laughs at everything|Is nearly always cheerful|Asks lots and lots of questions|Loves sharing|Loves helping|Is very curious|Is a little bit shy|Loves giving hugs|Always says thank you|Is a very good listener|Makes friends quickly|Is good at cheering people up|Is mad about surprises|Is good at waiting|Likes tidying up|Never forgets a birthday|Loves telling stories|Loves whispering secrets|Always has a plan|Loves giving compliments|Laughs louder than anyone|Is mad about jokes|Finds everything interesting|Always wants to help carry|Loves a cosy get-together|Likes chatting to everyone|Likes a good long think|Comes up with the wildest ideas|Waves at everyone|Is a true friend of animals|Says hello to everyone|Holds the door for everyone|Cheers everyone on|Is always up for a party|Never gives up|Makes everyone laugh|Likes being outdoors best|Is very caring|Is very brave|Is a real daydreamer'),
  },
  // --- wat de gast weet
  {
    group: 'know', who: 'all',
    nl: w("Weet alles van dino's|Kent alle vogels bij naam|Weet alles van treinen|Weet heel veel van sterren|Weet alles van vulkanen|Kent alle vlaggen|Weet alles van de ruimte|Kent alle automerken|Weet hoe bijen honing maken|Weet waarom zebra's strepen hebben|Weet hoe hoog een giraf is|Kent tien soorten bomen|Weet alles van tractors|Kent alle planeten bij naam|Weet hoe een regenboog ontstaat|Kent heel veel moppen|Kent een heel lang gedicht|Weet alles van vlinders|Weet alles van paarden|Weet alles van walvissen|Weet alles van kastelen|Weet alles van het weer|Leest alles over dieren|Kent alle sprookjes|Weet hoe je een vlieger maakt|Weet welk dier het snelst rent|Weet hoe oud een schildpad wordt|Kan de Grote Beer aanwijzen|Weet hoe een kikker groeit|Weet waar de zon ondergaat|Weet alles van schepen|Weet hoe een vuurtoren werkt"),
    en: w('Knows all about dinosaurs|Knows every bird by name|Knows all about trains|Knows a lot about stars|Knows all about volcanoes|Knows all the flags|Knows all about space|Knows every make of car|Knows how bees make honey|Knows why zebras have stripes|Knows how tall a giraffe is|Knows ten kinds of trees|Knows all about tractors|Knows every planet by name|Knows how a rainbow is made|Knows lots and lots of jokes|Knows a very long poem|Knows all about butterflies|Knows all about horses|Knows all about whales|Knows all about castles|Knows all about the weather|Reads everything about animals|Knows all the fairy tales|Knows how to make a kite|Knows which animal runs fastest|Knows how old a tortoise gets|Can point out the Great Bear|Knows how a frog grows|Knows where the sun sets|Knows all about ships|Knows how a lighthouse works'),
  },
  { group: 'know', who: 'kid', nl: w("Weet alles van piraten|Weet alles van ridders|Kent alle dino's bij naam|Weet alles van brandweerauto's"), en: w('Knows all about pirates|Knows all about knights|Knows every dinosaur by name|Knows all about fire engines') },
  {
    group: 'know', who: 'adult',
    nl: w('Kent alle paddenstoelen|Weet de naam van elke bloem|Weet waar ooievaars overwinteren|Kent de weg in elk bos|Weet alles van oude treinen'),
    en: w('Knows every kind of toadstool|Knows the name of every flower|Knows where storks spend the winter|Knows the way in every wood|Knows all about old trains'),
  },
  // --- lievelingsdingen
  {
    group: 'thing', who: 'kid',
    nl: [
      ...pre('Lievelingsknuffel:', 'een konijn|een beer|een olifant|een aap|een giraf|een pinguïn|een schaap|een draak'),
      ...pre('Lievelingsboek:', 'over een rups|over draken|over een kikker|over een trein|over de maan|over een beer|over dieren'),
      ...pre('Lievelingsspeelgoed:', 'een houten trein|een brandweerauto|een springtouw|een vlieger|een bal|de blokkendoos|een tol|een kraanwagen'),
      ...w('Heeft een knuffel die Beer heet|Neemt overal een dekentje mee|Heeft een rode step|Heeft een fiets met een toeter|Heeft een eigen zaklamp|Heeft een verkleedkist|Heeft een poppenhuis|Heeft een zak vol knikkers|Heeft een eigen gieter|Heeft een kompas|Heeft een vergrootglas|Heeft een vlieger als een draak'),
    ],
    en: [
      ...pre('Favourite cuddly toy:', 'a rabbit|a bear|an elephant|a monkey|a giraffe|a penguin|a sheep|a dragon'),
      ...pre('Favourite book:', 'about a caterpillar|about dragons|about a frog|about a train|about the moon|about a bear|about animals'),
      ...pre('Favourite toy:', 'a wooden train|a fire engine|a skipping rope|a kite|a ball|the box of blocks|a spinning top|a toy crane'),
      ...w("Has a cuddly toy called Bear|Takes a little blanket everywhere|Has a red scooter|Has a bike with a horn|Has a torch for dark dens|Has a dressing-up box|Has a doll's house|Has a bag full of marbles|Has a little watering can|Has a compass|Has a magnifying glass|Has a kite shaped like a dragon"),
    ],
  },
  {
    group: 'thing', who: 'adult',
    nl: w('Leest graag dikke boeken|Leest elke dag de krant|Heeft een oude fiets met een bel|Heeft een schuur vol gereedschap|Heeft een kast vol spelletjes|Heeft een caravan|Heeft een bootje|Heeft een oude platenspeler|Heeft altijd een boek in de tas|Schrijft elke dag in een dagboek|Stuurt nog echte kaarten|Bewaart alle kindertekeningen|Heeft een fiets met een mandje|Heeft een verrekijker van opa|Heeft een picknickmand van riet'),
    en: w("Likes reading thick books|Reads the paper every day|Has an old bike with a bell|Has a shed full of tools|Has a cupboard full of games|Has a caravan|Has a little boat|Has an old record player|Always has a book in the bag|Writes in a diary every day|Still sends real postcards|Keeps every child's drawing|Has a bike with a basket|Has grandad's old binoculars|Has a wicker picnic basket"),
  },
];

/** Groepen waar niets in staat over lopen, rennen of klimmen: daaruit komen de weetjes van een gast in een rolstoel. */
const CALM = ['food', 'drink', 'colour', 'pet', 'music', 'know', 'heart', 'collect', 'zoo', 'today'];

const langOf = (lang: string): Lang => (lang.toLowerCase().startsWith('nl') ? 'nl' : 'en');

/** Alle voornamen in deze taal. */
export function guestNames(lang: string): string[] {
  const n = NAMES[langOf(lang)];
  return [...n.kid.m, ...n.kid.f, ...n.adult.m, ...n.adult.f];
}

/** Alle weetjes in deze taal; met `who` alleen die voor iedereen, alleen voor kinderen of alleen voor grote mensen. */
export function guestFacts(lang: string, who?: FactWho): string[] {
  const L = langOf(lang);
  return POOLS.filter(p => !who || p.who === who).flatMap(p => p[L]);
}

/** Per groep hoeveel weetjes er in deze taal zijn (voor de telling). */
export function factCounts(lang: string): Record<string, number> {
  const L = langOf(lang), out: Record<string, number> = {};
  for (const p of POOLS) out[p.group] = (out[p.group] ?? 0) + p[L].length;
  return out;
}

/** Een vast rijtje toevalsgetallen bij een getal (mulberry32): hetzelfde getal geeft altijd hetzelfde rijtje. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GuestCard {
  name: string;
  facts: string[];
}

export interface CardOptions {
  /** Een naam voor een man of een vrouw; zonder kiest het getal zelf. */
  sex?: GuestSex | null;
  /** Hoeveel weetjes (gewoon drie). */
  count?: number;
  /** Groepen die niet meedoen: de juf krijgt geen ander werk, een klas op schoolreis geen eigen uitje. */
  skip?: string[];
  /** Alleen weetjes waar je niet voor hoeft te lopen of te klimmen (een gast in een rolstoel). */
  calm?: boolean;
}

// per taal en per kind of groot mens: alle weetjes die mogen, met hun groep erbij
const lists = new Map<string, { group: string; text: string }[]>();
function eligible(L: Lang, child: boolean): { group: string; text: string }[] {
  const key = `${L}${child ? 1 : 0}`;
  let list = lists.get(key);
  if (!list) {
    list = POOLS.filter(p => p.who === 'all' || (p.who === 'kid') === child).flatMap(p => p[L].map(text => ({ group: p.group, text })));
    lists.set(key, list);
  }
  return list;
}

/**
 * Het kaartje van een gast: een voornaam en een paar weetjes, elk uit een andere groep (zo spreken ze elkaar
 * nooit tegen). Hetzelfde getal geeft altijd hetzelfde kaartje.
 */
export function guestCard(seed: number, child: boolean, lang: string, opts: CardOptions = {}): GuestCard {
  const rnd = seeded(seed), L = langOf(lang);
  // altijd eerst het muntje voor man of vrouw, ook als we het al weten: dan blijft de rest van het rijtje gelijk
  const coin: GuestSex = rnd() < 0.5 ? 'm' : 'f';
  const names = NAMES[L][child ? 'kid' : 'adult'][opts.sex ?? coin];
  const name = names[Math.floor(rnd() * names.length)];
  const skip = opts.skip ?? [];
  const pool = eligible(L, child).filter(f => !skip.includes(f.group) && (!opts.calm || CALM.includes(f.group)));
  const facts: string[] = [], used = new Set<string>(), want = opts.count ?? 3;
  // elk weetje heeft evenveel kans; uit een groep die al aan de beurt was, komt er geen tweede
  for (let tries = 0; facts.length < want && tries < 200 && pool.length; tries++) {
    const f = pool[Math.floor(rnd() * pool.length)];
    if (used.has(f.group)) continue;
    used.add(f.group);
    facts.push(f.text);
  }
  return { name, facts };
}
