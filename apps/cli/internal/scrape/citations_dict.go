package scrape

import (
	"strings"
)

// citationKey folds a name into a stable dictionary key: lowercase, accents
// stripped (reusing accentFolder), periods removed, whitespace collapsed.
func citationKey(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = accentFolder.Replace(s)
	s = strings.ReplaceAll(s, ".", "")
	return strings.Join(strings.Fields(s), " ")
}

// ---------------------------------------------------------------------------
// Papal documents (encyclicals, apostolic constitutions/exhortations, motu
// proprios) cited by name in the plain text — not always hyperlinked. Keys are
// folded (citationKey); values are canonical ids.
// ---------------------------------------------------------------------------

var papalDocIDs = map[string]string{
	"munificentissimus deus":       "DOC.MUNIFICENTISSIMUS_DEUS",
	"humanae vitae":                "DOC.HUMANAE_VITAE",
	"evangelium vitae":             "DOC.EVANGELIUM_VITAE",
	"veritatis splendor":           "DOC.VERITATIS_SPLENDOR",
	"fides et ratio":               "DOC.FIDES_ET_RATIO",
	"laudato si":                   "DOC.LAUDATO_SI",
	"deus caritas est":             "DOC.DEUS_CARITAS_EST",
	"caritas in veritate":          "DOC.CARITAS_IN_VERITATE",
	"familiaris consortio":         "DOC.FAMILIARIS_CONSORTIO",
	"reconciliatio et paenitentia": "DOC.RECONCILIATIO_PAENITENTIA",
	"dominicae cenae":              "DOC.DOMINICAE_CENAE",
	"mysterium fidei":              "DOC.MYSTERIUM_FIDEI",
	"mysterium et ministerium":     "DOC.MYSTERIUM_ET_MINISTERIUM",
	"christifideles laici":         "DOC.CHRISTIFIDELES_LAICI",
	"redemptor hominis":            "DOC.REDEMPTOR_HOMINIS",
	"redemptoris missio":           "DOC.REDEMPTORIS_MISSIO",
	"dominum et vivificantem":      "DOC.DOMINUM_ET_VIVIFICANTEM",
	"ut unum sint":                 "DOC.UT_UNUM_SINT",
	"evangelium nuntiandi":         "DOC.EVANGELIUM_NUNTIANDI",
	"marialis cultus":              "DOC.MARIALIS_CULTUS",
	"fidei donum":                  "DOC.FIDEI_DONUM",
	"hae sunt nostrae":             "DOC.HAE_SUNT_NOSTRAE",
	"quas primas":                  "DOC.QUAS_PRIMAS",
	"divini illius magistri":       "DOC.DIVINI_ILLIUS_MAGISTRI",
	"casti connubii":               "DOC.CASTI_CONNUBII",
	"mortalium animos":             "DOC.MORTALIUM_ANIMOS",
	"mit brennender sorge":         "DOC.MIT_BRENNENDER_SORGE",
	"mystici corporis":             "DOC.MYSTICI_CORPORIS",
	"mediator dei":                 "DOC.MEDIATOR_DEI",
	"humani generis":               "DOC.HUMANI_GENERIS",
	"aeterni patris":               "DOC.AETERNI_PATRIS",
	"providentissimus deus":        "DOC.PROVIDENTISSIMUS_DEUS",
	"rerum novarum":                "DOC.RERUM_NOVARUM",
	"quadragesimo anno":            "DOC.QUADRAGESIMO_ANNO",
	"mater et magistra":            "DOC.MATER_ET_MAGISTRA",
	"pacem in terris":              "DOC.PACEM_IN_TERRIS",
	"populorum progressio":         "DOC.POPULORUM_PROGRESSIO",
	"laborem exercens":             "DOC.LABOREM_EXERCENS",
	"solicitudo rei socialis":      "DOC.SOLICITUDO_REI_SOCIALIS",
	"centesimus annus":             "DOC.CENTESIMUS_ANNUS",
	"credo del pueblo de dios":     "DOC.CREDO_PUEBLO_DIOS",
	"creed of the people of god":   "DOC.CREDO_PUEBLO_DIOS",
	"fidei depositum":              "DOC.FIDEI_DEPOSITUM",
	"lumen fidei":                  "DOC.LUMEN_FIDEI",
	"spe salvi":                    "DOC.SPE_SALVI",
	"gaudete et exsultate":         "DOC.GAUDETE_ET_EXSULTATE",
	"dilexit nos":                  "DOC.DILEXIT_NOS",
}

