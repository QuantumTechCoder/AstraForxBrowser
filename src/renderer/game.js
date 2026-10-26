(function () {
  'use strict';

  // --- Web Audio Synthesizer (Zero asset dependency) ---
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freqStart, freqEnd, type, duration, gainStart = 0.15) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), ctx.currentTime + duration);
      gain.gain.setValueAtTime(gainStart, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  function playJump() {
    playTone(200, 480, 'square', 0.12, 0.12);
  }

  function playDoubleJump() {
    playTone(450, 920, 'sine', 0.15, 0.15);
  }

  function playPoint() {
    playTone(600, 1200, 'triangle', 0.2, 0.18);
  }

  function playCrash() {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (_) {
      playTone(150, 40, 'sawtooth', 0.25, 0.2);
    }
  }

  // --- Game Engine ---
  const CANVAS_WIDTH = 640;
  const CANVAS_HEIGHT = 220;
  const GROUND_Y = 185;

  let canvas, ctx;
  let state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('astra_runner_best') || '0', 10);
  let speed = 4;
  let frame = 0;

  // Player properties
  const player = {
    x: 60,
    y: GROUND_Y - 24,
    w: 26,
    h: 18,
    vy: 0,
    gravity: 0.65,
    jumpPower: -10.5,
    isGrounded: false,
    jumpCount: 0,
    maxJumps: 2,
    diving: false,
    trail: [],
  };

  // World obstacles & collectibles
  let obstacles = [];
  let orbs = [];
  let stars = [];
  let gridOffset = 0;

  function initStars() {
    stars = [];
    for (let i = 0; i < 45; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (GROUND_Y - 20),
        size: Math.random() * 1.8 + 0.5,
        speed: Math.random() * 0.4 + 0.2,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }
  }

  function resetGame() {
    score = 0;
    speed = 4.2;
    frame = 0;
    player.y = GROUND_Y - 24;
    player.vy = 0;
    player.jumpCount = 0;
    player.isGrounded = true;
    player.diving = false;
    player.trail = [];
    obstacles = [];
    orbs = [];
    initStars();
  }

  function spawnObstacle() {
    const isDrone = Math.random() < 0.35 && score > 200;
    if (isDrone) {
      obstacles.push({
        type: 'drone',
        x: CANVAS_WIDTH + 20,
        y: GROUND_Y - 48,
        w: 22,
        h: 14,
        passed: false,
      });
    } else {
      const isTall = Math.random() < 0.3;
      obstacles.push({
        type: 'spike',
        x: CANVAS_WIDTH + 20,
        y: isTall ? GROUND_Y - 32 : GROUND_Y - 20,
        w: isTall ? 14 : 18,
        h: isTall ? 32 : 20,
        passed: false,
      });
    }
  }

  function spawnOrb() {
    orbs.push({
      x: CANVAS_WIDTH + 30,
      y: GROUND_Y - (Math.random() * 55 + 25),
      r: 6,
      pulse: 0,
    });
  }

  function handleJump() {
    getAudioCtx();
    if (state === 'IDLE' || state === 'GAMEOVER') {
      resetGame();
      state = 'PLAYING';
      playJump();
      return;
    }
    if (player.jumpCount < player.maxJumps) {
      if (player.jumpCount === 0) playJump();
      else playDoubleJump();
      player.vy = player.jumpPower;
      player.jumpCount++;
      player.isGrounded = false;
    }
  }

  function handleDive(isDown) {
    player.diving = isDown;
    if (isDown && !player.isGrounded) {
      player.vy += 4.5;
    }
  }

  function checkCollision(r1, r2) {
    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.y < r2.y + r2.h &&
      r1.y + r1.h > r2.y
    );
  }

  function update() {
    frame++;

    // Background Stars
    for (const s of stars) {
      s.x -= s.speed * (state === 'PLAYING' ? speed * 0.4 : 0.6);
      if (s.x < 0) s.x = CANVAS_WIDTH;
    }

    if (state !== 'PLAYING') return;

    // Progression
    score += 1;
    if (score % 400 === 0 && speed < 9.5) {
      speed += 0.4;
      playPoint();
    }

    // Grid scrolling
    gridOffset = (gridOffset + speed) % 24;

    // Player physics
    player.vy += player.gravity;
    player.y += player.vy;

    if (player.y >= GROUND_Y - player.h) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.isGrounded = true;
      player.jumpCount = 0;
    }

    // Trail particles
    if (frame % 2 === 0) {
      player.trail.push({
        x: player.x - 4,
        y: player.y + player.h / 2 + (Math.random() * 4 - 2),
        life: 1.0,
      });
    }
    for (let i = player.trail.length - 1; i >= 0; i--) {
      player.trail[i].x -= speed;
      player.trail[i].life -= 0.08;
      if (player.trail[i].life <= 0) player.trail.splice(i, 1);
    }

    // Obstacle spawning
    const minGap = Math.max(70, 130 - speed * 5);
    const lastObs = obstacles[obstacles.length - 1];
    if (!lastObs || (CANVAS_WIDTH - lastObs.x > minGap && Math.random() < 0.025)) {
      spawnObstacle();
    }

    // Orb spawning
    if (frame % 180 === 0 && Math.random() < 0.6) {
      spawnOrb();
    }

    // Obstacle updates & collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= speed;

      const playerHitbox = {
        x: player.x + 3,
        y: player.y + (player.diving ? 6 : 2),
        w: player.w - 6,
        h: player.diving ? player.h - 6 : player.h - 4,
      };

      if (checkCollision(playerHitbox, obs)) {
        state = 'GAMEOVER';
        playCrash();
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem('astra_runner_best', String(bestScore));
        }
        return;
      }

      if (obs.x + obs.w < 0) {
        obstacles.splice(i, 1);
      }
    }

    // Orbs update
    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];
      orb.x -= speed;
      orb.pulse += 0.1;

      const dist = Math.hypot(
        player.x + player.w / 2 - orb.x,
        player.y + player.h / 2 - orb.y
      );
      if (dist < 18) {
        score += 50;
        playPoint();
        orbs.splice(i, 1);
        continue;
      }
      if (orb.x < -10) orbs.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Deep Void Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#040508');
    sky.addColorStop(1, '#090d16');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

    // Stars
    for (const s of stars) {
      ctx.fillStyle = `rgba(0, 240, 255, ${s.opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Perspective Ground Wireframe Grid
    ctx.fillStyle = '#06080e';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Ground Laser Horizon Line
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Perspective Vertical Grid Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    for (let x = -gridOffset; x < CANVAS_WIDTH + 30; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x - 20, CANVAS_HEIGHT);
      ctx.stroke();
    }
    // Horizontal sub-grid lines
    for (let y = GROUND_Y + 10; y < CANVAS_HEIGHT; y += 12) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Player Trail
    for (const t of player.trail) {
      ctx.fillStyle = `rgba(0, 240, 255, ${t.life * 0.6})`;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5 * t.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Ship (Cyber Neon Arrow)
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.diving) {
      ctx.scale(1.1, 0.6);
    }
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(player.w, player.h / 2); // Nose
    ctx.lineTo(0, 0); // Top wing
    ctx.lineTo(6, player.h / 2); // Inner engine notch
    ctx.lineTo(0, player.h); // Bottom wing
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine Core Glow
    ctx.fillStyle = player.jumpCount > 0 ? '#a855f7' : '#00ff9d';
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(6, player.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Obstacles
    for (const obs of obstacles) {
      if (obs.type === 'drone') {
        // Floating Cyber Drone (Violet/Amber)
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.rect(obs.x, obs.y, obs.w, obs.h);
        ctx.fill();
        ctx.stroke();
        // Drone scanline eye
        ctx.fillStyle = '#ff3366';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, 4);
      } else {
        // Laser Spikes (Neon Rose)
        ctx.fillStyle = '#ff3366';
        ctx.strokeStyle = '#ff88aa';
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Energy Orbs
    for (const orb of orbs) {
      const pulseR = orb.r + Math.sin(orb.pulse) * 1.5;
      ctx.fillStyle = '#00ff9d';
      ctx.shadowColor = '#00ff9d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, pulseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, pulseR * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // HUD Display
    ctx.font = '11px "Consolas", monospace';
    ctx.fillStyle = '#79869e';
    ctx.fillText(`BEST: ${String(bestScore).padStart(6, '0')}`, CANVAS_WIDTH - 130, 24);

    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`DIST: ${String(score).padStart(6, '0')}m`, CANVAS_WIDTH - 130, 42);

    if (state === 'PLAYING') {
      ctx.fillStyle = 'rgba(0, 255, 157, 0.7)';
      ctx.fillText(`SPEED: ${(speed / 4).toFixed(1)}x`, 20, 24);
    }

    // Overlay Prompts
    if (state === 'IDLE') {
      ctx.fillStyle = 'rgba(5, 6, 8, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.font = 'bold 15px "Consolas", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fillText('// ASTRA :: VOID RUNNER //', CANVAS_WIDTH / 2, 90);

      ctx.shadowBlur = 0;
      ctx.font = '11px "Consolas", monospace';
      ctx.fillStyle = '#f0f4fc';
      ctx.fillText('[ PRESS SPACE OR CLICK TO LAUNCH ]', CANVAS_WIDTH / 2, 120);

      ctx.fillStyle = '#79869e';
      ctx.fillText('CONTROLS: SPACE/UP = BOOST (DOUBLE JUMP) | DOWN = DIVE', CANVAS_WIDTH / 2, 145);
      ctx.textAlign = 'left';
    } else if (state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(5, 6, 8, 0.75)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.font = 'bold 15px "Consolas", monospace';
      ctx.fillStyle = '#ff3366';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 12;
      ctx.fillText('// TELEMETRY TERMINATED //', CANVAS_WIDTH / 2, 85);

      ctx.shadowBlur = 0;
      ctx.font = '12px "Consolas", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(`FINAL DISTANCE: ${String(score).padStart(6, '0')}m`, CANVAS_WIDTH / 2, 115);

      ctx.fillStyle = '#f0f4fc';
      ctx.fillText('[ PRESS SPACE TO RETRY ]', CANVAS_WIDTH / 2, 145);
      ctx.textAlign = 'left';
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // --- Public API ---
  window.AstraRunner = {
    init: function () {
      canvas = document.getElementById('game-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      initStars();
      resetGame();

      // Keyboard Listeners
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
          // Avoid scrolling page
          e.preventDefault();
          handleJump();
        } else if (e.code === 'ArrowDown' || e.key === 's') {
          handleDive(true);
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowDown' || e.key === 's') {
          handleDive(false);
        }
      });

      // Mouse / Touch Controls
      canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleJump();
      });
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleJump();
      }, { passive: false });

      requestAnimationFrame(loop);
    },
    start: function () {
      handleJump();
    },
    getState: function () {
      return state;
    },
  };
})();
