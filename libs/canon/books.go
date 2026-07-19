// Package canon is the canonical catalog of the 73 books of the Catholic
// canon. Every Bible source scraper maps its own slugs/URLs onto these
// books, so entity IDs, English slugs and temporal metadata are identical
// across sources and languages.
package canon

// Book is one canonical book. Code follows the USFM/Paratext standard
// (used to build entity IDs: JHN.3.16); Slug is the shared English URL
// slug. Composition years are approximate scholarly ranges (negative = BC).
type Book struct {
	Code      string // USFM code, e.g. "GEN", "JHN", "1CO"
	Slug      string // canonical English slug, e.g. "genesis", "1-john"
	NameEN    string
	NameES    string
	Testament string // "OT" | "NT"
	StartYear int64
	EndYear   int64
	Era       string
}

// Books lists the full canon in canonical order.
var Books = []Book{
	// --- Old Testament (46) ------------------------------------------------
	{Code: "GEN", Slug: "genesis", NameEN: "Genesis", NameES: "Génesis", Testament: "OT", StartYear: -950, EndYear: -450, Era: "Old Testament"},
	{Code: "EXO", Slug: "exodus", NameEN: "Exodus", NameES: "Éxodo", Testament: "OT", StartYear: -950, EndYear: -450, Era: "Old Testament"},
	{Code: "LEV", Slug: "leviticus", NameEN: "Leviticus", NameES: "Levítico", Testament: "OT", StartYear: -550, EndYear: -450, Era: "Old Testament"},
	{Code: "NUM", Slug: "numbers", NameEN: "Numbers", NameES: "Números", Testament: "OT", StartYear: -600, EndYear: -450, Era: "Old Testament"},
	{Code: "DEU", Slug: "deuteronomy", NameEN: "Deuteronomy", NameES: "Deuteronomio", Testament: "OT", StartYear: -650, EndYear: -550, Era: "Old Testament"},
	{Code: "JOS", Slug: "joshua", NameEN: "Joshua", NameES: "Josué", Testament: "OT", StartYear: -650, EndYear: -550, Era: "Old Testament"},
	{Code: "JDG", Slug: "judges", NameEN: "Judges", NameES: "Jueces", Testament: "OT", StartYear: -650, EndYear: -550, Era: "Old Testament"},
	{Code: "RUT", Slug: "ruth", NameEN: "Ruth", NameES: "Rut", Testament: "OT", StartYear: -500, EndYear: -350, Era: "Old Testament"},
	{Code: "1SA", Slug: "1-samuel", NameEN: "1 Samuel", NameES: "1 Samuel", Testament: "OT", StartYear: -630, EndYear: -540, Era: "Old Testament"},
	{Code: "2SA", Slug: "2-samuel", NameEN: "2 Samuel", NameES: "2 Samuel", Testament: "OT", StartYear: -630, EndYear: -540, Era: "Old Testament"},
	{Code: "1KI", Slug: "1-kings", NameEN: "1 Kings", NameES: "1 Reyes", Testament: "OT", StartYear: -600, EndYear: -550, Era: "Old Testament"},
	{Code: "2KI", Slug: "2-kings", NameEN: "2 Kings", NameES: "2 Reyes", Testament: "OT", StartYear: -600, EndYear: -550, Era: "Old Testament"},
	{Code: "1CH", Slug: "1-chronicles", NameEN: "1 Chronicles", NameES: "1 Crónicas", Testament: "OT", StartYear: -400, EndYear: -300, Era: "Old Testament"},
	{Code: "2CH", Slug: "2-chronicles", NameEN: "2 Chronicles", NameES: "2 Crónicas", Testament: "OT", StartYear: -400, EndYear: -300, Era: "Old Testament"},
	{Code: "EZR", Slug: "ezra", NameEN: "Ezra", NameES: "Esdras", Testament: "OT", StartYear: -400, EndYear: -300, Era: "Old Testament"},
	{Code: "NEH", Slug: "nehemiah", NameEN: "Nehemiah", NameES: "Nehemías", Testament: "OT", StartYear: -400, EndYear: -300, Era: "Old Testament"},
	{Code: "TOB", Slug: "tobit", NameEN: "Tobit", NameES: "Tobías", Testament: "OT", StartYear: -250, EndYear: -170, Era: "Old Testament"},
	{Code: "JDT", Slug: "judith", NameEN: "Judith", NameES: "Judit", Testament: "OT", StartYear: -150, EndYear: -100, Era: "Old Testament"},
	{Code: "EST", Slug: "esther", NameEN: "Esther", NameES: "Ester", Testament: "OT", StartYear: -400, EndYear: -300, Era: "Old Testament"},
	{Code: "1MA", Slug: "1-maccabees", NameEN: "1 Maccabees", NameES: "1 Macabeos", Testament: "OT", StartYear: -130, EndYear: -100, Era: "Old Testament"},
	{Code: "2MA", Slug: "2-maccabees", NameEN: "2 Maccabees", NameES: "2 Macabeos", Testament: "OT", StartYear: -150, EndYear: -120, Era: "Old Testament"},
	{Code: "JOB", Slug: "job", NameEN: "Job", NameES: "Job", Testament: "OT", StartYear: -600, EndYear: -400, Era: "Old Testament"},
	{Code: "PSA", Slug: "psalms", NameEN: "Psalms", NameES: "Salmos", Testament: "OT", StartYear: -1000, EndYear: -300, Era: "Old Testament"},
	{Code: "PRO", Slug: "proverbs", NameEN: "Proverbs", NameES: "Proverbios", Testament: "OT", StartYear: -700, EndYear: -400, Era: "Old Testament"},
	{Code: "ECC", Slug: "ecclesiastes", NameEN: "Ecclesiastes", NameES: "Eclesiastés", Testament: "OT", StartYear: -300, EndYear: -200, Era: "Old Testament"},
	{Code: "SNG", Slug: "song-of-songs", NameEN: "Song of Songs", NameES: "Cantar de los Cantares", Testament: "OT", StartYear: -500, EndYear: -300, Era: "Old Testament"},
	{Code: "WIS", Slug: "wisdom", NameEN: "Wisdom", NameES: "Sabiduría", Testament: "OT", StartYear: -100, EndYear: -30, Era: "Old Testament"},
	{Code: "SIR", Slug: "sirach", NameEN: "Sirach", NameES: "Eclesiástico", Testament: "OT", StartYear: -200, EndYear: -175, Era: "Old Testament"},
	{Code: "ISA", Slug: "isaiah", NameEN: "Isaiah", NameES: "Isaías", Testament: "OT", StartYear: -740, EndYear: -540, Era: "Old Testament"},
	{Code: "JER", Slug: "jeremiah", NameEN: "Jeremiah", NameES: "Jeremías", Testament: "OT", StartYear: -620, EndYear: -580, Era: "Old Testament"},
	{Code: "LAM", Slug: "lamentations", NameEN: "Lamentations", NameES: "Lamentaciones", Testament: "OT", StartYear: -580, EndYear: -540, Era: "Old Testament"},
	{Code: "BAR", Slug: "baruch", NameEN: "Baruch", NameES: "Baruc", Testament: "OT", StartYear: -200, EndYear: -100, Era: "Old Testament"},
	{Code: "EZK", Slug: "ezekiel", NameEN: "Ezekiel", NameES: "Ezequiel", Testament: "OT", StartYear: -590, EndYear: -570, Era: "Old Testament"},
	{Code: "DAN", Slug: "daniel", NameEN: "Daniel", NameES: "Daniel", Testament: "OT", StartYear: -170, EndYear: -160, Era: "Old Testament"},
	{Code: "HOS", Slug: "hosea", NameEN: "Hosea", NameES: "Oseas", Testament: "OT", StartYear: -750, EndYear: -720, Era: "Old Testament"},
	{Code: "JOL", Slug: "joel", NameEN: "Joel", NameES: "Joel", Testament: "OT", StartYear: -500, EndYear: -350, Era: "Old Testament"},
	{Code: "AMO", Slug: "amos", NameEN: "Amos", NameES: "Amós", Testament: "OT", StartYear: -760, EndYear: -750, Era: "Old Testament"},
	{Code: "OBA", Slug: "obadiah", NameEN: "Obadiah", NameES: "Abdías", Testament: "OT", StartYear: -580, EndYear: -550, Era: "Old Testament"},
	{Code: "JON", Slug: "jonah", NameEN: "Jonah", NameES: "Jonás", Testament: "OT", StartYear: -500, EndYear: -400, Era: "Old Testament"},
	{Code: "MIC", Slug: "micah", NameEN: "Micah", NameES: "Miqueas", Testament: "OT", StartYear: -740, EndYear: -690, Era: "Old Testament"},
	{Code: "NAM", Slug: "nahum", NameEN: "Nahum", NameES: "Nahún", Testament: "OT", StartYear: -650, EndYear: -610, Era: "Old Testament"},
	{Code: "HAB", Slug: "habakkuk", NameEN: "Habakkuk", NameES: "Habacuc", Testament: "OT", StartYear: -620, EndYear: -590, Era: "Old Testament"},
	{Code: "ZEP", Slug: "zephaniah", NameEN: "Zephaniah", NameES: "Sofonías", Testament: "OT", StartYear: -640, EndYear: -620, Era: "Old Testament"},
	{Code: "HAG", Slug: "haggai", NameEN: "Haggai", NameES: "Ageo", Testament: "OT", StartYear: -520, EndYear: -515, Era: "Old Testament"},
	{Code: "ZEC", Slug: "zechariah", NameEN: "Zechariah", NameES: "Zacarías", Testament: "OT", StartYear: -520, EndYear: -450, Era: "Old Testament"},
	{Code: "MAL", Slug: "malachi", NameEN: "Malachi", NameES: "Malaquías", Testament: "OT", StartYear: -460, EndYear: -430, Era: "Old Testament"},

	// --- New Testament (27) ------------------------------------------------
	{Code: "MAT", Slug: "matthew", NameEN: "Matthew", NameES: "Mateo", Testament: "NT", StartYear: 70, EndYear: 90, Era: "Apostolic"},
	{Code: "MRK", Slug: "mark", NameEN: "Mark", NameES: "Marcos", Testament: "NT", StartYear: 65, EndYear: 75, Era: "Apostolic"},
	{Code: "LUK", Slug: "luke", NameEN: "Luke", NameES: "Lucas", Testament: "NT", StartYear: 80, EndYear: 90, Era: "Apostolic"},
	{Code: "JHN", Slug: "john", NameEN: "John", NameES: "Juan", Testament: "NT", StartYear: 90, EndYear: 110, Era: "Apostolic"},
	{Code: "ACT", Slug: "acts", NameEN: "Acts", NameES: "Hechos de los Apóstoles", Testament: "NT", StartYear: 80, EndYear: 90, Era: "Apostolic"},
	{Code: "ROM", Slug: "romans", NameEN: "Romans", NameES: "Romanos", Testament: "NT", StartYear: 55, EndYear: 58, Era: "Apostolic"},
	{Code: "1CO", Slug: "1-corinthians", NameEN: "1 Corinthians", NameES: "1 Corintios", Testament: "NT", StartYear: 53, EndYear: 55, Era: "Apostolic"},
	{Code: "2CO", Slug: "2-corinthians", NameEN: "2 Corinthians", NameES: "2 Corintios", Testament: "NT", StartYear: 55, EndYear: 57, Era: "Apostolic"},
	{Code: "GAL", Slug: "galatians", NameEN: "Galatians", NameES: "Gálatas", Testament: "NT", StartYear: 48, EndYear: 55, Era: "Apostolic"},
	{Code: "EPH", Slug: "ephesians", NameEN: "Ephesians", NameES: "Efesios", Testament: "NT", StartYear: 60, EndYear: 90, Era: "Apostolic"},
	{Code: "PHP", Slug: "philippians", NameEN: "Philippians", NameES: "Filipenses", Testament: "NT", StartYear: 54, EndYear: 62, Era: "Apostolic"},
	{Code: "COL", Slug: "colossians", NameEN: "Colossians", NameES: "Colosenses", Testament: "NT", StartYear: 58, EndYear: 80, Era: "Apostolic"},
	{Code: "1TH", Slug: "1-thessalonians", NameEN: "1 Thessalonians", NameES: "1 Tesalonicenses", Testament: "NT", StartYear: 50, EndYear: 52, Era: "Apostolic"},
	{Code: "2TH", Slug: "2-thessalonians", NameEN: "2 Thessalonians", NameES: "2 Tesalonicenses", Testament: "NT", StartYear: 50, EndYear: 90, Era: "Apostolic"},
	{Code: "1TI", Slug: "1-timothy", NameEN: "1 Timothy", NameES: "1 Timoteo", Testament: "NT", StartYear: 62, EndYear: 100, Era: "Apostolic"},
	{Code: "2TI", Slug: "2-timothy", NameEN: "2 Timothy", NameES: "2 Timoteo", Testament: "NT", StartYear: 62, EndYear: 100, Era: "Apostolic"},
	{Code: "TIT", Slug: "titus", NameEN: "Titus", NameES: "Tito", Testament: "NT", StartYear: 62, EndYear: 100, Era: "Apostolic"},
	{Code: "PHM", Slug: "philemon", NameEN: "Philemon", NameES: "Filemón", Testament: "NT", StartYear: 54, EndYear: 62, Era: "Apostolic"},
	{Code: "HEB", Slug: "hebrews", NameEN: "Hebrews", NameES: "Hebreos", Testament: "NT", StartYear: 60, EndYear: 90, Era: "Apostolic"},
	{Code: "JAS", Slug: "james", NameEN: "James", NameES: "Santiago", Testament: "NT", StartYear: 50, EndYear: 90, Era: "Apostolic"},
	{Code: "1PE", Slug: "1-peter", NameEN: "1 Peter", NameES: "1 Pedro", Testament: "NT", StartYear: 60, EndYear: 90, Era: "Apostolic"},
	{Code: "2PE", Slug: "2-peter", NameEN: "2 Peter", NameES: "2 Pedro", Testament: "NT", StartYear: 100, EndYear: 120, Era: "Apostolic"},
	{Code: "1JN", Slug: "1-john", NameEN: "1 John", NameES: "1 Juan", Testament: "NT", StartYear: 90, EndYear: 110, Era: "Apostolic"},
	{Code: "2JN", Slug: "2-john", NameEN: "2 John", NameES: "2 Juan", Testament: "NT", StartYear: 90, EndYear: 110, Era: "Apostolic"},
	{Code: "3JN", Slug: "3-john", NameEN: "3 John", NameES: "3 Juan", Testament: "NT", StartYear: 90, EndYear: 110, Era: "Apostolic"},
	{Code: "JUD", Slug: "jude", NameEN: "Jude", NameES: "Judas", Testament: "NT", StartYear: 90, EndYear: 110, Era: "Apostolic"},
	{Code: "REV", Slug: "revelation", NameEN: "Revelation", NameES: "Apocalipsis", Testament: "NT", StartYear: 90, EndYear: 100, Era: "Apostolic"},
}

var (
	byCode = func() map[string]*Book {
		m := make(map[string]*Book, len(Books))
		for i := range Books {
			m[Books[i].Code] = &Books[i]
		}
		return m
	}()
	bySlug = func() map[string]*Book {
		m := make(map[string]*Book, len(Books))
		for i := range Books {
			m[Books[i].Slug] = &Books[i]
		}
		return m
	}()
)

// ByCode looks a book up by its USFM code (e.g. "JHN").
func ByCode(code string) (*Book, bool) {
	b, ok := byCode[code]
	return b, ok
}

// BySlug looks a book up by its canonical English slug (e.g. "john").
func BySlug(slug string) (*Book, bool) {
	b, ok := bySlug[slug]
	return b, ok
}