// ---------------------------------------------------------------------------
// Vatican II documents — the most-cited sources, referenced by short
// abbreviations (LG, DV, GS, …) whose anchor text is stable across editions.
// ---------------------------------------------------------------------------

type vat2Doc struct {
	ID    string // canonical catalog id, e.g. "DOC.LG"
	Title string
	Kind  string // "constitution" | "decree" | "declaration"
	Date  string // ISO date of promulgation
}

var vat2Docs = map[string]vat2Doc{
	"LG": {"DOC.LG", "Lumen Gentium", "constitution", "1964-11-21"},
	"DV": {"DOC.DV", "Dei Verbum", "constitution", "1965-11-18"},
	"GS": {"DOC.GS", "Gaudium et Spes", "constitution", "1965-12-07"},
	"SC": {"DOC.SC", "Sacrosanctum Concilium", "constitution", "1963-12-04"},
	"AG": {"DOC.AG", "Ad Gentes", "decree", "1965-12-07"},
	"UR": {"DOC.UR", "Unitatis Redintegratio", "decree", "1964-11-21"},
	"AA": {"DOC.AA", "Apostolicam Actuositatem", "decree", "1965-11-18"},
	"DH": {"DOC.DH", "Dignitatis Humanae", "declaration", "1965-12-07"},
	"OT": {"DOC.OT", "Optatam Totius", "decree", "1965-10-28"},
	"CD": {"DOC.CD", "Christus Dominus", "decree", "1965-10-28"},
	"PO": {"DOC.PO", "Presbyterorum Ordinis", "decree", "1965-12-07"},
	"NA": {"DOC.NA", "Nostra Aetate", "declaration", "1965-10-28"},
	"GE": {"DOC.GE", "Gravissimum Educationis", "declaration", "1965-10-28"},
	"OE": {"DOC.OE", "Orientalium Ecclesiarum", "decree", "1964-11-21"},
}

// ---------------------------------------------------------------------------
// Councils — cited as "Concilio de Trento", "First Vatican Council",
// "Concilium Vaticanum I", etc. Values are canonical ids.
// ---------------------------------------------------------------------------

var councilIDs = map[string]string{
	// Spanish
	"concilio de nicea":              "COUNCIL.NICEA_I",
	"concilio de constantinopla":     "COUNCIL.CONSTANTINOPLE_I",
	"concilio de efeso":              "COUNCIL.EPHESUS",
	"concilio de calcedonia":         "COUNCIL.CHALCEDON",
	"concilio de letran":             "COUNCIL.LATERAN_IV",
	"concilio de vienne":             "COUNCIL.VIENNE",
	"concilio de constanza":          "COUNCIL.CONSTANCE",
	"concilio de florencia":          "COUNCIL.FLORENCE",
	"concilio de trento":             "COUNCIL.TRENT",
	"concilio vaticano i":            "COUNCIL.VATICAN_I",
	"concilio vaticano ii":           "COUNCIL.VATICAN_II",
	"concilio ecumenico vaticano i":  "COUNCIL.VATICAN_I",
	"concilio ecumenico vaticano ii": "COUNCIL.VATICAN_II",
	"vaticano i":                     "COUNCIL.VATICAN_I",
	"vaticano ii":                    "COUNCIL.VATICAN_II",
	// English
	"council of nicea":          "COUNCIL.NICEA_I",
	"council of ephesus":        "COUNCIL.EPHESUS",
	"council of chalcedon":      "COUNCIL.CHALCEDON",
	"council of trent":          "COUNCIL.TRENT",
	"first vatican council":     "COUNCIL.VATICAN_I",
	"second vatican council":    "COUNCIL.VATICAN_II",
	"vatican council i":         "COUNCIL.VATICAN_I",
	"vatican council ii":        "COUNCIL.VATICAN_II",
	"first council of nicea":    "COUNCIL.NICEA_I",
	"council of constantinople": "COUNCIL.CONSTANTINOPLE_I",
	"council of florence":       "COUNCIL.FLORENCE",
	"council of constance":      "COUNCIL.CONSTANCE",
	// Latin
	"concilium vaticanum i":   "COUNCIL.VATICAN_I",
	"concilium vaticanum ii":  "COUNCIL.VATICAN_II",
	"concilium tridentinum":   "COUNCIL.TRENT",
	"concilium nicaenum":      "COUNCIL.NICEA_I",
	"concilium ephesinum":     "COUNCIL.EPHESUS",
	"concilium chalcedonense": "COUNCIL.CHALCEDON",
}

