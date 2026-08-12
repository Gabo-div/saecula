import type { PrayerLang } from './prayers';

export interface RosaryMystery {
  title: Record<PrayerLang, string>;
}

export interface MysterySet {
  id: 'joyful' | 'sorrowful' | 'glorious' | 'luminous';
  name: Record<PrayerLang, string>;
  days: number[];
  mysteries: RosaryMystery[];
}

export interface GuidedStep {
  label: Record<PrayerLang, string>;
  prayerId?: string;
  body?: Record<PrayerLang, string>;
  repeat?: number;
}

export interface GuidedPrayer {
  id: string;
  title: Record<PrayerLang, string>;
  subtitle: Record<PrayerLang, string>;
  intro: Record<PrayerLang, string>;
  opening: GuidedStep[];
  decade: GuidedStep[];
  closing: GuidedStep[];
}

export const MYSTERY_SETS: MysterySet[] = [
  {
    id: 'joyful',
    name: {
      en: 'The Joyful Mysteries',
      es: 'Los Misterios Gozosos',
      la: 'Mysteria Gaudiosa',
    },
    days: [1, 6],
    mysteries: [
      {
        title: {
          en: 'The Annunciation',
          es: 'La Anunciación',
          la: 'Annuntiatio',
        },
      },
      {
        title: {
          en: 'The Visitation',
          es: 'La Visitación',
          la: 'Visitatio',
        },
      },
      {
        title: {
          en: 'The Nativity',
          es: 'El Nacimiento de Jesús',
          la: 'Nativitas',
        },
      },
      {
        title: {
          en: 'The Presentation in the Temple',
          es: 'La Presentación en el Templo',
          la: 'Praesentatio in Templo',
        },
      },
      {
        title: {
          en: 'The Finding in the Temple',
          es: 'El Niño Jesús perdido y hallado en el Templo',
          la: 'Inventio in Templo',
        },
      },
    ],
  },
  {
    id: 'luminous',
    name: {
      en: 'The Luminous Mysteries',
      es: 'Los Misterios Luminosos',
      la: 'Mysteria Luminosa',
    },
    days: [4],
    mysteries: [
      {
        title: {
          en: 'The Baptism in the Jordan',
          es: 'El Bautismo en el Jordán',
          la: 'Baptismus in Iordane',
        },
      },
      {
        title: {
          en: 'The Wedding at Cana',
          es: 'Las Bodas de Caná',
          la: 'Nuptiae in Cana',
        },
      },
      {
        title: {
          en: 'The Proclamation of the Kingdom',
          es: 'El Anuncio del Reino de Dios',
          la: 'Proclamatio Regni Dei',
        },
      },
      {
        title: {
          en: 'The Transfiguration',
          es: 'La Transfiguración',
          la: 'Transfiguratio',
        },
      },
      {
        title: {
          en: 'The Institution of the Eucharist',
          es: 'La Institución de la Eucaristía',
          la: 'Institutio Eucharistiae',
        },
      },
    ],
  },
  {
    id: 'sorrowful',
    name: {
      en: 'The Sorrowful Mysteries',
      es: 'Los Misterios Dolorosos',
      la: 'Mysteria Dolorosa',
    },
    days: [2, 5],
    mysteries: [
      {
        title: {
          en: 'The Agony in the Garden',
          es: 'La Oración en el Huerto',
          la: 'Agonia in Horto',
        },
      },
      {
        title: {
          en: 'The Scourging at the Pillar',
          es: 'La Flagelación',
          la: 'Flagellatio',
        },
      },
      {
        title: {
          en: 'The Crowning with Thorns',
          es: 'La Coronación de Espinas',
          la: 'Coronatio Spinis',
        },
      },
      {
        title: {
          en: 'The Carrying of the Cross',
          es: 'Jesús con la Cruz a cuestas',
          la: 'Baiulatio Crucis',
        },
      },
      {
        title: {
          en: 'The Crucifixion',
          es: 'La Crucifixión y Muerte de Jesús',
          la: 'Crucifixio',
        },
      },
    ],
  },
  {
    id: 'glorious',
    name: {
      en: 'The Glorious Mysteries',
      es: 'Los Misterios Gloriosos',
      la: 'Mysteria Gloriosa',
    },
    days: [0, 3],
    mysteries: [
      {
        title: {
          en: 'The Resurrection',
          es: 'La Resurrección',
          la: 'Resurrectio',
        },
      },
      {
        title: {
          en: 'The Ascension',
          es: 'La Ascensión',
          la: 'Ascensio',
        },
      },
      {
        title: {
          en: 'The Descent of the Holy Spirit',
          es: 'La Venida del Espíritu Santo',
          la: 'Descensus Spiritus Sancti',
        },
      },
      {
        title: {
          en: 'The Assumption of Mary',
          es: 'La Asunción de María',
          la: 'Assumptio Mariae',
        },
      },
      {
        title: {
          en: 'The Coronation of Mary',
          es: 'La Coronación de María',
          la: 'Coronatio Mariae',
        },
      },
    ],
  },
];

