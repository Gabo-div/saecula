// Guided prayers: Rosary (decade form) plus section-based prayers, all trilingual.
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

export interface GuidedSection {
  title: Record<PrayerLang, string>;
  steps: GuidedStep[];
}

export interface GuidedPrayer {
  id: string;
  title: Record<PrayerLang, string>;
  subtitle: Record<PrayerLang, string>;
  intro: Record<PrayerLang, string>;
  rosary?: { opening: GuidedStep[]; decade: GuidedStep[]; closing: GuidedStep[] };
  sections?: GuidedSection[];
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
  rosary: {
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
  },
};

export const ANGELUS: GuidedPrayer = {
  id: 'angelus',
  title: {
    en: 'The Angelus',
    es: 'El Ángelus',
    la: 'Angelus',
  },
  subtitle: {
    en: 'In honor of the Incarnation',
    es: 'En honor de la Encarnación',
    la: 'In honorem Incarnationis',
  },
  intro: {
    en: 'Traditionally prayed at dawn, noon, and dusk, alternating versicle and response, with a Hail Mary after each.',
    es: 'Se reza tradicionalmente al amanecer, al mediodía y al atardecer, alternando versículo y respuesta, con un Ave María después de cada uno.',
    la: 'Traditur oratio mane, meridie et vespere, versiculo et responsorio alternis, Ave Maria post singulos.',
  },
  sections: [
    {
      title: {
        en: 'The Angelus',
        es: 'El Ángelus',
        la: 'Angelus',
      },
      steps: [
        {
          label: {
            en: 'V. / R.',
            es: 'V. / R.',
            la: 'V. / R.',
          },
          body: {
            en: 'The Angel of the Lord declared unto Mary,\nand she conceived of the Holy Spirit.',
            es: 'El Ángel del Señor anunció a María,\ny concibió por obra del Espíritu Santo.',
            la: 'Angelus Domini nuntiavit Mariae,\net concepit de Spiritu Sancto.',
          },
        },
        {
          label: {
            en: 'Hail Mary',
            es: 'Ave María',
            la: 'Ave Maria',
          },
          prayerId: 'hail-mary',
        },
        {
          label: {
            en: 'V. / R.',
            es: 'V. / R.',
            la: 'V. / R.',
          },
          body: {
            en: 'Behold the handmaid of the Lord.\nBe it done unto me according to thy word.',
            es: 'He aquí la esclava del Señor.\nHágase en mí según tu palabra.',
            la: 'Ecce ancilla Domini.\nFiat mihi secundum verbum tuum.',
          },
        },
        {
          label: {
            en: 'Hail Mary',
            es: 'Ave María',
            la: 'Ave Maria',
          },
          prayerId: 'hail-mary',
        },
        {
          label: {
            en: 'V. / R.',
            es: 'V. / R.',
            la: 'V. / R.',
          },
          body: {
            en: 'And the Word was made flesh,\nand dwelt among us.',
            es: 'Y el Verbo se hizo carne,\ny habitó entre nosotros.',
            la: 'Et Verbum caro factum est,\net habitavit in nobis.',
          },
        },
        {
          label: {
            en: 'Hail Mary',
            es: 'Ave María',
            la: 'Ave Maria',
          },
          prayerId: 'hail-mary',
        },
        {
          label: {
            en: 'V. / R.',
            es: 'V. / R.',
            la: 'V. / R.',
          },
          body: {
            en: 'Pray for us, O holy Mother of God,\nthat we may be made worthy of the promises of Christ.',
            es: 'Ruega por nosotros, Santa Madre de Dios,\npara que seamos dignos de alcanzar las promesas de Cristo.',
            la: 'Ora pro nobis, sancta Dei Genetrix,\nut digni efficiamur promissionibus Christi.',
          },
        },
        {
          label: {
            en: 'Let us pray',
            es: 'Oremos',
            la: 'Oremus',
          },
          body: {
            en: 'Pour forth, we beseech thee, O Lord, thy grace into our hearts, that we, to whom the Incarnation of Christ thy Son was made known by the message of an angel, may by his Passion and Cross be brought to the glory of his Resurrection. Through the same Christ our Lord. Amen.',
            es: 'Derrama, Señor, tu gracia en nuestros corazones, para que, quienes hemos conocido, por el anuncio del ángel, la Encarnación de tu Hijo Jesucristo, lleguemos, por su Pasión y su Cruz, a la gloria de la Resurrección. Por el mismo Cristo nuestro Señor. Amén.',
            la: 'Gratiam tuam, quaesumus, Domine, mentibus nostris infunde; ut qui, angelo nuntiante, Christi Filii tui Incarnationem cognovimus, per passionem eius et crucem, ad resurrectionis gloriam perducamur. Per eundem Christum Dominum nostrum. Amen.',
          },
        },
      ],
    },
  ],
};