// ---------------------------------------------------------------------------
// Saints and Doctors — normalized name -> canonical id. Keys cover Spanish,
// English and Latin variants (folded by citationKey).
// ---------------------------------------------------------------------------

var saintIDs = map[string]string{
	"agustin":                  "SAINT.AUGUSTINE",
	"san agustin":              "SAINT.AUGUSTINE",
	"augustine":                "SAINT.AUGUSTINE",
	"aurelius augustinus":      "SAINT.AUGUSTINE",
	"augustinus":               "SAINT.AUGUSTINE",
	"tomas de aquino":          "SAINT.THOMAS_AQUINAS",
	"tomas":                    "SAINT.THOMAS_AQUINAS",
	"aquinas":                  "SAINT.THOMAS_AQUINAS",
	"thomas aquinas":           "SAINT.THOMAS_AQUINAS",
	"thomas":                   "SAINT.THOMAS_AQUINAS",
	"ireneo":                   "SAINT.IRENAEUS",
	"irenaus":                  "SAINT.IRENAEUS",
	"irenée":                   "SAINT.IRENAEUS",
	"i renaus":                 "SAINT.IRENAEUS",
	"ambrosio":                 "SAINT.AMBROSE",
	"ambrose":                  "SAINT.AMBROSE",
	"ambrosius":                "SAINT.AMBROSE",
	"juan crisostomo":          "SAINT.JOHN_CHRYSOSTOM",
	"john chrysostom":          "SAINT.JOHN_CHRYSOSTOM",
	"crisostomo":               "SAINT.JOHN_CHRYSOSTOM",
	"chrysostom":               "SAINT.JOHN_CHRYSOSTOM",
	"ignacio de antioquia":     "SAINT.IGNATIUS_ANTIOCH",
	"ignatius of antioch":      "SAINT.IGNATIUS_ANTIOCH",
	"ignacio":                  "SAINT.IGNATIUS_ANTIOCH",
	"ignatius":                 "SAINT.IGNATIUS_ANTIOCH",
	"tertuliano":               "SAINT.TERTULLIAN",
	"tertullian":               "SAINT.TERTULLIAN",
	"cirilo":                   "SAINT.CYRIL",
	"cyril":                    "SAINT.CYRIL",
	"cirilo de alejandria":     "SAINT.CYRIL_ALEXANDRIA",
	"cirilo de jerusalen":      "SAINT.CYRIL_JERUSALEM",
	"justino":                  "SAINT.JUSTIN_MARTYR",
	"justin":                   "SAINT.JUSTIN_MARTYR",
	"justino martir":           "SAINT.JUSTIN_MARTYR",
	"justin martyr":            "SAINT.JUSTIN_MARTYR",
	"cipriano":                 "SAINT.CYPRIAN",
	"cyprian":                  "SAINT.CYPRIAN",
	"cipriano de cartago":      "SAINT.CYPRIAN",
	"cyprian of carthage":      "SAINT.CYPRIAN",
	"gregorio nacianceno":      "SAINT.GREGORY_NAZIANZEN",
	"gregory nazianzen":        "SAINT.GREGORY_NAZIANZEN",
	"gregorio de nazianzo":     "SAINT.GREGORY_NAZIANZEN",
	"leon magno":               "SAINT.LEO_THE_GREAT",
	"leo the great":            "SAINT.LEO_THE_GREAT",
	"leo i":                    "SAINT.LEO_THE_GREAT",
	"gregorio de nisa":         "SAINT.GREGORY_NYSSA",
	"gregory of nyssa":         "SAINT.GREGORY_NYSSA",
	"origenes":                 "SAINT.ORIGEN",
	"clemente":                 "SAINT.CLEMENT",
	"clemente de roma":         "SAINT.CLEMENT_ROME",
	"clement of rome":          "SAINT.CLEMENT_ROME",
	"juan damasceno":           "SAINT.JOHN_DAMASCENE",
	"john damascene":           "SAINT.JOHN_DAMASCENE",
	"gregorio magno":           "SAINT.GREGORY_THE_GREAT",
	"gregory the great":        "SAINT.GREGORY_THE_GREAT",
	"gregorio i":               "SAINT.GREGORY_THE_GREAT",
	"basilio":                  "SAINT.BASIL",
	"basil":                    "SAINT.BASIL",
	"basilio de cesarea":       "SAINT.BASIL",
	"basil of caesarea":        "SAINT.BASIL",
	"juan de la cruz":          "SAINT.JOHN_OF_THE_CROSS",
	"john of the cross":        "SAINT.JOHN_OF_THE_CROSS",
	"teresa de jesus":          "SAINT.TERESA_AVILA",
	"teresa de avila":          "SAINT.TERESA_AVILA",
	"teresa":                   "SAINT.TERESA_AVILA",
	"teresa of avila":          "SAINT.TERESA_AVILA",
	"atanasio":                 "SAINT.ATHANASIUS",
	"athanasius":               "SAINT.ATHANASIUS",
	"jeronimo":                 "SAINT.JEROME",
	"jerome":                   "SAINT.JEROME",
	"catalina de siena":        "SAINT.CATHERINE_SIENA",
	"catherine of siena":       "SAINT.CATHERINE_SIENA",
	"bernardo":                 "SAINT.BERNARD",
	"bernard":                  "SAINT.BERNARD",
	"bernardo de claraval":     "SAINT.BERNARD",
	"bernard of clairvaux":     "SAINT.BERNARD",
	"buenaventura":             "SAINT.BONAVENTURE",
	"bonaventure":              "SAINT.BONAVENTURE",
	"casiano":                  "SAINT.CASSIAN",
	"cassian":                  "SAINT.CASSIAN",
	"hilario":                  "SAINT.HILARY",
	"hilary":                   "SAINT.HILARY",
	"francisco de sales":       "SAINT.FRANCIS_SALES",
	"francis de sales":         "SAINT.FRANCIS_SALES",
	"anselmo":                  "SAINT.ANSELM",
	"anselm":                   "SAINT.ANSELM",
	"roberto belarmino":        "SAINT.ROBERT_BELLARMINE",
	"robert bellarmine":        "SAINT.ROBERT_BELLARMINE",
	"alfonso maria de ligorio": "SAINT.ALPHONSUS_LIGUORI",
	"alphonsus liguori":        "SAINT.ALPHONSUS_LIGUORI",
	"policarpo":                "SAINT.POLYCARP",
	"polycarp":                 "SAINT.POLYCARP",
	"efren":                    "SAINT.EPHREM",
	"ephrem":                   "SAINT.EPHREM",
	"eusebio":                  "SAINT.EUSEBIUS",
	"eusebius":                 "SAINT.EUSEBIUS",
	"fulgencio":                "SAINT.FULGENTIUS",
	"fulgentius":               "SAINT.FULGENTIUS",
	"pedro damian":             "SAINT.PETER_DAMIAN",
	"peter damian":             "SAINT.PETER_DAMIAN",
	"dionisio":                 "SAINT.DIONYSIUS",
	"dionysius":                "SAINT.DIONYSIUS",
	"vicente de lerins":        "SAINT.VINCENT_LERINS",
	"vincent of lerins":        "SAINT.VINCENT_LERINS",
}

