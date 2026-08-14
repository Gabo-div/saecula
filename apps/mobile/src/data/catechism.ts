// The navigable structure of the Catechism, transcribed from the Holy See's
// table of contents (vatican.va). Navigation is Part → Article: each part lists
// its chapters as headers and its articles as tappable rows scoped to a
// paragraph range. Article ranges span their sub-paragraphs where the article
// itself carries no explicit range.
//
// Every label/name is trilingual (English, Spanish, Latin), matching the
// official published titles. The paragraph text served by the backend is
// English for now.

export type CatechismLang = 'en' | 'es' | 'la';

export interface CatechismEntry {
  label: Record<CatechismLang, string>;
  header?: boolean; // a non-tappable chapter/section title
  from?: number; // present → a tappable article scoped to [from, to]
  to?: number;
}

export interface CatechismPart {
  key: 'creed' | 'sacraments' | 'life' | 'prayer';
  roman: string;
  from: number;
  to: number;
  name: Record<CatechismLang, string>;
  entries: CatechismEntry[];
}

// The Prologue precedes the four pillars.
export const CATECHISM_PROLOGUE: { from: number; to: number; label: Record<CatechismLang, string> } = {
  from: 1,
  to: 25,
  label: { en: 'Prologue', es: 'Prólogo', la: 'Prologus' },
};

