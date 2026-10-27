// calculs.js : règles et calculs de Ma voiture et moi
var MVM = {};
MVM.KM_PAR_MILE = 1.609344;
MVM.MOIS = 6;
MVM.JOURS_ORANGE = 30;
MVM.ESTIMATION = "Estimation générale, pas une donnée du constructeur";
MVM.TABLE_HUILE = {
  minerale: { essence: 5000, diesel: 4000 },
  semi: { essence: 7500, diesel: 6000 },
  synthetique: { essence: 10000, diesel: 8000 },
  inconnue: { essence: 5000, diesel: 5000 }
};
// Usage : km roulés par jour (estimation) et jours avant de demander une mise à jour
MVM.KM_PAR_JOUR = { peu: 30, beaucoup: 120 };
MVM.JOURS_MAJ = { peu: 30, beaucoup: 14 };

// Unité du compteur : 'km' ou 'miles'
MVM.unite = function (v) {
  return v && v.unite_compteur === "miles" ? "miles" : "km";
};
MVM.seuil = function (unite) {
  return unite === "miles" ? 300 : 500;
};
MVM.intervalleParDefaut = function (unite) {
  return unite === "miles" ? 3100 : 5000;
};

// Nettoie un texte : minuscules, sans accents
MVM.nettoyer = function (t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Estimation de l'intervalle selon l'huile et le carburant
MVM.estimerIntervalle = function (huile, carburant, unite) {
  var h = MVM.nettoyer(huile);
  var type = "inconnue";
  if (h.indexOf("semi") >= 0) type = "semi";
  else if (h.indexOf("synth") >= 0) type = "synthetique";
  else if (h.indexOf("miner") >= 0) type = "minerale";
  var c = MVM.nettoyer(carburant);
  var diesel = c.indexOf("diesel") >= 0 || c.indexOf("gasoil") >= 0;
  var km = MVM.TABLE_HUILE[type][diesel ? "diesel" : "essence"];
  if (unite === "miles") return Math.round(km / MVM.KM_PAR_MILE / 100) * 100;
  return km;
};

// Dates
MVM.aujourdhui = function () {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
MVM.lireDate = function (texte) {
  if (!texte) return null;
  var p = String(texte).slice(0, 10).split("-");
  if (p.length !== 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
};
MVM.joursEntre = function (d1, d2) {
  return Math.round((d2 - d1) / 86400000);
};
MVM.ajouterMois = function (date, n) {
  var jour = date.getDate();
  var r = new Date(date.getFullYear(), date.getMonth() + n, 1);
  var dernier = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(jour, dernier));
  return r;
};
MVM.formatDate = function (d) {
  var j = ("0" + d.getDate()).slice(-2);
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  return j + "/" + m + "/" + d.getFullYear();
};
MVM.nombre = function (n) {
  return Math.round(n).toLocaleString("fr-FR");
};

// Jours depuis la dernière mise à jour du kilométrage (null si inconnu)
MVM.joursDepuisMaj = function (v) {
  var d = MVM.lireDate(v.kilometrage_maj);
  if (!d) return null;
  return Math.max(0, MVM.joursEntre(d, MVM.aujourdhui()));
};

// Kilométrage estimé : km actuel + jours passés x km par jour (si l'usage est connu)
MVM.kmEstime = function (v) {
  var reel = Number(v.kilometrage);
  var parJour = MVM.KM_PAR_JOUR[v.usage_vehicule];
  var jours = MVM.joursDepuisMaj(v);
  if (v.kilometrage == null || !parJour || jours === null) {
    return { km: reel, estime: false, jours: jours };
  }
  if (MVM.unite(v) === "miles") parJour = parJour / MVM.KM_PAR_MILE;
  return { km: Math.round(reel + jours * parJour), estime: true, jours: jours };
};

// Faut-il demander une mise à jour du kilométrage ?
MVM.besoinMaj = function (v) {
  var limite = MVM.JOURS_MAJ[v.usage_vehicule];
  var jours = MVM.joursDepuisMaj(v);
  if (!limite || jours === null) return { besoin: false, jours: jours };
  return { besoin: jours > limite, jours: jours };
};

// Vidange : km_restant = intervalle - (km_actuel - km_derniere_vidange)
MVM.vidange = function (v) {
  var unite = MVM.unite(v);
  var dernier = v.derniere_vidange_km;
  if (dernier == null || v.kilometrage == null) {
    return { couleur: "gris", phrase: "Vidange : informations manquantes." };
  }
  if (Number(dernier) > Number(v.kilometrage)) {
    return { couleur: "gris", phrase: "Vérifie tes kilométrages." };
  }
  var est = MVM.kmEstime(v);
  var intervalle = Number(v.intervalle_km) || MVM.intervalleParDefaut(unite);
  var restants = intervalle - (est.km - Number(dernier));
  var dateVidange = MVM.lireDate(v.derniere_vidange_date);
  var jours = null;
  if (dateVidange) {
    jours = MVM.joursEntre(MVM.aujourdhui(), MVM.ajouterMois(dateVidange, MVM.MOIS));
  }
  var couleur = "vert";
  if (restants <= MVM.seuil(unite) || (jours !== null && jours <= MVM.JOURS_ORANGE)) couleur = "orange";
  if (restants <= 0 || (jours !== null && jours < 0)) couleur = "rouge";
  var env = est.estime ? "environ " : "";
  var fin = est.estime ? " (estimé)." : ".";
  var phrase;
  if (restants > 0) phrase = "Il reste " + env + MVM.nombre(restants) + " " + unite + " avant la vidange" + fin;
  else if (restants === 0) phrase = "La vidange est à faire maintenant.";
  else phrase = "Vidange dépassée " + (est.estime ? "d'environ " : "de ") + MVM.nombre(-restants) + " " + unite + fin;
  if (jours !== null && jours < 0) phrase += " Plus de " + MVM.MOIS + " mois depuis la dernière vidange.";
  else if (jours !== null && jours <= MVM.JOURS_ORANGE) phrase += " Date limite dans " + jours + " jour(s).";
  return { couleur: couleur, phrase: phrase };
};

// Assurance et visite technique
MVM.echeance = function (nom, dateTexte) {
  var d = MVM.lireDate(dateTexte);
  if (!d) return { couleur: "gris", phrase: nom + " : date non renseignée." };
  var jours = MVM.joursEntre(MVM.aujourdhui(), d);
  if (jours < 0) return { couleur: "rouge", phrase: nom + " : dépassée depuis " + (-jours) + " jour(s)." };
  if (jours === 0) return { couleur: "orange", phrase: nom + " se termine aujourd'hui." };
  if (jours <= MVM.JOURS_ORANGE) return { couleur: "orange", phrase: nom + " se termine dans " + jours + " jour(s)." };
  return { couleur: "vert", phrase: nom + " : valable jusqu'au " + MVM.formatDate(d) + "." };
};

// La carte prend la pire couleur
MVM.pire = function (couleurs) {
  var ordre = ["gris", "vert", "orange", "rouge"];
  var meilleur = 0;
  couleurs.forEach(function (c) {
    if (ordre.indexOf(c) > meilleur) meilleur = ordre.indexOf(c);
  });
  return ordre[meilleur];
};
MVM.analyser = function (v) {
  var vid = MVM.vidange(v);
  var ass = MVM.echeance("Assurance", v.assurance_fin);
  var vis = MVM.echeance("Visite technique", v.visite_technique_fin);
  return {
    vidange: vid, assurance: ass, visite: vis,
    maj: MVM.besoinMaj(v), estime: MVM.kmEstime(v),
    couleur: MVM.pire([vid.couleur, ass.couleur, vis.couleur])
  };
};

// WhatsApp
MVM.numeroWhatsApp = function (contact) {
  var n = String(contact || "").replace(/\D/g, "");
  if (n.length === 8) n = "226" + n;
  return n.length >= 8 ? n : "";
};
MVM.messageWhatsApp = function (v) {
  var a = MVM.analyser(v);
  var lignes = [];
  [a.vidange, a.assurance, a.visite].forEach(function (x) {
    if (x.couleur === "orange" || x.couleur === "rouge") lignes.push("- " + x.phrase);
  });
  if (lignes.length === 0) return "";
  var nom = [v.marque, v.modele, v.plaque].filter(Boolean).join(" ");
  return "Bonjour, rappel pour ta voiture (" + nom + ") :\n" + lignes.join("\n");
};
MVM.lienWhatsApp = function (v) {
  var num = MVM.numeroWhatsApp(v.contact_rappel);
  var msg = MVM.messageWhatsApp(v);
  if (!num || !msg) return "";
  return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg);
};
// FIN calculs.js
