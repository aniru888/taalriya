export interface TaalVariation {
  name: string;
  bols: string[];
  beatsPerCycle?: number;
}

export interface Taal {
  id: string;
  name: string;
  beats: number;
  divisions: string;
  description: string;
  // 1-based beat positions
  sam: number;
  khali: number[];
  theka: string[];
  fast: string[];
  ending: string[];
  tehai: string[];
}

export const TAALS: Taal[] = [
  {
    id: "dadra",
    name: "Dadra",
    beats: 6,
    divisions: "3 + 3",
    description: "A light 6-beat taal used in thumri, ghazal and bhajan.",
    sam: 1,
    khali: [4],
    theka: ["Dha", "Dhin", "Na", "Dha", "Tin", "Na"],
    fast: ["Dha", "Tirakita", "Na", "Dha", "Tirakita", "Na"],
    ending: ["Dha", "Dhin", "Na", "Ta", "Tin", "Na"],
    tehai: ["Dha", "Ge", "Na", "Dha", "Ge", "Na", "Dha", "Ge", "Na", "Dha", "-", "-"],
  },
  {
    id: "keharwa",
    name: "Keharwa",
    beats: 8,
    divisions: "4 + 4",
    description: "Popular 8-beat taal used widely in folk and film music.",
    sam: 1,
    khali: [5],
    theka: ["Dha", "Ge", "Na", "Ti", "Na", "Ke", "Dhin", "Na"],
    fast: ["Dha", "Tirakita", "Dhin", "Na", "Tirakita", "Na", "Ke", "Dhin"],
    ending: ["Dha", "Ge", "Na", "Ti", "Na", "Ge", "Dhin", "Dha"],
    tehai: ["Dha", "Ge", "Na", "Dha", "Ge", "Na", "Dha", "Ge", "Na", "Dha", "-", "-"],
  },
  {
    id: "teentaal",
    name: "Teen Taal",
    beats: 16,
    divisions: "4 + 4 + 4 + 4",
    description: "The most common 16-beat taal in Hindustani classical music.",
    sam: 1,
    khali: [9],
    theka: ["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dhin","Dhin","Dha"],
    fast:  ["Dha","Tirakita","Dhin","Dha","Dha","Tirakita","Dhin","Dha","Dha","Tirakita","Tin","Ta","Ta","Tirakita","Dhin","Dha"],
    ending:["Dha","Ge","Dhin","Ge","Dha","Ge","Dhin","Ge","Ta","Ke","Dhin","Ge","Dha","Ge","Dhin","Dha"],
    tehai: ["Dha","Ge","Tirakita","Dha","-","Dha","Ge","Tirakita","Dha","-","Dha","Ge","Tirakita","Dha","-","-"],
  },
  {
    id: "rupak",
    name: "Rupak",
    beats: 7,
    divisions: "3 + 2 + 2",
    description: "A 7-beat taal starting on khali (empty), unique among classical taals.",
    sam: 4,
    khali: [1],
    theka: ["Tin","Tin","Na","Dhin","Na","Dhin","Na"],
    fast: ["Tin","Tirakita","Na","Dhin","Na","Dhin","Tirakita"],
    ending: ["Tin","Tin","Na","Dhin","Na","Dhin","Dha"],
    tehai: ["Dhin","Na","Dha","Dhin","Na","Dha","Dhin","Na","Dha","-","-","-","-","-"],
  },
  {
    id: "ektaal",
    name: "Ektaal",
    beats: 12,
    divisions: "2+2+2+2+2+2",
    description: "A grand 12-beat taal used in vilambit khayal and dhrupad.",
    sam: 1,
    khali: [5, 11],
    theka: ["Dhin","Dhin","Dha","Ge","Tirakita","Tu","Na","Ke","Dhin","Dhin","Dha","Ge"],
    fast: ["Dhin","Dhin","Dha","Tirakita","Tu","Na","Ke","Dhin","Dhin","Tirakita","Dha","Ge"],
    ending: ["Dhin","Dhin","Dha","Ge","Tirakita","Tu","Na","Ke","Dhin","Dha","Tirakita","Dha"],
    tehai: ["Dha","Tirakita","Dha","Dha","Tirakita","Dha","Dha","Tirakita","Dha","-","-","-"],
  },
];

export const VARIATION_KEYS = ["theka", "fast", "ending", "tehai"] as const;
export type VariationKey = (typeof VARIATION_KEYS)[number];

export const VARIATION_LABELS: Record<VariationKey, string> = {
  theka: "Basic Theka",
  fast: "Fast Variation",
  ending: "Ending Variation",
  tehai: "Tehai Pattern",
};
