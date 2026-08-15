package scrape

import "testing"

func TestParseVaticanParagraphs(t *testing.T) {
	// Shape mirrors vatican.va: a plain bold number, an anchored bold number,
	// an entity-spaced one (`<b>&nbsp;…</b>`), a font-wrapped one, a bold
	// number with a stray inline tag before the close (`<b>1928<i> </i></b>`),
	// a bare number after the <p> followed by a period, and one followed by a
	// space. A section heading and trailing navigation anchor must be trimmed.
	page := `
<p align="left"> <font size="3"> <b>27</b> El deseo de Dios est&aacute; inscrito.</font></p>
<p align="left"><b><a name="I">I. El deseo de Dios</a></b></p>
<p align="left"> <b> <a name="1601"> 1601</a></b> &quot;La alianza matrimonial&quot;.</p>
<p align="left"><b>&nbsp;2016</b> Los hijos de la Santa Madre Iglesia esperan la perseverancia.</p>
<p align="left"><b><font size="3">2551</font></b> Donde est&aacute; tu tesoro all&iacute; estar&aacute; tu coraz&oacute;n.</p>
<p align="left"><b>1928<i> </i></b>Societas iustitiam praestat socialem cum condiciones adimplet.</p>
<p align="left">1917. Corresponde a los que ejercen la autoridad reafirmar los valores.</p>
<p align="left">168 La Iglesia es la primera que cree, y así conduce, alimenta y sostiene mi fe.</p>
<p align="left"><b>2076</b> By his life Jesus attested the Decalogue. 2077 The gift of the Decalogue is bestowed from within the covenant.</p>
<p align="left"><a href="#top">Volver</a></p>
`
	got := parseVaticanParagraphs(page)
	want := map[int]string{
		27:   "El deseo de Dios está inscrito.",
		1601: "\"La alianza matrimonial\".",
		2016: "Los hijos de la Santa Madre Iglesia esperan la perseverancia.",
		2551: "Donde está tu tesoro allí estará tu corazón.",
		1928: "Societas iustitiam praestat socialem cum condiciones adimplet.",
		1917: "Corresponde a los que ejercen la autoridad reafirmar los valores.",
		168:  "La Iglesia es la primera que cree, y así conduce, alimenta y sostiene mi fe.",
		// A merged English block: 2076's text carries 2077 inline; splitMerged
		// separates them on the sequential number + capital.
		2076: "By his life Jesus attested the Decalogue.",
		2077: "The gift of the Decalogue is bestowed from within the covenant.",
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
