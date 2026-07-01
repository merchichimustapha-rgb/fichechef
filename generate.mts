import type { Context, Config } from "@netlify/functions";

// Fonction serverless : reçoit un nom de plat depuis le navigateur, appelle
// OpenRouter côté serveur (la clé API reste secrète, jamais envoyée au
// client) et renvoie la fiche technique + les allergènes au format JSON.
//
// Variable d'environnement à définir dans Netlify (Site configuration >
// Environment variables) :
//   OPENROUTER_API_KEY  -> votre clé OpenRouter (obligatoire)
//   OPENROUTER_MODEL    -> ex: anthropic/claude-3.5-sonnet (optionnel)

const ALLERGEN_KEYS = [
  "gluten", "crustaces", "oeufs", "poissons", "arachides", "soja",
  "lait", "fruitsACoque", "celeri", "moutarde", "sesame", "sulfites",
  "lupin", "mollusques",
];

const SYSTEM_PROMPT = `Tu es un chef de cuisine expert en fiches techniques professionnelles et en réglementation européenne sur les allergènes (Règlement UE n°1169/2011 - 14 allergènes à déclaration obligatoire).

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans bloc markdown ni commentaire, respectant exactement ce schéma :
{
  "portions": <entier>,
  "tempsPreparation": "<ex: 25 min>",
  "ingredients": [{"nom": "<string>", "quantite": "<string>", "unite": "<string>"}],
  "etapes": ["<string>", "<string>"],
  "allergenes": {
    "gluten": <bool>, "crustaces": <bool>, "oeufs": <bool>, "poissons": <bool>,
    "arachides": <bool>, "soja": <bool>, "lait": <bool>, "fruitsACoque": <bool>,
    "celeri": <bool>, "moutarde": <bool>, "sesame": <bool>, "sulfites": <bool>,
    "lupin": <bool>, "mollusques": <bool>
  },
  "noteAllergenes": "<courte précision, ex: traces possibles de fruits à coque selon l'atelier>"
}
Sois réaliste et précis pour un usage professionnel en cuisine de restauration/hôtellerie.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  const apiKey = Netlify.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return json(
      {
        error:
          "Clé API absente côté serveur. Ajoutez la variable d'environnement OPENROUTER_API_KEY dans les réglages du site Netlify.",
      },
      500,
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: "Requête invalide (JSON attendu)." }, 400);
  }

  const dishName = (payload?.dishName || "").toString().trim();
  const notes = (payload?.notes || "").toString().trim();

  if (!dishName) {
    return json({ error: "Le nom du plat est requis." }, 400);
  }

  const userPrompt = `Plat : ${dishName}${notes ? `\nPrécisions du chef : ${notes}` : ""}\n\nGénère la fiche technique complète (portions, temps, ingrédients avec quantités, étapes de préparation) et l'analyse des 14 allergènes UE pour ce plat.`;

  const model = Netlify.env.get("OPENROUTER_MODEL") || "anthropic/claude-3.5-sonnet";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://fichechef.app",
        "X-Title": "FicheChef",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return json({ error: `Erreur OpenRouter (${response.status}) : ${errText.slice(0, 300)}` }, response.status);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return json(
        { error: "Réponse de l'IA illisible (format JSON invalide). Réessayez.", raw: cleaned.slice(0, 500) },
        502,
      );
    }

    const result: any = {
      portions: Number(parsed.portions) || 4,
      tempsPreparation: parsed.tempsPreparation || "",
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((i: any) => ({
            nom: i.nom || "",
            quantite: i.quantite != null ? String(i.quantite) : "",
            unite: i.unite || "",
          }))
        : [],
      etapes: Array.isArray(parsed.etapes) ? parsed.etapes.map(String) : [],
      allergenes: {} as Record<string, boolean>,
      noteAllergenes: parsed.noteAllergenes || "",
    };
    ALLERGEN_KEYS.forEach((key) => {
      result.allergenes[key] = Boolean(parsed.allergenes && parsed.allergenes[key]);
    });

    return json(result, 200);
  } catch (err: any) {
    return json({ error: "Erreur serveur : " + err.message }, 500);
  }
};

export const config: Config = {
  path: "/api/generate",
};
