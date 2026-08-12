export type PrayerLang = 'en' | 'es' | 'la';

export interface Prayer {
  id: string;
  title: Record<PrayerLang, string>;
  text: Record<PrayerLang, string>;
}

export const PRAYERS: Prayer[] = [
  {
    id: 'sign-of-the-cross',
    title: {
      en: 'Sign of the Cross',
      es: 'Señal de la Cruz',
      la: 'Signum Crucis',
    },
    text: {
      en: 'In the name of the Father,\nand of the Son,\nand of the Holy Spirit.\nAmen.',
      es: 'En el nombre del Padre,\ny del Hijo,\ny del Espíritu Santo.\nAmén.',
      la: 'In nomine Patris,\net Filii,\net Spiritus Sancti.\nAmen.',
    },
  },
  {
    id: 'our-father',
    title: {
      en: 'Our Father',
      es: 'Padre Nuestro',
      la: 'Pater Noster',
    },
    text: {
      en: 'Our Father, who art in heaven,\nhallowed be thy name;\nthy kingdom come,\nthy will be done\non earth as it is in heaven.\nGive us this day our daily bread,\nand forgive us our trespasses,\nas we forgive those who trespass against us;\nand lead us not into temptation,\nbut deliver us from evil.\nAmen.',
      es: 'Padre nuestro, que estás en el cielo,\nsantificado sea tu Nombre;\nvenga a nosotros tu reino;\nhágase tu voluntad\nen la tierra como en el cielo.\nDanos hoy nuestro pan de cada día;\nperdona nuestras ofensas,\ncomo también nosotros perdonamos a los que nos ofenden;\nno nos dejes caer en la tentación,\ny líbranos del mal.\nAmén.',
      la: 'Pater noster, qui es in caelis,\nsanctificetur nomen tuum.\nAdveniat regnum tuum.\nFiat voluntas tua,\nsicut in caelo et in terra.\nPanem nostrum quotidianum da nobis hodie,\net dimitte nobis debita nostra,\nsicut et nos dimittimus debitoribus nostris.\nEt ne nos inducas in tentationem,\nsed libera nos a malo.\nAmen.',
    },
  },
  {
    id: 'hail-mary',
    title: {
      en: 'Hail Mary',
      es: 'Ave María',
      la: 'Ave Maria',
    },
    text: {
      en: 'Hail Mary, full of grace,\nthe Lord is with thee;\nblessed art thou amongst women,\nand blessed is the fruit of thy womb, Jesus.\nHoly Mary, Mother of God,\npray for us sinners,\nnow and at the hour of our death.\nAmen.',
      es: 'Dios te salve, María, llena eres de gracia,\nel Señor es contigo;\nbendita tú eres entre todas las mujeres,\ny bendito es el fruto de tu vientre, Jesús.\nSanta María, Madre de Dios,\nruega por nosotros, pecadores,\nahora y en la hora de nuestra muerte.\nAmén.',
      la: 'Ave Maria, gratia plena,\nDominus tecum.\nBenedicta tu in mulieribus,\net benedictus fructus ventris tui, Iesus.\nSancta Maria, Mater Dei,\nora pro nobis peccatoribus,\nnunc et in hora mortis nostrae.\nAmen.',
    },
  },
  {
    id: 'glory-be',
    title: {
      en: 'Glory Be',
      es: 'Gloria',
      la: 'Gloria Patri',
    },
    text: {
      en: 'Glory be to the Father,\nand to the Son,\nand to the Holy Spirit.\nAs it was in the beginning,\nis now, and ever shall be,\nworld without end.\nAmen.',
      es: 'Gloria al Padre,\ny al Hijo,\ny al Espíritu Santo.\nComo era en el principio,\nahora y siempre,\npor los siglos de los siglos.\nAmén.',
      la: 'Gloria Patri,\net Filio,\net Spiritui Sancto.\nSicut erat in principio,\net nunc, et semper,\net in saecula saeculorum.\nAmen.',
    },
  },
  {
    id: 'apostles-creed',
    title: {
      en: "Apostles' Creed",
      es: 'Credo de los Apóstoles',
      la: 'Symbolum Apostolorum',
    },
    text: {
      en: 'I believe in God,\nthe Father almighty,\nCreator of heaven and earth,\nand in Jesus Christ, his only Son, our Lord,\nwho was conceived by the Holy Spirit,\nborn of the Virgin Mary,\nsuffered under Pontius Pilate,\nwas crucified, died and was buried;\nhe descended into hell;\non the third day he rose again from the dead;\nhe ascended into heaven,\nand is seated at the right hand of God the Father almighty;\nfrom there he will come to judge the living and the dead.\nI believe in the Holy Spirit,\nthe holy catholic Church,\nthe communion of saints,\nthe forgiveness of sins,\nthe resurrection of the body,\nand life everlasting.\nAmen.',
      es: 'Creo en Dios,\nPadre todopoderoso,\nCreador del cielo y de la tierra.\nCreo en Jesucristo, su único Hijo, nuestro Señor,\nque fue concebido por obra y gracia del Espíritu Santo,\nnació de Santa María Virgen,\npadeció bajo el poder de Poncio Pilato,\nfue crucificado, muerto y sepultado,\ndescendió a los infiernos,\nal tercer día resucitó de entre los muertos,\nsubió a los cielos\ny está sentado a la derecha de Dios, Padre todopoderoso.\nDesde allí ha de venir a juzgar a vivos y muertos.\nCreo en el Espíritu Santo,\nla santa Iglesia católica,\nla comunión de los santos,\nel perdón de los pecados,\nla resurrección de la carne\ny la vida eterna.\nAmén.',
      la: 'Credo in Deum Patrem omnipotentem,\nCreatorem caeli et terrae.\nEt in Iesum Christum, Filium eius unicum, Dominum nostrum,\nqui conceptus est de Spiritu Sancto,\nnatus ex Maria Virgine,\npassus sub Pontio Pilato,\ncrucifixus, mortuus, et sepultus,\ndescendit ad inferos,\ntertia die resurrexit a mortuis,\nascendit ad caelos,\nsedet ad dexteram Dei Patris omnipotentis,\ninde venturus est iudicare vivos et mortuos.\nCredo in Spiritum Sanctum,\nsanctam Ecclesiam catholicam,\nsanctorum communionem,\nremissionem peccatorum,\ncarnis resurrectionem,\nvitam aeternam.\nAmen.',
    },
  },
  {
    id: 'hail-holy-queen',
    title: {
      en: 'Hail Holy Queen',
      es: 'Salve Regina',
      la: 'Salve Regina',
    },
    text: {
      en: 'Hail, holy Queen, Mother of Mercy,\nour life, our sweetness, and our hope.\nTo thee do we cry,\npoor banished children of Eve;\nto thee do we send up our sighs,\nmourning and weeping in this valley of tears.\nTurn then, most gracious Advocate,\nthine eyes of mercy toward us;\nand after this our exile,\nshow unto us the blessed fruit of thy womb, Jesus.\nO clement, O loving, O sweet Virgin Mary.\nPray for us, O holy Mother of God,\nthat we may be made worthy of the promises of Christ.\nAmen.',
      es: 'Dios te salve, Reina y Madre de misericordia,\nvida, dulzura y esperanza nuestra; Dios te salve.\nA ti llamamos los desterrados hijos de Eva;\na ti suspiramos, gimiendo y llorando,\nen este valle de lágrimas.\nEa, pues, Señora, abogada nuestra,\nvuelve a nosotros esos tus ojos misericordiosos;\ny después de este destierro,\nmuéstranos a Jesús, fruto bendito de tu vientre.\n¡Oh clementísima, oh piadosa, oh dulce Virgen María!\nRuega por nosotros, Santa Madre de Dios,\npara que seamos dignos de alcanzar las promesas de nuestro Señor Jesucristo.\nAmén.',
      la: 'Salve, Regina, Mater misericordiae,\nvita, dulcedo, et spes nostra, salve.\nAd te clamamus, exsules filii Hevae.\nAd te suspiramus, gementes et flentes\nin hac lacrimarum valle.\nEia ergo, advocata nostra,\nillos tuos misericordes oculos ad nos converte.\nEt Iesum, benedictum fructum ventris tui,\nnobis post hoc exsilium ostende.\nO clemens, O pia, O dulcis Virgo Maria.\nOra pro nobis, sancta Dei Genetrix,\nut digni efficiamur promissionibus Christi.\nAmen.',
    },
  },
  {
    id: 'guardian-angel',
    title: {
      en: 'Guardian Angel Prayer',
      es: 'Ángel de la Guarda',
      la: 'Angele Dei',
    },
    text: {
      en: 'Angel of God,\nmy guardian dear,\nto whom God’s love commits me here,\never this day be at my side,\nto light and guard,\nto rule and guide.\nAmen.',
      es: 'Ángel de la Guarda,\ndulce compañía,\nno me desampares\nni de noche ni de día.\nNo me dejes solo,\nque me perdería.\nAmén.',
      la: 'Angele Dei,\nqui custos es mei,\nme tibi commissum pietate superna,\nhodie illumina, custodi,\nrege et guberna.\nAmen.',
    },
  },
  {
    id: 'act-of-contrition',
    title: {
      en: 'Act of Contrition',
      es: 'Acto de Contrición',
      la: 'Actus Contritionis',
    },
    text: {
      en: 'O my God,\nI am heartily sorry for having offended Thee,\nand I detest all my sins,\nbecause I dread the loss of heaven and the pains of hell;\nbut most of all because they offend Thee, my God,\nwho art all good and deserving of all my love.\nI firmly resolve, with the help of Thy grace,\nto confess my sins, to do penance,\nand to amend my life.\nAmen.',
      es: 'Señor mío Jesucristo,\nDios y Hombre verdadero,\nCreador, Padre y Redentor mío;\npor ser Tú quien eres, Bondad infinita,\ny porque te amo sobre todas las cosas,\nme pesa de todo corazón haberte ofendido.\nTambién me pesa porque puedes castigarme\ncon las penas del infierno.\nAyudado de tu divina gracia,\npropongo firmemente nunca más pecar,\nconfesarme y cumplir la penitencia que me fuere impuesta.\nAmén.',
      la: 'Deus meus,\nex toto corde paenitet me omnium meorum peccatorum,\neaque detestor, quia peccando,\nnon solum poenas a te iuste statutas promeritus sum,\nsed praesertim quia offendi te,\nsummum bonum, ac dignum qui super omnia diligaris.\nIdeo firmiter propono,\nadiuvante gratia tua,\nde cetero me non peccaturum peccandique occasiones proximas fugiturum.\nAmen.',
    },
  },
];