// ---------------------------------------------------------------------------
// Patristic works — normalized title -> canonical work id. The saint prefix
// is baked in so a work is unambiguously attributed.
// ---------------------------------------------------------------------------

var workIDs = map[string]string{
	// Augustine
	"confessiones":                 "WORK.AUGUSTINE.CONFESSIONES",
	"confessions":                  "WORK.AUGUSTINE.CONFESSIONES",
	"de civitate dei":              "WORK.AUGUSTINE.CIVITATE_DEI",
	"the city of god":              "WORK.AUGUSTINE.CIVITATE_DEI",
	"de trinitate":                 "WORK.AUGUSTINE.TRINITATE",
	"on the trinity":               "WORK.AUGUSTINE.TRINITATE",
	"de libero arbitrio":           "WORK.AUGUSTINE.LIBERO_ARBITRIO",
	"de doctrina christiana":       "WORK.AUGUSTINE.DOCTRINA_CHRISTIANA",
	"on christian doctrine":        "WORK.AUGUSTINE.DOCTRINA_CHRISTIANA",
	"enchiridion":                  "WORK.AUGUSTINE.ENCHIRIDION",
	"de gratia et libero arbitrio": "WORK.AUGUSTINE.GRATIA_LIBERO_ARBITRIO",
	"de correptione et gratia":     "WORK.AUGUSTINE.CORREPTIONE_GRATIA",
	"de sancta virginitate":        "WORK.AUGUSTINE.SANCTA_VIRGINITATE",
	"in iohannis evangelium":       "WORK.AUGUSTINE.IN_IOHANNIS_EVANGELIUM",
	"sermones":                     "WORK.AUGUSTINE.SERMONES",
	"sermon":                       "WORK.AUGUSTINE.SERMONES",
	// Thomas Aquinas
	"summa theologiae":      "WORK.THOMAS.SUMMA_THEOLOGIAE",
	"summa theologica":      "WORK.THOMAS.SUMMA_THEOLOGIAE",
	"summa contra gentiles": "WORK.THOMAS.SUMMA_CONTRA_GENTILES",
	"summa contra gentes":   "WORK.THOMAS.SUMMA_CONTRA_GENTILES",
	"de malo":               "WORK.THOMAS.DE_MALO",
	"commentum in symbolum": "WORK.THOMAS.SYMBOLUM",
	// Irenaeus
	"adversus haereses":    "WORK.IRENAEUS.ADVERSUS_HAERESES",
	"against the heresies": "WORK.IRENAEUS.ADVERSUS_HAERESES",
	// Ambrose
	"de officiis":                        "WORK.AMBROSE.DE_OFFICIIS",
	"de sacramentis":                     "WORK.AMBROSE.DE_SACRAMENTIS",
	"de fide":                            "WORK.AMBROSE.DE_FIDE",
	"de spirito sancto":                  "WORK.AMBROSE.DE_SPIRITO_SANCTO",
	"expositio evangelii secundum lucam": "WORK.AMBROSE.LUCAM",
	// Chrysostom
	"in genesim homiliae":   "WORK.CHRYSOSTOM.IN_GENESIM",
	"homilies on matthew":   "WORK.CHRYSOSTOM.IN_MATTHEUM",
	"homiliae in matthaeum": "WORK.CHRYSOSTOM.IN_MATTHEUM",
	// Cyprian
	"de unitate ecclesiae":    "WORK.CYPRIAN.UNITATE_ECCLESIAE",
	"the unity of the church": "WORK.CYPRIAN.UNITATE_ECCLESIAE",
	// Gregory of Nyssa
	"de hominis opificio": "WORK.GREGORY_NYSSA.HOMINIS_OPIFICIO",
	// Basil
	"de spiritu sancto": "WORK.BASIL.DE_SPIRITU_SANCTO",
	// John Damascene
	"de fide orthodoxa": "WORK.JOHN_DAMASCENE.FIDE_ORTHODOXA",
	// John of the Cross
	"noche oscura":             "WORK.JOHN_CROSS.NOCHE_OSCURA",
	"canto espiritual":         "WORK.JOHN_CROSS.CANTICO_ESPIRITUAL",
	"subida del monte carmelo": "WORK.JOHN_CROSS.SUBIDA_CARMELO",
	// Teresa of Avila
	"camino de perfeccion": "WORK.TERESA.CAMINO_PERFECCION",
	"moradas":              "WORK.TERESA.MORADAS",
	// Tertullian
	"de praescriptione haereticorum": "WORK.TERTULLIAN.PRAESCRIPTIONE",
	// Ignatius of Antioch
	"ad romanos":      "WORK.IGNATIUS.AD_ROMANOS",
	"ad magnesios":    "WORK.IGNATIUS.AD_MAGNESIOS",
	"ad philippenses": "WORK.IGNATIUS.AD_PHILIPPENSES",
	// Origen
	"de principiis": "WORK.ORIGEN.DE_PRINCIPIIS",
	"contra celsum": "WORK.ORIGEN.CONTRA_CELSUM",
	// Bonaventure
	"itinerarium mentis in deum": "WORK.BONAVENTURE.ITINERARIUM",
	"itinerary of the mind":      "WORK.BONAVENTURE.ITINERARIUM",
}

