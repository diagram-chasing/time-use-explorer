<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  
  const dispatch = createEventDispatcher<{
    hideGame: void;
    hideGamePermanently: void;
    showLoadingSpinner: void;
  }>();
  
  // Props
  export let loading: boolean = false;
  export let dbReady: boolean = false;
  export let show: boolean = true;
  
  // Don't show again state
  let dontShowAgain = false;
  let gameApproved = false;
  let componentMounted = false;
  
  // Skip game if DB is already loaded
  $: if (componentMounted && dbReady && !loading && !gameApproved) {
    dispatch('hideGame');
  }
  
  // Game state
  let gameStarted = false;
  let gameScore = 0;
  let gameOver = false;
  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number | null = null;
  let lastFrameTime = 0;
  
  // Types
  type Obstacle = {
    x: number;
    width: number;
    height: number;
    passed: boolean;
  };
  
  // Game constants
  const GRAVITY = 0.6;
  const JUMP_FORCE = -12;
  const GROUND_HEIGHT = 20;
  const OBSTACLE_SPEED = 3.5;
  const OBSTACLE_WIDTH = 20;
  const OBSTACLE_MIN_HEIGHT = 30;
  const OBSTACLE_MAX_HEIGHT = 60;
  const OBSTACLE_MIN_GAP = 180;
  const OBSTACLE_MAX_GAP = 300;
  const PLAYER_WIDTH = 20;
  const PLAYER_HEIGHT = 30;
  const PLAYER_X = 50;
  // Default canvas size
  const DEFAULT_CANVAS_WIDTH = 500;
  const CANVAS_HEIGHT = 200;
  let CANVAS_WIDTH = DEFAULT_CANVAS_WIDTH * 0.5;
  
  // For crisp rendering
  let pixelRatio = 1;
  
  // Game objects
  let player = {
    x: PLAYER_X,
    y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    velocityY: 0,
    isJumping: false
  };
  
  let obstacles: Obstacle[] = [];
  let nextObstacleTime = 0;
  
  // Colors
  const colors = {
    background: '#FCFCFA',
    player: '#005AFF', // Blue
    obstacle: '#E20613', // Red
    ground: '#121212',
    text: '#121212',
    grid: 'rgba(18, 18, 18, 0.05)',
    loading: '#FFD100' // Yellow
  };
  
  function resetGame() {
    player = {
      x: PLAYER_X,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityY: 0,
      isJumping: false
    };
    obstacles = [];
    nextObstacleTime = 0;
    gameScore = 0;
    gameOver = false;
  }
  
  function startGame() {
    if (!browser || gameStarted) return;
    resetGame();
    gameStarted = true;
    requestAnimationFrame(gameLoop);
  }
  
  function stopGame() {
    if (!browser) return;
    
    gameStarted = false;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
  
  function createObstacle() {
    const height = Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT) + OBSTACLE_MIN_HEIGHT;
    const gapSize = Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP) + OBSTACLE_MIN_GAP;
    obstacles.push({
      x: CANVAS_WIDTH,
      width: OBSTACLE_WIDTH,
      height,
      passed: false
    });
    nextObstacleTime = gapSize / OBSTACLE_SPEED;
  }
  
  function gameLoop(timestamp: number) {
    if (!ctx) return;
    
    // Calculate delta time
    const deltaTime = timestamp - lastFrameTime || 0;
    lastFrameTime = timestamp;
    
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw grid lines (similar to app background)
    drawGridLines();
    
    // Draw ground
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    
    // Update player
    if (player.isJumping) {
      player.velocityY += GRAVITY;
      player.y += player.velocityY;
      
      // Check ground collision
      if (player.y >= CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT) {
        player.y = CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT;
        player.velocityY = 0;
        player.isJumping = false;
      }
    }
    
    // Draw player
    ctx.fillStyle = colors.player;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Update and draw obstacles
    nextObstacleTime -= deltaTime / 16;
    if (nextObstacleTime <= 0) {
      createObstacle();
    }
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= OBSTACLE_SPEED;
      
      // Draw obstacle
      ctx.fillStyle = colors.obstacle;
      ctx.fillRect(obstacle.x, CANVAS_HEIGHT - GROUND_HEIGHT - obstacle.height, obstacle.width, obstacle.height);
      
      // Check for collision
      if (
        player.x < obstacle.x + obstacle.width &&
        player.x + player.width > obstacle.x &&
        player.y + player.height > CANVAS_HEIGHT - GROUND_HEIGHT - obstacle.height
      ) {
        gameOver = true;
      }
      
      // Check if obstacle is passed
      if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
        obstacle.passed = true;
        gameScore++;
      }
      
      // Remove obstacles that are off screen
      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }
    }
    
    // Draw score
    ctx.fillStyle = colors.text;
    ctx.font = "16px 'JetBrains Mono Variable', monospace";
    ctx.fillText(`Score: ${gameScore}`, 20, 30);
    
    // Draw loading status if applicable
    if (!dbReady) {
      ctx.fillStyle = colors.loading;
      ctx.font = "12px 'JetBrains Mono Variable', monospace";
      ctx.fillText(`Database loading...`, CANVAS_WIDTH - 150, 20);
    }
    
    // Check game over
    if (gameOver) {
      ctx.fillStyle = 'rgba(18, 18, 18, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      ctx.fillStyle = '#FCFCFA';
      ctx.font = "20px 'JetBrains Mono Variable', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);
      ctx.fillText(`Score: ${gameScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
      ctx.font = "14px 'JetBrains Mono Variable', monospace";
      ctx.fillText('Press SPACE to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 45);
      ctx.textAlign = 'left';
      
      stopGame();
      return;
    }
    
    // Continue game loop
    animationId = requestAnimationFrame(gameLoop);
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      
      if (gameOver) {
        resetGame();
        startGame();
        return;
      }
      
      if (!gameStarted) {
        startGame();
        return;
      }
      
      if (!player.isJumping) {
        player.velocityY = JUMP_FORCE;
        player.isJumping = true;
      }
    }
  }
  
  function handleClick() {
    if (gameOver) {
      resetGame();
      startGame();
      return;
    }
    
    if (!gameStarted) {
      startGame();
      return;
    }
    
    if (!player.isJumping) {
      player.velocityY = JUMP_FORCE;
      player.isJumping = true;
    }
  }
  
  function handleHideGame() {
    if (dontShowAgain) {
      dispatch('hideGamePermanently');
    } else {
      dispatch('hideGame');
    }
  }
  
  function approveGame() {
    gameApproved = true;
    // Initialize the canvas after approval
    setTimeout(() => {
      if (browser && canvasEl) {
        initializeCanvas();
      }
    }, 50); // Small delay to ensure DOM is updated
  }
  
  function declineGame() {
    dispatch('showLoadingSpinner');
  }
  
  function initializeCanvas() {
    if (!canvasEl) return;
    
    // Get device pixel ratio for crisp rendering
    pixelRatio = window.devicePixelRatio || 1;
    
    // Set actual canvas dimensions
    canvasEl.width = CANVAS_WIDTH * pixelRatio;
    canvasEl.height = CANVAS_HEIGHT * pixelRatio;
    
    // Scale the rendering context
    ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(pixelRatio, pixelRatio);
    
    // Set display size via CSS
    canvasEl.style.width = `${CANVAS_WIDTH}px`;
    canvasEl.style.height = `${CANVAS_HEIGHT}px`;
    
    // Initial drawing
    drawInitialScreen();
  }
  
  onMount(async () => {
    if (!browser) return;
    
    componentMounted = true;
    
    await tick();
    if (canvasEl && gameApproved) {
      initializeCanvas();
    }
    
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
    }
  });
  
  function drawInitialScreen() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Grid lines
    drawGridLines();
    
    // Ground
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    
    // Player
    ctx.fillStyle = colors.player;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Instructions
    ctx.fillStyle = colors.text;
    ctx.font = "20px 'JetBrains Mono Variable', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE or Click to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = "12px 'JetBrains Mono Variable', monospace";
    ctx.fillText('(Jump over the obstacles)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
    ctx.textAlign = 'left';
  }
  
  function drawGridLines() {
    if (!ctx) return;
    
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    
    // For crisp lines, offset by 0.5 pixels
    // Vertical grid lines
    for (let x = 0; x < CANVAS_WIDTH; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, CANVAS_HEIGHT);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = 0; y < CANVAS_HEIGHT; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_WIDTH, y + 0.5);
      ctx.stroke();
    }
  }
  
  onDestroy(() => {
    stopGame();
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
  let width = 500;
$: CANVAS_WIDTH = width < 768 ? width * 0.8 : width * 0.5;
</script>

<div class="p-2 game-container {!show ? 'hidden' : ''}" bind:clientWidth={width}>
  {#if !gameApproved}
    <div class="initial-choice-container" in:fade>
      <p class="text-center text-sm mb-4">
        We are processing the data. Would you like to play a quick game while waiting?
      </p>
      <div class="flex gap-4 justify-center">
        <button 
          on:click={approveGame} 
          class="btn-primary"
        >
          Play Game
        </button>
        <button 
          on:click={declineGame} 
          class="px-3 py-1.5 text-sm border border-neutral bg-base-100 hover:bg-base-200"
        >
          No Thanks
        </button>
      </div>
    </div>
  {:else}
    <div class="h-[50px] w-full relative">
      {#if loading}
        <p 
          in:fly={{y: -10, duration: 200}} 
          out:fly={{y: 10, duration: 200}} 
          class="font-archivo text-center text-xs text-gray-500 absolute top-0 left-0 right-0"
        >
          We are processing a lot of data, this might take a few seconds the first time you load the app. <br/> Enjoy the game while you wait!
        </p>
      {:else}
        <p 
          in:fly={{y: -10, duration: 200}} 
          class="font-archivo text-center text-xs text-gray-500 absolute top-0 left-0 right-0"
        >
          All done! You can now explore the data.
        </p>
      {/if}
    </div>
    <div in:fade={{duration: 200}} class="game-wrapper">
      <canvas 
        bind:this={canvasEl} 
        on:click={handleClick}
        class="game-canvas"
      ></canvas>
      
      {#if !loading && dbReady}
        <div class="continue-container" in:fly={{y: 20, duration: 200}}>
          <div class="flex flex-col items-center gap-3">
          
            <button on:click={handleHideGame} class="btn-primary">
              Data loaded, continue...
            </button>
            <label class="flex items-center gap-2 text-xs">
              <input type="checkbox" bind:checked={dontShowAgain} />
              <span>Don't show this game again</span>
            </label>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .game-container {
    width: 100%;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 1rem 0;
  }
  
  .game-container.hidden {
    display: none;
  }
  
  .initial-choice-container {
    max-width: 400px;
    padding: 1rem;
    margin: 2rem auto;
    border: 1px solid #eaeaea;
    background-color: #FCFCFA;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  
  .game-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }
  
  .game-canvas {
    cursor: pointer;
    border: 1px solid #121212;
    box-shadow: 0 1px 0 0 #121212;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    background-color: #FCFCFA;
  }
  
  .continue-container {
    margin-top: 1rem;
    width: 100%;
    max-width: 300px;
  }
  
  input[type="checkbox"] {
    accent-color: #005AFF;
  }
</style> 