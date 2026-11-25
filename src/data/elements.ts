export interface ElementInfo {
  symbol: string;
  name: string;
  z: number;
  mass: number;
  covalentRadius: number;
}

const RAW_ELEMENTS: [number, string, string, number, number][] = [
  [1, 'H', 'Hydrogen', 1.008, 0.31],
  [2, 'He', 'Helium', 4.0026, 0.28],
  [3, 'Li', 'Lithium', 6.94, 1.28],
  [4, 'Be', 'Beryllium', 9.0122, 0.96],
  [5, 'B', 'Boron', 10.81, 0.84],
  [6, 'C', 'Carbon', 12.011, 0.76],
  [7, 'N', 'Nitrogen', 14.007, 0.71],
  [8, 'O', 'Oxygen', 15.999, 0.66],
  [9, 'F', 'Fluorine', 18.998, 0.57],
  [10, 'Ne', 'Neon', 20.18, 0.58],
  [11, 'Na', 'Sodium', 22.99, 1.66],
  [12, 'Mg', 'Magnesium', 24.305, 1.41],
  [13, 'Al', 'Aluminum', 26.982, 1.21],
  [14, 'Si', 'Silicon', 28.085, 1.11],
  [15, 'P', 'Phosphorus', 30.974, 1.07],
  [16, 'S', 'Sulfur', 32.06, 1.05],
  [17, 'Cl', 'Chlorine', 35.45, 1.02],
  [18, 'Ar', 'Argon', 39.948, 1.06],
  [19, 'K', 'Potassium', 39.098, 2.03],
  [20, 'Ca', 'Calcium', 40.078, 1.76],
  [21, 'Sc', 'Scandium', 44.956, 1.70],
  [22, 'Ti', 'Titanium', 47.867, 1.60],
  [23, 'V', 'Vanadium', 50.942, 1.53],
  [24, 'Cr', 'Chromium', 51.996, 1.39],
  [25, 'Mn', 'Manganese', 54.938, 1.39],
  [26, 'Fe', 'Iron', 55.845, 1.32],
  [27, 'Co', 'Cobalt', 58.933, 1.26],
  [28, 'Ni', 'Nickel', 58.693, 1.24],
  [29, 'Cu', 'Copper', 63.546, 1.32],
  [30, 'Zn', 'Zinc', 65.38, 1.22],
  [31, 'Ga', 'Gallium', 69.723, 1.22],
  [32, 'Ge', 'Germanium', 72.63, 1.20],
  [33, 'As', 'Arsenic', 74.922, 1.19],
  [34, 'Se', 'Selenium', 78.971, 1.20],
  [35, 'Br', 'Bromine', 79.904, 1.20],
  [36, 'Kr', 'Krypton', 83.798, 1.16],
  [37, 'Rb', 'Rubidium', 85.468, 2.20],
  [38, 'Sr', 'Strontium', 87.62, 1.95],
  [39, 'Y', 'Yttrium', 88.906, 1.90],
  [40, 'Zr', 'Zirconium', 91.224, 1.75],
  [41, 'Nb', 'Niobium', 92.906, 1.64],
  [42, 'Mo', 'Molybdenum', 95.95, 1.54],
  [43, 'Tc', 'Technetium', 98.0, 1.47],
  [44, 'Ru', 'Ruthenium', 101.07, 1.46],
  [45, 'Rh', 'Rhodium', 102.91, 1.42],
  [46, 'Pd', 'Palladium', 106.42, 1.39],
  [47, 'Ag', 'Silver', 107.87, 1.45],
  [48, 'Cd', 'Cadmium', 112.41, 1.44],
  [49, 'In', 'Indium', 114.82, 1.42],
  [50, 'Sn', 'Tin', 118.71, 1.39],
  [51, 'Sb', 'Antimony', 121.76, 1.39],
  [52, 'Te', 'Tellurium', 127.6, 1.38],
  [53, 'I', 'Iodine', 126.9, 1.39],
  [54, 'Xe', 'Xenon', 131.29, 1.40],
  [55, 'Cs', 'Cesium', 132.91, 2.44],
  [56, 'Ba', 'Barium', 137.33, 2.15],
  [57, 'La', 'Lanthanum', 138.91, 2.07],
  [58, 'Ce', 'Cerium', 140.12, 2.04],
  [59, 'Pr', 'Praseodymium', 140.91, 2.03],
  [60, 'Nd', 'Neodymium', 144.24, 2.01],
  [61, 'Pm', 'Promethium', 145.0, 1.99],
  [62, 'Sm', 'Samarium', 150.36, 1.98],
  [63, 'Eu', 'Europium', 151.96, 1.98],
  [64, 'Gd', 'Gadolinium', 157.25, 1.96],
  [65, 'Tb', 'Terbium', 158.93, 1.94],
  [66, 'Dy', 'Dysprosium', 162.5, 1.92],
  [67, 'Ho', 'Holmium', 164.93, 1.92],
  [68, 'Er', 'Erbium', 167.26, 1.89],
  [69, 'Tm', 'Thulium', 168.93, 1.90],
  [70, 'Yb', 'Ytterbium', 173.05, 1.87],
  [71, 'Lu', 'Lutetium', 174.97, 1.87],
  [72, 'Hf', 'Hafnium', 178.49, 1.75],
  [73, 'Ta', 'Tantalum', 180.95, 1.70],
  [74, 'W', 'Tungsten', 183.84, 1.62],
  [75, 'Re', 'Rhenium', 186.21, 1.51],
  [76, 'Os', 'Osmium', 190.23, 1.44],
  [77, 'Ir', 'Iridium', 192.22, 1.41],
  [78, 'Pt', 'Platinum', 195.08, 1.36],
  [79, 'Au', 'Gold', 196.97, 1.36],
  [80, 'Hg', 'Mercury', 200.59, 1.32],
  [81, 'Tl', 'Thallium', 204.38, 1.45],
  [82, 'Pb', 'Lead', 207.2, 1.46],
  [83, 'Bi', 'Bismuth', 208.98, 1.48],
  [84, 'Po', 'Polonium', 209.0, 1.40],
  [85, 'At', 'Astatine', 210.0, 1.50],
  [86, 'Rn', 'Radon', 222.0, 1.50],
  [87, 'Fr', 'Francium', 223.0, 2.60],
  [88, 'Ra', 'Radium', 226.0, 2.21],
  [89, 'Ac', 'Actinium', 227.0, 2.15],
  [90, 'Th', 'Thorium', 232.04, 2.06],
  [91, 'Pa', 'Protactinium', 231.04, 2.00],
  [92, 'U', 'Uranium', 238.03, 1.96],
  [93, 'Np', 'Neptunium', 237.0, 1.90],
  [94, 'Pu', 'Plutonium', 244.0, 1.87],
  [95, 'Am', 'Americium', 243.0, 1.80],
  [96, 'Cm', 'Curium', 247.0, 1.69],
  [97, 'Bk', 'Berkelium', 247.0, 1.68],
  [98, 'Cf', 'Californium', 251.0, 1.68],
  [99, 'Es', 'Einsteinium', 252.0, 1.65],
  [100, 'Fm', 'Fermium', 257.0, 1.67],
  [101, 'Md', 'Mendelevium', 258.0, 1.73],
  [102, 'No', 'Nobelium', 259.0, 1.76],
  [103, 'Lr', 'Lawrencium', 266.0, 1.61],
  [104, 'Rf', 'Rutherfordium', 267.0, 1.57],
  [105, 'Db', 'Dubnium', 268.0, 1.49],
  [106, 'Sg', 'Seaborgium', 269.0, 1.43],
  [107, 'Bh', 'Bohrium', 270.0, 1.41],
  [108, 'Hs', 'Hassium', 277.0, 1.34],
  [109, 'Mt', 'Meitnerium', 278.0, 1.29],
  [110, 'Ds', 'Darmstadtium', 281.0, 1.28],
  [111, 'Rg', 'Roentgenium', 282.0, 1.21],
  [112, 'Cn', 'Copernicium', 285.0, 1.22],
  [113, 'Nh', 'Nihonium', 286.0, 1.36],
  [114, 'Fl', 'Flerovium', 289.0, 1.43],
  [115, 'Mc', 'Moscovium', 290.0, 1.62],
  [116, 'Lv', 'Livermorium', 293.0, 1.75],
  [117, 'Ts', 'Tennessine', 294.0, 1.65],
  [118, 'Og', 'Oganesson', 294.0, 1.57]
];

