import { AppDataSource } from '../data-source';
import { IsNull, In } from 'typeorm';
import { Game } from '../entities/Game';
import { User } from '../entities/User';
import { UserStats } from '../entities/UserStats';
import { GameDto, UserDto, PlayerPiece, GameType, LeaderboardEntryDto, LeaderboardResponse } from '@vibe-games/shared';
import { calculateElo } from '../game/elo';
import { ENGINES } from '../game/gameRegistry';
import { StrategyWeights } from '../game/minimaxAi';

export const aiConfig: Record<string, Record<string, { id: string; username: string; elo: number; type: string; depth?: number; weights?: StrategyWeights; botLevel?: string; enabled?: boolean }>> = require('../game/aiConfig.json');

// BOTS configuration lookup map
export const BOTS_MAP = new Map<string, { username: string; elo: number; type: string; depth?: number; weights?: StrategyWeights; timeLimitMs?: number; botLevel?: string }>();
for (const gameBots of Object.values(aiConfig)) {
  for (const bot of Object.values(gameBots)) {
    // Skip disabled RL bots that have not yet been trained
    if (bot.enabled === false) continue;
    BOTS_MAP.set(bot.id, { username: bot.username, elo: bot.elo, type: bot.type, depth: bot.depth, weights: bot.weights, timeLimitMs: (bot as any).timeLimitMs, botLevel: bot.botLevel });
  }
}

export async function runAiLoopIfNeeded(game: Game): Promise<void> {
  const botId = [game.playerXId, game.playerOId].find(id => id && BOTS_MAP.has(id));
  if (!botId) return;

  const botInfo = BOTS_MAP.get(botId)!;
  const aiPiece: PlayerPiece = botId === game.playerXId ? 'X' : 'O';

  const engine = ENGINES[game.gameType];
  if (!engine) return;

  let aiActive = !game.state.winner;
  while (aiActive && game.state.turn === aiPiece) {
    try {
      const startTime = Date.now();
      let rawAction: any;

      // ── RL sidecar path (async) ───────────────────────────────────────────
      if (botInfo.type === 'rl' && engine.getAiActionAsync) {
        const asyncResult = engine.getAiActionAsync(game.state, botInfo.botLevel ?? botInfo.type, botInfo.depth || 3, botInfo.weights, botInfo.timeLimitMs || 4000);
        if (asyncResult !== null) {
          rawAction = await asyncResult;
        } else {
          rawAction = engine.getAiAction(game.state, botInfo.type, botInfo.depth || 3, botInfo.weights, botInfo.timeLimitMs || 4000);
        }
      } else {
        // ── Standard synchronous path ─────────────────────────────────────
        rawAction = engine.getAiAction(game.state, botInfo.type, botInfo.depth || 3, botInfo.weights, botInfo.timeLimitMs || 4000);
      }

      game.state = engine.handleMove(game.state, rawAction, aiPiece);

      if (game.state.winner) {
        game.status = 'finished';
        game.winnerId = game.state.winner === 'draw' ? null : (game.state.winner === 'X' ? game.playerXId : game.playerOId);
        aiActive = false;
      }
    } catch (err) {
      console.error('AI execution error:', err);
      game.status = 'finished';
      const humanPiece = aiPiece === 'X' ? 'O' : 'X';
      game.winnerId = humanPiece === 'X' ? game.playerXId : game.playerOId;
      game.state.winner = humanPiece;
      aiActive = false;
    }
  }
}

export async function getOrCreateUser(userId: string): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);
  let user = await userRepo.findOneBy({ id: userId });
  if (!user) {
    const botInfo = BOTS_MAP.get(userId);
    user = userRepo.create({
      id: userId,
      username: botInfo ? botInfo.username : `Player_${userId.substring(0, 5)}`,
      googleId: botInfo ? `bot-${userId}` : undefined,
      email: botInfo ? `bot-${userId}@vibegames.local` : undefined,
    });
    try {
      await userRepo.save(user);
    } catch (err) {
      const existing = await userRepo.findOneBy({ id: userId });
      if (existing) {
        user = existing;
      } else {
        throw err;
      }
    }
  }
  return user;
}