const STATION_NAMES: RosaryMystery[] = [
  {
    title: {
      en: '1. Jesus is condemned to death',
      es: '1. Jesús es condenado a muerte',
      la: '1. Iesus morte condemnatur',
    },
  },
  {
    title: {
      en: '2. Jesus takes up his cross',
      es: '2. Jesús carga con la cruz',
      la: '2. Iesus crucem accipit',
    },
  },
  {
    title: {
      en: '3. Jesus falls the first time',
      es: '3. Jesús cae por primera vez',
      la: '3. Iesus primum cadit',
    },
  },
  {
    title: {
      en: '4. Jesus meets his mother',
      es: '4. Jesús encuentra a su madre',
      la: '4. Iesus matrem suam obviat',
    },
  },
  {
    title: {
      en: '5. Simon of Cyrene helps Jesus carry the cross',
      es: '5. Simón de Cirene ayuda a Jesús a llevar la cruz',
      la: '5. Simon Cyrenaeus Iesum crucem baiulare adiuvat',
    },
  },
  {
    title: {
      en: '6. Veronica wipes the face of Jesus',
      es: '6. Verónica limpia el rostro de Jesús',
      la: '6. Veronica faciem Iesu tergit',
    },
  },
  {
    title: {
      en: '7. Jesus falls the second time',
      es: '7. Jesús cae por segunda vez',
      la: '7. Iesus iterum cadit',
    },
  },
  {
    title: {
      en: '8. Jesus meets the women of Jerusalem',
      es: '8. Jesús encuentra a las mujeres de Jerusalén',
      la: '8. Iesus mulieres Ierusalem obviat',
    },
  },
  {
    title: {
      en: '9. Jesus falls the third time',
      es: '9. Jesús cae por tercera vez',
      la: '9. Iesus tertium cadit',
    },
  },
  {
    title: {
      en: '10. Jesus is stripped of his garments',
      es: '10. Jesús es despojado de sus vestiduras',
      la: '10. Iesus vestibus spoliatur',
    },
  },
  {
    title: {
      en: '11. Jesus is nailed to the cross',
      es: '11. Jesús es clavado en la cruz',
      la: '11. Iesus cruci affigitur',
    },
  },
  {
    title: {
      en: '12. Jesus dies on the cross',
      es: '12. Jesús muere en la cruz',
      la: '12. Iesus in cruce moritur',
    },
  },
  {
    title: {
      en: '13. Jesus is taken down from the cross',
      es: '13. Jesús es bajado de la cruz',
      la: '13. Iesus de cruce deponitur',
    },
  },
  {
    title: {
      en: '14. Jesus is laid in the tomb',
      es: '14. Jesús es sepultado',
      la: '14. Iesus in sepulcro ponitur',
    },
  },
];

