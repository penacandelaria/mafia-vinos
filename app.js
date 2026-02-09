// Mafia — Carta de vinos (lee Google Sheets publicado como CSV)
var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOV55YmZv_Q1kpcpC2nbNgJLcC87Wzb9ufPmZWKO-DOVqVlczHbYOx5ldOX_jtpXXBnae5uSo43NU2/pub?gid=315352744&single=true&output=csv";

// --- Helpers ---
function el(tag, cls, text){
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function parseCSV(text){
  // Parser simple con soporte de comillas
  var rows = [];
  var row = [];
  var cur = "";
  var inQuotes = false;

  for (var i = 0; i < text.length; i++){
    var c = text[i];
    var next = text[i+1];

    if (c === '"' && inQuotes && next === '"'){ cur += '"'; i++; continue; }
    if (c === '"'){ inQuotes = !inQuotes; continue; }

    if (c === "," && !inQuotes){ row.push(cur); cur = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQuotes){
      if (cur.length || row.length){
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

function norm(s){
  return (s === null || s === undefined) ? "" : String(s).trim();
}

function toMoney(val){
  if (!val) return "";
  var n = String(val).replace(/[^\d]/g, "");
  if (!n) return String(val).trim();
  return "$ " + Number(n).toLocaleString("es-AR");
}

function render(sections){
  var root = document.getElementById("carta");
  root.innerHTML = "";

  for (var sIdx = 0; sIdx < sections.length; sIdx++){
    var sec = sections[sIdx];

    var s = el("section", "section");
    s.appendChild(el("h2", "section__title", sec.categoria));

    for (var i = 0; i < sec.items.length; i++){
      var it = sec.items[i];

      var item = el("div", "item");

      var row = el("div", "row");
      row.appendChild(el("div", "name", it.nombre));
      row.appendChild(el("div", "price", it.precio || ""));
      item.appendChild(row);

      if (it.sub) item.appendChild(el("div", "sub", it.sub));
      if (it.nota) item.appendChild(el("div", "note", it.nota));

      s.appendChild(item);
    }

    root.appendChild(s);
  }
}

function main(){
  var meta = document.getElementById("meta");
  meta.textContent = "Cargando desde planilla…";

  fetch(SHEET_CSV_URL, { cache: "no-store" })
    .then(function(res){ return res.text(); })
    .then(function(csv){
      var rows = parseCSV(csv);
      if (!rows || rows.length < 2){
        throw new Error("CSV vacío o inválido");
      }

      // headers = primera fila
      var headers = [];
      for (var h = 0; h < rows[0].length; h++){
        headers.push(norm(rows[0][h]));
      }

      // data = filas restantes
      var data = [];
      for (var r = 1; r < rows.length; r++){
        var rr = rows[r];
        var hasAny = false;
        for (var k = 0; k < rr.length; k++){
          if (norm(rr[k]) !== ""){ hasAny = true; break; }
        }
        if (!hasAny) continue;

        var obj = {};
        for (var c = 0; c < headers.length; c++){
          obj[headers[c]] = norm(rr[c]);
        }
        data.push(obj);
      }

      // Filtrar disponibles
      var visibles = [];
      for (var j = 0; j < data.length; j++){
        var x = data[j];
        if (norm(x["Disponible"]).toUpperCase() !== "NO"){
          visibles.push(x);
        }
      }

      // Ordenar por Categoría + Orden
      visibles.sort(function(a, b){
        var ca = norm(a["Categoría"]);
        var cb = norm(b["Categoría"]);
        if (ca !== cb) return ca.localeCompare(cb, "es");

        var oa = Number(norm(a["Orden"]) || 9999);
        var ob = Number(norm(b["Orden"]) || 9999);
        return oa - ob;
      });

      // Agrupar por categoría (map simple)
      var cats = [];
      var catItems = {}; // {cat: [items]}

      for (var t = 0; t < visibles.length; t++){
        var v = visibles[t];
        var cat = norm(v["Categoría"]) || "Otros";
        if (!catItems[cat]){
          catItems[cat] = [];
          cats.push(cat);
        }

        var productor = norm(v["Productor"]);
        var region = norm(v["Región"]);
        var uva = norm(v["Uva"]);
        var cosecha = norm(v["Cosecha"]);
        var nota = norm(v["Nota corta"]);

        var subParts = [];
        if (productor) subParts.push(productor);
        if (region) subParts.push(region);
        if (uva) subParts.push(uva);
        if (cosecha) subParts.push(cosecha);

        var precioBot = toMoney(v["Precio botella"]);
        var precioCopa = toMoney(v["Precio copa"]);

        var precio = precioBot;
        if (precioBot && precioCopa) precio = precioBot + " · " + precioCopa;
        else if (!precioBot && precioCopa) precio = precioCopa;

        catItems[cat].push({
          nombre: norm(v["Vino"]) || "(Sin nombre)",
          sub: subParts.join(" · "),
          precio: precio,
          nota: nota
        });
      }

      // Convertir a sections para render
      var sections = [];
      for (var ci = 0; ci < cats.length; ci++){
        var cName = cats[ci];
        sections.push({ categoria: cName, items: catItems[cName] });
      }

      render(sections);

      var d = new Date();
      meta.textContent = "Actualizado: " + d.toLocaleDateString("es-AR");
    })
    .catch(function(err){
      console.error(err);
      var root = document.getElementById("carta");
      root.innerHTML = '<div class="loading">No se pudo cargar la planilla.</div>';
      meta.textContent = "Error de carga";
    });
}

main();