export async function seedBots() {
  const userRepo = AppDataSource.getRepository(User);
  const userStatsRepo = AppDataSource.getRepository(UserStats);

  for (const [gameType, gameBots] of Object.entries(aiConfig)) {
    const targetGameType = gameType as GameType;
    for (const bot of Object.values(gameBots)) {
      let existing = await userRepo.findOneBy({ id: bot.id });
      if (!existing) {
        existing = userRepo.create({
          id: bot.id,
          username: bot.username,
          googleId: `bot-${bot.id}`,
          email: `bot-${bot.id}@vibegames.local`,
        });
        try {
          await userRepo.save(existing);
        } catch (err) {
          // Safe to ignore if concurrent seed process inserted first
        }
      }

      let stats = await userStatsRepo.findOneBy({ userId: bot.id, gameType: targetGameType });
      if (!stats) {
        stats = userStatsRepo.create({
          userId: bot.id,
          gameType: targetGameType,
          elo: bot.elo,
        });
        try {
          await userStatsRepo.save(stats);
        } catch (err) {
          // Safe to ignore if concurrent seed process inserted first
        }
      }
    }
  }
}

export async function toUserDto(user: User | null, gameType: GameType): Promise<UserDto | null> {
  if (!user) return null;

  const botInfo = BOTS_MAP.get(user.id);
  if (botInfo) {
    return {
      id: user.id,
      username: botInfo.username,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl,
      elo: botInfo.elo,
    };
  }

  const statsRepo = AppDataSource.getRepository(UserStats);
  const stats = await statsRepo.findOneBy({ userId: user.id, gameType });

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    email: user.email,
    elo: stats ? stats.elo : 1200,
    wins: stats ? stats.wins : 0,
    losses: stats ? stats.losses : 0,
    draws: stats ? stats.draws : 0,
  };
}

export function obfuscateHolyGrailState(
  state: any,
  requestingUserId: string | undefined,
  playerXId: string | null,
  playerOId: string | null
): any {
  if (!state) return state;

  const cloned = JSON.parse(JSON.stringify(state));

  const isPlayerX = requestingUserId && requestingUserId === playerXId;
  const isPlayerO = requestingUserId && requestingUserId === playerOId;

  if (cloned.hands) {
    if (!isPlayerX && cloned.hands.X) {
      cloned.hands.X = cloned.hands.X.map((card: any) => ({ ...card, value: 0 }));
    }
    if (!isPlayerO && cloned.hands.O) {
      cloned.hands.O = cloned.hands.O.map((card: any) => ({ ...card, value: 0 }));
    }
  }

  if (cloned.board) {
    for (const cellKey of Object.keys(cloned.board)) {
      const cell = cloned.board[cellKey];
      if (cell && cell.soldiers) {
        cell.soldiers = cell.soldiers.map((card: any) => {
          const owner = cell.owner;
          let showValue = false;
          if (owner === 'X' && isPlayerX) showValue = true;
          else if (owner === 'O' && isPlayerO) showValue = true;
          else if (card.revealed) showValue = true;

          return {
            ...card,
            value: showValue ? card.value : 0
          };
        });
      }
    }
  }

  if (cloned.pendingCombats) {
    cloned.pendingCombats = cloned.pendingCombats.map((combat: any) => {
      const isAttacker = (combat.attacker === 'X' && isPlayerX) || (combat.attacker === 'O' && isPlayerO);
      const isDefender = (combat.defender === 'X' && isPlayerX) || (combat.defender === 'O' && isPlayerO);

      const res: any = { ...combat };

      if (res.attackerStack) {
        res.attackerStack = res.attackerStack.map((card: any) => {
          const showValue = isAttacker || card.revealed;
          return {
            ...card,
            value: showValue ? card.value : 0
          };
        });
      }

      const showAttackerTop = isAttacker || (combat.attackerTopCard && combat.attackerTopCard.revealed);
      if (combat.attackerTopCard) {
        res.attackerTopCard = {
          ...combat.attackerTopCard,
          value: showAttackerTop ? combat.attackerTopCard.value : 0
        };
      }

      const showDefenderTop = isDefender || (combat.defenderTopCard && combat.defenderTopCard.revealed);
      if (combat.defenderTopCard) {
        res.defenderTopCard = {
          ...combat.defenderTopCard,
          value: showDefenderTop ? combat.defenderTopCard.value : 0
        };
      }

      return res;
    });
  }

  if (cloned.movesThisTurn) {
    cloned.movesThisTurn = cloned.movesThisTurn.map((move: any) => {
      const movingPlayer = cloned.turn;
      const isMovingPlayer = (movingPlayer === 'X' && isPlayerX) || (movingPlayer === 'O' && isPlayerO);

      return {
        ...move,
        cards: move.cards.map((card: any) => {
          const showValue = isMovingPlayer || card.revealed;
          return {
            ...card,
            value: showValue ? card.value : 0
          };
        })
      };
    });
  }

  if (cloned.history) {
    cloned.history = cloned.history.map((log: string) => {
      if (log.trim().startsWith('{')) {
        try {
          const action = JSON.parse(log);
          if (action.type === 'deploy' || action.action === 'deploy') {
            const isOpponent = (action.player === 'X' && !isPlayerX) || (action.player === 'O' && !isPlayerO);
            if (isOpponent) {
              return JSON.stringify({
                ...action,
                cardValue: 0,
                count: 1
              });
            }
          }
        } catch (e) {
          // ignore
        }
      }
      return log;
    });
  }

  return cloned;
}

