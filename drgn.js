<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Jeu de Lancer vs Dragon</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      font-family: Arial, sans-serif;
      background-image: url('https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');
      background-size: cover;
      background-position: center;
    }
    #gameCanvas {
      display: block;
      margin: 20px auto;
      background-color: rgba(0, 0, 0, 0.5);
      border: 2px solid #444;
    }
    #message {
      position: absolute;
      top: 20px;
      width: 100%;
      text-align: center;
      color: white;
      font-size: 24px;
      text-shadow: 0 0 5px black;
    }
    #debug {
      position: absolute;
      top: 60px;
      left: 10px;
      color: white;
      font-size: 14px;
      background: rgba(0,0,0,0.7);
      padding: 5px;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div id="message">Prêt ? Cliquez et maintenez pour viser</div>
  <div id="debug"></div>
  <canvas id="gameCanvas" width="800" height="400"></canvas>

  <script>
    // ========== CONFIGURATION ==========
    const CONFIG = {
      // Paramètres visuels
      canvasWidth: 800,
      canvasHeight: 400,
      launcherX: 100,
      launcherY: 200,
      dragonX: 650,
      dragonY: 200,
      
      // Paramètres de jeu (vos modifications)
      grenadeSpeed: 8,        // Vitesse augmentée
      fireballSpeed: 50,      // Vitesse très rapide
      TimeToCheckFormStatut: 2, // Intervalle de vérification
      
      // Sprites (vos URLs)
      spritePaths: {
        launcher: [
          'https://i.imgur.com/PXwz8do.png', // lanc1
          'https://i.imgur.com/I0ri1XS.png',  // lanc2
          'https://i.imgur.com/r97rHmm.png',  // lanc3
          'https://i.imgur.com/WLzkfIV.png',  // lanc4
          'https://i.imgur.com/I0ri1XS.png'   // lanc5 (identique à lanc2?)
        ],
        dragon: [
          'https://i.imgur.com/EEU6BQK.png', // DRG1
          'https://i.imgur.com/Byw5TVt.png', // DRG2
          'https://i.imgur.com/5F7rHkV.png', // DRG3
          'https://i.imgur.com/EEU6BQK.png'  // DRG4 (identique à DRG1?)
        ]
      }
    };

    // ========== VARIABLES DU JEU ==========
    let canvas, ctx;
    let messageDiv, debugDiv;
    let images = {};
    let gameActive = true;
    
    // État du lanceur
    let launcherState = 0;
    let grenade = {
      active: false,
      x: CONFIG.launcherX + 50,
      y: CONFIG.launcherY + 30
    };
    
    // État du dragon
    let dragonState = 0;
    let fireball = {
      active: false,
      x: CONFIG.dragonX,
      y: CONFIG.dragonY + 60
    };
    
    // Cellule Google Sheets
    let FormDoorStepStatus = "B9";
    let cellCheckInterval;

    // ========== INITIALISATION ==========
    window.onload = function() {
      canvas = document.getElementById('gameCanvas');
      ctx = canvas.getContext('2d');
      messageDiv = document.getElementById('message');
      debugDiv = document.getElementById('debug');
      
      // Charger les images
      loadImages().then(() => {
        setupEventListeners();
        startGame();
        startCellChecker();
      }).catch(err => {
        console.error('Erreur de chargement:', err);
        messageDiv.textContent = "Erreur de chargement des images";
        initDemoMode();
      });
      
      updateDebugInfo();
    };

    // ========== FONCTIONS DU JEU ==========
    function loadImages() {
      const promises = [];
      images.launcher = [];
      images.dragon = [];
      
      // Charger les sprites du lanceur
      CONFIG.spritePaths.launcher.forEach((src, index) => {
        promises.push(new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { 
            images.launcher[index] = img; 
            resolve(); 
          };
          img.onerror = () => {
            console.error(`Erreur chargement: ${src}`);
            reject(`Erreur de chargement: ${src}`);
          };
          img.src = src;
          img.crossOrigin = "Anonymous"; // Pour les images externes
        }));
      });
      
      // Charger les sprites du dragon
      CONFIG.spritePaths.dragon.forEach((src, index) => {
        promises.push(new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { 
            images.dragon[index] = img; 
            resolve(); 
          };
          img.onerror = () => {
            console.error(`Erreur chargement: ${src}`);
            reject(`Erreur de chargement: ${src}`);
          };
          img.src = src;
          img.crossOrigin = "Anonymous";
        }));
      });
      
      return Promise.all(promises);
    }

    function initDemoMode() {
      // Créer des images de démo colorées
      images.launcher = CONFIG.spritePaths.launcher.map((_, i) => {
        const img = new Image();
        img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="${
          ['gray','blue','green','black','purple'][i]}"/><text x="40" y="50" fill="white" text-anchor="middle">lanc${i+1}</text></svg>`;
        return img;
      });
      
      images.dragon = CONFIG.spritePaths.dragon.map((_, i) => {
        const img = new Image();
        img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${
          ['darkred','red','orange','yellow'][i]}"/><text x="60" y="60" fill="white" text-anchor="middle">DRG${i+1}</text></svg>`;
        return img;
      });
      
      setupEventListeners();
      startGame();
      startCellChecker();
    }

    function setupEventListeners() {
      canvas.addEventListener('mousedown', startAiming);
      canvas.addEventListener('mouseup', throwGrenade);
      canvas.addEventListener('mouseleave', cancelAiming);
      
      // Pour tactiles
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startAiming();
      }, {passive: false});
      
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        throwGrenade();
      }, {passive: false});
    }

    function startGame() {
      gameActive = true;
      gameLoop();
    }

    function gameLoop() {
      if (!gameActive) return;
      
      update();
      render();
      requestAnimationFrame(gameLoop);
    }

    function update() {
      // Mouvement de la grenade
      if (grenade.active) {
        grenade.x += CONFIG.grenadeSpeed;
        
        // Collision avec dragon
        if (grenade.x >= CONFIG.dragonX) {
          if (dragonState === 1) { // Si dragon en position d'attaque
            endGame(true); // Victoire
          } else if (grenade.x > CONFIG.canvasWidth) {
            resetGrenade();
          }
        }
      }
      
      // Mouvement de la boule de feu (très rapide avec votre réglage)
      if (fireball.active) {
        fireball.x -= CONFIG.fireballSpeed;
        
        // Collision avec lanceur
        if (fireball.x <= CONFIG.launcherX + 50) {
          endGame(false); // Défaite
        }
      }
    }

    function render() {
      // Fond
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
      
      // Dragon
      if (images.dragon[dragonState]) {
        ctx.drawImage(images.dragon[dragonState], CONFIG.dragonX, CONFIG.dragonY, 120, 120);
      }
      
      // Lanceur
      if (images.launcher[launcherState]) {
        ctx.drawImage(images.launcher[launcherState], CONFIG.launcherX, CONFIG.launcherY, 80, 100);
      }
      
      // Grenade
      if (grenade.active) {
        ctx.beginPath();
        ctx.arc(grenade.x, grenade.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#2ecc71";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.stroke();
      }
      
      // Boule de feu (rendu amélioré pour haute vitesse)
      if (fireball.active) {
        const gradient = ctx.createRadialGradient(
          fireball.x, fireball.y, 5,
          fireball.x, fireball.y, 25
        );
        gradient.addColorStop(0, 'yellow');
        gradient.addColorStop(0.7, 'orange');
        gradient.addColorStop(1, 'red');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fireball.x, fireball.y, 25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function startAiming() {
      if (gameActive && !grenade.active && !fireball.active && launcherState === 0) {
        launcherState = 1; // Position de préparation
        updateDebugInfo();
      }
    }

    function cancelAiming() {
      if (launcherState === 1) {
        launcherState = 0; // Annuler si souris quitte
        updateDebugInfo();
      }
    }

    function throwGrenade() {
      if (gameActive && launcherState === 1) {
        launcherState = 2; // Position de lancer
        grenade.active = true;
        grenade.x = CONFIG.launcherX + 50;
        console.log("Grenade lancée !");
        updateDebugInfo();
      }
    }

    function resetGrenade() {
      grenade.active = false;
      launcherState = 0; // Retour à l'état initial
      grenade.x = CONFIG.launcherX + 50;
      updateDebugInfo();
    }

    function endGame(win) {
      gameActive = false;
      clearInterval(cellCheckInterval);
      
      if (win) {
        launcherState = 4; // Position victoire
        dragonState = 3;   // Dragon vaincu
        showMessage("Victoire ! Grenade dans la gueule !");
      } else {
        launcherState = 3; // Position KO
        showMessage("Perdu ! Le dragon vous a brûlé !");
      }
      updateDebugInfo();
    }

    function showMessage(text) {
      messageDiv.textContent = text;
    }

    function updateDebugInfo() {
      debugDiv.innerHTML = `
        <div><strong>Config:</strong></div>
        <div>• Vitesse grenade: ${CONFIG.grenadeSpeed}</div>
        <div>• Vitesse boule de feu: ${CONFIG.fireballSpeed}</div>
        <div>• Vérif cellule: ${CONFIG.TimeToCheckFormStatut}s</div>
        <div><strong>État:</strong></div>
        <div>• Lanceur: ${launcherState}</div>
        <div>• Dragon: ${dragonState}</div>
        <div>• Grenade: ${grenade.active ? 'active' : 'inactive'}</div>
        <div>• Boule de feu: ${fireball.active ? 'active' : 'inactive'}</div>
      `;
    }

    // ========== FONCTIONS CELLULE ==========
    function read(cel) {
      const url = `https://script.google.com/macros/s/AKfycbwanne3dMvFx8x8cIFt7b2kRMLTWFNPwjaRWDHKBxP4S1YoFce3UCHOJOZrQa58I3QwUQ/exec?cellule=${encodeURIComponent(cel)}`;

      return fetch(url)
        .then(response => response.text())
        .then(result => {
          const val = result.trim();
          console.log("📖 Lecture cellule:", val);
          return val;
        })
        .catch(error => {
          console.error("❌ Erreur de lecture:", error);
          return "off"; // Par défaut si erreur
        });
    }

    function startCellChecker() {
      cellCheckInterval = setInterval(() => {
        if (!gameActive) return;
        
        read(FormDoorStepStatus).then(value => {
          if (!value) return;
          
          if (value.toLowerCase() === "on") {
            // Dragon en position d'attaque (bouche ouverte)
            dragonState = 1;
            showMessage("Dragon: Bouche ouverte - Prêt à lancer !");
          } else if (dragonState === 1) {
            // Dragon lance l'attaque
            dragonState = 2;
            fireball.active = true;
            fireball.x = CONFIG.dragonX;
            showMessage("Dragon: Attaque !");
          }
          
          updateDebugInfo();
        });
      }, CONFIG.TimeToCheckFormStatut * 1000);
    }
  </script>
</body>
</html>
