export const BOT_DESCRIPTIONS: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "Random Play",
    easy_cowardly: "Blocked-Avoidance & Defense",
    easy_greedy: "Material Hunter",
    easy_aggressive: "Mill Hunter",
    medium_aggressive: "Material & Mills",
    medium_defensive: "Threat Blocking",
    medium_mobile: "Piece Mobility",
    hard_tactical: "Minimax Depth 4",
    expert_garry: "Minimax Depth 5",
    legendary_magnus: "Minimax Depth 6",
    perfect_oracle: "Solved Openings & Positional Search",
  },
  connect_four: {
    easy_random: "Random Play",
    easy_cowardly: "Blocked-Avoidance & Defense",
    easy_greedy: "Material Hunter",
    easy_aggressive: "Line Hunter",
    medium_aggressive: "Center Control & Openings",
    medium_defensive: "Defensive Blocking",
    medium_mobile: "Spaced Alignment",
    hard_tactical: "Minimax Depth 4",
    expert_garry: "Minimax Depth 5",
    legendary_magnus: "Minimax Depth 6",
    perfect_oracle: "Center Alignment Search",
    rl_novice: "Neural Network (Depth 0)",
    rl_intermediate: "Neural Network + MCTS 50",
    rl_strong: "Neural Network + MCTS 200",
    rl_master: "Neural Network + MCTS 800",
  },
  holy_grail: {
    easy_random: "Random Play",
    medium_aggressive: "Positional & Combat",
    hard_tactical: "Tactical Search",
    expert_smart: "Lookahead 1-ply Simulation"
  }
};

export const BOT_EMOJIS: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "🟢",
    easy_cowardly: "🟢",
    easy_greedy: "🟢",
    easy_aggressive: "🟢",
    medium_aggressive: "🟡",
    medium_defensive: "🟡",
    medium_mobile: "🟡",
    hard_tactical: "🔴",
    expert_garry: "🔥",
    legendary_magnus: "👑",
    perfect_oracle: "🌌",
  },
  connect_four: {
    easy_random: "🟢",
    easy_cowardly: "🟢",
    easy_greedy: "🟢",
    easy_aggressive: "🟢",
    medium_aggressive: "🟡",
    medium_defensive: "🟡",
    medium_mobile: "🟡",
    hard_tactical: "🔴",
    expert_garry: "🔥",
    legendary_magnus: "👑",
    perfect_oracle: "🌌",
    rl_novice: "⚡",
    rl_intermediate: "⚡",
    rl_strong: "⚡",
    rl_master: "⚡",
  },
  holy_grail: {
    easy_random: "🟢",
    medium_aggressive: "🟡",
    hard_tactical: "🔴",
    expert_smart: "🌌"
  }
};

export const BOT_HELP_TEXT: Record<string, Record<string, string>> = {
  mill: {
    easy_random: "Randy plays completely random moves. Great for absolute beginners.",
    easy_cowardly: "Connie searches shallowly and hates getting blocked. Easy to maneuver around.",
    easy_greedy: "Gordon values material over safety. Trappable by planning ahead.",
    easy_aggressive: "Arthur pursues mill structures single-mindedly, often leaving his own pieces exposed.",
    medium_aggressive: "Archie uses 3 plies of search prioritizing making mills and material count.",
    medium_defensive: "Debbie searches 3 plies deep prioritizing blocking opponent threats.",
    medium_mobile: "Monty searches 3 plies deep prioritizing keeping his own pieces free.",
    hard_tactical: "Toby calculates 4 plies ahead. He will punish tactical mistakes.",
    expert_garry: "Garry evaluates 5 plies deep with optimized positional heuristics. A true challenge!",
    legendary_magnus: "Magnus calculates 6 plies deep with extremely optimized weights. Legendary level!",
    perfect_oracle: "The Oracle uses deep positional evaluation and solved center column openings for maximum control.",
  },
  connect_four: {
    easy_random: "Randy plays completely random moves. Great for absolute beginners.",
    easy_cowardly: "Connie searches shallowly and hates getting blocked. Easy to maneuver around.",
    easy_greedy: "Gordon values material over safety. Trappable by planning ahead.",
    easy_aggressive: "Arthur pursues line structures single-mindedly, often leaving his own pieces exposed.",
    medium_aggressive: "Archie searches 3 plies deep, prioritizing connecting pieces and center column alignment.",
    medium_defensive: "Debbie searches 3 plies deep, focusing on blocking opponent 3-in-a-row threats.",
    medium_mobile: "Monty searches 3 plies deep, focusing on maintaining flexible, non-blocked connections.",
    hard_tactical: "Toby calculates 4 plies ahead, focusing on blocking and creating alignment traps.",
    expert_garry: "Garry evaluates 5 plies deep with optimized positional heuristics. A true challenge!",
    legendary_magnus: "Magnus calculates 6 plies deep with extremely optimized weights. Legendary level!",
    perfect_oracle: "The Oracle uses deep positional evaluation and center column search for maximum control.",
    rl_novice: "⚡ Neural Novice uses a pure neural network (no lookahead) trained by AlphaZero-style self-play.",
    rl_intermediate: "⚡ Neural Scout combines a trained neural network with 50 MCTS simulations per move.",
    rl_strong: "⚡ Neural Strategist runs 200 MCTS simulations guided by a deep self-play trained network.",
    rl_master: "⚡ Neural Master runs 800 MCTS simulations. The strongest self-play trained bot on this platform.",
  },
  holy_grail: {
    easy_random: "Randy HG plays completely random moves.",
    medium_aggressive: "Archie HG plays a positional game targeting farms and bases.",
    hard_tactical: "Toby HG calculates moves and combat sequences.",
    expert_smart: "Sophia simulates all possible next moves and evaluates positions using detailed combat, farm, base, and Grail heuristics."
  }
};