export async function toGameDto(game: Game, requestingUserId?: string): Promise<GameDto> {
  const dto: GameDto = {
    id: game.id,
    gameType: game.gameType,
    status: game.status,
    playerX: await toUserDto(game.playerX, game.gameType),
    playerO: await toUserDto(game.playerO, game.gameType),
    winnerId: game.winnerId,
    state: game.state,
    isPublic: game.isPublic,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };

  if (game.gameType === 'holy_grail' && dto.state) {
    dto.state = obfuscateHolyGrailState(dto.state, requestingUserId, game.playerXId, game.playerOId);
  }

  return dto;
}

export async function handleGameFinished(game: Game) {
  if (game.status !== 'finished') return;

  const playerXId = game.playerXId;
  const playerOId = game.playerOId;
  const winner = game.state.winner; // 'X' | 'O' | 'draw'

  if (!playerXId || !playerOId) return;

  const userStatsRepo = AppDataSource.getRepository(UserStats);

  let xStats = await userStatsRepo.findOneBy({ userId: playerXId, gameType: game.gameType });
  if (!xStats) {
    const botInfo = BOTS_MAP.get(playerXId);
    xStats = userStatsRepo.create({
      userId: playerXId,
      gameType: game.gameType,
      elo: botInfo ? botInfo.elo : 1200,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  let oStats = await userStatsRepo.findOneBy({ userId: playerOId, gameType: game.gameType });
  if (!oStats) {
    const botInfo = BOTS_MAP.get(playerOId);
    oStats = userStatsRepo.create({
      userId: playerOId,
      gameType: game.gameType,
      elo: botInfo ? botInfo.elo : 1200,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  const oldXElo = xStats.elo;
  const oldOElo = oStats.elo;

  let xOutcome: 1 | 0.5 | 0 = 0.5;
  let oOutcome: 1 | 0.5 | 0 = 0.5;

  if (winner === 'X') {
    xOutcome = 1;
    oOutcome = 0;
    xStats.wins += 1;
    oStats.losses += 1;
  } else if (winner === 'O') {
    xOutcome = 0;
    oOutcome = 1;
    xStats.losses += 1;
    oStats.wins += 1;
  } else {
    xStats.draws += 1;
    oStats.draws += 1;
  }

  const newXElo = calculateElo(oldXElo, oldOElo, xOutcome);
  const newOElo = calculateElo(oldOElo, oldXElo, oOutcome);

  const isXBot = BOTS_MAP.has(playerXId);
  const isOBot = BOTS_MAP.has(playerOId);

  if (!isXBot) {
    xStats.elo = newXElo;
    try {
      await userStatsRepo.save(xStats);
    } catch (err) {
      const existing = await userStatsRepo.findOneBy({ userId: playerXId, gameType: game.gameType });
      if (existing) {
        existing.wins += winner === 'X' ? 1 : 0;
        existing.losses += winner === 'O' ? 1 : 0;
        existing.draws += winner === 'draw' ? 1 : 0;
        existing.elo = calculateElo(existing.elo, oldOElo, xOutcome);
        await userStatsRepo.save(existing);
      } else {
        throw err;
      }
    }
  }

  if (!isOBot) {
    oStats.elo = newOElo;
    try {
      await userStatsRepo.save(oStats);
    } catch (err) {
      const existing = await userStatsRepo.findOneBy({ userId: playerOId, gameType: game.gameType });
      if (existing) {
        existing.wins += winner === 'O' ? 1 : 0;
        existing.losses += winner === 'X' ? 1 : 0;
        existing.draws += winner === 'draw' ? 1 : 0;
        existing.elo = calculateElo(existing.elo, oldXElo, oOutcome);
        await userStatsRepo.save(existing);
      } else {
        throw err;
      }
    }
  }
}


export async function createGame(user: User, gameType: GameType, isPublic: boolean, vsAi: boolean, aiLevel: string, aiStarts: boolean): Promise<Game> {
  const engine = ENGINES[gameType];
  if (!engine) throw new Error('Unsupported game type');

  const gameRepo = AppDataSource.getRepository(Game);

  let playerXId: string | null = user.id;
  let playerOId: string | null = null;
  let playerXEntity: User | null = user;
  let playerOEntity: User | null = null;

  if (vsAi) {
    let botKey = aiLevel || 'medium_aggressive';
    if (botKey === 'easy') botKey = 'easy_random';
    else if (botKey === 'medium') botKey = 'medium_aggressive';
    else if (botKey === 'hard') botKey = 'hard_tactical';

    const gameBots = aiConfig[gameType] || aiConfig['mill'];
    const botConfig = gameBots[botKey] || gameBots['medium_aggressive'];
    const botUser = await getOrCreateUser(botConfig.id);

    if (aiStarts) {
      playerXId = botConfig.id;
      playerOId = user.id;
      playerXEntity = botUser;
      playerOEntity = user;
    } else {
      playerXId = user.id;
      playerOId = botConfig.id;
      playerXEntity = user;
      playerOEntity = botUser;
    }
  } else if (aiStarts) {
    playerXId = null;
    playerOId = user.id;
    playerXEntity = null;
    playerOEntity = user;
  }

  const game = gameRepo.create({
    gameType,
    status: vsAi ? 'in_progress' : 'waiting',
    playerXId,
    playerOId,
    state: engine.createInitialState(),
    isPublic,
    playerX: playerXEntity,
    playerO: playerOEntity,
  });

  if (vsAi && aiStarts) {
    await runAiLoopIfNeeded(game);
    if (game.status === 'finished') {
      await handleGameFinished(game);
    }
  }

  return await gameRepo.save(game);
}

export async function getOpenGames(gameType?: string, status: string = 'waiting'): Promise<Game[]> {
  const gameRepo = AppDataSource.getRepository(Game);
  let baseWhere: any = { isPublic: true };
  if (gameType) baseWhere.gameType = gameType;
  
  if (status === 'waiting') {
    return await gameRepo.find({
      where: [
        { ...baseWhere, status: 'waiting', playerOId: IsNull() },
        { ...baseWhere, status: 'waiting', playerXId: IsNull() },
      ],
      relations: ['playerX', 'playerO'],
      order: { createdAt: 'DESC' },
    });
  } else if (status === 'in_progress') {
    return await gameRepo.find({
      where: { ...baseWhere, status: 'in_progress' },
      relations: ['playerX', 'playerO'],
      order: { updatedAt: 'DESC' },
      take: 50
    });
  } else {
    return await gameRepo.find({
      where: [
        { ...baseWhere, status: 'waiting', playerOId: IsNull() },
        { ...baseWhere, status: 'waiting', playerXId: IsNull() },
        { ...baseWhere, status: 'in_progress' }
      ],
      relations: ['playerX', 'playerO'],
      order: { updatedAt: 'DESC' },
      take: 50
    });
  }
}

export async function getUserActiveGames(userId: string): Promise<Game[]> {
  const gameRepo = AppDataSource.getRepository(Game);
  return await gameRepo.find({
    where: [
      { playerXId: userId, status: In(['waiting', 'in_progress']) },
      { playerOId: userId, status: In(['waiting', 'in_progress']) },
    ],
    relations: ['playerX', 'playerO'],
    order: { updatedAt: 'DESC' },
  });
}

export async function getLeaderboard(gameType: GameType): Promise<LeaderboardResponse> {
  if (gameType !== 'mill' && gameType !== 'connect_four' && gameType !== 'holy_grail') {
    throw new Error('Unsupported game type');
  }

  const statsRepo = AppDataSource.getRepository(UserStats);
  const statsList = await statsRepo.find({
    where: { gameType },
    relations: ['user'],
    order: { elo: 'DESC' },
    take: 100,
  });

  const entries: LeaderboardEntryDto[] = statsList.map(stats => {
    const isBot = BOTS_MAP.has(stats.userId);
    let currentElo = stats.elo;
    let username = stats.user ? stats.user.username : `Player_${stats.userId.substring(0, 5)}`;
    if (isBot) {
      const botInfo = BOTS_MAP.get(stats.userId);
      if (botInfo) {
        currentElo = botInfo.elo;
        username = botInfo.username;
      }
    }

    return {
      userId: stats.userId,
      username,
      avatarUrl: stats.user ? stats.user.avatarUrl : null,
      elo: currentElo,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      isBot,
    };
  });

  entries.sort((a, b) => b.elo - a.elo);

  return { gameType, entries };
}

export async function joinGame(gameId: string, user: User): Promise<Game> {
  const gameRepo = AppDataSource.getRepository(Game);
  const game = await gameRepo.findOne({
    where: { id: gameId },
    relations: ['playerX', 'playerO'],
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== 'waiting') throw new Error('Game is not in a joinable status');
  if (game.playerXId === user.id || game.playerOId === user.id) throw new Error('Cannot play against yourself');

  if (game.playerXId === null) {
    game.playerXId = user.id;
    game.playerX = user;
  } else {
    game.playerOId = user.id;
    game.playerO = user;
  }
  game.status = 'in_progress';

  return await gameRepo.save(game);
}

export async function cancelGame(gameId: string, userId: string): Promise<void> {
  const gameRepo = AppDataSource.getRepository(Game);
  const game = await gameRepo.findOne({ where: { id: gameId } });

  if (!game) throw new Error('Game not found');
  if (game.playerXId !== userId && game.playerOId !== userId) throw new Error('Only the creator can cancel this game');
  if (game.status !== 'waiting') throw new Error('Only games in waiting status can be cancelled');

  await gameRepo.remove(game);
}

export async function forfeitGame(gameId: string, userId: string): Promise<Game> {
  const gameRepo = AppDataSource.getRepository(Game);
  const game = await gameRepo.findOne({
    where: { id: gameId },
    relations: ['playerX', 'playerO'],
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== 'in_progress') throw new Error('Only games in progress can be forfeited');
  if (game.playerXId !== userId && game.playerOId !== userId) throw new Error('Only participants can forfeit this game');

  game.status = 'finished';
  const winnerPiece = game.playerXId === userId ? 'O' : 'X';
  game.winnerId = game.playerXId === userId ? game.playerOId : game.playerXId;

  game.state = { ...game.state, winner: winnerPiece };

  await handleGameFinished(game);
  return await gameRepo.save(game);
}

export async function submitMove(gameId: string, userId: string, movePayload: any): Promise<Game> {
  const gameRepo = AppDataSource.getRepository(Game);
  const game = await gameRepo.findOne({
    where: { id: gameId },
    relations: ['playerX', 'playerO'],
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== 'in_progress') throw new Error('Game is not in progress');

  const playerPiece: PlayerPiece = game.playerXId === userId ? 'X' : game.playerOId === userId ? 'O' : (null as any);
  if (!playerPiece) throw new Error('You are not a player in this game');

  if (game.state.turn !== playerPiece) throw new Error(`It is not your turn (current turn: ${game.state.turn})`);

  const engine = ENGINES[game.gameType];
  if (!engine) throw new Error('Unsupported game type');

  game.state = engine.handleMove(game.state, movePayload, playerPiece);

  if (game.state.winner) {
    game.status = 'finished';
    game.winnerId = game.state.winner === 'draw' ? null : (game.state.winner === 'X' ? game.playerXId : game.playerOId);
  }

  await runAiLoopIfNeeded(game);

  if (game.status === 'finished') {
    await handleGameFinished(game);
  }

  return await gameRepo.save(game);
}
