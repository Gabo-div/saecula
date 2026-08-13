package scrape

import "testing"

func TestParseCatechismParagraphs(t *testing.T) {
	// Shape mirrors scborromeo.org: numeric NAME anchors delimit paragraphs,
	// a bold self-link repeats the number, a section heading sits between two
	// paragraphs, and a footnote superscript must be dropped.
	page := `
<P><A NAME=I></A><B>I. THE DESIRE FOR GOD</B><P>
<A NAME=27></A><B><A HREF="javascript:openWindow('cr/27.htm');">27</a></B> The desire for God is written in the human heart.<A HREF="x"><SUP>1</SUP></A>
<P><A NAME=II></A><B>II. WAYS</B><P>
<A NAME=28></A><B><A HREF="javascript:openWindow('cr/28.htm');">28</a></B> In many ways man has given expression to his quest for God.
`
	got := parseCatechismParagraphs(page)
	if len(got) != 2 {
		t.Fatalf("got %d paragraphs, want 2: %+v", len(got), got)
	}
	if got[0].OfficialNumber != 27 ||
		got[0].Text != "The desire for God is written in the human heart." {
		t.Fatalf("paragraph 27 = %+v", got[0])
	}
	if got[1].OfficialNumber != 28 ||
		got[1].Text != "In many ways man has given expression to his quest for God." {
		t.Fatalf("paragraph 28 = %+v", got[1])
	}
}

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
