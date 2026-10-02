# carte-pistes-cyclables

## Installation et compilation

### Prérequis

Installez [Node.js](https://nodejs.org/), qui inclut npm. npm permet d'installer les dépendances et d'exécuter les commandes du projet.

### Installer le projet

Depuis le dossier du projet, ouvrez un terminal et installez les dépendances :

```bash
npm install
```

Cette commande télécharge les outils et bibliothèques nécessaires. Elle est à exécuter après avoir récupéré le projet, puis de nouveau si ses dépendances changent.

### Lancer le site pendant le développement

```bash
npm run dev
```

Cette commande démarre un serveur local. Ouvrez dans votre navigateur l'adresse affichée dans le terminal. Le serveur facilite les essais pendant que vous modifiez le code ; il ne crée pas les fichiers de production.

### Créer la version de production

```bash
npm run build
```

Vite rassemble et prépare les fichiers du site, notamment `index.html` et ceux de `src/`. Le résultat prêt à être déployé est placé dans le dossier `dist/`.

Pour prévisualiser cette version sur votre ordinateur, après la compilation, exécutez :

```bash
npm run preview
```

Le terminal affiche l'adresse locale à ouvrir dans votre navigateur. Cette prévisualisation sert à vérifier la version générée ; elle ne publie pas le site sur Internet.
