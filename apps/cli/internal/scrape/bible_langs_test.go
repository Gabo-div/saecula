package scrape

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestParseNVBook_MultiChapter(t *testing.T) {
	// Two chapters, a poetry continuation line (no leading number), a
	// duplicate verse marker (LXX-style, kept-first), and the trailing
	// chapter-nav that must be trimmed off the last chapter.
	page := `<p>index <a href="#1">1</a> <a href="#2">2</a></p>
<!--FINE TESTO-->
<p><b><a name="1"><font color="#663300">1</font></a></b><br />1 In principio.<br />et vacua erat.<br />2 Dixit Deus.<br />2 Variant marker.</p>
<p><b><a name="2"><font color="#663300">2</font></a></b><br />1 Igitur perfecti.</p>
<p align="center"><b><a href="#1">1</a> <a href="#2">2</a></b></p>`

	chapters, skipped, err := parseNVBook(page, "test://multi")
	if err != nil {
		t.Fatal(err)
	}
	if len(chapters) != 2 {
		t.Fatalf("want 2 chapters, got %d", len(chapters))
	}
	if skipped != 1 {
		t.Errorf("want 1 duplicate skipped, got %d", skipped)
	}
	c1 := chapters[0].Verses
	if len(c1) != 2 {
		t.Fatalf("ch1: want 2 verses, got %d (%v)", len(c1), c1)
	}
	// poetry line merged into verse 1
	if c1[0].Number != 1 || c1[0].Text != "In principio. et vacua erat." {
		t.Errorf("ch1 v1 = %+v", c1[0])
	}
	// the trailing nav (numbers 1,2) must not appear as verses of ch2
	if len(chapters[1].Verses) != 1 || chapters[1].Verses[0].Text != "Igitur perfecti." {
		t.Errorf("ch2 polluted by nav: %+v", chapters[1].Verses)
	}
}

func TestParseNVBook_SingleChapter(t *testing.T) {
	// No chapter anchor; header has the empty "#" back-to-top link that must
	// NOT truncate the scripture, and verse 1 is glued to the title's <p>.
	page := `<a name="top"></a><a href="#">up</a>
<p align="center"><b>EPISTULA</b></p>
<p align="justify"> 1 Paulus servus.<br />2 Gratia vobis.</p>
<p>&nbsp;</p>`

	chapters, _, err := parseNVBook(page, "test://single")
	if err != nil {
		t.Fatal(err)
	}
	if len(chapters) != 1 || chapters[0].Number != 1 {
		t.Fatalf("want 1 chapter numbered 1, got %+v", chapters)
	}
	v := chapters[0].Verses
	if len(v) != 2 || v[0].Text != "Paulus servus." || v[1].Number != 2 {
		t.Errorf("single-chapter verses = %+v", v)
	}
}

func TestSourceBookNames(t *testing.T) {
	ceeCases := map[string]string{
		"Pentateuco: 1. Génesis - Conferencia Episcopal Española":         "Génesis",
		"Libros históricos: 9. 1 Samuel - Conferencia Episcopal Española": "1 Samuel",
		"Evangelios. 1. Mateo - Conferencia Episcopal Española":           "Mateo",
		"Libro del apocalipsis 1 - Conferencia Episcopal Española":        "Libro del apocalipsis",
	}
	for title, want := range ceeCases {
		if got := ceeBookName(title); got != want {
			t.Errorf("ceeBookName(%q) = %q, want %q", title, got, want)
		}
	}
	if got := nvBookName(`<meta name="description" content="LIBER GENESIS - Nova Vulgata, Vetus Testamentum" />`); got != "LIBER GENESIS" {
		t.Errorf("nv = %q", got)
	}
}

func TestParseUSFMBook(t *testing.T) {
	usfm := `\id JHN Test
\h John the Beloved
\c 3
\p
\v 16 \w For|strong="G1063"\w* God so loved\f + \fr 3:16 \ft note\f* the world,
\q1 that he gave his Son.
\v 17 \nd God\nd* sent his Son.
\c 4
\v 1 Therefore.`

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("73-JHNeng-web-c.usfm")
	_, _ = w.Write([]byte(usfm))
	_ = zw.Close()
	zr, _ := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))

	name, chapters, err := parseUSFMBook(zr.File[0])
	if err != nil {
		t.Fatal(err)
	}
	if name != "John the Beloved" {
		t.Errorf("book name = %q", name)
	}
	if len(chapters) != 2 {
		t.Fatalf("want 2 chapters, got %d", len(chapters))
	}
	v16 := chapters[0].Verses[0]
	// footnote dropped, \w and \nd markup stripped, poetry line merged
	if v16.Number != 16 || v16.Text != "For God so loved the world, that he gave his Son." {
		t.Errorf("v16 = %q", v16.Text)
	}
	if got := chapters[0].Verses[1].Text; got != "God sent his Son." {
		t.Errorf("v17 = %q", got)
	}
}
