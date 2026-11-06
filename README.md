# Ripasso

Web app per studiare le lezioni con i quiz. Funziona dal telefono come un'app (si installa sulla schermata home) e anche offline.

- Una sezione per ogni **materia** e, dentro, una per ogni **lezione**
- 4 tipi di domanda: **risposta multipla** (anche con più risposte giuste), **vero/falso**, **completamento** (a scrittura libera o con menu a tendina), **trova l'errore** (in una frase o in un blocco di codice)
- **Statistiche** per materia: precisione, domande viste/consolidate/da ripassare, andamento dei quiz, attività degli ultimi 14 giorni, risultati per lezione e per tipo, domande più difficili
- Modalità **intelligente**: propone più spesso le domande mai viste e quelle sbagliate
- Formule LaTeX con `$...$` (KaTeX incluso, funziona offline)

## Metterla online con GitHub Pages

1. Crea un nuovo repository su GitHub (es. `ripasso`). Può essere pubblico; con un piano gratuito Pages richiede il repo pubblico.
2. Carica tutto il contenuto di questa cartella nella radice del repo (*Add file → Upload files*, trascina tutto e fai *Commit*).
3. Vai in **Settings → Pages**, alla voce *Source* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, poi *Save*.
4. Dopo circa un minuto l'app è su `https://<tuo-utente>.github.io/ripasso/`.
5. Dal telefono apri il link e aggiungila alla home:
   - **Android (Chrome):** menu ⋮ → *Aggiungi a schermata Home* / *Installa app*
   - **iPhone (Safari):** Condividi → *Aggiungi alla schermata Home*

## Aggiungere i quiz

Ci sono due modi, e si possono usare insieme.

**A. Dal telefono (più rapido).** Apri *Importa* e incolla il JSON, anche direttamente dalla chat con Claude (i blocchi ```json vengono puliti da soli), oppure scegli dei file `.json`. L'app controlla il formato e ti dice quali domande hanno errori. Queste lezioni restano salvate **solo su quel dispositivo**.

**B. Nel repo (restano per sempre e sono uguali su tutti i dispositivi).** Metti il file in `data/` e aggiungi il percorso a `data/index.json`:

```json
{ "file": ["hlt/18-post-training-lora.json", "cv/01-intro.json"] }
```

Dentro l'app, in *Formato*, c'è il pulsante **"Copia il prompt per generarli con Claude"**: lo incolli in chat insieme alle slide della lezione e ottieni il JSON pronto.

## Formato

Ogni file contiene una lezione:

```json
{
  "materia": "Human Language Technologies",
  "lezione": "18 - Post-training e LoRA",
  "domande": [ ... ]
}
```

Oppure più lezioni della stessa materia: `{ "materia": "...", "lezioni": [ { "lezione": "...", "domande": [...] } ] }`, o una lista `[ {...}, {...} ]`.

Materie e lezioni vengono create in automatico in base al nome, quindi usa sempre lo stesso nome per la stessa materia. Le lezioni sono ordinate in base al numero all'inizio del nome (`18 - ...`), oppure in base al campo opzionale `"ordine"`.

### Risposta multipla
```json
{ "tipo": "multipla",
  "domanda": "Quale tecnica non richiede un reward model esplicito?",
  "opzioni": ["RLHF con PPO", "DPO", "Reward modeling", "Best-of-n con RM"],
  "corretta": "B",
  "spiegazione": "DPO ottimizza direttamente sulle coppie di preferenze." }
```
`corretta` è una lettera, oppure una lista (`["A","C"]`) se le risposte giuste sono più di una. In quel caso l'app chiede di selezionarle tutte. Le opzioni vengono mescolate; con `"mescola": false` restano nell'ordine scritto (utile per opzioni come "tutte le precedenti").

### Vero / Falso
```json
{ "tipo": "vero_falso", "affermazione": "LoRA congela i pesi pre-addestrati.", "risposta": true }
```

### Completamento
```json
{ "tipo": "completamento",
  "testo": "In RLHF la policy è ottimizzata con [[PPO]] e una penalità [[KL|Kullback-Leibler]].",
  "distrattori": ["SGD", "entropia"] }
```
Ogni spazio si scrive `[[risposta]]` e le varianti accettate si separano con `|`. Senza `distrattori` la risposta si scrive a mano: maiuscole, accenti e punteggiatura finale non contano, e sulle parole di almeno 5 lettere viene perdonato un errore di battitura. Con `distrattori` ogni spazio diventa un menu a tendina.

### Trova l'errore
```json
{ "tipo": "errore",
  "testo": "In QLoRA il modello base è quantizzato a {{8|4}} bit (NF4).",
  "spiegazione": "QLoRA usa 4 bit NormalFloat." }
```
Ci va esattamente un `{{sbagliato|corretto}}`, con la parte sbagliata breve (idealmente una parola). Se il `testo` ha più righe, per esempio del codice con `\n`, si tocca la **riga** sbagliata invece della parola. Con `"domanda"` puoi scrivere la consegna.

### Campi opzionali (tutti i tipi)
- `spiegazione`: mostrata dopo la risposta (consigliata)
- `codice`: snippet mostrato sopra la domanda
- `id`: identificativo fisso. Le statistiche sono legate al testo della domanda: se pensi di correggerla in futuro, metti un `id` per non perdere lo storico.

Nei testi funzionano `$formule$`, `**grassetto**` e `` `codice` ``. Nel JSON i backslash del LaTeX vanno raddoppiati: `"$\\alpha$"`.

## Dati e backup

Le statistiche e le lezioni importate dal telefono sono salvate nel browser del dispositivo (localStorage), non su GitHub. Da *Dati* puoi:
- esportare o ripristinare un **backup** (fallo prima di cambiare telefono o di cancellare i dati del browser)
- esportare una singola lezione importata in un file `.json`, da caricare poi nel repo
- eliminare lezioni importate o azzerare le statistiche

Le lezioni del repo si modificano su GitHub. Dopo un aggiornamento basta riaprire l'app con la rete attiva.

## Struttura

```
index.html  style.css  app.js     ← l'app (JS puro, nessuna build)
sw.js  manifest.json  icons/      ← installazione e uso offline
vendor/katex/                     ← rendering delle formule
data/index.json                   ← elenco dei file di quiz
data/**.json                      ← i quiz
```

Per provarla sul computer: `python3 -m http.server` nella cartella, poi apri `http://localhost:8000`. Aprire `index.html` con doppio clic non funziona, perché i file JSON non si caricano.