// ---------------------------------------------------------------------------
// Liturgical texts and creeds — cited by name (Tropario, Misal, Credo, …).
// ---------------------------------------------------------------------------

var liturgicalIDs = map[string]string{
	"tropario":              "LIT.TROPARION",
	"troparium":             "LIT.TROPARION",
	"misal romano":          "LIT.ROMAN_MISSAL",
	"roman missal":          "LIT.ROMAN_MISSAL",
	"missale romanum":       "LIT.ROMAN_MISSAL",
	"canon romano":          "LIT.ROMAN_CANON",
	"roman canon":           "LIT.ROMAN_CANON",
	"liturgia de las horas": "LIT.LITURGY_OF_HOURS",
	"liturgy of the hours":  "LIT.LITURGY_OF_HOURS",
	"breviario":             "LIT.BREVIARY",
	"prefacio":              "LIT.PREFACE",
	"rito de la iniciacion cristiana de adultos": "LIT.RCIA",
	"rcia":               "LIT.RCIA",
	"exorcismos menores": "LIT.SMALL_EXORCISMS",
	"eucologio":          "LIT.EUCHOLOGION",
	"eucologion":         "LIT.EUCHOLOGION",
	"anaphora":           "LIT.ANAPHORA",
	// Creeds / prayers
	"credo de nicea constantinopla": "CREED.NICENE_CONSTANTINOPOLITAN",
	"credo de nicea":                "CREED.NICENE",
	"credo niceno":                  "CREED.NICENE",
	"nicene creed":                  "CREED.NICENE_CONSTANTINOPOLITAN",
	"credo de los apostoles":        "CREED.APOSTLES",
	"apostles creed":                "CREED.APOSTLES",
	"credo del pueblo de dios":      "DOC.CREDO_PUEBLO_DIOS",
	"creed of the people of god":    "DOC.CREDO_PUEBLO_DIOS",
	"padre nuestro":                 "PRAYER.LORDS_PRAYER",
	"lord's prayer":                 "PRAYER.LORDS_PRAYER",
	"hail mary":                     "PRAYER.HAIL_MARY",
}

