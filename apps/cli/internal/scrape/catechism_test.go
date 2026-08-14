package scrape

import "testing"

func TestParseVaticanParagraphs(t *testing.T) {
	// Shape mirrors vatican.va: a plain bold number, an anchored bold number
	// (used on some pages), and a handful that lost their bold tag and open
	// with a bare number after the <p>. A section heading and trailing
	// navigation anchor must be trimmed off.
	page := `
<p align="left"> <font size="3"> <b>27</b> El deseo de Dios est&aacute; inscrito.</font></p>
<p align="left"><b><a name="I">I. El deseo de Dios</a></b></p>
<p align="left"> <b> <a name="1601"> 1601</a></b> &quot;La alianza matrimonial&quot;.</p>
<p align="left">168 La Iglesia es la primera que cree.</p>
<p align="left"><a href="#top">Volver</a></p>
`
	got := parseVaticanParagraphs(page)
	want := map[int]string{
		27:   "El deseo de Dios está inscrito.",
		1601: "\"La alianza matrimonial\".",
		168:  "La Iglesia es la primera que cree.",
	}
	if len(got) != len(want) {
		t.Fatalf("got %d paragraphs, want %d: %+v", len(got), len(want), got)
	}
	for _, p := range got {
		if want[p.OfficialNumber] != p.Text {
			t.Fatalf("paragraph %d = %q, want %q", p.OfficialNumber, p.Text, want[p.OfficialNumber])
		}
	}
}
