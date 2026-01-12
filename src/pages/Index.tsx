import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
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

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('arkanoid-highscore');
    return saved ? parseInt(saved) : 0;
  });

  const ballRef = useRef<Ball>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 150,
    dx: 4,
    dy: -4,
    radius: BALL_RADIUS,
  });

  const paddleRef = useRef<Paddle>({
    x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
    y: CANVAS_HEIGHT - 50,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  });

  const blocksRef = useRef<Block[]>([]);
  const animationFrameRef = useRef<number>();

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
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 150,
      dx: 4 + level * 0.5,
      dy: -4 - level * 0.5,
      radius: BALL_RADIUS,
    };
  }, [level]);

  const startNewGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setLevel(1);
    blocksRef.current = createBlocks(1);
    resetBall();
    paddleRef.current.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    setGameState('playing');
  }, [createBlocks, resetBall]);

  const nextLevel = useCallback(() => {
    const newLevel = level + 1;
    setLevel(newLevel);
    blocksRef.current = createBlocks(newLevel);
    resetBall();
    paddleRef.current.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
  }, [level, createBlocks, resetBall]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      paddleRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2));
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * scaleX;
      paddleRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2));
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    const gameLoop = () => {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const ball = ballRef.current;
      const paddle = paddleRef.current;

      ball.x += ball.dx;
      ball.y += ball.dy;

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
        const newLives = lives - 1;
        setLives(newLives);
        
        if (newLives <= 0) {
          setGameState('gameover');
          if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('arkanoid-highscore', score.toString());
          }
          return;
        }
        resetBall();
      }

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
            return false;
          }
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

      ctx.fillStyle = '#00ff41';
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(paddle.x, paddle.y, paddle.width, paddle.height);

      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gameState, lives, score, level, highScore, nextLevel, resetBall]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-4 font-['Press_Start_2P']">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl mb-4 text-[#00ff41] drop-shadow-[0_0_10px_#00ff41]">
            ARKANOID
          </h1>
          <div className="flex justify-center gap-8 text-sm md:text-base flex-wrap">
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

        <div className="relative border-4 border-[#00ff41] shadow-[0_0_20px_#00ff41] mx-auto" style={{ width: 'fit-content' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block max-w-full h-auto"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {gameState === 'menu' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <div className="text-center px-4">
                <p className="text-[#00ff41] text-xs md:text-sm mb-4">
                  BREAK ALL BLOCKS
                </p>
                <p className="text-[#ff00ff] text-xs md:text-sm">
                  USE MOUSE OR TOUCH
                </p>
              </div>
              <Button
                onClick={startNewGame}
                className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-sm md:text-base px-8 py-6 border-4 border-[#ff00ff] shadow-[0_0_20px_#ff00ff]"
              >
                START GAME
              </Button>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <p className="text-[#00ff41] text-2xl md:text-4xl">PAUSED</p>
              <Button
                onClick={() => setGameState('playing')}
                className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-sm md:text-base px-8 py-6 border-4 border-[#ff00ff]"
              >
                RESUME
              </Button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex flex-col items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-[#ff006e] text-2xl md:text-4xl mb-4">GAME OVER</p>
                <p className="text-[#00ff41] text-sm md:text-base">
                  FINAL SCORE: <span className="text-[#ff00ff]">{score}</span>
                </p>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                <Button
                  onClick={startNewGame}
                  className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-[#1a1a2e] text-sm md:text-base px-6 py-4 border-4 border-[#ff00ff]"
                >
                  RETRY
                </Button>
                <Button
                  onClick={() => setGameState('menu')}
                  className="bg-[#ff00ff] hover:bg-[#ff00ff]/80 text-[#1a1a2e] text-sm md:text-base px-6 py-4 border-4 border-[#00ff41]"
                >
                  MENU
                </Button>
              </div>
            </div>
          )}
        </div>

        {gameState === 'playing' && (
          <div className="text-center mt-8">
            <Button
              onClick={() => setGameState('paused')}
              variant="outline"
              size="sm"
              className="text-[#00ff41] border-[#00ff41] hover:bg-[#00ff41] hover:text-[#1a1a2e]"
            >
              <Icon name="Pause" size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;