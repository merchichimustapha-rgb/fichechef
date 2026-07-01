# FicheChef

Application de cuisine professionnelle : génère des fiches techniques éditables
et l'analyse des 14 allergènes UE (Règl. 1169/2011) pour chaque plat, avec
import de menu et export Excel / Word / PDF.

## Architecture (sécurisée)

```
fichechef/
├── index.html                   ← interface (front-end, statique)
├── netlify.toml                 ← config Netlify (publication)
├── package.json                 ← types nécessaires à la fonction
└── netlify/
    └── functions/
        └── generate.mts         ← fonction serverless (TypeScript/ESM) :
                                    appelle OpenRouter avec la clé API
                                    gardée côté serveur, exposée sur /api/generate
```

La clé API **n'est jamais écrite dans le code ni envoyée au navigateur**.
Elle est stockée comme variable d'environnement sur Netlify et lue uniquement
par `generate.js`, qui s'exécute sur les serveurs de Netlify.

## Déploiement — site déjà créé : `fichechef.netlify.app`

Le site Netlify et la variable `OPENROUTER_API_KEY` ont déjà été configurés.
Il ne reste qu'à publier les fichiers :

1. Ouvrir https://app.netlify.com/projects/fichechef → onglet **Deploys**.
2. Glisser-déposer le fichier `fichechef.zip` (ou le dossier décompressé)
   dans la zone "Drag and drop your site output folder here".
3. Attendre la fin du déploiement (statut "Published").

L'application sera alors disponible sur **https://fichechef.netlify.app**.

### Alternative en ligne de commande (si Node.js est installé)

```
npm install -g netlify-cli
netlify login
netlify deploy --prod --site 8f96e269-cded-4cad-98d9-45322f554288
```

### Mettre à jour le modèle utilisé (optionnel)

Depuis **Site configuration → Environment variables**, vous pouvez ajouter
`OPENROUTER_MODEL` (ex: `anthropic/claude-3.5-sonnet`) pour changer le modèle
utilisé sur OpenRouter.

## Tester en local avant de déployer (facultatif)

```
netlify dev
```
Cela lance le site **et** la fonction ensemble sur `http://localhost:8888`,
exactement comme en production.

## Important — sécurité de la clé

- Ne collez jamais la clé API directement dans `index.html` ou dans un autre
  fichier du projet : tout fichier statique est visible par n'importe qui.
- Si une clé a déjà été partagée en clair (par exemple dans une conversation),
  régénérez-la depuis votre compte OpenRouter avant de l'utiliser ici.
- N'importe qui avec accès au tableau de bord Netlify du site peut voir/modifier
  la variable d'environnement — limitez l'accès au site à votre équipe de confiance.

## Utilisation

1. Ajouter un plat (nom + précisions facultatives), ou importer un fichier
   menu (`.txt` / `.csv`, un plat par ligne).
2. Cliquer **Générer la fiche** sur chaque ticket, ou **Générer toutes les
   fiches en attente** pour tout traiter d'un coup.
3. Modifier librement : nom, portions, ingrédients, étapes, et basculer
   chaque allergène (cliquer sur le tampon) selon votre recette réelle.
4. Choisir le mode d'export par plat (Fiche seule / Allergènes seuls /
   Les deux), puis exporter en Excel, Word ou PDF (impression).
5. Supprimer un plat avec le bouton **×** sur son ticket.
