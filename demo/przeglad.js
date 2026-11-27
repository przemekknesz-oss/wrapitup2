// WrapItUp: przegląd szkicu (lektor) i PDF dla ucznia.
// Dane (SECTIONS, SOURCE_NAME) są w index.html (transkrypcja 1) i t2–t5.html.

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  children.forEach(c => c != null && n.append(c));
  return n;
}

(() => {
  const CHECK = "do sprawdzenia";
  const SOURCE_LABEL = { transcript: "Transkrypcja", audio: "Dźwięk", doc: "Dokument" };
  const LABELS = { keep: "Zostaw", edit: "Edytuj", remove: "Usuń" };
  const KEYS = { keep: "Z", edit: "E", remove: "U" };
  // Stan pozycji. Pewne: domyślnie „Zostaw”. Do sprawdzenia: brak domyślnej decyzji.
  const ALL = [];
  SECTIONS.forEach((sec, si) => sec.items.forEach((it, ii) => {
    it.sec = sec;
    it.no = `${si + 1}.${ii + 1}`;
    it.check = it.status === CHECK;
    it.state = it.check ? null : "keep";
    it.editing = false;
    it.origWrong = it.wrong;
    it.origRight = it.right;
    it.src = it.source || "transcript"; // obecne szkice powstały z transkrypcji lekcji
    ALL.push(it);
  }));
  const CHECKS = ALL.filter(i => i.check);
  const ORDER = [...CHECKS, ...ALL.filter(i => !i.check)];
  let active = ORDER[0] || null;

  const $ = id => document.getElementById(id);
  const isEdited = it => it.wrong !== it.origWrong || it.right !== it.origRight;
  // Pozycja-potwierdzenie: lektor potwierdził, że nie ma błędu. Dane bez zmian, inne tylko wyświetlanie.
  const CONFIRM = /^brak błędu:\s*/i;
  const isConfirm = it => CONFIRM.test(it.wrong);
  const original = it => it.wrong.replace(CONFIRM, "");
  const pending = () => CHECKS.filter(i => !i.state || i.editing).length;
  const anyEditing = () => ALL.some(i => i.editing);
  const onReview = () => !["approved", "consent", "recording"].some(c => document.body.classList.contains(c));

  // ---------- Render przeglądu ----------
  function renderReview() {

    const root = $("groups");
    root.innerHTML = "";

    const g1 = el("section", { class: "group", "aria-label": "Do sprawdzenia" }, [
      el("div", { class: "group-label" }, [
        "Do sprawdzenia", el("span", { class: "n", text: String(CHECKS.length) }),
        el("span", { class: "hint", text: CHECKS.length ? "Zdecyduj o każdej pozycji, żeby zatwierdzić" : "" })
      ])
    ]);
    if (!CHECKS.length) g1.append(el("p", { class: "empty", text: "Brak pozycji do sprawdzenia." }));
    CHECKS.forEach(it => g1.append(renderRow(it)));
    root.append(g1);

    const sure = ALL.length - CHECKS.length;
    const g2 = el("section", { class: "group", "aria-label": "Pewne" }, [
      el("div", { class: "group-label" }, [
        "Pewne", el("span", { class: "n", text: String(sure) }),
        el("span", { class: "hint", text: sure ? "Domyślnie zostają w podsumowaniu" : "" })
      ])
    ]);
    SECTIONS.forEach(sec => {
      const items = sec.items.filter(i => !i.check);
      if (!items.length && sec.items.length) return;
      g2.append(el("h3", { class: "subhead" }, [sec.name, el("span", { class: "n", text: String(items.length) })]));
      if (!items.length) g2.append(el("p", { class: "empty", text: "brak pozycji" }));
      items.forEach(it => g2.append(renderRow(it)));
    });
    root.append(g2);
    updateBar();
  }

  function quoteLine(text) {
    const m = text.match(/^(Teacher|Student):\s*/);
    const p = el("p");
    if (m) p.append(el("b", { text: m[1] + ": " }), text.slice(m[0].length));
    else p.textContent = text;
    return p;
  }

  function renderRow(it) {
    const row = el("div", { class: "row", tabindex: "-1", "data-no": it.no });
    it.row = row;

    const cat = el("div", { class: "row-cat" });
    if (it.check) cat.append(el("span", { class: "sec", text: it.sec.name }));
    cat.append(el("span", { class: "no", text: it.no }));
    const tag = it.check ? el("span", { class: "tag" }) : null;
    if (tag) cat.append(tag);

    const was = el("span", { class: "was" });
    const is = el("span", { class: "is" });
    const note = el("span", { class: "note" });
    const ctx = el("span", { class: "ctx" });
    const ask = el("span", { class: "ask", text: "Potwierdzenie, nie poprawka – uwzględnić w podsumowaniu?" });
    const line = el("div", { class: "row-line" }, [was, el("span", { class: "arr", text: "→", "aria-hidden": "true" }), is, note, ctx, ask]);

    // Edycja w miejscu
    const inWas = el("input", { type: "text", autocomplete: "off", spellcheck: "false" });
    const inIs = el("input", { type: "text", autocomplete: "off", spellcheck: "false" });
    const save = el("button", { type: "submit", class: "primary" }, ["Zapisz ", el("kbd", { text: "↵" })]);
    const cancel = el("button", { type: "button", class: "secondary" }, ["Anuluj ", el("kbd", { text: "Esc" })]);
    const form = el("form", { class: "row-edit" }, [
      el("label", {}, ["Było", inWas]),
      el("span", { class: "arr", text: "→", "aria-hidden": "true" }),
      el("label", {}, ["Jest", inIs]),
      el("div", { class: "btns" }, [save, cancel])
    ]);
    form.addEventListener("submit", e => { e.preventDefault(); saveEdit(it, inWas.value, inIs.value, true); });
    cancel.addEventListener("click", () => cancelEdit(it));
    form.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); cancelEdit(it); }
    });
    it.inputs = [inWas, inIs];

    const src = el("div", { class: "row-src" }, [
      el("span", { class: "src", text: SOURCE_LABEL[it.src] || it.src }),
      el("span", { class: "peek", text: it.quote[0] || "" })
    ]);
    const quote = el("div", { class: "quote" }, it.quote.map(quoteLine));

    const main = el("div", { class: "row-main" }, [line, form, src, quote]);

    const buttons = Object.keys(LABELS).map(act => {
      const b = el("button", { type: "button", "data-act": act, title: `${LABELS[act]} (${KEYS[act]})` },
        [LABELS[act], el("kbd", { text: KEYS[act] })]);
      b.addEventListener("click", e => {
        e.stopPropagation();
        setActive(it, false);
        if (act === "edit") startEdit(it);
        else decide(it, act, false);
      });
      return b;
    });
    const seg = el("div", { class: "seg", role: "group", "aria-label": `Decyzja dla pozycji ${it.no}` }, buttons);

    const quiet = el("span", { class: "quiet" });
    row.append(cat, main, el("div", { class: "row-act" }, [quiet, seg]));
    row.addEventListener("mousedown", e => {
      if (e.target.closest("input, button")) return;
      setActive(it, false);
    });

    it.sync = () => {
      row.classList.toggle("is-check", it.check);
      row.classList.toggle("is-decided", !!it.state && !it.editing);
      row.classList.toggle("is-removed", it.state === "remove" && !it.editing);
      row.classList.toggle("is-editing", it.editing);
      row.classList.toggle("is-active", it === active);
      row.classList.toggle("show-quote", (it.check && !it.state) || it === active || it.editing);
      const conf = isConfirm(it);
      row.classList.toggle("is-confirm", conf);
      row.classList.toggle("ask-open", conf && !it.state);
      was.textContent = conf ? original(it) : it.wrong;
      is.textContent = it.right;
      ctx.textContent = conf ? it.right : "";
      note.textContent = isEdited(it) && it.state !== "remove" ? "edytowane" : "";
      if (tag) {
        const done = !!it.state && !it.editing;
        tag.className = "tag " + (done ? "done" : "pending");
        tag.textContent = !done ? "do sprawdzenia" : it.state === "remove" ? "usunięte" : it.state === "edit" ? "poprawione" : "zostaje";
      }
      quiet.textContent = { keep: "Zostaje", edit: "Poprawione", remove: "Usunięte" }[it.state] || "";
      buttons.forEach(b => b.setAttribute("aria-pressed",
        String(b.dataset.act === "edit" ? (it.editing || it.state === "edit") : (!it.editing && b.dataset.act === it.state))));
      row.setAttribute("aria-label", `${it.no} ${it.wrong} → ${it.right}`);
    };
    it.sync();
    return row;
  }

  // ---------- Decyzje ----------
  function decide(it, state, advance) {
    it.editing = false; // Zostaw/Usuń w trakcie edycji porzuca niezapisane zmiany
    it.state = state;
    it.sync();
    updateBar();
    if (advance) next(it);
  }

  function startEdit(it) {
    if (it.editing) { it.inputs[0].focus(); return; }
    it.prevState = it.state;
    it.editing = true;
    it.inputs[0].value = it.wrong;
    it.inputs[1].value = it.right;
    it.sync();
    updateBar();
    it.inputs[1].focus();
    it.inputs[1].select();
  }

  function saveEdit(it, w, r, advance) {
    it.wrong = w.trim() || it.wrong;
    it.right = r.trim() || it.right;
    it.editing = false;
    it.state = isEdited(it) ? "edit" : (it.prevState || "keep");
    it.sync();
    updateBar();
    it.row.focus({ preventScroll: true });
    if (advance) next(it);
  }

  function cancelEdit(it) {
    it.editing = false;
    it.state = it.prevState ?? it.state;
    it.sync();
    updateBar();
    it.row.focus({ preventScroll: true });
  }

  // Po decyzji klawiszem: następna nierozstrzygnięta „do sprawdzenia”, a gdy ich brak, następna pozycja.
  function next(it) {
    const idx = ORDER.indexOf(it);
    const open = ORDER.find((o, i) => i > idx && o.check && !o.state) || CHECKS.find(o => !o.state);
    setActive(open || ORDER[Math.min(idx + 1, ORDER.length - 1)], true);
  }

  function setActive(it, scroll) {
    if (!it) return;
    const prev = active;
    active = it;
    if (prev && prev !== it) prev.sync();
    it.sync();
    if (!it.editing) it.row.focus({ preventScroll: true });
    if (scroll) reveal(it.row);
  }

  function move(d) {
    if (!active) { setActive(ORDER[0], true); return; }
    const i = ORDER.indexOf(active) + d;
    if (i >= 0 && i < ORDER.length) setActive(ORDER[i], true);
  }

  // Przewija tylko to okno (bez scrollIntoView), żeby w ramce iframe nie ruszać strony nadrzędnej.
  function reveal(node) {
    const bar = $("bar");
    const bottomLimit = window.innerHeight - (bar ? bar.offsetHeight : 0) - 12;
    const r = node.getBoundingClientRect();
    if (r.top < 12) window.scrollBy(0, r.top - 12);
    else if (r.bottom > bottomLimit) window.scrollBy(0, Math.min(r.bottom - bottomLimit, r.top - 12));
  }

  // ---------- Pasek: licznik i „Zatwierdź” ----------
  function updateBar() {
    const left = pending();
    const removed = ALL.filter(i => i.state === "remove" && !i.editing).length;
    const edited = ALL.filter(i => i.state !== "remove" && isEdited(i)).length;
    $("meta").textContent = `${ALL.length} ${plural(ALL.length, "pozycja", "pozycje", "pozycji")} · do PDF: ${ALL.length - removed} · edytowane: ${edited} · usunięte: ${removed}`;

    const box = $("remaining");
    box.innerHTML = "";
    box.classList.toggle("is-zero", left === 0);
    if (left) box.append("Do sprawdzenia zostało", el("span", { class: "num-big", text: String(left) }));
    else box.append(anyEditing() ? "Dokończ edycję" : "Wszystko sprawdzone");

    const btn = $("approve");
    btn.disabled = left > 0 || anyEditing();
    btn.title = btn.disabled ? "Najpierw zdecyduj o każdej pozycji do sprawdzenia" : "Zatwierdź (⌘/Ctrl + Enter)";
  }

  function approve() {
    if ($("approve").disabled) return;
    renderClean();
    document.body.classList.add("approved");
    window.scrollTo(0, 0);
  }

  // ---------- PDF dla ucznia ----------
  function renderClean() {
    const kept = ALL.filter(i => i.state !== "remove");
    const date = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    $("clean-status").innerHTML = "";
    $("clean-status").append(el("b", { text: "Zatwierdzone. " }),
      `Do PDF trafi ${kept.length} z ${ALL.length} ${plural(ALL.length, "pozycji", "pozycji", "pozycji")}.`);

    const sheet = $("sheet");
    sheet.innerHTML = "";
    sheet.append(
      el("div", { class: "sheet-top" }, [
        el("span", { class: "logo" }, ["WrapItUp", el("span", { class: "dot", text: "." })]),
        el("span", { text: date })
      ]),
      el("h1", { text: "Podsumowanie lekcji" }),
      el("p", { class: "lead", text: `Poprawki z lekcji, sprawdzone przez lektora. Razem: ${kept.length}.` })
    );

    SECTIONS.forEach((sec, si) => {
      const items = sec.items.filter(i => i.state !== "remove");
      const fixes = items.filter(i => !isConfirm(i));
      const good = items.filter(isConfirm);
      sheet.append(el("h2", {}, [
        el("span", { class: "sn", text: String(si + 1).padStart(2, "0") }),
        sec.name,
        el("span", { class: "cnt", text: String(items.length) })
      ]));
      if (!items.length) { sheet.append(el("p", { class: "none", text: "brak pozycji" })); return; }
      const head = el("tr", {}, [
        el("th", { class: "c-no", text: "" }), el("th", { class: "c-was", text: "Było" }),
        el("th", { class: "c-arr", text: "" }), el("th", { class: "c-is", text: "Jest" })
      ]);
      const rows = fixes.map((i, n) => el("tr", {}, [
        el("td", { class: "c-no", text: String(n + 1) }),
        el("td", { class: "c-was", text: i.wrong }),
        el("td", { class: "c-arr", text: "→" }),
        el("td", { class: "c-is", text: i.right })
      ]));
      if (fixes.length) sheet.append(el("table", {}, [el("thead", {}, [head]), el("tbody", {}, rows)]));
      if (good.length) sheet.append(el("div", { class: "good" }, [
        el("h3", { text: "Dobrze" }),
        el("ul", {}, good.map(i => el("li", {}, [el("span", { class: "g-orig", text: original(i) }), el("span", { class: "g-note", text: " – " + i.right })])))
      ]));
    });

    sheet.append(el("div", { class: "sheet-foot" }, [
      el("p", { text: "WrapItUp. Podsumowanie przygotowane z zapisu lekcji i zatwierdzone przez lektora." })
    ]));
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    const d = n % 10, t = n % 100;
    return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
  }

  // ---------- Klawiatura ----------
  document.addEventListener("keydown", e => {
    if (!onReview()) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); approve(); return; }
    if (e.target.closest("input, textarea, select")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j") { e.preventDefault(); move(1); }
    else if (k === "arrowup" || k === "k") { e.preventDefault(); move(-1); }
    else if (!active) return;
    else if (k === "z") { e.preventDefault(); decide(active, "keep", true); }
    else if (k === "u") { e.preventDefault(); decide(active, "remove", true); }
    else if (k === "e") { e.preventDefault(); startEdit(active); }
  });

  $("approve").addEventListener("click", approve);
  $("back").addEventListener("click", () => {
    document.body.classList.remove("approved");
    if (active) setActive(active, false);
  });

  // ?start=przeglad: pomija ekrany zgody i nagrywania (np. w ramce na stronie case study)
  if (new URLSearchParams(location.search).get("start") === "przeglad") {
    document.body.classList.remove("consent", "recording");
  }

  renderReview();
})();
