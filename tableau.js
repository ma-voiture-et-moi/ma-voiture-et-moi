// tableau.js : affichage du tableau de bord (utilise calculs.js et la variable sb)
var COULEURS = { vert: "#2e9e4f", orange: "#e8890c", rouge: "#d63a2f", gris: "#8a8f98" };
var HUILES = ["Minérale", "Semi-synthétique", "Synthétique", "Inconnue"];
var appDiv = document.getElementById("app");
var voitures = [];

function echapper(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function dateISO(d) {
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var j = ("0" + d.getDate()).slice(-2);
  return d.getFullYear() + "-" + m + "-" + j;
}
function message(texte) {
  appDiv.innerHTML = "<p>" + echapper(texte) + "</p>";
}

// Une carte par voiture
function ligne(x) {
  return '<p style="margin:4px 0;color:' + COULEURS[x.couleur] + '">● ' + echapper(x.phrase) + "</p>";
}
function carte(v) {
  var a = MVM.analyser(v);
  var unite = MVM.unite(v);
  var titre = [v.marque, v.modele, v.annee].filter(Boolean).join(" ");
  var h = '<div class="carte" style="border-left:8px solid ' + COULEURS[a.couleur] + '">';
  h += "<h2>" + echapper(titre) + "</h2>";
  if (v.plaque) h += "<p>Plaque : " + echapper(v.plaque) + "</p>";
  if (v.kilometrage != null) h += "<p>Compteur : " + MVM.nombre(v.kilometrage) + " " + unite + "</p>";
  h += ligne(a.vidange) + ligne(a.assurance) + ligne(a.visite);
  h += '<button data-act="km" data-id="' + v.id + '">Mettre à jour mon kilométrage</button>';
  h += '<button data-act="vidange" data-id="' + v.id + '">J\'ai fait ma vidange</button>';
  var lien = MVM.lienWhatsApp(v);
  if (lien) h += '<a class="bouton" href="' + lien + '" target="_blank" rel="noopener">Prévenir sur WhatsApp</a>';
  h += '<div class="zone" id="zone-' + v.id + '"></div></div>';
  return h;
}

// Charger et afficher
async function charger() {
  var s = await sb.auth.getSession();
  if (!s.data.session) { window.location.href = "connexion.html"; return; }
  var r = await sb.from("voitures").select("*").order("created_at", { ascending: true });
  if (r.error) { message("Erreur : " + r.error.message); return; }
  voitures = r.data;
  afficher();
}
function afficher() {
  var h = '<p><a class="bouton" href="voiture.html">Ajouter une voiture</a> <button data-act="sortir">Déconnexion</button></p>';
  if (voitures.length === 0) h += "<p>Aucune voiture enregistrée.</p>";
  voitures.forEach(function (v) { h += carte(v); });
  appDiv.innerHTML = h;
}
function trouver(id) {
  return voitures.find(function (v) { return String(v.id) === String(id); });
}
async function sortir() {
  await sb.auth.signOut();
  window.location.href = "connexion.html";
}

// Formulaire : kilométrage
function formKm(id) {
  var v = trouver(id);
  var z = document.getElementById("zone-" + id);
  z.innerHTML = "<p>Kilométrage actuel (" + MVM.unite(v) + ") :</p>" +
    '<input id="km-' + id + '" type="number" inputmode="numeric" value="' + (v.kilometrage == null ? "" : v.kilometrage) + '">' +
    '<p id="msg-' + id + '"></p>' +
    '<button data-act="ok-km" data-id="' + id + '">Enregistrer</button> <button data-act="annuler">Annuler</button>';
}
async function enregistrerKm(id) {
  var champ = document.getElementById("km-" + id);
  var msg = document.getElementById("msg-" + id);
  if (champ.value === "" || Number(champ.value) < 0) { msg.textContent = "Écris un nombre."; return; }
  var r = await sb.from("voitures").update({ kilometrage: Number(champ.value), kilometrage_maj: dateISO(new Date()) }).eq("id", id);
  if (r.error) { msg.textContent = "Erreur : " + r.error.message; return; }
  await charger();
}

// Formulaire : vidange
function formVidange(id) {
  var v = trouver(id);
  var u = MVM.unite(v);
  var actuelle = MVM.nettoyer(v.type_huile);
  var opts = HUILES.map(function (h) {
    var sel = MVM.nettoyer(h) === actuelle ? " selected" : "";
    return "<option" + sel + ">" + h + "</option>";
  }).join("");
  var inter = MVM.estimerIntervalle(v.type_huile, v.carburant, u);
  var z = document.getElementById("zone-" + id);
  z.innerHTML = "<p>Date de la vidange :</p>" +
    '<input id="vd-' + id + '" type="date" value="' + dateISO(new Date()) + '">' +
    "<p>Km à la vidange (" + u + ") :</p>" +
    '<input id="vk-' + id + '" type="number" inputmode="numeric" value="' + (v.kilometrage == null ? "" : v.kilometrage) + '">' +
    "<p>Huile :</p>" +
    '<select id="vh-' + id + '" data-act="huile" data-id="' + id + '">' + opts + "</select>" +
    "<p>Intervalle proposé (tu peux le changer) :</p>" +
    '<input id="vi-' + id + '" type="number" inputmode="numeric" value="' + inter + '">' +
    "<p><small>" + MVM.ESTIMATION + "</small></p>" +
    '<p id="msg-' + id + '"></p>' +
    '<button data-act="ok-vidange" data-id="' + id + '">Enregistrer</button> <button data-act="annuler">Annuler</button>';
}
async function enregistrerVidange(id) {
  var v = trouver(id);
  var date = document.getElementById("vd-" + id).value;
  var km = document.getElementById("vk-" + id).value;
  var huile = document.getElementById("vh-" + id).value;
  var inter = document.getElementById("vi-" + id).value;
  var msg = document.getElementById("msg-" + id);
  if (!date || km === "" || inter === "" || Number(inter) <= 0) { msg.textContent = "Remplis la date, les km et l'intervalle."; return; }
  var maj = { derniere_vidange_date: date, derniere_vidange_km: Number(km), type_huile: huile, intervalle_km: Number(inter) };
  if (v.kilometrage == null || Number(km) > Number(v.kilometrage)) {
    maj.kilometrage = Number(km);
    maj.kilometrage_maj = dateISO(new Date());
  }
  var r = await sb.from("voitures").update(maj).eq("id", id);
  if (r.error) { msg.textContent = "Erreur : " + r.error.message; return; }
  await charger();
}

// Clics et changements
appDiv.addEventListener("click", function (e) {
  var b = e.target.closest("button");
  if (!b) return;
  var act = b.getAttribute("data-act");
  var id = b.getAttribute("data-id");
  if (act === "sortir") sortir();
  else if (act === "km") formKm(id);
  else if (act === "vidange") formVidange(id);
  else if (act === "ok-km") enregistrerKm(id);
  else if (act === "ok-vidange") enregistrerVidange(id);
  else if (act === "annuler") afficher();
});
appDiv.addEventListener("change", function (e) {
  if (e.target.getAttribute("data-act") !== "huile") return;
  var id = e.target.getAttribute("data-id");
  var v = trouver(id);
  document.getElementById("vi-" + id).value = MVM.estimerIntervalle(e.target.value, v.carburant, MVM.unite(v));
});

charger();
// FIN tableau.js
