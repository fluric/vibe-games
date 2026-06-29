export class SearchTimeoutError extends Error {
  constructor() {
    super("Search time limit exceeded");
    this.name = "SearchTimeoutError";
  }
}

export interface SearchAdapter<State, Action> {
  getValidActions(state: State): Action[];
  simulateAction(state: State, action: Action): State;
  evaluateState(state: State, depth: number): number;
  isGameOver(state: State): boolean;
  getHash(state: State): string;
  orderActions(state: State, actions: Action[], ttBestAction?: Action): Action[];
  getTurn(state: State): 'X' | 'O';
}

export interface TranspositionTableEntry<Action> {
  depth: number;
  value: number;
  flag: 'exact' | 'lower' | 'upper';
  bestAction?: Action;
}

export class SearchEngine<State, Action> {
  private tt: Map<string, TranspositionTableEntry<Action>>;
  private adapter: SearchAdapter<State, Action>;
  private aiPlayer: 'X' | 'O' = 'O';

  constructor(adapter: SearchAdapter<State, Action>) {
    this.adapter = adapter;
    this.tt = new Map();
  }

  public clearTT() {
    this.tt.clear();
  }

  public iterativeDeepening(
    state: State,
    maxDepth: number,
    timeLimitMs: number,
    aiPlayer: 'X' | 'O'
  ): { bestAction: Action | null; score: number } {
    this.aiPlayer = aiPlayer;
    const startTime = Date.now();
    const deadline = startTime + timeLimitMs;
    
    let bestActionGlobal: Action | null = null;
    let bestScoreGlobal = -Infinity;

    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        const { bestAction, score } = this.searchRoot(state, depth, deadline);
        if (bestAction !== null) {
          bestActionGlobal = bestAction;
          bestScoreGlobal = score;
        }
        
        if (Math.abs(score) > 90000) {
          break;
        }
      } catch (err) {
        if (err instanceof SearchTimeoutError) {
          break;
        }
        throw err;
      }
    }

    return { bestAction: bestActionGlobal, score: bestScoreGlobal };
  }

  private searchRoot(
    state: State,
    depth: number,
    deadline: number
  ): { bestAction: Action | null; score: number } {
    const actions = this.adapter.getValidActions(state);
    if (actions.length === 0) {
      return { bestAction: null, score: this.adapter.evaluateState(state, depth) };
    }

    const cacheKey = this.adapter.getHash(state);
    const ttEntry = this.tt.get(cacheKey);
    const orderedActions = this.adapter.orderActions(state, actions, ttEntry?.bestAction);

    let bestScore = -Infinity;
    let bestAction: Action | null = null;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const action of orderedActions) {
      const nextState = this.adapter.simulateAction(state, action);
      const score = this.minimax(nextState, depth - 1, alpha, beta, false, deadline);

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
      
      alpha = Math.max(alpha, bestScore);
    }

    if (bestAction) {
      this.tt.set(cacheKey, {
        depth,
        value: bestScore,
        flag: 'exact',
        bestAction
      });
    }

    return { bestAction, score: bestScore };
  }

  private minimax(
    state: State,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    deadline: number
  ): number {
    if (Date.now() > deadline) {
      throw new SearchTimeoutError();
    }

    const alphaOrig = alpha;
    const betaOrig = beta;

    if (depth === 0 || this.adapter.isGameOver(state)) {
      return this.adapter.evaluateState(state, depth);
    }

    const cacheKey = this.adapter.getHash(state);
    const ttEntry = this.tt.get(cacheKey);

    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 'exact') return ttEntry.value;
      if (ttEntry.flag === 'lower') alpha = Math.max(alpha, ttEntry.value);
      if (ttEntry.flag === 'upper') beta = Math.min(beta, ttEntry.value);
      if (alpha >= beta) return ttEntry.value;
    }

    const actions = this.adapter.getValidActions(state);
    if (actions.length === 0) {
      return isMaximizing ? -90000 : 90000;
    }

    const orderedActions = this.adapter.orderActions(state, actions, ttEntry?.bestAction);

    let bestScore = isMaximizing ? -Infinity : Infinity;
    let bestAction: Action | null = null;

    for (const action of orderedActions) {
      const nextState = this.adapter.simulateAction(state, action);
      
      if (isMaximizing) {
        const score = this.minimax(nextState, depth - 1, alpha, beta, false, deadline);
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        const score = this.minimax(nextState, depth - 1, alpha, beta, true, deadline);
        if (score < bestScore) {
          bestScore = score;
          bestAction = action;
        }
        beta = Math.min(beta, bestScore);
      }

      if (alpha >= beta) {
        break; // cutoff
      }
    }

    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    if (bestScore <= alphaOrig) flag = 'upper';
    else if (bestScore >= betaOrig) flag = 'lower';

    this.tt.set(cacheKey, {
      depth,
      value: bestScore,
      flag,
      bestAction: bestAction || undefined
    });

    return bestScore;
  }
}