export const STATIONS: GuidedPrayer = {
  id: 'stations',
  title: {
    en: 'Stations of the Cross',
    es: 'Vía Crucis',
    la: 'Via Crucis',
  },
  subtitle: {
    en: "A meditation on Christ's Passion",
    es: 'Meditación de la Pasión de Cristo',
    la: 'Meditatio passionis Christi',
  },
  intro: {
    en: 'At each station, adore Christ with the versicle and response, then pray an Our Father, a Hail Mary, and a Glory Be.',
    es: 'En cada estación, adora a Cristo con el versículo y la respuesta, y luego reza un Padre Nuestro, un Ave María y un Gloria.',
    la: 'In singulis stationibus Christum versiculo et responsorio adora, deinde ora Pater Noster, Ave Maria et Gloria Patri.',
  },
  sections: STATION_NAMES.map((station) => ({
    title: station.title,
    steps: [
      {
        label: {
          en: 'V. / R.',
          es: 'V. / R.',
          la: 'V. / R.',
        },
        body: {
          en: 'We adore you, O Christ, and we bless you.\nBecause by your holy cross you have redeemed the world.',
          es: 'Te adoramos, oh Cristo, y te bendecimos.\nQue por tu santa cruz redimiste al mundo.',
          la: 'Adoramus te, Christe, et benedicimus tibi.\nQuia per sanctam crucem tuam redemisti mundum.',
        },
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
          en: 'Hail Mary',
          es: 'Ave María',
          la: 'Ave Maria',
        },
        prayerId: 'hail-mary',
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
  })),
};

const MERCY_DECADE_LABELS: Record<PrayerLang, string>[] = [
  { en: 'Decade 1', es: 'Primera decena', la: 'Prima decas' },
  { en: 'Decade 2', es: 'Segunda decena', la: 'Secunda decas' },
  { en: 'Decade 3', es: 'Tercera decena', la: 'Tertia decas' },
  { en: 'Decade 4', es: 'Cuarta decena', la: 'Quarta decas' },
  { en: 'Decade 5', es: 'Quinta decena', la: 'Quinta decas' },
];

export const DIVINE_MERCY: GuidedPrayer = {
  id: 'divine-mercy',
  title: {
    en: 'Divine Mercy Chaplet',
    es: 'Coronilla de la Divina Misericordia',
    la: 'Corona Divinae Misericordiae',
  },
  subtitle: {
    en: 'Trust in the mercy of God',
    es: 'Confianza en la misericordia de Dios',
    la: 'Fiducia in misericordia Dei',
  },
  intro: {
    en: 'Prayed on rosary beads. After the opening prayers, on each decade offer the Eternal Father on the large bead and the pardon plea ten times on the small beads. Conclude with the Trisagion three times.',
    es: 'Se reza con las cuentas del rosario. Tras las oraciones iniciales, en cada decena ofrece el Padre Eterno en la cuenta grande y la súplica diez veces en las cuentas pequeñas. Termina con el Trisagio tres veces.',
    la: 'Oratur globulis rosarii. Post orationes initiales, in singulis decadibus Patrem Aeternum in globulo maiore offer et deprecationem decies in globulis minoribus. Conclude Trisagio ter dicto.',
  },
  sections: [
    {
      title: {
        en: 'Opening',
        es: 'Inicio',
        la: 'Initium',
      },
      steps: [
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
            en: 'Our Father',
            es: 'Padre Nuestro',
            la: 'Pater Noster',
          },
          prayerId: 'our-father',
        },
        {
          label: {
            en: 'Hail Mary',
            es: 'Ave María',
            la: 'Ave Maria',
          },
          prayerId: 'hail-mary',
        },
        {
          label: {
            en: "Apostles' Creed",
            es: 'Credo de los Apóstoles',
            la: 'Symbolum Apostolorum',
          },
          prayerId: 'apostles-creed',
        },
      ],
    },
    ...MERCY_DECADE_LABELS.map((label) => ({
      title: label,
      steps: [
        {
          label: {
            en: 'Eternal Father',
            es: 'Padre Eterno',
            la: 'Pater Aeterne',
          },
          body: {
            en: 'Eternal Father, I offer you the Body and Blood, Soul and Divinity of your dearly beloved Son, our Lord Jesus Christ, in atonement for our sins and those of the whole world.',
            es: 'Padre Eterno, te ofrezco el Cuerpo y la Sangre, el Alma y la Divinidad de tu amadísimo Hijo, nuestro Señor Jesucristo, en expiación de nuestros pecados y los del mundo entero.',
            la: 'Pater Aeterne, offero tibi Corpus et Sanguinem, Animam et Divinitatem dilectissimi Filii tui, Domini nostri Iesu Christi, in propitiatione pro peccatis nostris et totius mundi.',
          },
        },
        {
          label: {
            en: 'For the sake of His sorrowful Passion',
            es: 'Por su dolorosa Pasión',
            la: 'Per dolorosam Passionem eius',
          },
          repeat: 10,
          body: {
            en: 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.',
            es: 'Por su dolorosa Pasión, ten misericordia de nosotros y del mundo entero.',
            la: 'Per dolorosam Passionem eius, miserere nobis et totius mundi.',
          },
        },
      ],
    })),
    {
      title: {
        en: 'Closing',
        es: 'Conclusión',
        la: 'Conclusio',
      },
      steps: [
        {
          label: {
            en: 'Holy God',
            es: 'Dios Santo',
            la: 'Sanctus Deus',
          },
          repeat: 3,
          body: {
            en: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.',
            es: 'Dios Santo, Santo Fuerte, Santo Inmortal, ten misericordia de nosotros y del mundo entero.',
            la: 'Sanctus Deus, Sanctus Fortis, Sanctus Immortalis, miserere nobis et totius mundi.',
          },
        },
      ],
    },
  ],
};

export const GUIDED: GuidedPrayer[] = [ROSARY, ANGELUS, STATIONS, DIVINE_MERCY];
