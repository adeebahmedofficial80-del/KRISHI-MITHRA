import {
  PlantingCropSchedule,
  PlantingReadinessResult,
  WeatherSnapshot,
} from '../types/krishi';

export const MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const PLANTING_SCHEDULES: PlantingCropSchedule[] = [
  // ======================== 24 VEGETABLES ========================
  {
    cropId: 'tomato',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [1, 2, 6, 7, 9, 10],
    harvestMonths: [3, 4, 5, 8, 9, 11, 12, 1],
    daysToHarvest: '65–80 days',
    idealTempMinC: 18,
    idealTempMaxC: 30,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Raise nursery seedlings on raised beds; transplant 25-day seedlings in cool evening hours.',
    harvestTip: 'Pick at breaker (pink-turning) stage for distant APMCs; firm red for local mandis.',
  },
  {
    cropId: 'onion',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [5, 6, 9, 10, 11],
    harvestMonths: [1, 2, 3, 4, 8, 9, 10],
    daysToHarvest: '110–130 days',
    idealTempMinC: 15,
    idealTempMaxC: 32,
    maxSafeSowingRainMm: 20,
    sowingTip: 'Transplant 45-day seedlings on well-drained flat or broad beds to prevent basal rot.',
    harvestTip: 'Stop irrigation 12 days prior; cure bulbs in shade for 5–7 days until necks dry tightly.',
  },
  {
    cropId: 'potato',
    seasonLabel: 'Rabi',
    sowingMonths: [6, 7, 10, 11],
    harvestMonths: [1, 2, 3, 9, 10],
    daysToHarvest: '85–105 days',
    idealTempMinC: 14,
    idealTempMaxC: 26,
    maxSafeSowingRainMm: 18,
    sowingTip: 'Plant certified disease-free sprouted seed tubers on ridges; earth up at 30 days.',
    harvestTip: 'Dehaulm 10 days before digging so skins harden for cleaner grading and lower bruising.',
  },
  {
    cropId: 'brinjal',
    seasonLabel: 'Year-Round',
    sowingMonths: [1, 2, 6, 7, 10, 11],
    harvestMonths: [3, 4, 5, 8, 9, 10, 12, 1],
    daysToHarvest: '65–75 days',
    idealTempMinC: 18,
    idealTempMaxC: 33,
    maxSafeSowingRainMm: 25,
    sowingTip: 'Install pheromone traps early at transplanting to limit shoot and fruit borer.',
    harvestTip: 'Harvest glossy, tender fruits with green calyx before seeds harden.',
  },
  {
    cropId: 'cabbage',
    seasonLabel: 'Rabi',
    sowingMonths: [8, 9, 10, 11],
    harvestMonths: [11, 12, 1, 2, 3],
    daysToHarvest: '75–90 days',
    idealTempMinC: 13,
    idealTempMaxC: 25,
    maxSafeSowingRainMm: 20,
    sowingTip: 'Best established in cool weather; maintain even soil moisture to avoid head splitting.',
    harvestTip: 'Cut compact heads early morning with 2–3 protective wrapper leaves intact.',
  },
  {
    cropId: 'cauliflower',
    seasonLabel: 'Rabi',
    sowingMonths: [8, 9, 10, 11],
    harvestMonths: [11, 12, 1, 2, 3],
    daysToHarvest: '75–95 days',
    idealTempMinC: 14,
    idealTempMaxC: 25,
    maxSafeSowingRainMm: 20,
    sowingTip: 'Apply boron and molybdenum foliar nutrition to prevent hollow stem and browning.',
    harvestTip: 'Blanch curds lightly and harvest snow-white compact heads before loosening.',
  },
  {
    cropId: 'carrot',
    seasonLabel: 'Rabi',
    sowingMonths: [8, 9, 10, 11],
    harvestMonths: [11, 12, 1, 2, 3],
    daysToHarvest: '80–95 days',
    idealTempMinC: 14,
    idealTempMaxC: 26,
    maxSafeSowingRainMm: 18,
    sowingTip: 'Direct-sow in deep, stone-free sandy loam ridges; thin seedlings to 5 cm spacing.',
    harvestTip: 'Irrigate lightly before pulling to avoid snapping roots; wash in clean shade water.',
  },
  {
    cropId: 'radish',
    seasonLabel: 'Year-Round',
    sowingMonths: [1, 2, 7, 8, 9, 10, 11],
    harvestMonths: [2, 3, 4, 9, 10, 11, 12, 1],
    daysToHarvest: '40–50 days',
    idealTempMinC: 14,
    idealTempMaxC: 28,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Sow sequentially every 15 days on ridges for continuous harvest and steady mandi dispatch.',
    harvestTip: 'Pull promptly at 40–45 days before roots turn pithy or fibrous.',
  },
  {
    cropId: 'green-chilli',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [1, 2, 6, 7, 9, 10],
    harvestMonths: [3, 4, 5, 8, 9, 10, 11, 12],
    daysToHarvest: '70–85 days',
    idealTempMinC: 20,
    idealTempMaxC: 34,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Use virus-free nursery trays and yellow sticky traps against thrips and mites.',
    harvestTip: 'Pick firm, dark-green pods with stalks intact during early morning coolness.',
  },
  {
    cropId: 'capsicum',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [1, 2, 7, 8, 9, 10],
    harvestMonths: [3, 4, 5, 10, 11, 12, 1],
    daysToHarvest: '75–85 days',
    idealTempMinC: 16,
    idealTempMaxC: 28,
    maxSafeSowingRainMm: 18,
    sowingTip: 'Mulch beds and stake plants early; shelter from high afternoon heat to avoid blossom drop.',
    harvestTip: 'Harvest thick-walled, glossy fruits before sun-scald develops; pack in ventilated crates.',
  },
  {
    cropId: 'ladies-finger',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [2, 3, 6, 7],
    harvestMonths: [4, 5, 6, 8, 9, 10],
    daysToHarvest: '45–55 days',
    idealTempMinC: 22,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 25,
    sowingTip: 'Soak seeds 12 hours before sowing; select YVMV-tolerant hybrids.',
    harvestTip: 'Pick tender 8–10 cm pods every alternate morning to keep flowering active.',
  },
  {
    cropId: 'beans',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [1, 2, 6, 7, 9, 10],
    harvestMonths: [3, 4, 8, 9, 11, 12],
    daysToHarvest: '50–60 days',
    idealTempMinC: 16,
    idealTempMaxC: 28,
    maxSafeSowingRainMm: 20,
    sowingTip: 'Direct-sow on well-drained beds; avoid waterlogging during seedling emergence.',
    harvestTip: 'Harvest crisp, stringless pods early morning and dispatch same day to keep premium grade.',
  },
  {
    cropId: 'cucumber',
    seasonLabel: 'Zaid',
    sowingMonths: [1, 2, 3, 6, 7],
    harvestMonths: [3, 4, 5, 8, 9, 10],
    daysToHarvest: '45–55 days',
    idealTempMinC: 20,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Sow on raised channels or trellis lines to improve airflow and fruit straightness.',
    harvestTip: 'Pick crisp, uniform green cucumbers before yellowing or seed maturity.',
  },
  {
    cropId: 'bottle-gourd',
    seasonLabel: 'Zaid',
    sowingMonths: [1, 2, 3, 6, 7],
    harvestMonths: [3, 4, 5, 6, 8, 9, 10],
    daysToHarvest: '55–65 days',
    idealTempMinC: 22,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 25,
    sowingTip: 'Train vines on pandal/trellis during monsoon to keep fruits spotless and straight.',
    harvestTip: 'Harvest tender fruits when fingernail pierces skin easily; cushion crates with dry straw.',
  },
  {
    cropId: 'bitter-gourd',
    seasonLabel: 'Zaid',
    sowingMonths: [1, 2, 3, 6, 7],
    harvestMonths: [3, 4, 5, 6, 8, 9, 10],
    daysToHarvest: '55–65 days',
    idealTempMinC: 22,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 24,
    sowingTip: 'Pre-soak hard seeds overnight; erect bower staking and fruit-fly cue-lure traps.',
    harvestTip: 'Pick deep-green tender fruits every 3 days before ridges turn yellow.',
  },
  {
    cropId: 'ridge-gourd',
    seasonLabel: 'Zaid',
    sowingMonths: [1, 2, 3, 6, 7],
    harvestMonths: [3, 4, 5, 8, 9, 10],
    daysToHarvest: '55–65 days',
    idealTempMinC: 22,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 24,
    sowingTip: 'Grow on vertical trellis for straight marketable pods and easier fruit-fly monitoring.',
    harvestTip: 'Harvest tender non-fibrous pods early morning; avoid bruising delicate ridges.',
  },
  {
    cropId: 'pumpkin',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [1, 2, 6, 7],
    harvestMonths: [4, 5, 6, 9, 10, 11],
    daysToHarvest: '90–110 days',
    idealTempMinC: 20,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 25,
    sowingTip: 'Prepare pits with well-rotted FYM at 2.5 m spacing for vigorous vine coverage.',
    harvestTip: 'Cut mature fruits leaving a 4–5 cm stem; cures well for 3–6 weeks in cool ventilated shade.',
  },
  {
    cropId: 'spinach',
    seasonLabel: 'Year-Round',
    sowingMonths: [1, 2, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 9, 10, 11, 12],
    daysToHarvest: '30–40 days',
    idealTempMinC: 14,
    idealTempMaxC: 28,
    maxSafeSowingRainMm: 18,
    sowingTip: 'Broadcast or line-sow on fine raised beds; shade nets help during warm spells.',
    harvestTip: 'Cut tender leaves before sunrise and mist lightly to preserve crispness for morning auction.',
  },
  {
    cropId: 'coriander',
    seasonLabel: 'Year-Round',
    sowingMonths: [1, 2, 6, 7, 9, 10, 11],
    harvestMonths: [2, 3, 4, 7, 8, 10, 11, 12],
    daysToHarvest: '35–45 days',
    idealTempMinC: 15,
    idealTempMaxC: 28,
    maxSafeSowingRainMm: 15,
    sowingTip: 'Split seeds gently into halves and soak 8 hours for faster, even germination.',
    harvestTip: 'Pull whole aromatic bunches early morning before heat causes wilting.',
  },
  {
    cropId: 'drumstick',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [2, 3, 4, 5, 9, 10, 11],
    daysToHarvest: '160–180 days (first flush)',
    idealTempMinC: 22,
    idealTempMaxC: 38,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Plant PKM-1 seeds or cuttings with monsoon onset; pinch main stem at 1 m for branching.',
    harvestTip: 'Harvest tender, pencil-thick green pods before seeds harden and pods split.',
  },
  {
    cropId: 'green-peas',
    seasonLabel: 'Rabi',
    sowingMonths: [10, 11],
    harvestMonths: [12, 1, 2, 3],
    daysToHarvest: '60–75 days',
    idealTempMinC: 10,
    idealTempMaxC: 22,
    maxSafeSowingRainMm: 15,
    sowingTip: 'Treat seed with Rhizobium culture; sow in cool soil with gentle pre-sowing moisture.',
    harvestTip: 'Pick well-filled sweet green pods before outer skin turns pale or leathery.',
  },
  {
    cropId: 'garlic',
    seasonLabel: 'Rabi',
    sowingMonths: [9, 10, 11],
    harvestMonths: [2, 3, 4],
    daysToHarvest: '130–150 days',
    idealTempMinC: 12,
    idealTempMaxC: 26,
    maxSafeSowingRainMm: 15,
    sowingTip: 'Plant healthy bold outer cloves upright at 7–8 cm spacing in well-drained loam.',
    harvestTip: 'Lift bulbs when 50% tops yellow; cure in airy shade for 10 days before braiding/bagging.',
  },
  {
    cropId: 'ginger',
    seasonLabel: 'Kharif',
    sowingMonths: [4, 5, 6],
    harvestMonths: [12, 1, 2, 3],
    daysToHarvest: '210–240 days',
    idealTempMinC: 20,
    idealTempMaxC: 32,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Treat seed rhizomes against soft rot and mulch beds heavily with green leaf mulch.',
    harvestTip: 'Dig fresh vegetable ginger at 6 months or fully mature fibrous rhizomes at 8 months.',
  },
  {
    cropId: 'sweet-potato',
    seasonLabel: 'Kharif & Rabi',
    sowingMonths: [6, 7, 9, 10],
    harvestMonths: [10, 11, 1, 2],
    daysToHarvest: '105–120 days',
    idealTempMinC: 20,
    idealTempMaxC: 32,
    maxSafeSowingRainMm: 28,
    sowingTip: 'Plant healthy apical vine cuttings on ridges; avoid excess nitrogen to encourage tuber bulk.',
    harvestTip: 'Harvest when latex dries white quickly on cut surface; handle gently to prevent skinning.',
  },

  // ======================== 20 FRUITS ========================
  {
    cropId: 'banana',
    seasonLabel: 'Year-Round',
    sowingMonths: [2, 3, 6, 7, 8, 9],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    daysToHarvest: '11–13 months',
    idealTempMinC: 20,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 35,
    sowingTip: 'Use tissue-cultured disease-free plants with drip fertigation and windbreak borders.',
    harvestTip: 'Cut bunches at 75–80% angular fullness for long-distance mandi transport.',
  },
  {
    cropId: 'mango',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [3, 4, 5, 6, 7],
    daysToHarvest: '3–4 years (orchard bearing)',
    idealTempMinC: 22,
    idealTempMaxC: 38,
    maxSafeSowingRainMm: 40,
    sowingTip: 'Plant grafted saplings during monsoon in 1 m pits; protect flowering panicles in Jan–Feb.',
    harvestTip: 'Harvest mature fruits with 1–2 cm stalk using clippers to avoid sap burn.',
  },
  {
    cropId: 'apple',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [12, 1, 2],
    harvestMonths: [7, 8, 9, 10],
    daysToHarvest: '4–5 years (temperate bearing)',
    idealTempMinC: 8,
    idealTempMaxC: 24,
    maxSafeSowingRainMm: 20,
    sowingTip: 'Plant dormant grafted saplings in winter in temperate high-altitude zones with chilling hours.',
    harvestTip: 'Pick gently with stalk attached when ground color turns creamy and starch clears.',
  },
  {
    cropId: 'papaya',
    seasonLabel: 'Year-Round',
    sowingMonths: [2, 3, 6, 7, 9, 10],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    daysToHarvest: '9–10 months',
    idealTempMinC: 22,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Ensure strict drainage on raised mounds; papaya roots fail quickly in standing water.',
    harvestTip: 'Harvest when yellow streaks appear at blossom end; wrap individual fruits in newspaper.',
  },
  {
    cropId: 'guava',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [1, 2, 8, 9, 11, 12],
    daysToHarvest: '2–3 years (orchard bearing)',
    idealTempMinC: 18,
    idealTempMaxC: 34,
    maxSafeSowingRainMm: 35,
    sowingTip: 'Prune and regulate Mrig/Hasta bahar for sweeter, fruit-fly-free winter harvests.',
    harvestTip: 'Bag developing fruits and harvest at light-green-to-yellow skin break.',
  },
  {
    cropId: 'pomegranate',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9, 10],
    harvestMonths: [1, 2, 3, 7, 8, 9, 10, 11],
    daysToHarvest: '2–3 years (orchard bearing)',
    idealTempMinC: 18,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 25,
    sowingTip: 'Prefer dry, low-humidity bahar regulation to curb bacterial blight and fruit cracking.',
    harvestTip: 'Clip fruits when skin turns deep Bhagwa red and gives a metallic sound when tapped.',
  },
  {
    cropId: 'grapes',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [1, 2, 10, 11],
    harvestMonths: [1, 2, 3, 4, 5],
    daysToHarvest: '14–16 months (first crop)',
    idealTempMinC: 15,
    idealTempMaxC: 34,
    maxSafeSowingRainMm: 15,
    sowingTip: 'October pruning initiates fruiting for winter-spring harvest; monitor downy mildew after rain.',
    harvestTip: 'Harvest cool morning bunches once Brix reaches 16–18°; pre-cool promptly.',
  },
  {
    cropId: 'watermelon',
    seasonLabel: 'Zaid',
    sowingMonths: [12, 1, 2],
    harvestMonths: [3, 4, 5, 6],
    daysToHarvest: '80–90 days',
    idealTempMinC: 24,
    idealTempMaxC: 38,
    maxSafeSowingRainMm: 18,
    sowingTip: 'Use silver-black plastic mulch with drip irrigation for sweeter summer melons.',
    harvestTip: 'Check dried tendril near stalk, creamy ground spot, and dull thump before cutting.',
  },
  {
    cropId: 'muskmelon',
    seasonLabel: 'Zaid',
    sowingMonths: [1, 2, 3],
    harvestMonths: [4, 5, 6],
    daysToHarvest: '75–85 days',
    idealTempMinC: 24,
    idealTempMaxC: 38,
    maxSafeSowingRainMm: 15,
    sowingTip: 'Keep dry sunny weather during ripening; cut back irrigation near maturity for higher sugar.',
    harvestTip: 'Pick at half-slip stage for distant mandis and full-slip aromatic stage for nearby markets.',
  },
  {
    cropId: 'orange',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8],
    harvestMonths: [11, 12, 1, 2, 3],
    daysToHarvest: '4–5 years (orchard bearing)',
    idealTempMinC: 16,
    idealTempMaxC: 32,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Plant budded disease-free grafts in well-drained deep loam; maintain micronutrient sprays.',
    harvestTip: 'Clip fruits cleanly without pulling skin; grade by size for Nagpur/regional auction lots.',
  },
  {
    cropId: 'mosambi',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8],
    harvestMonths: [8, 9, 10, 11, 12, 1],
    daysToHarvest: '3–4 years (orchard bearing)',
    idealTempMinC: 18,
    idealTempMaxC: 35,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Maintain basin drainage and zinc/iron foliar sprays for vibrant Sathgudi fruit sizing.',
    harvestTip: 'Harvest mature juicy fruits at pale green-yellow transition using secateurs.',
  },
  {
    cropId: 'lemon',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
    daysToHarvest: '3 years (orchard bearing)',
    idealTempMinC: 20,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Regulate stress in Dec–Jan to target high-value summer lemon demand in Apr–May.',
    harvestTip: 'Pick bright greenish-yellow juicy lemons; avoid dropping to prevent oil-gland spotting.',
  },
  {
    cropId: 'pineapple',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [5, 6, 7, 8],
    harvestMonths: [1, 2, 3, 4, 5, 6, 11, 12],
    daysToHarvest: '15–18 months',
    idealTempMinC: 22,
    idealTempMaxC: 34,
    maxSafeSowingRainMm: 40,
    sowingTip: 'Plant uniform slips/suckers in double-row trenches on slightly acidic well-drained soil.',
    harvestTip: 'Harvest when basal 2–3 rows of eyes turn golden yellow with intact crown.',
  },
  {
    cropId: 'sapota',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [1, 2, 3, 4, 10, 11, 12],
    daysToHarvest: '4–5 years (orchard bearing)',
    idealTempMinC: 20,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 35,
    sowingTip: 'Plant Kalipatti/Cricket Ball grafts with monsoon showers; apply organic mulch around basins.',
    harvestTip: 'Scratch skin gently—if yellow-brown without green latex, fruit is ready to pick.',
  },
  {
    cropId: 'jackfruit',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8, 9],
    harvestMonths: [3, 4, 5, 6, 7],
    daysToHarvest: '4–6 years (grafted bearing)',
    idealTempMinC: 22,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 45,
    sowingTip: 'Plant grafted Chandra/Siddu saplings in deep, non-waterlogged soil at monsoon start.',
    harvestTip: 'Harvest tender vegetable jackfruit early or ripe fruits when spines flatten and aroma rises.',
  },
  {
    cropId: 'coconut',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [5, 6, 7, 8, 9],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    daysToHarvest: '5–7 years (bearing every 45 days)',
    idealTempMinC: 22,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 45,
    sowingTip: 'Establish seedlings with onset of monsoon; practice husk burial for summer moisture retention.',
    harvestTip: 'Harvest tender nuts at 7 months or mature copra nuts at 11–12 months.',
  },
  {
    cropId: 'strawberry',
    seasonLabel: 'Rabi',
    sowingMonths: [9, 10],
    harvestMonths: [12, 1, 2, 3, 4],
    daysToHarvest: '65–80 days',
    idealTempMinC: 12,
    idealTempMaxC: 24,
    maxSafeSowingRainMm: 12,
    sowingTip: 'Plant tissue-cultured runners on raised plastic-mulched beds with drip irrigation.',
    harvestTip: 'Pick early morning with green cap attached at 75% red color; pack immediately in punnets.',
  },
  {
    cropId: 'custard-apple',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [6, 7, 8],
    harvestMonths: [9, 10, 11, 12],
    daysToHarvest: '3–4 years (orchard bearing)',
    idealTempMinC: 20,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 30,
    sowingTip: 'Thrives in semi-arid upland soils; prune light shoots in late winter before spring flush.',
    harvestTip: 'Harvest firm fruits when creamy grooves widen between segments before splitting on tree.',
  },
  {
    cropId: 'pear',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [12, 1, 2],
    harvestMonths: [7, 8, 9],
    daysToHarvest: '4–5 years (orchard bearing)',
    idealTempMinC: 10,
    idealTempMaxC: 26,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Plant dormant saplings in winter in sub-temperate hills or low-chill Punjab/Uttarakhand belts.',
    harvestTip: 'Pick mature firm green fruits before tree softening so they travel cleanly without bruising.',
  },
  {
    cropId: 'dragon-fruit',
    seasonLabel: 'Perennial Orchard',
    sowingMonths: [3, 4, 5, 6],
    harvestMonths: [6, 7, 8, 9, 10, 11],
    daysToHarvest: '14–18 months',
    idealTempMinC: 20,
    idealTempMaxC: 36,
    maxSafeSowingRainMm: 22,
    sowingTip: 'Install sturdy RCC poles with rings; plant cured cuttings on raised well-drained beds.',
    harvestTip: 'Clip vibrant pink-red fruits 30–35 days after flowering when scale tips start turning green-pink.',
  },
];