export const ELEMENT_BY_SYMBOL = new Map<string, ElementInfo>();
export const ELEMENT_BY_Z = new Map<number, ElementInfo>();

for (const [z, symbol, name, mass, covalentRadius] of RAW_ELEMENTS) {
  const info: ElementInfo = { z, symbol, name, mass, covalentRadius };
  ELEMENT_BY_SYMBOL.set(symbol.toLowerCase(), info);
  ELEMENT_BY_Z.set(z, info);
}

export function lookupElement(raw: string): ElementInfo | undefined {
  const cleaned = raw.trim().replace(/:$/, '').replace(/\(\d+\)$/, '');
  if (/^\d+$/.test(cleaned)) {
    return ELEMENT_BY_Z.get(parseInt(cleaned, 10));
  }
  return ELEMENT_BY_SYMBOL.get(cleaned.toLowerCase());
}

export function computeFormula(atoms: { element: string; isGhost?: boolean }[]): string {
  const counts = new Map<string, number>();
  let ghostCount = 0;
  for (const a of atoms) {
    if (a.isGhost) {
      ghostCount++;
      continue;
    }
    const el = lookupElement(a.element)?.symbol ?? a.element;
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  // Hill system: C first, H second, then alphabetical
  const keys = Array.from(counts.keys());
  const ordered: string[] = [];
  if (counts.has('C')) {
    ordered.push('C');
    if (counts.has('H')) {
      ordered.push('H');
    }
  }
  for (const k of keys.sort()) {
    if (!ordered.includes(k)) {
      ordered.push(k);
    }
  }
  const base = ordered
    .map((el) => {
      const n = counts.get(el)!;
      return n > 1 ? `${el}${n}` : el;
    })
    .join('');
  return ghostCount > 0 ? `${base} (+${ghostCount} ghost)` : base || 'Empty';
}
