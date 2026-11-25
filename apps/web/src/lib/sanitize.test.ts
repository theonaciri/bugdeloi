import { describe, expect, test } from 'bun:test'
import { sanitizeLegalHtml } from './sanitize.ts'

describe('sanitizeLegalHtml', () => {
  test('garde le HTML DILA courant', () => {
    const html = '<p align="left">I. – Le montant est fixé à 1 000 €.<br/>II. – <b>Abrogé</b>.</p>'
    expect(sanitizeLegalHtml(html)).toBe(
      '<p align="left">I. – Le montant est fixé à 1 000 €.<br>II. – <b>Abrogé</b>.</p>',
    )
  })

  test('conserve les tableaux et leurs fusions de cellules', () => {
    const html =
      '<table border="1"><tr><td colspan="2" style="color:red">A</td><td rowspan="x">B</td></tr></table>'
    expect(sanitizeLegalHtml(html)).toBe('<table><tr><td colspan="2">A</td><td>B</td></tr></table>')
  })

  test('supprime scripts, styles et leur contenu', () => {
    expect(sanitizeLegalHtml('<p>a<script>alert(1)</script>b<style>p{}</style>c</p>')).toBe('<p>abc</p>')
    expect(sanitizeLegalHtml('<SCRIPT SRC=//x.example></SCRIPT>ok')).toBe('ok')
    expect(sanitizeLegalHtml('<svg><script>alert(1)</script></svg>ok')).toBe('ok')
  })

  test('retire les gestionnaires d’événements et les URL javascript', () => {
    expect(sanitizeLegalHtml('<p onclick="alert(1)">x</p>')).toBe('<p>x</p>')
    expect(sanitizeLegalHtml('<img src=x onerror=alert(1)>t')).toBe('t')
    expect(sanitizeLegalHtml('<a href="javascript:alert(1)">lien</a>')).toBe('lien')
    expect(sanitizeLegalHtml('<p align="left" onmouseover=alert(1)>x</p>')).toBe('<p align="left">x</p>')
  })

  test('déballe les liens et balises de présentation', () => {
    expect(sanitizeLegalHtml('<a href="/affichCodeArticle.do?cidTexte=X">article 197</a>')).toBe(
      'article 197',
    )
    expect(sanitizeLegalHtml('<font size="2">texte</font>')).toBe('texte')
  })

  test('échappe le texte et les chevrons isolés', () => {
    expect(sanitizeLegalHtml('si a < b et c > d')).toBe('si a &lt; b et c &gt; d')
    expect(sanitizeLegalHtml('"guillemets" & Cie')).toBe('&quot;guillemets&quot; &amp; Cie')
    expect(sanitizeLegalHtml('&eacute;t&eacute; &#233; &#x0; &bogus;')).toBe(
      '&eacute;t&eacute; &#233; &amp;#x0; &amp;bogus;',
    )
  })

  test('rééquilibre les balises', () => {
    expect(sanitizeLegalHtml('<p><b>gras')).toBe('<p><b>gras</b></p>')
    expect(sanitizeLegalHtml('</b>texte</p>')).toBe('texte')
    expect(sanitizeLegalHtml('<p><b>x</p>y')).toBe('<p><b>x</b></p>y')
  })

  test('supprime commentaires et doctypes', () => {
    expect(sanitizeLegalHtml('<!-- <script>alert(1)</script> -->x<!DOCTYPE html>')).toBe('x')
    expect(sanitizeLegalHtml('<!--x')).toBe('')
  })

  test('résiste aux attributs mal fermés et aux balises malformées', () => {
    expect(sanitizeLegalHtml('<p title="a>b" onclick=x>t</p>')).toBe('<p>t</p>')
    expect(sanitizeLegalHtml('<<script>script>alert(1)<</script>/script>')).toBe('&lt;/script&gt;')
    expect(sanitizeLegalHtml('<p\nonclick="x">t</p>')).toBe('<p>t</p>')
  })

  test('est idempotent', () => {
    const inputs = [
      '<p align="center">A &amp; B &lt; C</p><table><tr><td>1</td></tr></table>',
      '<div>x<br>y &nbsp; z</div>',
      '"<b>x</b>"',
    ]
    for (const html of inputs) {
      const once = sanitizeLegalHtml(html)
      expect(sanitizeLegalHtml(once)).toBe(once)
    }
  })

  test('valeurs vides', () => {
    expect(sanitizeLegalHtml('')).toBe('')
    expect(sanitizeLegalHtml(null)).toBe('')
    expect(sanitizeLegalHtml(undefined)).toBe('')
  })
})
