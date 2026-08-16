'use client'

import { useState } from 'react'

type Lang = 'es' | 'en' | 'la'

interface Prayer {
  id: string
  title: { es: string; en: string; la: string }
  text: { es: string; en: string; la: string }
}

const PRAYERS: Prayer[] = [
  {
    id: 'sign-of-cross',
    title: { es: 'Señal de la Cruz', en: 'Sign of the Cross', la: 'Signum Crucis' },
    text: {
      es: 'En el nombre del Padre, y del Hijo, y del Espíritu Santo. Amén.',
      en: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
      la: 'In nomine Patris, et Filii, et Spiritus Sancti. Amen.',
    },
  },
  {
    id: 'our-father',
    title: { es: 'Padre Nuestro', en: 'Our Father', la: 'Pater Noster' },
    text: {
      es: 'Padre nuestro, que estás en el cielo, santificado sea tu nombre; venga a nosotros tu reino; hágase tu voluntad en la tierra como en el cielo. Danos hoy nuestro pan de cada día; perdona nuestras ofensas, como también nosotros perdonamos a los que nos ofenden; no nos dejes caer en la tentación, y líbranos del mal. Amén.',
      en: 'Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.',
      la: 'Pater noster, qui es in caelis, sanctificetur nomen tuum; adveniat regnum tuum; fiat voluntas tua, sicut in caelo et in terra. Panem nostrum quotidianum da nobis hodie; et dimitte nobis debita nostra, sicut et nos dimittimus debitoribus nostris; et ne nos inducas in tentationem, sed libera nos a malo. Amen.',
    },
  },
  {
    id: 'hail-mary',
    title: { es: 'Dios te salve, María', en: 'Hail Mary', la: 'Ave Maria' },
    text: {
      es: 'Dios te salve, María, llena eres de gracia; el Señor es contigo; bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén.',
      en: 'Hail Mary, full of grace, the Lord is with thee; blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
      la: 'Ave Maria, gratia plena, Dominus tecum; benedicta tu in mulieribus, et benedictus fructus ventris tui, Iesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.',
    },
  },
  {
    id: 'glory-be',
    title: { es: 'Gloria al Padre', en: 'Glory Be', la: 'Gloria Patri' },
    text: {
      es: 'Gloria al Padre, y al Hijo, y al Espíritu Santo. Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.',
      en: 'Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.',
      la: 'Gloria Patri, et Filio, et Spiritui Sancto. Sicut erat in principio, et nunc, et semper, in saecula saeculorum. Amen.',
    },
  },
  {
    id: 'apostles-creed',
    title: { es: 'Credo de los Apóstoles', en: "Apostles' Creed", la: 'Symbolum Apostolorum' },
    text: {
      es: 'Creo en Dios, Padre todopoderoso, Creador del cielo y de la tierra. Creo en Jesucristo, su único Hijo, nuestro Señor, que fue concebido por obra y gracia del Espíritu Santo, nació de Santa María Virgen, padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado, descendió a los infiernos, al tercer día resucitó de entre los muertos, subió a los cielos y está sentado a la diestra de Dios, Padre todopoderoso, de donde vendrá a juzgar a vivos y muertos. Creo en el Espíritu Santo, la Santa Iglesia católica, la comunión de los santos, el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén.',
      en: 'I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, His only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried; He descended into hell; the third day He rose again from the dead; He ascended into heaven, and is seated at the right hand of God the Father almighty; from thence He shall come to judge the living and the dead. I believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.',
      la: 'Credo in Deum, Patrem omnipotentem, Creatorem caeli et terrae. Et in Iesum Christum, Filium eius unicum, Dominum nostrum, qui conceptus est de Spiritu Sancto, natus ex Maria Virgine, passus sub Pontio Pilato, crucifixus, mortuus, et sepultus, descendit ad inferos, tertia die resurrexit a mortuis, ascendit ad caelos, sedet ad dexteram Dei Patris omnipotentis, inde venturus est iudicare vivos et mortuos. Credo in Spiritum Sanctum, sanctam Ecclesiam catholicam, Sanctorum communionem, remissionem peccatorum, carnis resurrectionem, vitam aeternam. Amen.',
    },
  },
  {
    id: 'hail-holy-queen',
    title: { es: 'Dios te salve, Reina', en: 'Hail Holy Queen', la: 'Salve Regina' },
    text: {
      es: 'Dios te salve, Reina y Madre de misericordia, vida, dulzura y esperanza nuestra, Dios te salve. A ti llamamos los desterrados hijos de Eva; a ti suspiramos, gimiendo y llorando en este valle de lágrimas. Ea, pues, Señora, abogada nuestra, vuelve a nosotros esos tus ojos misericordiosos; y después de este destierro, muéstranos a Jesús, fruto bendito de tu vientre. Oh clemente, oh pia, oh dulce Virgen María. Ruega por nosotros, Santa Madre de Dios, para que seamos dignos de las promesas de Cristo. Amén.',
      en: 'Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope. To you do we cry, poor banished children of Eve. To you do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, your eyes of mercy toward us, and after this our exile, show unto us the blessed fruit of your womb, Jesus. O clement, O loving, O sweet Virgin Mary. Pray for us, O Holy Mother of God, that we may be made worthy of the promises of Christ. Amen.',
      la: 'Salve, Regina, Mater misericordiae, vita, dulcedo et spes nostra, salve. Ad te clamamus, exules filii Hevae. Ad te suspiramus, gementes et flentes in hac lacrimarum valle. Eia ergo, Advocata nostra, illos tuos misericordes oculos ad nos converte; et Iesum, benedictum fructum ventris tui, nobis post hoc exilium ostende. O clemens, o pia, o dulcis Virgo Maria. Ora pro nobis, sancta Dei Genetrix, ut digni efficiamur promissionibus Christi. Amen.',
    },
  },
  {
    id: 'guardian-angel',
    title: { es: 'Ángel de la Guarda', en: 'Guardian Angel', la: 'Angele Dei' },
    text: {
      es: 'Ángel de la Guarda, dulce compañía, no me desampares ni de día ni de noche, no me desampares hasta que me recibas en la paz de Dios. Amén.',
      en: 'Angel of God, my guardian dear, to whom God\'s love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen.',
      la: 'Angele Dei, qui custos es mei, me tibi commissum pietate superna, hodie custodi, rege, et guberna. Amen.',
    },
  },
  {
    id: 'act-of-contrition',
    title: { es: 'Acto de Contrición', en: 'Act of Contrition', la: 'Actus Contritionis' },
    text: {
      es: 'Señor mío, Jesucristo, Dios y Hombre verdadero, Padre, Hijo y Espíritu Santo, ten piedad de mí miserable pecador. Te ofrezco y prometo con tu gracia, de confesar mis pecados, de enmendar mi vida y hacer penitencia. Amén.',
      en: 'O my God, I am heartily sorry for having offended Thee, and I detest all my sins because of Thy just punishments, but most of all because they offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasions of sin. Amen.',
      la: 'Deus meus, ex toto corde paenitet me omnium meorum peccatorum, eaque detestor, quia peccando, non solum poenas a te iuste statutas meritus sum, sed praesertim quia offendi te, summum bonum, ac dignum qui super omnia diligaris. Ideo firmiter propono, adiuvante gratia tua, peccata mea de cetero relinquere et peccandi causas proximas vitare. Amen.',
    },
  },
]