// ---------------------------------------------------------------------------
// Document slugs — canonical ids for non-Vatican-II documents parsed from the
// href. The Vatican URL filename embeds the type and the document name.
// ---------------------------------------------------------------------------

// canonicalDocID turns a Vatican href into a canonical document id, e.g.
// "…/vat-ii_const_19641121_lumen-gentium_sp.html" -> "DOC.lumen-gentium".
func canonicalDocID(href string) (id string, ok bool) {
	base := href
	if i := strings.LastIndexByte(href, '/'); i >= 0 {
		base = href[i+1:]
	}
	base = strings.TrimSuffix(base, ".html")
	base = strings.TrimSuffix(base, ".htm")
	// Strip a trailing language suffix: _sp / _en / _lt / _la
	for _, sfx := range []string{"_sp", "_en", "_lt", "_la", "_fr", "_de", "_pt", "_it"} {
		base = strings.TrimSuffix(base, sfx)
	}
	if base == "" {
		return "", false
	}
	// The document name is the last non-numeric slug segment: filenames carry a
	// type + date prefix ("vat-ii_const_19641121_lumen-gentium"), and some
	// speech URLs end in a bare date.
	name := ""
	for _, part := range strings.Split(base, "_") {
		if part == "" || isNumeric(part) {
			continue
		}
		name = part
	}
	if name == "" {
		name = base
	}
	return "DOC." + name, true
}

// isNumeric reports whether s is entirely ASCII digits.
func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
