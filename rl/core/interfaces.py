from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, List, Optional
import numpy as np


class BaseEnv(ABC):
    """
    Abstract Base Class for Reinforcement Learning Game Environments.
    All custom game environments (Connect Four, Mill, etc.) must implement this interface
    for compatibility with the generic MCTS and training loops.
    """

    @abstractmethod
    def reset(self) -> BaseEnv:
        """Resets the environment to the initial state and returns self."""
        pass

    @abstractmethod
    def clone(self) -> BaseEnv:
        """Returns a deep copy of the environment state."""
        pass

    @abstractmethod
    def legal_actions(self) -> List[int]:
        """Returns a list of valid action indices in the current state."""
        pass

    @abstractmethod
    def is_terminal(self) -> bool:
        """Returns True if the game has ended (win/loss/draw), False otherwise."""
        pass

    @abstractmethod
    def step(self, action: int) -> BaseEnv:
        """
        Applies the action to the current state, updating the environment in-place.
        Must raise ValueError if the action is illegal.
        Returns self.
        """
        pass

    @abstractmethod
    def encode(self) -> np.ndarray:
        """
        Encodes the current state into a float32 numpy tensor suitable for the neural network.
        Typically shape: (channels, height, width).
        """
        pass

    @abstractmethod
    def outcome(self, player: int) -> Optional[float]:
        """
        Returns the game outcome from the perspective of `player` once terminal:
        +1.0 = win, -1.0 = loss, 0.0 = draw.
        Returns None if the game is not yet terminal.
        """
        pass

    @property
    @abstractmethod
    def turn(self) -> int:
        """
        Returns the ID of the current player whose turn it is to move.
        By convention: 1 for Player 1, -1 for Player 2.
        """
        pass

    @classmethod
    @abstractmethod
    def from_state_dict(cls, state: dict) -> BaseEnv:
        """Instantiates the environment from a JSON-serializable state dict."""
        pass

    @abstractmethod
    def to_state_dict(self) -> dict:
        """Serializes the environment into a JSON-serializable dict."""
        pass


class BaseNet(ABC):
    """
    Abstract Base Class for Neural Networks used in the AlphaZero framework.
    """

    @abstractmethod
    def predict(self, state_tensor: np.ndarray) -> tuple[np.ndarray, float]:
        """
        Evaluates a single state tensor (unbatched).
        Returns:
            policy_logits: 1D numpy array of raw logits for the action space.
            value: scalar float [-1, 1] predicting the outcome for the current player.
        """
        pass
