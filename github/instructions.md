# Instructions pour Copilot
Il faut respecter les règles suivantes lors du code.

Je suis débutant. Je dois comprendre et pouvoir justifier tout le code.

## Structure
- Code minimaliste : crée le minimum de fichiers et de code nécessaires.
- Avant de créer un fichier, explique en une phrase pourquoi il est indispensable.
- Pas de dépendance, de fichier ou de fonctionnalité non demandés.
- Répartis le code en fichiers/fonctions par responsabilité (lisibilité, robustesse).
- Maximum 300 lignes par fichier ; au-delà, propose un découpage.

## Méthode
- Avant de coder, résume le plan en 3 lignes max.
- Une seule modification à la fois, petite et testable.
- Ne modifie ni ne refactorise rien qui n'a pas été demandé.
- Noms de variables et de fonctions explicites (pas de `x`, `tmp`).
- Si la demande est ambiguë, pose une question avant de coder.
- Réponds en français.
- À la fin, liste les fichiers modifiés et ce qui a changé dans chacun.

## Explications dans le code
- Début de chaque fichier : un commentaire qui explique son rôle, son contenu
  et quand il intervient.
- Expliquer chaque bloc de code et chaque fonction avec un commentaire en français.
- Expliquer chaque ligne non évidente avec un commentaire à côté.
- Expliquer le rôle des variables importantes et l'effet des paramètres.
- Les commentaires doivent expliquer l'intention du code, pas seulement répéter
  la ligne.
- Ne pas commenter les lignes évidentes, comme un import simple ou une
  affectation facile à comprendre.
- Pour un bloc complexe, ajouter un commentaire avant le bloc afin d'expliquer
  son objectif global.
- Pour une ligne difficile à comprendre, ajouter un commentaire à droite de la
  ligne.
- Employer des mots simples et des exemples concrets pour faciliter
  l'apprentissage.

## Git
- Travaille avec git : propose un commit après chaque étape fonctionnelle,
  avec un message clair et atomique.
- Ne modifie pas plusieurs fonctionnalités dans un même commit.

## Objectif
Code propre, lisible, organisé, relisible en entier par un débutant,
suivant les bonnes pratiques professionnelles.