export const PLANTING_CALENDAR_MAP: Record<string, PlantingCropSchedule> = Object.fromEntries(
  PLANTING_SCHEDULES.map((item) => [item.cropId, item]),
);

export function getCropSchedule(cropId: string): PlantingCropSchedule | undefined {
  return PLANTING_CALENDAR_MAP[cropId];
}

export function evaluateWeatherReadiness(
  schedule: PlantingCropSchedule,
  weather: WeatherSnapshot | null,
  selectedMonth: number,
  isCurrentMonth: boolean,
): PlantingReadinessResult {
  const isSowMonth = schedule.sowingMonths.includes(selectedMonth);
  const isHarvestMonth = schedule.harvestMonths.includes(selectedMonth);

  // If inspecting a future/past month other than current month, evaluate seasonal window directly
  if (!isCurrentMonth || !weather) {
    if (isSowMonth && isHarvestMonth) {
      return {
        kind: 'ideal_sow',
        label: 'Sow & Harvest Window',
        detail: `Dual seasonal window (${schedule.seasonLabel}). ${schedule.sowingTip}`,
      };
    }
    if (isSowMonth) {
      return {
        kind: 'ideal_sow',
        label: 'Sowing Window',
        detail: `${schedule.seasonLabel} sowing period. Ideal temperature ${schedule.idealTempMinC}–${schedule.idealTempMaxC}°C.`,
      };
    }
    if (isHarvestMonth) {
      return {
        kind: 'harvest_ready',
        label: 'Harvest Window',
        detail: `${schedule.harvestTip}`,
      };
    }
    return {
      kind: 'off_season',
      label: 'Prep / Resting',
      detail: `Outside primary sowing/harvest peak. Use this month for soil testing, FYM incorporation, or nursery planning.`,
    };
  }

  // Live weather readiness evaluation for the current month using verified forecast telemetry
  const next3Days = weather.forecast.slice(0, 3);
  const rainMmValues = next3Days
    .map((d) => d.rainfallMm)
    .filter((v): v is number => v !== null && v !== undefined);
  const rainProbValues = [
    ...next3Days.map((d) => d.rainProbability),
    weather.rainProbability,
  ].filter((v): v is number => v !== null && v !== undefined);
  const maxTempValues = [
    ...next3Days.map((d) => d.maxTemp),
    weather.currentTemperature,
    weather.todayMaxTemp,
  ].filter((v): v is number => v !== null && v !== undefined);
  const minTempValues = [
    ...next3Days.map((d) => d.minTemp),
    weather.currentTemperature,
    weather.todayMinTemp,
  ].filter((v): v is number => v !== null && v !== undefined);

  if (maxTempValues.length === 0 && minTempValues.length === 0 && rainProbValues.length === 0) {
    if (isSowMonth) {
      return {
        kind: 'ideal_sow',
        label: 'Sowing Window',
        detail: `${schedule.seasonLabel} sowing period (${schedule.idealTempMinC}–${schedule.idealTempMaxC}°C ideal). Live temperature/rain values pending refresh.`,
      };
    }
    if (isHarvestMonth) {
      return {
        kind: 'harvest_ready',
        label: 'Harvest Window',
        detail: `${schedule.harvestTip}`,
      };
    }
  }

  const maxRain3d = rainMmValues.length > 0 ? Math.max(...rainMmValues) : null;
  const maxRainProb3d = rainProbValues.length > 0 ? Math.max(...rainProbValues) : null;
  const maxTemp3d = maxTempValues.length > 0 ? Math.max(...maxTempValues) : null;
  const minTemp3d = minTempValues.length > 0 ? Math.min(...minTempValues) : null;

  const hasHeavyRainRisk =
    (maxRain3d !== null && maxRain3d > schedule.maxSafeSowingRainMm) ||
    (maxRainProb3d !== null && maxRainProb3d >= 75 && (maxRain3d === null || maxRain3d >= 15));
  const hasHeatStress = maxTemp3d !== null && maxTemp3d > schedule.idealTempMaxC + 3;
  const hasColdStress = minTemp3d !== null && minTemp3d < schedule.idealTempMinC - 3;

  if (isSowMonth) {
    if (hasHeavyRainRisk) {
      return {
        kind: 'caution_weather',
        label: 'Delay Sowing (Rain)',
        detail: `${maxRain3d !== null ? `Up to ${Math.round(maxRain3d)} mm rain` : 'Heavy rain'} (${maxRainProb3d ?? 'high'}% chance) expected in the next 3 days. Wait for soil drainage before sowing.`,
      };
    }
    if (hasHeatStress && maxTemp3d !== null) {
      return {
        kind: 'caution_weather',
        label: 'Caution (High Heat)',
        detail: `Forecast highs near ${Math.round(maxTemp3d)}°C exceed ideal ${schedule.idealTempMaxC}°C. Transplant in late evening with light mulching and immediate irrigation.`,
      };
    }
    if (hasColdStress && minTemp3d !== null) {
      return {
        kind: 'caution_weather',
        label: 'Caution (Cool Nights)',
        detail: `Minimum temperatures near ${Math.round(minTemp3d)}°C are below ideal ${schedule.idealTempMinC}°C. Protect young nurseries from cold breeze.`,
      };
    }
    const tempSummary =
      minTemp3d !== null && maxTemp3d !== null
        ? `${Math.round(minTemp3d)}–${Math.round(maxTemp3d)}°C`
        : maxTemp3d !== null
          ? `up to ${Math.round(maxTemp3d)}°C`
          : 'mild temperatures';
    const rainSummary = maxRainProb3d !== null ? `, ${maxRainProb3d}% rain chance` : '';
    return {
      kind: 'ideal_sow',
      label: 'Ideal to Sow Now',
      detail: `Current forecast (${tempSummary}${rainSummary}) fits ${schedule.idealTempMinC}–${schedule.idealTempMaxC}°C sowing range.`,
    };
  }

  if (isHarvestMonth) {
    if (hasHeavyRainRisk) {
      return {
        kind: 'caution_weather',
        label: 'Harvest Before Rain',
        detail: `Rain risk (${maxRainProb3d ?? 'high'}%${maxRain3d !== null ? ` / ${Math.round(maxRain3d)} mm` : ''}) in next 3 days. Prioritize picking mature lots early and keep crates covered.`,
      };
    }
    return {
      kind: 'harvest_ready',
      label: 'Good for Harvest',
      detail: `Favorable harvest window (${maxTemp3d !== null ? `${Math.round(maxTemp3d)}°C high` : 'moderate temps'}${maxRainProb3d !== null ? `, ${maxRainProb3d}% rain chance` : ''}). ${schedule.harvestTip}`,
    };
  }

  // Check if between sowing and harvest (active growing phase)
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  if (schedule.sowingMonths.includes(prevMonth) || schedule.harvestMonths.includes(nextMonth)) {
    return {
      kind: 'active_growing',
      label: 'Active Crop Care',
      detail: `Mid-cycle vegetative/fruiting stage (${schedule.daysToHarvest}). Maintain regular moisture and pest scouting.`,
    };
  }

  return {
    kind: 'off_season',
    label: 'Off-Peak / Prep',
    detail: `Outside main sowing & harvest months for ${weather.locationName}. Ideal time for bed preparation and seed procurement.`,
  };
}
