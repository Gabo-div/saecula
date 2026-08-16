package scrape

import "testing"

// Fixture mirrors the real vatican.va Spanish page for CCC 963-975: inline
// <a href> links to Vatican II / papal documents plus inline DS references.
const assumptionPage = `
<p align="left"><b>966</b> &quot;Finalmente, la Virgen Inmaculada [...] fue asunta
en cuerpo y alma a la gloria del cielo [...]&quot;
(<a href="/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_sp.html">LG</a> 59;
cf. P&iacute;o XII, Const. apo. <i>Munificentissimus Deus</i>, 1 noviembre 1950: DS 3903).</p>
<p align="left"><b>967</b> &quot;miembro supereminente y del todo singular de la Iglesia&quot;
(<a href="/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_sp.html">LG</a> 53).</p>
<p align="left"><b>971</b> (<i>Lc</i> 1, 48): &quot;La piedad de la Iglesia [...]&quot;
(<a href="/holy_father/paul_vi/apost_exhortations/documents/hf_p-vi_exh_19740202_marialis-cultus_sp.html">MC</a> 56).</p>
`

func TestParseCitationParagraphs(t *testing.T) {
	got := parseCitationParagraphs(assumptionPage)
	byNum := map[int]ParagraphCitations{}
	for _, pc := range got {
		byNum[pc.Number] = pc
	}
	if _, ok := byNum[966]; !ok {
		t.Fatalf("expected paragraph 966, got %v", got)
	}

	has := func(pc ParagraphCitations, typ, id string) bool {
		for _, c := range pc.Citations {
			if c.Type == typ && c.ID == id {
				return true
			}
		}
		return false
	}

	// LG 59 is a hyperlinked document.
	if !has(byNum[966], "document", "DOC.LG") {
		t.Errorf("966: missing DOC.LG citation, got %+v", byNum[966].Citations)
	}
	// Munificentissimus Deus cited by name in plain text.
	if !has(byNum[966], "document", "DOC.MUNIFICENTISSIMUS_DEUS") {
		t.Errorf("966: missing Munificentissimus Deus, got %+v", byNum[966].Citations)
	}
	// DS 3903 inline.
	if !has(byNum[966], "denzinger", "DS.3903") {
		t.Errorf("966: missing DS.3903, got %+v", byNum[966].Citations)
	}
	// MC (Marialis Cultus) — id from the href slug, reference number captured.
	if !has(byNum[971], "document", "DOC.marialis-cultus") {
		t.Errorf("971: missing DOC.marialis-cultus, got %+v", byNum[971].Citations)
	}
	// Lc 1,48 scripture (inline, no cf. lead-in).
	if !has(byNum[971], "scripture", "BIBLE.LUK.1.48") {
		t.Errorf("971: missing scripture LUK.1.48, got %+v", byNum[971].Citations)
	}
}

func TestExtractCitationsScripture(t *testing.T) {
	html := `<p>Los que pertenecen a Cristo deben confesar su fe (cf. Mt 10,32; Rom 10,9).</p>`
	cites := extractCitations(html)
	got := map[string]bool{}
	for _, c := range cites {
		got[c.ID] = true
	}
	for _, want := range []string{"BIBLE.MAT.10.32", "BIBLE.ROM.10.9"} {
		if !got[want] {
			t.Errorf("missing scripture %s in %+v", want, cites)
		}
	}
}

func TestExtractCitationsSaint(t *testing.T) {
	html := `<p>San Agust&iacute;n, <i>Confessiones</i>, 1,1,1; Santo Tom&aacute;s de Aquino.</p>`
	cites := extractCitations(html)
	got := map[string]bool{}
	for _, c := range cites {
		got[c.ID] = true
	}
	for _, want := range []string{"SAINT.AUGUSTINE", "WORK.AUGUSTINE.CONFESSIONES", "SAINT.THOMAS_AQUINAS"} {
		if !got[want] {
			t.Errorf("missing %s in %+v", want, cites)
		}
	}
}
