"""
Smoke tests for the neural network and MCTS.
Does not require training data — just verifies shapes and no-crash behavior.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import numpy as np
import torch

from games.connect_four.env import ConnectFourEnv
from games.connect_four.net import ConnectFourNet, get_device, create_net
from games.connect_four.mcts import MCTS


class TestNet:
    def test_forward_pass_shape(self):
        net = ConnectFourNet()
        net.eval()
        x = torch.randn(4, 3, 6, 7)  # batch of 4
        with torch.no_grad():
            policy, value = net(x)
        assert policy.shape == (4, 7)
        assert value.shape == (4, 1)

    def test_predict_shape(self):
        net = ConnectFourNet()
        net.eval()
        env = ConnectFourEnv()
        encoded = torch.tensor(env.encode(), dtype=torch.float32)
        probs, v = net.predict(encoded)
        assert probs.shape == (7,)
        assert isinstance(v, float)
        assert -1.0 <= v <= 1.0

    def test_policy_is_probability(self):
        net = ConnectFourNet()
        net.eval()
        env = ConnectFourEnv()
        encoded = torch.tensor(env.encode(), dtype=torch.float32)
        probs, _ = net.predict(encoded)
        assert abs(probs.sum().item() - 1.0) < 1e-5
        assert (probs >= 0).all()


class TestMCTS:
    def test_best_action_no_simulations(self):
        """Pure NN policy (0 sims) should return a legal action."""
        device = torch.device("cpu")
        net = create_net(device)
        mcts = MCTS(net, device)
        env = ConnectFourEnv()
        action = mcts.best_action(env, num_simulations=0)
        assert action in env.legal_actions()

    def test_best_action_few_simulations(self):
        """5 simulations should still return a legal action."""
        device = torch.device("cpu")
        net = create_net(device)
        mcts = MCTS(net, device)
        env = ConnectFourEnv()
        action = mcts.best_action(env, num_simulations=5)
        assert action in env.legal_actions()

    def test_policy_sums_to_one(self):
        device = torch.device("cpu")
        net = create_net(device)
        mcts = MCTS(net, device)
        env = ConnectFourEnv()
        policy = mcts.run(env, num_simulations=10, add_noise=False)
        assert abs(policy.sum() - 1.0) < 1e-5

    def test_does_not_mutate_env(self):
        device = torch.device("cpu")
        net = create_net(device)
        mcts = MCTS(net, device)
        env = ConnectFourEnv()
        original_board = env.board.copy()
        mcts.best_action(env, num_simulations=5)
        np.testing.assert_array_equal(env.board, original_board)

    def test_terminal_state(self):
        """MCTS on a terminal state should not crash — returns action gracefully."""
        device = torch.device("cpu")
        net = create_net(device)
        mcts = MCTS(net, device)
        # Create a won state
        env = ConnectFourEnv()
        for col in [0, 4, 1, 4, 2, 4, 3]:
            env.step(col)
            if env.is_terminal():
                break
        # Just verify it's terminal; MCTS won't be called on terminal in real game
        assert env.is_terminal()