const LANG_LABELS: Record<Lang, string> = { es: 'Español', en: 'English', la: 'Latina' }

export default function PrayersPage() {
  const [lang, setLang] = useState<Lang>('es')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = PRAYERS.find((p) => p.id === selectedId)

  if (selected) {
    return (
      <div>
        <div className="reader-controls" style={{ marginBottom: 16 }}>
          <button onClick={() => setSelectedId(null)}>← Volver</button>
        </div>

        <div className="reader-lang-tabs">
          {(['es', 'en', 'la'] as Lang[]).map((l) => (
            <button
              key={l}
              className={`reader-lang-tab ${lang === l ? 'active' : ''}`}
              onClick={() => setLang(l)}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>

        <h1 className="reader-page-title">{selected.title[lang]}</h1>
        <div className="reader-prayer-detail">{selected.text[lang]}</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="reader-page-title">Oraciones</h1>

      <div className="reader-lang-tabs">
        {(['es', 'en', 'la'] as Lang[]).map((l) => (
          <button
            key={l}
            className={`reader-lang-tab ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PRAYERS.map((p) => (
          <div
            key={p.id}
            className="reader-prayer-card"
            onClick={() => setSelectedId(p.id)}
          >
            <h3>{p.title[lang]}</h3>
            <p>{p.text[lang].slice(0, 80)}...</p>
          </div>
        ))}
      </div>
    </div>
  )
}