export const ROSARY: GuidedPrayer = {
  id: 'rosary',
  title: {
    en: 'The Holy Rosary',
    es: 'El Santo Rosario',
    la: 'Sacratissimum Rosarium',
  },
  subtitle: {
    en: 'A meditation on the life of Christ',
    es: 'Meditación de la vida de Cristo',
    la: 'Meditatio vitae Christi',
  },
  intro: {
    en: 'Begin with the sign of the cross. For each decade, announce the mystery, then pray an Our Father, ten Hail Marys, a Glory Be, and the Fátima Prayer. Conclude with the Hail Holy Queen.',
    es: 'Comienza con la señal de la cruz. En cada decena, anuncia el misterio y reza un Padre Nuestro, diez Ave Marías, un Gloria y la Oración de Fátima. Termina con la Salve.',
    la: 'Incipe signo crucis. In singulis decadibus mysterium enuntia, deinde ora Pater Noster, decem Ave Maria, Gloria Patri et orationem Fatimensem. Conclude Salve Regina.',
  },
  opening: [
    {
      label: {
        en: 'Sign of the Cross',
        es: 'Señal de la Cruz',
        la: 'Signum Crucis',
      },
      prayerId: 'sign-of-the-cross',
    },
    {
      label: {
        en: "Apostles' Creed",
        es: 'Credo de los Apóstoles',
        la: 'Symbolum Apostolorum',
      },
      prayerId: 'apostles-creed',
    },
    {
      label: {
        en: 'Our Father',
        es: 'Padre Nuestro',
        la: 'Pater Noster',
      },
      prayerId: 'our-father',
    },
    {
      label: {
        en: 'Three Hail Marys',
        es: 'Tres Ave Marías',
        la: 'Tria Ave Maria',
      },
      prayerId: 'hail-mary',
      repeat: 3,
    },
    {
      label: {
        en: 'Glory Be',
        es: 'Gloria',
        la: 'Gloria Patri',
      },
      prayerId: 'glory-be',
    },
  ],
  decade: [
    {
      label: {
        en: 'Our Father',
        es: 'Padre Nuestro',
        la: 'Pater Noster',
      },
      prayerId: 'our-father',
    },
    {
      label: {
        en: 'Ten Hail Marys',
        es: 'Diez Ave Marías',
        la: 'Decem Ave Maria',
      },
      prayerId: 'hail-mary',
      repeat: 10,
    },
    {
      label: {
        en: 'Glory Be',
        es: 'Gloria',
        la: 'Gloria Patri',
      },
      prayerId: 'glory-be',
    },
    {
      label: {
        en: 'Fátima Prayer',
        es: 'Oración de Fátima',
        la: 'Oratio Fatimensis',
      },
      body: {
        en: 'O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to Heaven, especially those most in need of Thy mercy.',
        es: 'Oh Jesús mío, perdona nuestros pecados, líbranos del fuego del infierno, lleva al cielo a todas las almas, especialmente a las más necesitadas de tu misericordia.',
        la: 'O mi Iesu, dimitte nobis debita nostra, libera nos ab igne inferni, conduc in caelum omnes animas, praesertim illas quae maxime indigent misericordia tua.',
      },
    },
  ],
  closing: [
    {
      label: {
        en: 'Hail Holy Queen',
        es: 'Salve',
        la: 'Salve Regina',
      },
      prayerId: 'hail-holy-queen',
    },
  ],
};

export const GUIDED: GuidedPrayer[] = [ROSARY];
