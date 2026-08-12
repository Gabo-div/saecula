// The navigable structure of the Catechism, transcribed from the Holy See's
// table of contents (vatican.va, Spanish). Navigation is Part → Article: each
// part lists its chapters as headers and its articles as tappable rows scoped
// to a paragraph range. Article ranges span their sub-paragraphs where the
// article itself carries no explicit range.
//
// Labels are Spanish (the structure); the paragraph text served by the backend
// is English for now.

export interface CatechismEntry {
  label: string;
  header?: boolean; // a non-tappable chapter/section title
  from?: number; // present → a tappable article scoped to [from, to]
  to?: number;
}

export interface CatechismPart {
  key: 'creed' | 'sacraments' | 'life' | 'prayer';
  roman: string;
  from: number;
  to: number;
  entries: CatechismEntry[];
}

// The Prologue precedes the four pillars.
export const CATECHISM_PROLOGUE = { from: 1, to: 25 };

export const CATECHISM_PARTS: CatechismPart[] = [
  {
    key: 'creed',
    roman: 'I',
    from: 1,
    to: 1065,
    entries: [
      { label: 'El hombre es «capaz» de Dios', from: 27, to: 49 },
      { label: 'Dios al encuentro del hombre', header: true },
      { label: 'La Revelación de Dios', from: 51, to: 73 },
      { label: 'La transmisión de la Revelación divina', from: 74, to: 100 },
      { label: 'La Sagrada Escritura', from: 101, to: 141 },
      { label: 'La respuesta del hombre a Dios', header: true },
      { label: 'Creo', from: 144, to: 165 },
      { label: 'Creemos', from: 166, to: 184 },
      { label: 'Creo en Dios Padre', header: true },
      { label: 'Creo en Dios, Padre todopoderoso, creador', from: 199, to: 421 },
      { label: 'Creo en Jesucristo, Hijo único de Dios', header: true },
      { label: 'Y en Jesucristo, su único Hijo, Nuestro Señor', from: 430, to: 455 },
      { label: 'Concebido por el Espíritu Santo, nació de María Virgen', from: 456, to: 570 },
      { label: 'Padeció bajo Poncio Pilato, fue crucificado y sepultado', from: 571, to: 630 },
      { label: 'Descendió a los infiernos, al tercer día resucitó', from: 631, to: 658 },
      { label: 'Subió a los cielos, está sentado a la derecha del Padre', from: 659, to: 667 },
      { label: 'Desde allí ha de venir a juzgar a vivos y muertos', from: 668, to: 682 },
      { label: 'Creo en el Espíritu Santo', header: true },
      { label: 'Creo en el Espíritu Santo', from: 687, to: 747 },
      { label: 'Creo en la Santa Iglesia Católica', from: 748, to: 975 },
      { label: 'Creo en el perdón de los pecados', from: 976, to: 987 },
      { label: 'Creo en la resurrección de la carne', from: 988, to: 1019 },
      { label: 'Creo en la vida eterna', from: 1020, to: 1065 },
    ],
  },
  {
    key: 'sacraments',
    roman: 'II',
    from: 1066,
    to: 1690,
    entries: [
      { label: 'El misterio pascual en el tiempo de la Iglesia', header: true },
      { label: 'La liturgia, obra de la Santísima Trinidad', from: 1077, to: 1112 },
      { label: 'El misterio pascual en los sacramentos de la Iglesia', from: 1113, to: 1134 },
      { label: 'La celebración sacramental del misterio pascual', header: true },
      { label: 'Celebrar la Liturgia de la Iglesia', from: 1136, to: 1199 },
      { label: 'Diversidad litúrgica y unidad del misterio', from: 1200, to: 1209 },
      { label: 'Los sacramentos de la iniciación cristiana', header: true },
      { label: 'El sacramento del Bautismo', from: 1213, to: 1284 },
      { label: 'El sacramento de la Confirmación', from: 1285, to: 1321 },
      { label: 'El sacramento de la Eucaristía', from: 1322, to: 1419 },
      { label: 'Los sacramentos de curación', header: true },
      { label: 'La Penitencia y la Reconciliación', from: 1422, to: 1498 },
      { label: 'La Unción de los enfermos', from: 1499, to: 1532 },
      { label: 'Los sacramentos al servicio de la comunidad', header: true },
      { label: 'El sacramento del Orden', from: 1536, to: 1600 },
      { label: 'El sacramento del Matrimonio', from: 1601, to: 1666 },
      { label: 'Otras celebraciones litúrgicas', header: true },
      { label: 'Los sacramentales', from: 1667, to: 1679 },
      { label: 'Las exequias cristianas', from: 1680, to: 1690 },
    ],
  },
  {
    key: 'life',
    roman: 'III',
    from: 1691,
    to: 2557,
    entries: [
      { label: 'La dignidad de la persona humana', header: true },
      { label: 'El hombre, imagen de Dios', from: 1701, to: 1715 },
      { label: 'Nuestra vocación a la bienaventuranza', from: 1716, to: 1729 },
      { label: 'La libertad del hombre', from: 1730, to: 1748 },
      { label: 'La moralidad de los actos humanos', from: 1749, to: 1761 },
      { label: 'La moralidad de las pasiones', from: 1762, to: 1775 },
      { label: 'La conciencia moral', from: 1776, to: 1802 },
      { label: 'Las virtudes', from: 1803, to: 1845 },
      { label: 'El pecado', from: 1846, to: 1876 },
      { label: 'La comunidad humana', header: true },
      { label: 'La persona y la sociedad', from: 1878, to: 1896 },
      { label: 'La participación en la vida social', from: 1897, to: 1927 },
      { label: 'La justicia social', from: 1928, to: 1948 },
      { label: 'La salvación de Dios: la ley y la gracia', header: true },
      { label: 'La ley moral', from: 1950, to: 1986 },
      { label: 'Gracia y justificación', from: 1987, to: 2029 },
      { label: 'La Iglesia, madre y maestra', from: 2030, to: 2051 },
      { label: 'Los Diez Mandamientos — «Amarás al Señor tu Dios»', header: true },
      { label: 'El primer mandamiento', from: 2084, to: 2141 },
      { label: 'El segundo mandamiento', from: 2142, to: 2167 },
      { label: 'El tercer mandamiento', from: 2168, to: 2195 },
      { label: '«Amarás a tu prójimo como a ti mismo»', header: true },
      { label: 'El cuarto mandamiento', from: 2197, to: 2257 },
      { label: 'El quinto mandamiento', from: 2258, to: 2330 },
      { label: 'El sexto mandamiento', from: 2331, to: 2400 },
      { label: 'El séptimo mandamiento', from: 2401, to: 2463 },
      { label: 'El octavo mandamiento', from: 2464, to: 2513 },
      { label: 'El noveno mandamiento', from: 2514, to: 2533 },
      { label: 'El décimo mandamiento', from: 2534, to: 2557 },
    ],
  },
  {
    key: 'prayer',
    roman: 'IV',
    from: 2558,
    to: 2865,
    entries: [
      { label: 'La revelación de la oración', header: true },
      { label: 'En el Antiguo Testamento', from: 2568, to: 2597 },
      { label: 'En la plenitud de los tiempos', from: 2598, to: 2622 },
      { label: 'En el tiempo de la Iglesia', from: 2623, to: 2649 },
      { label: 'La tradición de la oración', header: true },
      { label: 'Fuentes de la oración', from: 2652, to: 2662 },
      { label: 'El camino de la oración', from: 2663, to: 2682 },
      { label: 'Maestros de oración', from: 2683, to: 2696 },
      { label: 'La vida de oración', header: true },
      { label: 'Expresiones de la oración', from: 2700, to: 2724 },
      { label: 'El combate de la oración', from: 2725, to: 2758 },
      { label: 'La oración del Señor: «Padre Nuestro»', header: true },
      { label: '«Resumen de todo el Evangelio»', from: 2761, to: 2776 },
      { label: '«Padre nuestro que estás en el cielo»', from: 2777, to: 2802 },
      { label: 'Las siete peticiones', from: 2803, to: 2865 },
    ],
  },
];