export const CATECHISM_PARTS: CatechismPart[] = [
  {
    key: 'creed',
    roman: 'I',
    from: 1,
    to: 1065,
    name: { en: 'The Profession of Faith', es: 'La profesión de la fe', la: 'Professio fidei' },
    entries: [
      { label: { en: 'Man’s Capacity for God', es: 'El hombre es «capaz» de Dios', la: 'Homo Dei «capax»' }, from: 27, to: 49 },
      { label: { en: 'God Comes to Meet Man', es: 'Dios al encuentro del hombre', la: 'Deus homini obviam venit' }, header: true },
      { label: { en: 'The Revelation of God', es: 'La Revelación de Dios', la: 'Revelatio Dei' }, from: 51, to: 73 },
      { label: { en: 'The Transmission of Divine Revelation', es: 'La transmisión de la Revelación divina', la: 'Transmissio divinae Revelationis' }, from: 74, to: 100 },
      { label: { en: 'Sacred Scripture', es: 'La Sagrada Escritura', la: 'Sacra Scriptura' }, from: 101, to: 141 },
      { label: { en: 'Man’s Response to God', es: 'La respuesta del hombre a Dios', la: 'Hominis ad Deum responsio' }, header: true },
      { label: { en: 'I Believe', es: 'Creo', la: 'Credo' }, from: 144, to: 165 },
      { label: { en: 'We Believe', es: 'Creemos', la: 'Credimus' }, from: 166, to: 184 },
      { label: { en: 'I Believe in God the Father', es: 'Creo en Dios Padre', la: 'Credo in Deum Patrem' }, header: true },
      { label: { en: 'I Believe in God, the Father Almighty, Creator', es: 'Creo en Dios, Padre todopoderoso, creador', la: 'Credo in Deum, Patrem omnipotentem, Creatorem' }, from: 199, to: 421 },
      { label: { en: 'I Believe in Jesus Christ, the Only Son of God', es: 'Creo en Jesucristo, Hijo único de Dios', la: 'Credo in Iesum Christum, Filium Dei unicum' }, header: true },
      { label: { en: 'And in Jesus Christ, His Only Son, Our Lord', es: 'Y en Jesucristo, su único Hijo, Nuestro Señor', la: 'Et in Iesum Christum, Filium Eius unicum, Dominum nostrum' }, from: 430, to: 455 },
      { label: { en: 'Conceived by the Holy Spirit, Born of the Virgin Mary', es: 'Concebido por el Espíritu Santo, nació de María Virgen', la: 'Qui conceptus est de Spiritu Sancto, natus ex Maria Virgine' }, from: 456, to: 570 },
      { label: { en: 'Suffered under Pontius Pilate, Was Crucified and Buried', es: 'Padeció bajo Poncio Pilato, fue crucificado y sepultado', la: 'Passus sub Pontio Pilato, crucifixus et sepultus' }, from: 571, to: 630 },
      { label: { en: 'He Descended into Hell, on the Third Day He Rose Again', es: 'Descendió a los infiernos, al tercer día resucitó', la: 'Descendit ad inferos, tertia die resurrexit' }, from: 631, to: 658 },
      { label: { en: 'He Ascended into Heaven, Is Seated at the Right Hand of the Father', es: 'Subió a los cielos, está sentado a la derecha del Padre', la: 'Ascendit ad caelos, sedet ad dexteram Patris' }, from: 659, to: 667 },
      { label: { en: 'From Thence He Will Come to Judge the Living and the Dead', es: 'Desde allí ha de venir a juzgar a vivos y muertos', la: 'Inde venturus est iudicare vivos et mortuos' }, from: 668, to: 682 },
      { label: { en: 'I Believe in the Holy Spirit', es: 'Creo en el Espíritu Santo', la: 'Credo in Spiritum Sanctum' }, header: true },
      { label: { en: 'I Believe in the Holy Spirit', es: 'Creo en el Espíritu Santo', la: 'Credo in Spiritum Sanctum' }, from: 687, to: 747 },
      { label: { en: 'I Believe in the Holy Catholic Church', es: 'Creo en la Santa Iglesia Católica', la: 'Credo in sanctam Ecclesiam catholicam' }, from: 748, to: 975 },
      { label: { en: 'I Believe in the Forgiveness of Sins', es: 'Creo en el perdón de los pecados', la: 'Credo in remissionem peccatorum' }, from: 976, to: 987 },
      { label: { en: 'I Believe in the Resurrection of the Body', es: 'Creo en la resurrección de la carne', la: 'Credo in carnis resurrectionem' }, from: 988, to: 1019 },
      { label: { en: 'I Believe in Life Everlasting', es: 'Creo en la vida eterna', la: 'Credo in vitam aeternam' }, from: 1020, to: 1065 },
    ],
  },
  {
    key: 'sacraments',
    roman: 'II',
    from: 1066,
    to: 1690,
    name: { en: 'The Celebration of the Christian Mystery', es: 'La celebración del misterio cristiano', la: 'Celebratio mysterii christiani' },
    entries: [
      { label: { en: 'The Paschal Mystery in the Age of the Church', es: 'El misterio pascual en el tiempo de la Iglesia', la: 'Mysterium paschale in tempore Ecclesiae' }, header: true },
      { label: { en: 'The Liturgy — Work of the Holy Trinity', es: 'La liturgia, obra de la Santísima Trinidad', la: 'Liturgia, opus Sanctissimae Trinitatis' }, from: 1077, to: 1112 },
      { label: { en: 'The Paschal Mystery in the Church’s Sacraments', es: 'El misterio pascual en los sacramentos de la Iglesia', la: 'Mysterium paschale in sacramentis Ecclesiae' }, from: 1113, to: 1134 },
      { label: { en: 'The Sacramental Celebration of the Paschal Mystery', es: 'La celebración sacramental del misterio pascual', la: 'Celebratio sacramentalis mysterii paschalis' }, header: true },
      { label: { en: 'Celebrating the Church’s Liturgy', es: 'Celebrar la Liturgia de la Iglesia', la: 'Liturgiam Ecclesiae celebrare' }, from: 1136, to: 1199 },
      { label: { en: 'Liturgical Diversity and the Unity of the Mystery', es: 'Diversidad litúrgica y unidad del misterio', la: 'Diversitas liturgica et mysterii unitas' }, from: 1200, to: 1209 },
      { label: { en: 'The Sacraments of Christian Initiation', es: 'Los sacramentos de la iniciación cristiana', la: 'Sacramenta initiationis christianae' }, header: true },
      { label: { en: 'The Sacrament of Baptism', es: 'El sacramento del Bautismo', la: 'Sacramentum Baptismi' }, from: 1213, to: 1284 },
      { label: { en: 'The Sacrament of Confirmation', es: 'El sacramento de la Confirmación', la: 'Sacramentum Confirmationis' }, from: 1285, to: 1321 },
      { label: { en: 'The Sacrament of the Eucharist', es: 'El sacramento de la Eucaristía', la: 'Sacramentum Eucharistiae' }, from: 1322, to: 1419 },
      { label: { en: 'The Sacraments of Healing', es: 'Los sacramentos de curación', la: 'Sacramenta sanationis' }, header: true },
      { label: { en: 'The Sacrament of Penance and Reconciliation', es: 'La Penitencia y la Reconciliación', la: 'Sacramentum Poenitentiae et Reconciliationis' }, from: 1422, to: 1498 },
      { label: { en: 'The Anointing of the Sick', es: 'La Unción de los enfermos', la: 'Unctio infirmorum' }, from: 1499, to: 1532 },
      { label: { en: 'The Sacraments at the Service of Communion', es: 'Los sacramentos al servicio de la comunidad', la: 'Sacramenta in servitium communionis' }, header: true },
      { label: { en: 'The Sacrament of Holy Orders', es: 'El sacramento del Orden', la: 'Sacramentum Ordinis' }, from: 1536, to: 1600 },
      { label: { en: 'The Sacrament of Matrimony', es: 'El sacramento del Matrimonio', la: 'Sacramentum Matrimonii' }, from: 1601, to: 1666 },
      { label: { en: 'Other Liturgical Celebrations', es: 'Otras celebraciones litúrgicas', la: 'Aliae celebrationes liturgicae' }, header: true },
      { label: { en: 'Sacramentals', es: 'Los sacramentales', la: 'Sacramentalia' }, from: 1667, to: 1679 },
      { label: { en: 'Christian Funerals', es: 'Las exequias cristianas', la: 'Exsequiae christianae' }, from: 1680, to: 1690 },
    ],
  },
  {
    key: 'life',
    roman: 'III',
    from: 1691,
    to: 2557,
    name: { en: 'Life in Christ', es: 'La vida en Cristo', la: 'Vita in Christo' },
    entries: [
      { label: { en: 'The Dignity of the Human Person', es: 'La dignidad de la persona humana', la: 'Dignitas personae humanae' }, header: true },
      { label: { en: 'Man: The Image of God', es: 'El hombre, imagen de Dios', la: 'Homo imago Dei' }, from: 1701, to: 1715 },
      { label: { en: 'Our Vocation to Beatitude', es: 'Nuestra vocación a la bienaventuranza', la: 'Vocatio nostra ad beatitudinem' }, from: 1716, to: 1729 },
      { label: { en: 'Man’s Freedom', es: 'La libertad del hombre', la: 'Libertas hominis' }, from: 1730, to: 1748 },
      { label: { en: 'The Morality of Human Acts', es: 'La moralidad de los actos humanos', la: 'Moralitas actuum humanorum' }, from: 1749, to: 1761 },
      { label: { en: 'The Morality of the Passions', es: 'La moralidad de las pasiones', la: 'Moralitas passionum' }, from: 1762, to: 1775 },
      { label: { en: 'Moral Conscience', es: 'La conciencia moral', la: 'Conscientia moralis' }, from: 1776, to: 1802 },
      { label: { en: 'The Virtues', es: 'Las virtudes', la: 'Virtutes' }, from: 1803, to: 1845 },
      { label: { en: 'Sin', es: 'El pecado', la: 'Peccatum' }, from: 1846, to: 1876 },
      { label: { en: 'The Human Community', es: 'La comunidad humana', la: 'Communitas humana' }, header: true },
      { label: { en: 'The Person and Society', es: 'La persona y la sociedad', la: 'Persona et societas' }, from: 1878, to: 1896 },
      { label: { en: 'Participation in Social Life', es: 'La participación en la vida social', la: 'Participatio vitae socialis' }, from: 1897, to: 1927 },
      { label: { en: 'Social Justice', es: 'La justicia social', la: 'Iustitia socialis' }, from: 1928, to: 1948 },
      { label: { en: 'God’s Salvation: Law and Grace', es: 'La salvación de Dios: la ley y la gracia', la: 'Salus Dei: lex et gratia' }, header: true },
      { label: { en: 'The Moral Law', es: 'La ley moral', la: 'Lex moralis' }, from: 1950, to: 1986 },
      { label: { en: 'Grace and Justification', es: 'Gracia y justificación', la: 'Gratia et iustificatio' }, from: 1987, to: 2029 },
      { label: { en: 'The Church, Mother and Teacher', es: 'La Iglesia, madre y maestra', la: 'Ecclesia, mater et magistra' }, from: 2030, to: 2051 },
      { label: { en: 'The Ten Commandments — «You Shall Love the Lord Your God»', es: 'Los Diez Mandamientos — «Amarás al Señor tu Dios»', la: 'Decem praecepta — «Diliges Dominum Deum tuum»' }, header: true },
      { label: { en: 'The First Commandment', es: 'El primer mandamiento', la: 'Primum praeceptum' }, from: 2084, to: 2141 },
      { label: { en: 'The Second Commandment', es: 'El segundo mandamiento', la: 'Secundum praeceptum' }, from: 2142, to: 2167 },
      { label: { en: 'The Third Commandment', es: 'El tercer mandamiento', la: 'Tertium praeceptum' }, from: 2168, to: 2195 },
      { label: { en: '«You Shall Love Your Neighbor as Yourself»', es: '«Amarás a tu prójimo como a ti mismo»', la: '«Diliges proximum tuum sicut teipsum»' }, header: true },
      { label: { en: 'The Fourth Commandment', es: 'El cuarto mandamiento', la: 'Quartum praeceptum' }, from: 2197, to: 2257 },
      { label: { en: 'The Fifth Commandment', es: 'El quinto mandamiento', la: 'Quintum praeceptum' }, from: 2258, to: 2330 },
      { label: { en: 'The Sixth Commandment', es: 'El sexto mandamiento', la: 'Sextum praeceptum' }, from: 2331, to: 2400 },
      { label: { en: 'The Seventh Commandment', es: 'El séptimo mandamiento', la: 'Septimum praeceptum' }, from: 2401, to: 2463 },
      { label: { en: 'The Eighth Commandment', es: 'El octavo mandamiento', la: 'Octavum praeceptum' }, from: 2464, to: 2513 },
      { label: { en: 'The Ninth Commandment', es: 'El noveno mandamiento', la: 'Nonum praeceptum' }, from: 2514, to: 2533 },
      { label: { en: 'The Tenth Commandment', es: 'El décimo mandamiento', la: 'Decimum praeceptum' }, from: 2534, to: 2557 },
    ],
  },
  {
    key: 'prayer',
    roman: 'IV',
    from: 2558,
    to: 2865,
    name: { en: 'Christian Prayer', es: 'La oración cristiana', la: 'Oratio christiana' },
    entries: [
      { label: { en: 'The Revelation of Prayer', es: 'La revelación de la oración', la: 'Revelatio orationis' }, header: true },
      { label: { en: 'In the Old Testament', es: 'En el Antiguo Testamento', la: 'In Vetere Testamento' }, from: 2568, to: 2597 },
      { label: { en: 'In the Fullness of Time', es: 'En la plenitud de los tiempos', la: 'In plenitudine temporis' }, from: 2598, to: 2622 },
      { label: { en: 'In the Age of the Church', es: 'En el tiempo de la Iglesia', la: 'In tempore Ecclesiae' }, from: 2623, to: 2649 },
      { label: { en: 'The Tradition of Prayer', es: 'La tradición de la oración', la: 'Traditio orationis' }, header: true },
      { label: { en: 'At the Wellsprings of Prayer', es: 'Fuentes de la oración', la: 'Fontes orationis' }, from: 2652, to: 2662 },
      { label: { en: 'The Way of Prayer', es: 'El camino de la oración', la: 'Via orationis' }, from: 2663, to: 2682 },
      { label: { en: 'Guides for Prayer', es: 'Maestros de oración', la: 'Duces ad orationem' }, from: 2683, to: 2696 },
      { label: { en: 'The Life of Prayer', es: 'La vida de oración', la: 'Vita orationis' }, header: true },
      { label: { en: 'Expressions of Prayer', es: 'Expresiones de la oración', la: 'Expressiones orationis' }, from: 2700, to: 2724 },
      { label: { en: 'The Battle of Prayer', es: 'El combate de la oración', la: 'Orationis dimicatio' }, from: 2725, to: 2758 },
      { label: { en: 'The Lord’s Prayer: «Our Father!»', es: 'La oración del Señor: «Padre Nuestro»', la: 'Oratio dominica: «Pater noster!»' }, header: true },
      { label: { en: '«The Summary of the Whole Gospel»', es: '«Resumen de todo el Evangelio»', la: '«Totius Evangelii breviarium»' }, from: 2761, to: 2776 },
      { label: { en: '«Our Father Who Art in Heaven»', es: '«Padre nuestro que estás en el cielo»', la: '«Pater noster qui es in caelis»' }, from: 2777, to: 2802 },
      { label: { en: 'The Seven Petitions', es: 'Las siete peticiones', la: 'Septem petitiones' }, from: 2803, to: 2865 },
    ],
  },
];
