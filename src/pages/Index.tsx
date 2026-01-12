import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  id: number;
}

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  color: string;
}

interface Bonus {
  x: number;
  y: number;
  dy: number;
  type: 'speed' | 'wide' | 'multi';
  icon: string;
  color: string;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 20;
const BALL_RADIUS = 8;
const BLOCK_ROWS = 5;
const BLOCK_COLS = 10;
const BLOCK_WIDTH = 70;
const BLOCK_HEIGHT = 25;
const BLOCK_PADDING = 10;

const BLOCK_COLORS = ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff'];

const BONUS_TYPES = [
  { type: 'speed' as const, icon: '⚡', color: '#ffbe0b', chance: 0.1 },
  { type: 'wide' as const, icon: '⬌', color: '#3a86ff', chance: 0.1 },
  { type: 'multi' as const, icon: '●●●', color: '#ff00ff', chance: 0.05 },
];

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('arkanoid-highscore');
    return saved ? parseInt(saved) : 0;
  });

  const ballsRef = useRef<Ball[]>([{
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 150,
    dx: 0,
    dy: 0,
    radius: BALL_RADIUS,
    id: 0,
  }]);

  const paddleRef = useRef<Paddle>({
    x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
    y: CANVAS_HEIGHT - 50,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  });

  const blocksRef = useRef<Block[]>([]);
  const bonusesRef = useRef<Bonus[]>([]);
  const animationFrameRef = useRef<number>();
  const ballIdCounter = useRef(1);
  const speedBoostRef = useRef(false);
  const speedBoostTimer = useRef<NodeJS.Timeout | null>(null);
  const wideBoostRef = useRef(false);
  const wideBoostTimer = useRef<NodeJS.Timeout | null>(null);
  const ballLaunchedRef = useRef(false);

  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = window.innerHeight - 200;

      const scale = Math.min(containerWidth / CANVAS_WIDTH, containerHeight / CANVAS_HEIGHT, 1);
      
      setCanvasSize({
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('orientationchange', updateCanvasSize);
    };
  }, []);

  const createBlocks = useCallback((levelNum: number) => {
    const blocks: Block[] = [];
    const offsetX = (CANVAS_WIDTH - (BLOCK_COLS * (BLOCK_WIDTH + BLOCK_PADDING))) / 2;
    const offsetY = 80;

    for (let row = 0; row < BLOCK_ROWS; row++) {
      for (let col = 0; col < BLOCK_COLS; col++) {
        blocks.push({
          x: offsetX + col * (BLOCK_WIDTH + BLOCK_PADDING),
          y: offsetY + row * (BLOCK_HEIGHT + BLOCK_PADDING),
          width: BLOCK_WIDTH,
          height: BLOCK_HEIGHT,
          health: Math.min(levelNum, 3),
          color: BLOCK_COLORS[row % BLOCK_COLORS.length],
        });
      }
    }
    return blocks;
  }, []);

  const resetBall = useCallback(() => {
    ballsRef.current = [{
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 150,
      dx: 0,
      dy: 0,
      radius: BALL_RADIUS,
      id: 0,
    }];
    ballIdCounter.current = 1;
    ballLaunchedRef.current = false;
  }, [level]);

  const clearBonusTimers = useCallback(() => {
    if (speedBoostTimer.current) clearTimeout(speedBoostTimer.current);
    if (wideBoostTimer.current) clearTimeout(wideBoostTimer.current);
    speedBoostRef.current = false;
    wideBoostRef.current = false;
    paddleRef.current.width = PADDLE_WIDTH;
  }, []);

  const launchBall = useCallback(() => {
    if (!ballLaunchedRef.current && ballsRef.current.length > 0) {
      ballLaunchedRef.current = true;
      ballsRef.current.forEach(ball => {
        ball.dx = 4 + level * 0.5;
        ball.dy = -4 - level * 0.5;
      });
    }
  }, [level]);

  const startNewGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setLevel(1);
    blocksRef.current = createBlocks(1);
    bonusesRef.current = [];
    resetBall();
    clearBonusTimers();
    paddleRef.current.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    paddleRef.current.width = PADDLE_WIDTH;
    setGameState('playing');
  }, [createBlocks, resetBall, clearBonusTimers]);

  const nextLevel = useCallback(() => {
    const newLevel = level + 1;
    setLevel(newLevel);
    blocksRef.current = createBlocks(newLevel);
    bonusesRef.current = [];
    resetBall();
    clearBonusTimers();
    paddleRef.current.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    paddleRef.current.width = PADDLE_WIDTH;
  }, [level, createBlocks, resetBall, clearBonusTimers]);

  const applyBonus = useCallback((type: string) => {
    if (type === 'speed') {
      speedBoostRef.current = true;
      ballsRef.current.forEach(ball => {
        ball.dx *= 1.5;
        ball.dy *= 1.5;
      });
      if (speedBoostTimer.current) clearTimeout(speedBoostTimer.current);
      speedBoostTimer.current = setTimeout(() => {
        speedBoostRef.current = false;
        ballsRef.current.forEach(ball => {
          ball.dx /= 1.5;
          ball.dy /= 1.5;
        });
      }, 5000);
    } else if (type === 'wide') {
      wideBoostRef.current = true;
      paddleRef.current.width = PADDLE_WIDTH * 1.5;
      if (wideBoostTimer.current) clearTimeout(wideBoostTimer.current);
      wideBoostTimer.current = setTimeout(() => {
        wideBoostRef.current = false;
        paddleRef.current.width = PADDLE_WIDTH;
      }, 8000);
    } else if (type === 'multi') {
      const currentBall = ballsRef.current[0];
      if (currentBall) {
        const angle1 = Math.PI / 6;
        const angle2 = -Math.PI / 6;
        const speed = Math.sqrt(currentBall.dx ** 2 + currentBall.dy ** 2);
        
        ballsRef.current.push({
          x: currentBall.x,
          y: currentBall.y,
          dx: speed * Math.sin(angle1),
          dy: -speed * Math.cos(angle1),
          radius: BALL_RADIUS,
          id: ballIdCounter.current++,
        });
        
        ballsRef.current.push({
          x: currentBall.x,
          y: currentBall.y,
          dx: speed * Math.sin(angle2),
          dy: -speed * Math.cos(angle2),
          radius: BALL_RADIUS,
          id: ballIdCounter.current++,
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const paddle = paddleRef.current;
      paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, mouseX - paddle.width / 2));
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * scaleX;
      const paddle = paddleRef.current;
      paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, touchX - paddle.width / 2));
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      launchBall();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * scaleX;
      const paddle = paddleRef.current;
      paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, touchX - paddle.width / 2));
    };

    const handleClick = () => {
      launchBall();
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    const gameLoop = () => {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const paddle = paddleRef.current;

      ballsRef.current.forEach((ball, ballIndex) => {
        if (!ballLaunchedRef.current) {
          ball.x = paddle.x + paddle.width / 2;
          ball.y = paddle.y - ball.radius - 5;
        } else {
          ball.x += ball.dx;
          ball.y += ball.dy;
        }

        if (ball.x + ball.radius > CANVAS_WIDTH || ball.x - ball.radius < 0) {
          ball.dx = -ball.dx;
        }
        if (ball.y - ball.radius < 0) {
          ball.dy = -ball.dy;
        }

        if (
          ball.y + ball.radius > paddle.y &&
          ball.x > paddle.x &&
          ball.x < paddle.x + paddle.width
        ) {
          ball.dy = -Math.abs(ball.dy);
          const hitPos = (ball.x - paddle.x) / paddle.width;
          ball.dx = (hitPos - 0.5) * 10;
        }

        if (ball.y + ball.radius > CANVAS_HEIGHT) {
          ballsRef.current.splice(ballIndex, 1);
        }
      });

      if (ballsRef.current.length === 0) {
        const newLives = lives - 1;
        setLives(newLives);
        
        if (newLives <= 0) {
          setGameState('gameover');
          if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('arkanoid-highscore', score.toString());
          }
          clearBonusTimers();
          return;
        }
        resetBall();
      }

      ballsRef.current.forEach(ball => {
        blocksRef.current = blocksRef.current.filter((block) => {
          if (
            ball.x + ball.radius > block.x &&
            ball.x - ball.radius < block.x + block.width &&
            ball.y + ball.radius > block.y &&
            ball.y - ball.radius < block.y + block.height
          ) {
            ball.dy = -ball.dy;
            block.health--;
            
            if (block.health <= 0) {
              setScore((prev) => prev + 100 * level);
              
              const rand = Math.random();
              let cumulativeChance = 0;
              
              for (const bonusType of BONUS_TYPES) {
                cumulativeChance += bonusType.chance;
                if (rand < cumulativeChance) {
                  bonusesRef.current.push({
                    x: block.x + block.width / 2,
                    y: block.y + block.height / 2,
                    dy: 2,
                    type: bonusType.type,
                    icon: bonusType.icon,
                    color: bonusType.color,
                  });
                  break;
                }
              }
              
              return false;
            }
          }
          return true;
        });
      });

      bonusesRef.current = bonusesRef.current.filter((bonus) => {
        bonus.y += bonus.dy;

        if (
          bonus.y + 15 > paddle.y &&
          bonus.x > paddle.x &&
          bonus.x < paddle.x + paddle.width
        ) {
          applyBonus(bonus.type);
          return false;
        }

        if (bonus.y > CANVAS_HEIGHT) {
          return false;
        }

        return true;
      });

      if (blocksRef.current.length === 0) {
        nextLevel();
      }

      blocksRef.current.forEach((block) => {
        const alpha = block.health / 3;
        ctx.fillStyle = block.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(block.x, block.y, block.width, block.height);
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.strokeRect(block.x, block.y, block.width, block.height);
        ctx.globalAlpha = 1;
      });

      bonusesRef.current.forEach((bonus) => {
        ctx.fillStyle = bonus.color;
        ctx.fillRect(bonus.x - 15, bonus.y - 15, 30, 30);
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.strokeRect(bonus.x - 15, bonus.y - 15, 30, 30);
        
        ctx.fillStyle = '#1a1a2e';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bonus.icon, bonus.x, bonus.y);
      });

      const paddleColor = wideBoostRef.current ? '#3a86ff' : '#00ff41';
      ctx.fillStyle = paddleColor;
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(paddle.x, paddle.y, paddle.width, paddle.height);

      ballsRef.current.forEach(ball => {
        const ballColor = speedBoostRef.current ? '#ffbe0b' : '#ff00ff';
        ctx.fillStyle = ballColor;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gameState, lives, score, level, highScore, nextLevel, resetBall, clearBonusTimers, applyBonus]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-2 sm:p-4 font-['Press_Start_2P'] overflow-hidden">
      <div className="w-full max-w-4xl" ref={containerRef}>
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl md:text-6xl mb-2 sm:mb-4 text-[#00ff41] drop-shadow-[0_0_10px_#00ff41]">
            ARKANOID
          </h1>
          <div className="flex justify-center gap-2 sm:gap-4 md:gap-8 text-[8px] sm:text-xs md:text-sm flex-wrap">
            <div className="text-[#00ff41]">
              SCORE: <span className="text-[#ff00ff]">{score}</span>
            </div>
            <div className="text-[#00ff41]">
              LEVEL: <span className="text-[#ffbe0b]">{level}</span>
            </div>
            <div className="text-[#00ff41]">
              LIVES: <span className="text-[#ff006e]">{lives}</span>
            </div>
            <div className="text-[#00ff41]">
              HI-SCORE: <span className="text-[#3a86ff]">{highScore}</span>
            </div>
          </div>
        </div>

        <div className="relative border-2 sm:border-4 border-[#00ff41] shadow-[0_0_20px_#00ff41] mx-auto touch-none" style={{ width: 'fit-content' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
            style={{ 
              imageRendering: 'pixelated',
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          />
          
          {gameState === 'menu' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <div className="text-center px-4">
                <p className="text-[#00ff41] text-[8px] sm:text-xs md:text-sm mb-2 sm:mb-4">
                  BREAK ALL BLOCKS
                </p>
                <p className="text-[#ff00ff] text-[8px] sm:text-xs md:text-sm mb-2">
                  CLICK TO LAUNCH
                </p>
                <div className="text-[8px] sm:text-[10px] text-[#ffbe0b] mt-4 space-y-1">
                  <p>⚡ SPEED BOOST</p>
                  <p>⬌ WIDE PADDLE</p>
                  <p>●●● MULTI BALL</p>
                </div>
              </div>
              <Button
                onClick={startNewGame}
                className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-xs sm:text-sm md:text-base px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 border-2 sm:border-4 border-[#ff00ff] shadow-[0_0_20px_#ff00ff]"
              >
                START GAME
              </Button>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <p className="text-[#00ff41] text-xl sm:text-2xl md:text-4xl">PAUSED</p>
              <Button
                onClick={() => setGameState('playing')}
                className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-xs sm:text-sm md:text-base px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 border-2 sm:border-4 border-[#ff00ff]"
              >
                RESUME
              </Button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <div className="text-center px-4">
                <p className="text-[#ff006e] text-xl sm:text-2xl md:text-4xl mb-2 sm:mb-4">GAME OVER</p>
                <p className="text-[#00ff41] text-[8px] sm:text-xs md:text-sm">
                  FINAL SCORE: <span className="text-[#ff00ff]">{score}</span>
                </p>
              </div>
              <div className="flex gap-2 sm:gap-4 flex-wrap justify-center">
                <Button
                  onClick={startNewGame}
                  className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-xs sm:text-sm md:text-base px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-2 sm:border-4 border-[#ff00ff]"
                >
                  RETRY
                </Button>
                <Button
                  onClick={() => setGameState('menu')}
                  className="bg-[#ff00ff] hover:bg-[#ff00ff]/80 text-[#1a1a2e] text-xs sm:text-sm md:text-base px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-2 sm:border-4 border-[#00ff41]"
                >
                  MENU
                </Button>
              </div>
            </div>
          )}
        </div>

        {gameState === 'playing' && (
          <div className="text-center mt-4 sm:mt-8">
            <Button
              onClick={() => setGameState('paused')}
              variant="outline"
              size="sm"
              className="text-[#00ff41] border-[#00ff41] hover:bg-[#00ff41] hover:text-[#1a1a2e] text-xs sm:text-sm"
            >
              <Icon name="Pause" size={14} className="sm:w-4 sm:h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;